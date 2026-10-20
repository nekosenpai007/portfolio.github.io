/* Fluid cursor: a small WebGL fluid simulation that trails violet smoke behind the pointer.
   Adapted from Pavel Dobryakov's WebGL Fluid Simulation (MIT licence,
   https://github.com/PavelDoGreat/WebGL-Fluid-Simulation), the same base Inspira UI's
   Fluid Cursor uses. Runs only with a mouse/trackpad, never with reduced motion,
   and stops rendering when the pointer has been still for a few seconds. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  if (C.reducedMotion || !C.finePointer) return;

  var config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 720,
    DENSITY_DISSIPATION: 3.2,
    VELOCITY_DISSIPATION: 2,
    PRESSURE: 0.1,
    PRESSURE_ITERATIONS: 16,
    CURL: 3,
    SPLAT_RADIUS: 0.18,
    SPLAT_FORCE: 6000,
    COLOR_UPDATE_SPEED: 8,
    IDLE_MS: 3500
  };

  // weaker machines (≤4 cores or ≤4 GB memory): a lighter simulation that still looks the same
  if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) {
    config.SIM_RESOLUTION = 96;
    config.DYE_RESOLUTION = 512;
    config.PRESSURE_ITERATIONS = 10;
  }

  var canvas = document.createElement("canvas");
  canvas.className = "fluid-canvas";
  canvas.setAttribute("aria-hidden", "true");

  var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
  var gl = canvas.getContext("webgl2", params);
  var isWebGL2 = !!gl;
  if (!gl) gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);
  if (!gl) return;

  var halfFloat;
  var supportLinearFiltering;
  if (isWebGL2) {
    gl.getExtension("EXT_color_buffer_float");
    supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
  } else {
    halfFloat = gl.getExtension("OES_texture_half_float");
    supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
  }
  var halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;
  if (!halfFloatTexType || !supportLinearFiltering) return; // keep it simple: skip old GPUs

  gl.clearColor(0, 0, 0, 0);

  function supportRenderTextureFormat(internalFormat, format, type) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    return ok;
  }

  function getSupportedFormat(internalFormat, format, type) {
    if (!supportRenderTextureFormat(internalFormat, format, type)) {
      if (!isWebGL2) return null;
      if (internalFormat === gl.R16F) return getSupportedFormat(gl.RG16F, gl.RG, type);
      if (internalFormat === gl.RG16F) return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
      return null;
    }
    return { internalFormat: internalFormat, format: format };
  }

  var formatRGBA = getSupportedFormat(isWebGL2 ? gl.RGBA16F : gl.RGBA, gl.RGBA, halfFloatTexType);
  var formatRG = getSupportedFormat(isWebGL2 ? gl.RG16F : gl.RGBA, isWebGL2 ? gl.RG : gl.RGBA, halfFloatTexType);
  var formatR = getSupportedFormat(isWebGL2 ? gl.R16F : gl.RGBA, isWebGL2 ? gl.RED : gl.RGBA, halfFloatTexType);
  if (!formatRGBA || !formatRG || !formatR) return;

  /* ---------- shaders ---------- */

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function Program(vertexShader, fragmentSource) {
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    this.uniforms = {};
    var count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var name = gl.getActiveUniform(this.program, i).name;
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }

  Program.prototype.bind = function () {
    gl.useProgram(this.program);
  };

  var PRE = "precision highp float;\nprecision highp sampler2D;\n";

  var programs;
  try {
    var baseVertex = compile(gl.VERTEX_SHADER, PRE +
      "attribute vec2 aPosition;\n" +
      "varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
      "uniform vec2 texelSize;\n" +
      "void main () {\n" +
      "  vUv = aPosition * 0.5 + 0.5;\n" +
      "  vL = vUv - vec2(texelSize.x, 0.0);\n" +
      "  vR = vUv + vec2(texelSize.x, 0.0);\n" +
      "  vT = vUv + vec2(0.0, texelSize.y);\n" +
      "  vB = vUv - vec2(0.0, texelSize.y);\n" +
      "  gl_Position = vec4(aPosition, 0.0, 1.0);\n" +
      "}");

    programs = {
      clear: new Program(baseVertex, PRE +
        "varying vec2 vUv; uniform sampler2D uTexture; uniform float value;\n" +
        "void main () { gl_FragColor = value * texture2D(uTexture, vUv); }"),

      splat: new Program(baseVertex, PRE +
        "varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color;\n" +
        "uniform vec2 point; uniform float radius;\n" +
        "void main () {\n" +
        "  vec2 p = vUv - point.xy; p.x *= aspectRatio;\n" +
        "  vec3 splat = exp(-dot(p, p) / radius) * color;\n" +
        "  vec3 base = texture2D(uTarget, vUv).xyz;\n" +
        "  gl_FragColor = vec4(base + splat, 1.0);\n" +
        "}"),

      advection: new Program(baseVertex, PRE +
        "varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;\n" +
        "uniform vec2 texelSize; uniform float dt; uniform float dissipation;\n" +
        "void main () {\n" +
        "  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;\n" +
        "  vec4 result = texture2D(uSource, coord);\n" +
        "  gl_FragColor = result / (1.0 + dissipation * dt);\n" +
        "}"),

      divergence: new Program(baseVertex, PRE +
        "varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
        "uniform sampler2D uVelocity;\n" +
        "void main () {\n" +
        "  float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;\n" +
        "  float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;\n" +
        "  vec2 C = texture2D(uVelocity, vUv).xy;\n" +
        "  if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; }\n" +
        "  if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }\n" +
        "  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);\n" +
        "}"),

      curl: new Program(baseVertex, PRE +
        "varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
        "uniform sampler2D uVelocity;\n" +
        "void main () {\n" +
        "  float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;\n" +
        "  float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;\n" +
        "  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);\n" +
        "}"),

      vorticity: new Program(baseVertex, PRE +
        "varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
        "uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;\n" +
        "void main () {\n" +
        "  float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;\n" +
        "  float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;\n" +
        "  float C = texture2D(uCurl, vUv).x;\n" +
        "  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n" +
        "  force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;\n" +
        "  vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;\n" +
        "  velocity = min(max(velocity, -1000.0), 1000.0);\n" +
        "  gl_FragColor = vec4(velocity, 0.0, 1.0);\n" +
        "}"),

      pressure: new Program(baseVertex, PRE +
        "varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
        "uniform sampler2D uPressure; uniform sampler2D uDivergence;\n" +
        "void main () {\n" +
        "  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;\n" +
        "  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;\n" +
        "  float divergence = texture2D(uDivergence, vUv).x;\n" +
        "  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);\n" +
        "}"),

      gradient: new Program(baseVertex, PRE +
        "varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
        "uniform sampler2D uPressure; uniform sampler2D uVelocity;\n" +
        "void main () {\n" +
        "  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;\n" +
        "  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;\n" +
        "  vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);\n" +
        "  gl_FragColor = vec4(velocity, 0.0, 1.0);\n" +
        "}"),

      display: new Program(baseVertex, PRE +
        "varying vec2 vUv; uniform sampler2D uTexture;\n" +
        "void main () {\n" +
        "  vec3 c = texture2D(uTexture, vUv).rgb;\n" +
        "  float a = max(c.r, max(c.g, c.b));\n" +
        "  gl_FragColor = vec4(c, a);\n" +
        "}")
    };
  } catch (err) {
    return; // shader compile failure: no fluid, the page works the same
  }

  /* ---------- geometry ---------- */

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function blit(target) {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  /* ---------- framebuffers ---------- */

  function createFBO(w, h, internalFormat, format, type, filter) {
    gl.activeTexture(gl.TEXTURE0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture: texture,
      fbo: fbo,
      width: w,
      height: h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
      destroy: function () {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(texture);
      }
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, filter) {
    var a = createFBO(w, h, internalFormat, format, type, filter);
    var b = createFBO(w, h, internalFormat, format, type, filter);
    return {
      width: w,
      height: h,
      texelSizeX: a.texelSizeX,
      texelSizeY: a.texelSizeY,
      get read() { return a; },
      get write() { return b; },
      swap: function () { var t = a; a = b; b = t; },
      destroy: function () { a.destroy(); b.destroy(); }
    };
  }

  function getResolution(resolution) {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    var min = Math.round(resolution);
    var max = Math.round(resolution * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min }
      : { width: min, height: max };
  }

  var dye, velocity, divergence, curl, pressure;

  function initFramebuffers() {
    var simRes = getResolution(config.SIM_RESOLUTION);
    var dyeRes = getResolution(config.DYE_RESOLUTION);
    var type = halfFloatTexType;
    gl.disable(gl.BLEND);
    [dye, velocity, divergence, curl, pressure].forEach(function (f) { if (f) f.destroy(); });
    dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, type, gl.LINEAR);
    velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, type, gl.LINEAR);
    divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, type, gl.NEAREST);
    curl = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, type, gl.NEAREST);
    pressure = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, type, gl.NEAREST);
  }

  /* ---------- simulation ---------- */

  function step(dt) {
    gl.disable(gl.BLEND);
    var tx = velocity.texelSizeX;
    var ty = velocity.texelSizeY;
    var p;

    p = programs.curl; p.bind();
    gl.uniform2f(p.uniforms.texelSize, tx, ty);
    gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    p = programs.vorticity; p.bind();
    gl.uniform2f(p.uniforms.texelSize, tx, ty);
    gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(p.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(p.uniforms.curl, config.CURL);
    gl.uniform1f(p.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    p = programs.divergence; p.bind();
    gl.uniform2f(p.uniforms.texelSize, tx, ty);
    gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    p = programs.clear; p.bind();
    gl.uniform1i(p.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(p.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    p = programs.pressure; p.bind();
    gl.uniform2f(p.uniforms.texelSize, tx, ty);
    gl.uniform1i(p.uniforms.uDivergence, divergence.attach(0));
    for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(p.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    p = programs.gradient; p.bind();
    gl.uniform2f(p.uniforms.texelSize, tx, ty);
    gl.uniform1i(p.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    p = programs.advection; p.bind();
    gl.uniform2f(p.uniforms.texelSize, tx, ty);
    var velocityId = velocity.read.attach(0);
    gl.uniform1i(p.uniforms.uVelocity, velocityId);
    gl.uniform1i(p.uniforms.uSource, velocityId);
    gl.uniform1f(p.uniforms.dt, dt);
    gl.uniform1f(p.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(p.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(p.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    var p = programs.display;
    p.bind();
    gl.uniform1i(p.uniforms.uTexture, dye.read.attach(0));
    blit(null);
  }

  function correctRadius(radius) {
    var aspect = canvas.width / canvas.height;
    return aspect > 1 ? radius * aspect : radius;
  }

  function splat(x, y, dx, dy, color) {
    var p = programs.splat;
    p.bind();
    gl.uniform1i(p.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(p.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(p.uniforms.point, x, y);
    gl.uniform3f(p.uniforms.color, dx, dy, 0);
    gl.uniform1f(p.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100));
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(p.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(p.uniforms.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
  }

  /* ---------- colour: violets, with the odd indigo ---------- */

  function hsv(h, s, v) {
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    var rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return { r: rgb[0], g: rgb[1], b: rgb[2] };
  }

  function generateColor() {
    var hue = Math.random() < 0.2 ? 0.66 + Math.random() * 0.04 : 0.72 + Math.random() * 0.1;
    var c = hsv(hue, 0.85, 1);
    var k = C.theme && C.theme() === "xray" ? 0.26 : 0.2;
    c.r *= k; c.g *= k; c.b *= k;
    return c;
  }

  /* ---------- input + loop ---------- */

  var pointer = { x: 0, y: 0, prevX: 0, prevY: 0, dx: 0, dy: 0, moved: false, down: false, color: generateColor(), seen: false };
  var lastTime = performance.now();
  var colorTimer = 0;
  var lastInput = 0;
  var running = false;
  var raf = 0;

  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.floor(window.innerWidth * dpr);
    var h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      initFramebuffers();
    }
  }

  function frame(now) {
    var dt = Math.min((now - lastTime) / 1000, 0.016666);
    lastTime = now;

    colorTimer += dt * config.COLOR_UPDATE_SPEED;
    if (colorTimer >= 1) {
      colorTimer %= 1;
      pointer.color = generateColor();
    }

    if (pointer.moved) {
      pointer.moved = false;
      splat(pointer.x, pointer.y, pointer.dx * config.SPLAT_FORCE, pointer.dy * config.SPLAT_FORCE, pointer.color);
    }

    step(dt);
    render();

    if (now - lastInput > config.IDLE_MS || document.hidden) {
      running = false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function wake() {
    lastInput = performance.now();
    if (running) return;
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function onMove(e) {
    var dpr = canvas.width / window.innerWidth;
    var x = (e.clientX * dpr) / canvas.width;
    var y = 1 - (e.clientY * dpr) / canvas.height;
    pointer.prevX = pointer.seen ? pointer.x : x;
    pointer.prevY = pointer.seen ? pointer.y : y;
    pointer.seen = true;
    pointer.x = x;
    pointer.y = y;
    var aspect = canvas.width / canvas.height;
    var dx = pointer.x - pointer.prevX;
    var dy = pointer.y - pointer.prevY;
    if (aspect < 1) dx *= aspect;
    if (aspect > 1) dy /= aspect;
    pointer.dx = dx;
    pointer.dy = dy;
    pointer.moved = Math.abs(dx) > 0 || Math.abs(dy) > 0;
    wake();
  }

  function onDown(e) {
    if (e.button !== 0) return;
    var dpr = canvas.width / window.innerWidth;
    var c = generateColor();
    c.r *= 8; c.g *= 8; c.b *= 8;
    wake();
    splat((e.clientX * dpr) / canvas.width, 1 - (e.clientY * dpr) / canvas.height,
      10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5), c);
  }

  function start() {
    document.body.appendChild(canvas);
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse" || e.pointerType === "pen") onMove(e);
    }, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
