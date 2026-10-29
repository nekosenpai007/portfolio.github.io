/* Loader: violet particles swirl in, settle into a glassy "c", then the "c" flies
   into the header wordmark and the page is revealed.
   Shown once per browser session. The head script only adds .is-loading when it
   should run (not with reduced motion, not on a repeat visit in the same session).
   Fires "cipher:loaded" on document when the page is revealed. */
(function () {
  "use strict";

  var root = document.documentElement;
  var C = (window.Cipher = window.Cipher || {});
  var done = false;

  /* Run fn once the page is visible: right away when there is no loader. */
  C.afterLoad = function (fn) {
    if (done || !root.classList.contains("is-loading")) {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("cipher:loaded", function () { fn(); }, { once: true });
    }
  };

  var el = document.querySelector(".loader");

  function finish() {
    if (done) return;
    done = true;
    root.classList.remove("is-loading");
    try { sessionStorage.setItem("cipher-loaded", "1"); } catch (e) {}
    if (el && el.parentNode) el.parentNode.removeChild(el);
    document.dispatchEvent(new CustomEvent("cipher:loaded"));
  }

  if (!el || !root.classList.contains("is-loading")) {
    done = true;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    return;
  }

  var failsafe = setTimeout(finish, 7000);
  var canvas = el.querySelector("canvas");
  var count = el.querySelector(".loader-count b");
  var ctx = canvas.getContext("2d");
  if (!ctx) { finish(); return; }

  var wordEl = document.querySelector(".site-header .wordmark");
  var family = getComputedStyle(wordEl || document.body).fontFamily;
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  function size() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();

  var COLORS = ["#8b3dff", "#a66bff", "#6d5dfc", "#c4a6ff", "#5b3fd9", "#e2d4ff"];
  var particles = [];
  var targets = [];
  var glyphBox = { x: 0, y: 0, size: 0 };

  /* Sample points from a big "c" drawn off-screen: mostly the outline, some fill. */
  function sampleGlyph() {
    var fontSize = Math.round(Math.min(W, H) * 0.62);
    var off = document.createElement("canvas");
    var ow = Math.round(fontSize * 0.9), oh = Math.round(fontSize * 1.1);
    off.width = ow;
    off.height = oh;
    var o = off.getContext("2d");
    o.fillStyle = "#fff";
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.font = "600 " + fontSize + "px " + family;
    o.fillText("c", ow / 2, oh / 2);
    var data = o.getImageData(0, 0, ow, oh).data;
    var edge = [], fill = [];
    var stepPx = Math.max(3, Math.round(fontSize / 120));
    function a(x, y) { return x < 0 || y < 0 || x >= ow || y >= oh ? 0 : data[(y * ow + x) * 4 + 3]; }
    for (var y = 0; y < oh; y += stepPx) {
      for (var x = 0; x < ow; x += stepPx) {
        if (a(x, y) < 128) continue;
        var isEdge = a(x - stepPx, y) < 128 || a(x + stepPx, y) < 128 || a(x, y - stepPx) < 128 || a(x, y + stepPx) < 128;
        (isEdge ? edge : fill).push({ x: x - ow / 2, y: y - oh / 2, edge: isEdge });
      }
    }
    for (var i = fill.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = fill[i]; fill[i] = fill[j]; fill[j] = t;
    }
    targets = edge.concat(fill.slice(0, Math.round(edge.length * 0.6)));
    glyphBox.size = fontSize;
    glyphBox.x = W / 2;
    glyphBox.y = H / 2;
  }

  function makeParticles() {
    var n = Math.min(targets.length, W < 700 ? 700 : 1400);
    var R = Math.max(W, H) * 0.62;
    particles = [];
    for (var i = 0; i < n; i++) {
      var t = targets[Math.floor((i / n) * targets.length)];
      var k = Math.random();                       // position along the spiral arm
      var jitter = (Math.random() - 0.5) * 0.22;   // ribbon thickness
      particles.push({
        tx: glyphBox.x + t.x,
        ty: glyphBox.y + t.y,
        edge: t.edge,
        ang: k * Math.PI * 2.6 + jitter,
        rad: R * (0.18 + 0.82 * k) * (1 + jitter * 0.6),
        spin: 1.6 - k * 0.6,
        x: 0,
        y: 0,
        size: t.edge ? 1.1 + Math.random() * 1.3 : 0.7 + Math.random() * 0.9,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        delay: Math.random() * 0.35
      });
    }
  }

  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  var start = 0;
  var SWIRL = 1200, GATHER = 1100, HOLD = 450;

  function draw(now) {
    if (!start) start = now;
    var t = now - start;
    ctx.clearRect(0, 0, W, H);

    var gather = clamp01((t - SWIRL * 0.55) / GATHER);
    var fade = clamp01((t - SWIRL - GATHER) / HOLD);

    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var local = clamp01((gather - p.delay * 0.6) / (1 - p.delay * 0.6));
      var e = easeInOut(local);
      // swirl: particles orbit in a tightening spiral around the centre
      var ang = p.ang + (t / 1000) * p.spin;
      var rad = p.rad * (1 - 0.55 * clamp01(t / (SWIRL + GATHER)));
      var sx = W / 2 + Math.cos(ang) * rad;
      var sy = H / 2 + Math.sin(ang) * rad * 0.62;
      p.x = sx + (p.tx - sx) * e;
      p.y = sy + (p.ty - sy) * e;
      var alpha = (0.35 + 0.65 * Math.min(1, t / 500)) * (1 - fade * (p.edge ? 0.6 : 1));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - e) * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    var pct = Math.round(clamp01(t / (SWIRL + GATHER)) * 100);
    if (count) count.textContent = (pct < 10 ? "00" : pct < 100 ? "0" : "") + pct;

    if (fade > 0) drawGlyph(glyphBox.x, glyphBox.y, 1, fade);

    if (t < SWIRL + GATHER + HOLD) {
      requestAnimationFrame(draw);
    } else {
      flyToWordmark();
    }
  }

  function drawGlyph(cx, cy, scale, alpha) {
    var size = glyphBox.size * scale;
    var g = ctx.createLinearGradient(cx - size * 0.4, cy - size * 0.45, cx + size * 0.4, cy + size * 0.45);
    g.addColorStop(0, "#f1e9ff");
    g.addColorStop(0.28, "#b794ff");
    g.addColorStop(0.52, "#8b3dff");
    g.addColorStop(0.78, "#3b1d8f");
    g.addColorStop(1, "#c4a6ff");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "600 " + size + "px " + family;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(139, 61, 255, 0.55)";
    ctx.shadowBlur = 48 * scale;
    ctx.fillStyle = g;
    ctx.fillText("c", cx, cy);
    ctx.restore();
  }

  /* Fly the big "c" onto the wordmark's "c" while the page fades in underneath. */
  function flyToWordmark() {
    el.classList.add("is-leaving");
    var word = document.querySelector(".site-header .wordmark");
    var node = word && word.firstChild;
    if (!node || node.nodeType !== 3) {
      setTimeout(finish, 500);
      return;
    }
    var range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 1);
    var r = range.getBoundingClientRect();
    var tx = r.left + r.width / 2;
    var ty = r.top + r.height / 2;
    var endScale = parseFloat(getComputedStyle(word).fontSize) / glyphBox.size;
    var t0 = 0;
    var DUR = 850;

    function fly(now) {
      if (!t0) t0 = now;
      var k = clamp01((now - t0) / DUR);
      var e = easeInOut(k);
      ctx.clearRect(0, 0, W, H);
      var scale = 1 + (endScale - 1) * e;
      var alpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      drawGlyph(glyphBox.x + (tx - glyphBox.x) * e, glyphBox.y + (ty - glyphBox.y) * e, scale, alpha);
      if (k < 1) requestAnimationFrame(fly);
      else finish();
    }
    requestAnimationFrame(fly);
  }

  function begin() {
    size();
    // no viewport yet (background tab, hidden frame, preview bot): skip the intro
    if (W < 1 || H < 1) { clearTimeout(failsafe); finish(); return; }
    sampleGlyph();
    if (!targets.length) { clearTimeout(failsafe); finish(); return; }
    makeParticles();
    requestAnimationFrame(draw);
  }

  var fontReady = document.fonts && document.fonts.load
    ? Promise.race([
        document.fonts.load("600 100px 'Space Grotesk'"),
        new Promise(function (r) { setTimeout(r, 1200); })
      ])
    : Promise.resolve();

  fontReady.then(begin, begin);

  window.addEventListener("resize", function () {
    if (!done) size();
  });

  // clicking skips the intro
  el.addEventListener("click", function () {
    clearTimeout(failsafe);
    finish();
  });
})();
