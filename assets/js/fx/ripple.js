/* Card hover effects, after juncastudio.com:
   - a "VIEW …" label that trails the pointer over any [data-cursor] element
   - water ripples with RGB split on any [data-ripple] media box, drawn by one shared
     WebGL canvas that moves into whichever box is hovered.
   The ripple works from a snapshot of what the box shows (its background plus its
   <img>, respecting object-fit), so it suits logos, photos and SVG covers alike.
   Mouse/trackpad only; nothing runs with reduced motion or on touch screens. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  if (C.reducedMotion || !C.finePointer) return;

  var root = document.documentElement;
  root.classList.add("has-fx-cursor");

  /* ---------- view cursor ---------- */

  var cursor = document.createElement("div");
  cursor.className = "view-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<span class="vc-label"></span><span class="vc-icon"><svg viewBox="0 0 16 16"><path d="M5 11 11 5M6 5h5v5"/></svg></span>';
  var label = cursor.querySelector(".vc-label");
  var px = -100, py = -100, cxp = -100, cyp = -100, cursorOn = false, cursorRaf = 0;

  function cursorLoop() {
    cxp += (px - cxp) * 0.18;
    cyp += (py - cyp) * 0.18;
    cursor.style.transform = "translate3d(" + cxp.toFixed(1) + "px," + cyp.toFixed(1) + "px,0)";
    if (cursorOn || Math.abs(px - cxp) > 0.5 || Math.abs(py - cyp) > 0.5) {
      cursorRaf = requestAnimationFrame(cursorLoop);
    } else {
      cursorRaf = 0;
    }
  }

  function showCursor(text, x, y) {
    if (!cursorOn) {
      cxp = x;
      cyp = y;
    }
    label.textContent = text;
    cursorOn = true;
    cursor.classList.add("is-on");
    if (!cursorRaf) cursorRaf = requestAnimationFrame(cursorLoop);
  }

  function hideCursor() {
    cursorOn = false;
    cursor.classList.remove("is-on");
  }

  /* ---------- WebGL ripple ---------- */

  var canvas = document.createElement("canvas");
  canvas.className = "ripple-canvas";
  canvas.setAttribute("aria-hidden", "true");
  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
  var prog = null, uni = {}, texture = null;

  var MAX_DROPS = 8;

  if (gl) {
    var vsrc = "attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }";
    var fsrc = [
      "precision highp float;",
      "varying vec2 uv;",
      "uniform sampler2D tex;",
      "uniform vec2 res;",
      "uniform float time;",
      "uniform float strength;",
      "uniform vec3 drops[" + MAX_DROPS + "];", // x, y (0..1), start time (s); start < 0 = unused
      "void main(){",
      "  float aspect = res.x / res.y;",
      "  vec2 offset = vec2(0.0);",
      "  for (int i = 0; i < " + MAX_DROPS + "; i++) {",
      "    vec3 d = drops[i];",
      "    if (d.z < 0.0) continue;",
      "    float age = time - d.z;",
      "    if (age < 0.0 || age > 2.4) continue;",
      "    vec2 dir = uv - d.xy; dir.x *= aspect;",
      "    float dist = length(dir);",
      "    float front = age * 0.42;",                       // ring radius grows over time
      "    float band = smoothstep(front + 0.02, front - 0.02, dist) * smoothstep(0.0, 0.05, dist);",
      "    float wave = sin(dist * 70.0 - age * 14.0) * band;",
      "    float decay = exp(-age * 1.6) * exp(-dist * 2.2);",
      "    offset += (dist > 0.0001 ? dir / dist : vec2(0.0)) * wave * decay * 0.022;",
      "  }",
      "  offset *= strength;",
      "  offset.x /= aspect;",
      "  vec2 zoom = (uv - 0.5) * (1.0 - 0.025 * strength) + 0.5;",
      "  float r = texture2D(tex, zoom + offset * 1.0).r;",
      "  float g = texture2D(tex, zoom + offset * 1.6).g;",
      "  float b = texture2D(tex, zoom + offset * 2.3).b;",
      "  float a = texture2D(tex, zoom + offset).a;",
      "  gl_FragColor = vec4(r, g, b, a);",
      "}"
    ].join("\n");

    try {
      prog = gl.createProgram();
      [[gl.VERTEX_SHADER, vsrc], [gl.FRAGMENT_SHADER, fsrc]].forEach(function (pair) {
        var sh = gl.createShader(pair[0]);
        gl.shaderSource(sh, pair[1]);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(prog, sh);
      });
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      ["tex", "res", "time", "strength", "drops"].forEach(function (n) {
        uni[n] = gl.getUniformLocation(prog, n);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } catch (e) {
      prog = null;
    }
  }

  var snap = document.createElement("canvas");
  var sctx = snap.getContext("2d");

  /* Draw exactly what the media box shows into the snapshot canvas. */
  function snapshot(box, w, h, dpr) {
    snap.width = Math.round(w * dpr);
    snap.height = Math.round(h * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bg = getComputedStyle(box).backgroundColor;
    sctx.clearRect(0, 0, w, h);
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
      sctx.fillStyle = bg;
      sctx.fillRect(0, 0, w, h);
    }
    var img = box.querySelector("img");
    if (!img || !img.complete || !img.naturalWidth) return false;
    var br = box.getBoundingClientRect();
    var ir = img.getBoundingClientRect();
    var ix = ir.left - br.left, iy = ir.top - br.top, iw = ir.width, ih = ir.height;
    var cs = getComputedStyle(img);
    var fit = cs.objectFit;
    var nw = img.naturalWidth, nh = img.naturalHeight;
    // the image's own padding shrinks its content box
    var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    var pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    ix += pl; iy += pt; iw -= pl + pr; ih -= pt + pb;
    var scale = fit === "contain" ? Math.min(iw / nw, ih / nh) : fit === "cover" ? Math.max(iw / nw, ih / nh) : 0;
    try {
      sctx.save();
      sctx.beginPath();
      sctx.rect(ix, iy, iw, ih);
      sctx.clip();
      if (scale) {
        var dw = nw * scale, dh = nh * scale;
        sctx.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
      } else {
        sctx.drawImage(img, ix, iy, iw, ih);
      }
      sctx.restore();
      return true;
    } catch (e) {
      return false;
    }
  }

  var active = null;      // the hovered media box
  var drops = [];
  var strength = 0, target = 0;
  var rippleRaf = 0;
  var t0 = performance.now();
  var lastDrop = { x: -1, y: -1, t: 0 };

  function now() { return (performance.now() - t0) / 1000; }

  function addDrop(x, y) {
    drops.push([x, y, now()]);
    if (drops.length > MAX_DROPS) drops.shift();
  }

  function rippleLoop() {
    strength += (target - strength) * 0.12;
    var flat = new Float32Array(MAX_DROPS * 3);
    for (var i = 0; i < MAX_DROPS; i++) {
      var d = drops[i];
      flat[i * 3] = d ? d[0] : 0;
      flat[i * 3 + 1] = d ? d[1] : 0;
      flat[i * 3 + 2] = d ? d[2] : -1;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uni.res, canvas.width, canvas.height);
    gl.uniform1f(uni.time, now());
    gl.uniform1f(uni.strength, strength);
    gl.uniform3fv(uni.drops, flat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (target === 0 && strength < 0.02) {
      canvas.classList.remove("is-on");
      if (active) active.classList.remove("is-rippling");
      active = null;
      rippleRaf = 0;
      return;
    }
    rippleRaf = requestAnimationFrame(rippleLoop);
  }

  function startRipple(box, e) {
    if (!prog) return;
    var r = box.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!snapshot(box, r.width, r.height, dpr)) return;
    if (active && active !== box) active.classList.remove("is-rippling");
    active = box;
    canvas.width = snap.width;
    canvas.height = snap.height;
    if (canvas.parentNode !== box) box.appendChild(canvas); // sits under the box's tags
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snap);
    drops = [];
    addDrop((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    target = 1;
    canvas.classList.add("is-on");
    box.classList.add("is-rippling");
    if (!rippleRaf) rippleRaf = requestAnimationFrame(rippleLoop);
  }

  /* ---------- pointer wiring ---------- */

  var currentCursorEl = null;

  document.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    px = e.clientX;
    py = e.clientY;

    var el = e.target.closest ? e.target.closest("[data-cursor]") : null;
    if (el !== currentCursorEl) {
      currentCursorEl = el;
      if (el) showCursor(el.getAttribute("data-cursor"), px, py);
      else hideCursor();
    }

    var box = e.target.closest ? e.target.closest("[data-ripple]") : null;
    if (box && box !== active) {
      startRipple(box, e);
    } else if (!box && active && target) {
      target = 0;
    }
    if (box && box === active) {
      target = 1;
      var r = box.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      var t = now();
      var moved = Math.abs(x - lastDrop.x) + Math.abs(y - lastDrop.y);
      if (t - lastDrop.t > 0.16 && moved > 0.04) {
        addDrop(x, y);
        lastDrop = { x: x, y: y, t: t };
      }
    }
  }, { passive: true });

  document.addEventListener("pointerleave", function () {
    hideCursor();
    target = 0;
  });

  function mount() {
    document.body.appendChild(cursor);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
