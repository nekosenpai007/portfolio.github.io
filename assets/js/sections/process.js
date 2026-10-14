/* process: "From a packet to a report."
   A pinned investigation in eight steps. The stage sticks while the page
   scrolls natively; this script only reads where the section is and writes
   progress for the CSS: --t1 … --t8 on .pr-stage (0 → 1 per step), the
   counter, the active caption and the typed code. Reduced motion and short
   viewports get the static list from the CSS instead. */
(function () {
  "use strict";

  var root = document.getElementById("process");
  if (!root) return;

  var stage = root.querySelector(".pr-stage");
  var steps = root.querySelectorAll(".pr-step");
  if (!stage || !steps.length) return;

  var C = window.Cipher || {};
  var esc = C.esc || function (s) { return String(s); };

  var frame = root.querySelector(".pr-frame");
  var body = root.querySelector(".pr-body");
  var art = root.querySelector(".pr-art");
  var hexEl = root.querySelector("[data-pr-hex]");
  var dimEl = root.querySelector("[data-pr-dim]");
  var meterEl = root.querySelector(".pr-meter");
  var digits = root.querySelectorAll("[data-pr-digit]");
  var cta = root.querySelector(".pr-cta");
  var ctaSize = root.querySelector("[data-pr-cta-size]");

  var N = steps.length;   // 8
  var HOLD = 0.92;        // 100% at 92% of the pinned scroll; the rest is a short hold
  var BUILD = 0.75;       // share of each step's slot spent building its layer
  var PAUSE = 4;          // typed "characters" of pause at the end of each code line

  /* must match the media query that pins the stage in process.css */
  var mq = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 560px)");

  var pinned = false;
  var ticking = false;
  var stageH = 0;
  var progress = -1;
  var active = -1;
  var shownPct = -1;
  var isFinal = false;
  var seenOpen = false;
  var t = [];
  for (var s = 0; s < N; s++) t.push(-1);

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  /* ---------- 02: the hex dump ----------
     128 bytes from offset 0x0100: the tail of an HTTP request, then zero
     padding, with one 0x4A at 0x0172 where it should not be. */

  function buildHex() {
    if (!hexEl) return;
    var text = "ept-Language: en-US,en;q=0.9\r\nConnection: keep-alive\r\nCache-Control: no-cache\r\n\r\n";
    var bytes = [];
    for (var i = 0; i < 128; i++) bytes.push(i < text.length ? text.charCodeAt(i) : 0);
    bytes[0x72] = 0x4a;

    var html = "";
    for (var r = 0; r < 8; r++) {
      var cells = "";
      var ascii = "";
      for (var c = 0; c < 16; c++) {
        var b = bytes[r * 16 + c];
        cells += "<i" + (b === 0 ? ' class="z"' : "") + ">" + ("0" + b.toString(16).toUpperCase()).slice(-2) + "</i>";
        ascii += b > 31 && b < 127 ? String.fromCharCode(b) : ".";
      }
      html +=
        '<div class="pr-row" style="--r:' + r + '">' +
        '<span class="pr-off">' + ("000" + (0x100 + r * 16).toString(16).toUpperCase()).slice(-4) + "</span>" +
        '<span class="pr-bytes">' + cells + "</span>" +
        '<span class="pr-ascii">' + esc(ascii) + "</span></div>";
    }
    hexEl.innerHTML = html;
  }

  /* ---------- 06: typed code ---------- */

  var lines = [];
  each(root.querySelectorAll(".pr-code-lines li"), function (li) {
    var el = li.querySelector(".pr-cl");
    if (el) lines.push({ li: li, el: el, len: el.textContent.length, n: -1 });
  });
  var codeTotal = lines.reduce(function (sum, l) { return sum + l.len + PAUSE; }, 0);
  var typed = -1;
  var caretLine = null;

  function type(k) {
    var count = Math.round(k * codeTotal);
    if (count === typed || !lines.length) return;
    typed = count;
    var acc = 0;
    var caret = null;
    lines.forEach(function (l) {
      var n = clamp(count - acc, 0, l.len);
      if (n !== l.n) {
        l.n = n;
        l.el.style.setProperty("--n", n);
      }
      if (!caret && n < l.len) caret = l;
      acc += l.len + PAUSE;
    });
    caret = caret || lines[lines.length - 1];
    if (caret !== caretLine) {
      if (caretLine) caretLine.li.classList.remove("is-typing");
      caret.li.classList.add("is-typing");
      caretLine = caret;
    }
  }

  /* ---------- sizes: artboard fit, frame label, button label ---------- */

  function fit() {
    if (!pinned || !body || !art) return;
    var bw = body.clientWidth;
    var bh = body.clientHeight;
    var aw = art.offsetWidth;
    var ah = art.offsetHeight;
    if (!bw || !bh || !aw || !ah) return;
    var k = Math.min(bw / aw, bh / ah, 1);
    art.style.setProperty("--k", k.toFixed(4));
    art.style.setProperty("--mx", Math.ceil((bw / k - aw) / 2 + 2) + "px");
    art.style.setProperty("--my", Math.ceil((bh / k - ah) / 2 + 2) + "px");
    if (dimEl && frame) {
      dimEl.textContent = Math.round(frame.offsetWidth) + " × " + Math.round(frame.offsetHeight);
    }
  }

  function sizeCta() {
    if (cta && ctaSize && cta.offsetWidth) {
      ctaSize.textContent = "Button · " + Math.round(cta.offsetWidth) + " × " + Math.round(cta.offsetHeight);
    }
  }

  function measure() {
    stageH = stage.offsetHeight;
    fit();
    sizeCta();
  }

  /* ---------- progress → stage ---------- */

  function setActive(a) {
    active = a;
    each(steps, function (li, j) {
      li.classList.toggle("is-active", j === a);
    });
    stage.setAttribute("data-active", String(a + 1));
    queueLocalSpecs(700);
  }

  function render() {
    var pos = progress * N;
    for (var i = 0; i < N; i++) {
      var v = Math.round(clamp((pos - i) / BUILD, 0, 1) * 1000) / 1000;
      if (v !== t[i]) {
        t[i] = v;
        stage.style.setProperty("--t" + (i + 1), v);
      }
    }

    var a = Math.min(N - 1, Math.floor(pos));
    if (a !== active) setActive(a);

    var pct = Math.round(progress * 100);
    if (pct !== shownPct) {
      shownPct = pct;
      var str = ("00" + pct).slice(-3);
      each(digits, function (d, j) { d.textContent = str.charAt(j); });
    }

    type(clamp((t[5] - 0.2) / 0.72, 0, 1));

    var fin = t[N - 1] > 0.55;
    if (fin !== isFinal) {
      isFinal = fin;
      stage.classList.toggle("is-final", fin);
    }
  }

  function update() {
    ticking = false;
    if (!pinned) return;
    var r = root.getBoundingClientRect();
    var dist = r.height - stageH;
    var f = dist > 0 ? clamp(-r.top / dist, 0, 1) : 0;
    var p = clamp(f / HOLD, 0, 1);
    var inView = r.top < window.innerHeight && r.bottom > 0;
    if (inView && p < 1) seenOpen = true;

    if (p !== progress) {
      progress = p;
      render();
    }

    /* the case is closed once the last step has been fully shown on screen */
    if (p >= 1 && inView && seenOpen && C.flags) C.flags.capture("case_closed");
  }

  function onScroll() {
    if (!pinned || ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  /* ---------- X-ray: spec boxes drawn inside the sticky stage ----------
     The core draws boxes in page coordinates, which drift while the stage is
     pinned. So while pinned, this section draws its own, and hands its
     data-spec elements back to the core only for the static list. */

  var xray = document.createElement("div");
  xray.className = "pr-xray";
  xray.setAttribute("aria-hidden", "true");
  stage.appendChild(xray);
  var specTimer = 0;

  function queueLocalSpecs(delay) {
    clearTimeout(specTimer);
    specTimer = setTimeout(drawLocalSpecs, delay || 0);
  }

  function drawLocalSpecs() {
    if (!pinned || !C.theme || C.theme() !== "xray") {
      xray.innerHTML = "";
      return;
    }
    var sr = stage.getBoundingClientRect();
    var items = [
      { el: meterEl, name: "Counter", note: "Fixed-width digits.", end: true },
      { el: steps[Math.max(0, active)], name: "Caption", note: "Steps crossfade with blur." }
    ];
    xray.innerHTML = items.map(function (it) {
      if (!it.el) return "";
      var r = it.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return "";
      return '<div class="xray-box" style="left:' + (r.left - sr.left) + "px;top:" + (r.top - sr.top) +
        "px;width:" + r.width + "px;height:" + r.height + 'px"><i></i><i></i><i></i><i></i>' +
        '<div class="xray-tag" style="width:max-content' + (it.end ? ';left:auto;right:-1px;justify-items:end' : "") + '">' +
        '<span class="spec-label">' + esc(it.name) + "&nbsp;&nbsp;" + Math.round(r.width) + "×" + Math.round(r.height) + "</span>" +
        '<span class="xray-note">' + esc(it.note) + "</span></div></div>";
    }).join("");
  }

  function swapSpecs(toLocal) {
    var from = toLocal ? "data-spec" : "data-pr-spec";
    var to = toLocal ? "data-pr-spec" : "data-spec";
    each(root.querySelectorAll("[" + from + "]"), function (el) {
      el.setAttribute(to, el.getAttribute(from));
      el.removeAttribute(from);
      var note = el.getAttribute(from + "-note");
      if (note !== null) {
        el.setAttribute(to + "-note", note);
        el.removeAttribute(from + "-note");
      }
    });
  }

  /* ---------- mode: pinned stage or static list ---------- */

  function setMode() {
    var on = mq.matches;
    if (on === pinned) return;
    pinned = on;
    swapSpecs(on);
    if (on) {
      progress = -1;
      measure();
      update();
    } else {
      stage.classList.remove("is-final");
      isFinal = false;
    }
    sizeCta();
    queueLocalSpecs(0);
    if (C.refreshSpecs) C.refreshSpecs();
  }

  /* ---------- boot ---------- */

  buildHex();
  setMode();
  sizeCta();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    if (pinned) {
      measure();
      progress = -1;
      update();
    }
    sizeCta();
    queueLocalSpecs(200);
  });

  if (mq.addEventListener) mq.addEventListener("change", setMode);
  else if (mq.addListener) mq.addListener(setMode);

  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(function () {
      if (pinned) {
        stageH = stage.offsetHeight;
        fit();
      }
      sizeCta();
    });
    if (body) ro.observe(body);
    if (cta) ro.observe(cta);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      measure();
      queueLocalSpecs(0);
    });
  }

  document.addEventListener("cipher:theme", function () {
    queueLocalSpecs(0);
  });

  /* Keyboard: the button only shows on the last step, so focusing it while the
     stage is still earlier jumps to the end of the sequence. */
  if (cta) {
    cta.addEventListener("focus", function () {
      if (!pinned || progress >= 1) return;
      try {
        if (!cta.matches(":focus-visible")) return;
      } catch (e) {}
      var top = root.getBoundingClientRect().top + window.scrollY;
      var dist = root.offsetHeight - stageH;
      window.scrollTo({ top: Math.round(top + dist * (HOLD + (1 - HOLD) / 2)), behavior: "instant" });
    });
  }

  /* Static list: the case closes when the final button comes into view. */
  if (cta && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !pinned && C.flags) C.flags.capture("case_closed");
      });
    }, { threshold: 0.6 });
    io.observe(cta);
  }
})();
