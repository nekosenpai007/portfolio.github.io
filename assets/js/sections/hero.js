/* hero — the lens, the pixel ruler, the typing line and flag 1.
   The X-ray layer is a second copy of the hero layout; the lens reveals it
   through clip-path: circle(var(--hero-lens-r) at var(--hero-lx) var(--hero-ly)). */
(function () {
  "use strict";

  var hero = document.getElementById("home");
  if (!hero || !hero.classList.contains("sec--hero")) return;

  var paper = hero.querySelector(".hero-paper");
  var xray = hero.querySelector(".hero-xray");
  var lens = hero.querySelector(".hero-lens");
  var title = paper && paper.querySelector(".hero-title");
  if (!paper || !xray || !lens || !title) return;

  var C = window.Cipher || {};
  var reduced = !!C.reducedMotion;
  var finePointer = C.finePointer !== undefined
    ? !!C.finePointer
    : window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var readX = lens.querySelector("[data-lens-x]");
  var readY = lens.querySelector("[data-lens-y]");
  var handle = lens.querySelector(".hero-lens-handle");
  var flagEl = xray.querySelector(".hx-flag");
  var hint = hero.querySelector(".hero-hint");

  var FLAG_ID = "look_closer";
  var HINT_KEY = "cipher-lens-hint";

  /* ---------- helpers ---------- */

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /* Position of el inside the hero, ignoring transforms (entrance animations). */
  function posIn(el) {
    var x = 0;
    var y = 0;
    while (el && el !== hero) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent;
    }
    return { x: x, y: y };
  }

  function toHex(color) {
    var m = String(color).match(/[\d.]+/g);
    if (!m || m.length < 3) return color;
    return "#" + m.slice(0, 3).map(function (n) {
      var h = Math.round(+n).toString(16);
      return h.length < 2 ? "0" + h : h;
    }).join("");
  }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
    return null;
  }

  /* ---------- lens ring ticks ---------- */

  var tickGroup = lens.querySelector(".hero-lens-ticks");
  if (tickGroup && !tickGroup.firstChild) {
    var ticks = "";
    for (var i = 0; i < 72; i++) {
      var a = (i * 5 * Math.PI) / 180;
      var major = i % 18 === 0;
      var mid = i % 6 === 0;
      var r1 = 124;
      var r2 = major ? 139 : mid ? 133 : 129;
      var c = Math.cos(a);
      var s = Math.sin(a);
      ticks += '<line x1="' + (c * r1).toFixed(2) + '" y1="' + (s * r1).toFixed(2) +
        '" x2="' + (c * r2).toFixed(2) + '" y2="' + (s * r2).toFixed(2) + '"' +
        (major ? ' class="is-major"' : "") + "/>";
    }
    tickGroup.innerHTML = ticks;
  }

  /* ---------- geometry ---------- */

  var geo = { w: 0, h: 0, restX: 0, restY: 0, rRest: 120, rPress: 210, fx: -1e4, fy: -1e4, fr: 0 };
  var rulerH = 0;
  var rulers = hero.querySelectorAll(".hero-ruler-labels");

  function drawRulers(h) {
    if (h === rulerH) return;
    rulerH = h;
    var html = "";
    for (var v = 64; v <= h - 16; v += 64) {
      html += '<span style="top:' + v + 'px">' + v + "</span>";
    }
    Array.prototype.forEach.call(rulers, function (el) { el.innerHTML = html; });
  }

  function setText(sel, text) {
    var el = xray.querySelector(sel);
    if (el && el.textContent !== text) el.textContent = text;
  }

  /* Live specs inside the X-ray layer, e.g. "Heading 640×115" and "104/100 px · #121214". */
  function updateSpecs() {
    var tcs = getComputedStyle(title);
    setText('[data-hx="title-size"]', title.offsetWidth + "×" + title.offsetHeight);
    setText('[data-hx="title-type"]', Math.round(parseFloat(tcs.fontSize)) + "/" +
      Math.round(parseFloat(tcs.lineHeight)) + " px · " + toHex(tcs.color));

    var lead = paper.querySelector(".hero-lead");
    if (lead) {
      var lcs = getComputedStyle(lead);
      setText('[data-hx="lead-size"]', lead.offsetWidth + "×" + lead.offsetHeight);
      setText('[data-hx="lead-type"]', Math.round(parseFloat(lcs.fontSize)) + "/" +
        Math.round(parseFloat(lcs.lineHeight)) + " px · Space Grotesk");
    }

    var media = paper.querySelector(".hero-media");
    if (media) setText('[data-hx="media-size"]', media.offsetWidth + "×" + media.offsetHeight);

    var btn = paper.querySelector(".hero-actions .btn-pill");
    if (btn) setText('[data-hx="btn-size"]', btn.offsetWidth + "×" + btn.offsetHeight);
  }

  function measure() {
    geo.w = hero.offsetWidth;
    geo.h = hero.offsetHeight;

    var cs = getComputedStyle(hero);
    geo.rRest = parseFloat(cs.getPropertyValue("--hero-r-rest")) || 120;
    geo.rPress = parseFloat(cs.getPropertyValue("--hero-r-press")) || 210;

    /* rest: over the start of the headline, showing its spec labels above */
    var t = posIn(title);
    geo.restX = t.x + geo.rRest * 0.6;
    geo.restY = t.y + title.offsetHeight * 0.18;

    if (flagEl) {
      var f = posIn(flagEl);
      geo.fx = f.x + flagEl.offsetWidth / 2;
      geo.fy = f.y + flagEl.offsetHeight / 2;
      geo.fr = Math.max(flagEl.offsetWidth, flagEl.offsetHeight) / 2;
    }

    drawRulers(geo.h);
    updateSpecs();

    if (st.mode === "rest") {
      st.tx = geo.restX;
      st.ty = geo.restY;
      if (!started) {
        st.x = st.tx;
        st.y = st.ty;
        apply();
      } else {
        kick();
      }
    } else if (st.mode === "placed") {
      st.tx = clamp(st.tx, 0, geo.w);
      st.ty = clamp(st.ty, 0, geo.h);
      kick();
    }
  }

  /* ---------- state + render loop ---------- */

  var st = {
    x: 0, y: 0, tx: 0, ty: 0,
    mode: "rest",          // rest | follow | drag | placed
    pressed: false,
    cx: 0, cy: 0,          // last client position of the mouse
    gx: 0, gy: 0,          // grab offset while dragging
    dragId: null,
    cover: 0,
    captured: !!(C.flags && C.flags.has && C.flags.has(FLAG_ID))
  };
  var started = false;
  var visible = true;
  var raf = 0;
  var lastT = 0;
  var shownX = null;
  var shownY = null;

  if (st.captured && flagEl) flagEl.classList.add("is-captured");

  function apply() {
    var xs = st.x.toFixed(1) + "px";
    var ys = st.y.toFixed(1) + "px";
    xray.style.setProperty("--hero-lx", xs);
    xray.style.setProperty("--hero-ly", ys);
    lens.style.setProperty("--hero-lx", xs);
    lens.style.setProperty("--hero-ly", ys);
    var rx = Math.round(st.x);
    var ry = Math.round(st.y);
    if (readX && rx !== shownX) { readX.textContent = rx; shownX = rx; }
    if (readY && ry !== shownY) { readY.textContent = ry; shownY = ry; }
  }

  function tau() {
    if (st.mode === "drag") return 45;
    if (st.mode === "follow") return 110;
    return 170;
  }

  function frame(t) {
    raf = 0;
    var dt = lastT ? Math.min(64, t - lastT) : 16;
    lastT = t;
    var k = 1 - Math.exp(-dt / tau());
    st.x += (st.tx - st.x) * k;
    st.y += (st.ty - st.y) * k;
    var settled = Math.abs(st.tx - st.x) < 0.15 && Math.abs(st.ty - st.y) < 0.15;
    if (settled) {
      st.x = st.tx;
      st.y = st.ty;
    }
    apply();
    var watching = checkFlag(dt);
    if (!settled || watching) schedule();
    else lastT = 0;
  }

  function schedule() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  var reducedFlagTimer = 0;

  function kick() {
    if (reduced) {
      st.x = st.tx;
      st.y = st.ty;
      apply();
      clearTimeout(reducedFlagTimer);
      if (covering()) {
        reducedFlagTimer = setTimeout(function () {
          if (covering()) capture();
        }, 600);
      }
      return;
    }
    schedule();
  }

  /* ---------- flag 1: hold the lens over it for ~600 ms ---------- */

  function covering() {
    if (st.captured || !flagEl || !hero.classList.contains("is-lens-on")) return false;
    var r = st.pressed ? geo.rPress : geo.rRest;
    var dx = geo.fx - st.x;
    var dy = geo.fy - st.y;
    var room = Math.max(18, r - geo.fr * 0.75);
    return dx * dx + dy * dy < room * room;
  }

  function checkFlag(dt) {
    if (st.captured) return false;
    if (covering()) {
      st.cover += dt;
      if (st.cover >= 600) {
        capture();
        return false;
      }
      return true;
    }
    st.cover = 0;
    return false;
  }

  function capture() {
    if (st.captured) return;
    st.captured = true;
    if (flagEl) flagEl.classList.add("is-captured");
    if (C.flags && C.flags.capture) C.flags.capture(FLAG_ID);
  }

  /* ---------- pressing grows the lens ---------- */

  function setPressed(on) {
    if (st.pressed === on) return;
    st.pressed = on;
    hero.classList.toggle("is-pressed", on);
    kick();
  }

  function toHero(clientX, clientY) {
    var r = hero.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  /* Mouse / pen: the lens follows the pointer inside the hero. */
  hero.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || st.mode === "drag") return;
    st.cx = e.clientX;
    st.cy = e.clientY;
    if (reduced) return;
    var p = toHero(e.clientX, e.clientY);
    st.mode = "follow";
    st.tx = p.x;
    st.ty = p.y;
    kick();
  }, { passive: true });

  hero.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "touch" || st.mode === "drag") return;
    setPressed(false);
    if (st.mode === "follow" || (reduced && st.mode === "placed")) {
      st.mode = "rest";
      st.tx = geo.restX;
      st.ty = geo.restY;
      kick();
    }
  });

  hero.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "touch" || e.button !== 0) return;
    if (e.target.closest("a, button, input, textarea, select, label")) return;
    if (reduced) {
      /* no motion: the lens jumps to where you press */
      var p = toHero(e.clientX, e.clientY);
      st.mode = "placed";
      st.tx = p.x;
      st.ty = p.y;
    }
    setPressed(true);
    dismissHint(true);
  });

  window.addEventListener("pointerup", function (e) {
    if (e.pointerType !== "touch" && st.mode !== "drag") setPressed(false);
  });

  window.addEventListener("blur", function () {
    if (st.mode !== "drag") setPressed(false);
  });

  hero.addEventListener("selectstart", function (e) {
    if (st.pressed) e.preventDefault();
  });

  /* Touch: drag the lens by its handle; the page scrolls everywhere else. */
  if (handle) {
    handle.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      var p = toHero(e.clientX, e.clientY);
      st.gx = p.x - st.x;
      st.gy = p.y - st.y;
      st.dragId = e.pointerId;
      st.mode = "drag";
      setPressed(true);
      dismissHint(true);
    });

    handle.addEventListener("pointermove", function (e) {
      if (st.mode !== "drag" || e.pointerId !== st.dragId) return;
      var p = toHero(e.clientX, e.clientY);
      st.tx = clamp(p.x - st.gx, 0, geo.w);
      st.ty = clamp(p.y - st.gy, 0, geo.h);
      kick();
    });

    var endDrag = function (e) {
      if (st.mode !== "drag" || (e && e.pointerId !== st.dragId)) return;
      st.mode = "placed";
      st.dragId = null;
      setPressed(false);
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("lostpointercapture", endDrag);
  }

  /* Scrolling moves the page under a resting mouse: keep the lens on the pointer. */
  var scrollQueued = false;
  window.addEventListener("scroll", function () {
    if (st.mode !== "follow" || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      if (st.mode !== "follow") return;
      var p = toHero(st.cx, st.cy);
      st.tx = p.x;
      st.ty = p.y;
      kick();
    });
  }, { passive: true });

  /* ---------- one-time hint ---------- */

  var hintDone = store(HINT_KEY) === "1";
  var hintPending = false;
  var hintTimer = 0;
  var hintHide = 0;

  function showHint() {
    if (hintDone || !hint) return;
    if (!visible) {
      hintPending = true;
      return;
    }
    hintPending = false;
    hint.classList.add("is-on");
    store(HINT_KEY, "1");
    hintHide = setTimeout(function () { dismissHint(false); }, 8000);
  }

  function dismissHint(interacted) {
    if (interacted) store(HINT_KEY, "1");
    hintDone = true;
    hintPending = false;
    clearTimeout(hintTimer);
    clearTimeout(hintHide);
    if (hint) hint.classList.remove("is-on");
  }

  if (hint && !hintDone) {
    if (!finePointer) {
      var hintText = hint.querySelector("[data-hint-text]");
      if (hintText) hintText.textContent = "Drag the lens to look closer.";
    }
    hintTimer = setTimeout(showHint, 3000);
  }

  /* ---------- typing line ---------- */

  var WORDS = ["Cyber Security", "Web Designing", "Web Development", "Information Technology"];
  var typeLine = paper.querySelector(".hero-type");
  var typeWord = paper.querySelector(".hero-type-word");
  var tw = { i: 0, n: WORDS[0].length, dir: 0, timer: 0 };

  function typeLater(ms) {
    clearTimeout(tw.timer);
    tw.timer = setTimeout(typeStep, ms);
  }

  function typeStep() {
    tw.timer = 0;
    if (!visible || document.hidden) return;
    var word = WORDS[tw.i];
    if (tw.dir === 0) {
      tw.dir = -1;
      typeLine.classList.add("is-typing");
      return typeLater(30);
    }
    if (tw.dir === -1) {
      tw.n -= 1;
      if (tw.n <= 0) {
        tw.n = 0;
        tw.i = (tw.i + 1) % WORDS.length;
        tw.dir = 1;
        typeWord.textContent = "";
        return typeLater(280);
      }
      typeWord.textContent = word.slice(0, tw.n);
      return typeLater(26);
    }
    tw.n += 1;
    typeWord.textContent = word.slice(0, tw.n);
    if (tw.n >= word.length) {
      tw.dir = 0;
      typeLine.classList.remove("is-typing");
      return typeLater(2400);
    }
    return typeLater(55 + Math.random() * 45);
  }

  function resumeTyping() {
    if (reduced || !typeWord || !typeLine) return;
    if (!tw.timer && visible && !document.hidden) typeLater(tw.dir === 0 ? 1600 : 200);
  }

  if (typeWord && typeLine && !reduced) {
    typeWord.textContent = WORDS[0];
    typeLater(3200);
    document.addEventListener("visibilitychange", resumeTyping);
  }

  /* ---------- visibility, resize, theme ---------- */

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) {
        kick();
        resumeTyping();
        if (hintPending) showHint();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        lastT = 0;
      }
    }).observe(hero);
  }

  var measureQueued = false;
  function queueMeasure() {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(function () {
      measureQueued = false;
      measure();
    });
  }

  if ("ResizeObserver" in window) new ResizeObserver(queueMeasure).observe(hero);
  window.addEventListener("resize", queueMeasure);
  window.addEventListener("load", queueMeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueMeasure);
  document.addEventListener("cipher:theme", function () { updateSpecs(); });

  /* ---------- start ---------- */

  measure();
  started = true;

  /* Open the lens once the headline has landed. */
  setTimeout(function () {
    hero.classList.add("is-lens-on");
    setTimeout(function () { hero.classList.add("is-lens-ready"); }, reduced ? 0 : 1000);
  }, reduced ? 0 : 950);
})();
