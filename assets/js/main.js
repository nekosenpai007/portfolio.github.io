/* cipher. — core behaviour shared by every section.
   Section scripts in assets/js/sections/ use the small window.Cipher API below. */
(function () {
  "use strict";

  var root = document.documentElement;
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");

  var Cipher = (window.Cipher = window.Cipher || {});
  Cipher.reducedMotion = mqReduce.matches;
  Cipher.finePointer = mqFine.matches;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
  }

  Cipher.esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };

  Cipher.getJSON = function (url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + " " + res.status);
      return res.json();
    });
  };

  /* ---------- toast ---------- */

  var toastEl = document.querySelector(".toast");
  var toastTimer = 0;

  Cipher.toast = function (text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-on");
    }, 3200);
  };

  /* ---------- reveal on scroll ---------- */

  var revealObserver = null;
  if ("IntersectionObserver" in window && !Cipher.reducedMotion) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.01 });
  }

  /* Observe .reveal elements inside `scope` (default: document). Call again for
     content rendered later, e.g. from JSON. Siblings get a small stagger. */
  Cipher.reveal = function (scope) {
    var els = (scope || document).querySelectorAll(".reveal:not(.is-in)");
    Array.prototype.forEach.call(els, function (el) {
      if (!revealObserver) {
        el.classList.add("is-in");
        return;
      }
      if (!el.style.getPropertyValue("--reveal-delay")) {
        var i = 0;
        var sib = el;
        while ((sib = sib.previousElementSibling) && i < 6) {
          if (sib.classList.contains("reveal")) i++;
        }
        el.style.setProperty("--reveal-delay", i * 80 + "ms");
      }
      revealObserver.observe(el);
    });
  };

  /* ---------- flag hunt ---------- */

  var FLAGS = [
    { id: "deep_scan", hint: "Hold the globe to run a deep scan." },
    { id: "xray", hint: "See how this page is built." },
    { id: "case_closed", hint: "Take the hint at the end of the investigation." },
    { id: "console", hint: "Developers know where to look." },
    { id: "konami", hint: "Old cheat codes still work." }
  ];

  var found = {};
  (store("cipher-flags") || "").split(",").forEach(function (id) {
    if (id) found[id] = true;
  });

  var flagsBox = document.getElementById("flags");
  var flagsPill = flagsBox && flagsBox.querySelector(".flags-pill");
  var flagsPanel = document.getElementById("flags-panel");

  function renderFlags() {
    if (!flagsBox) return;
    var count = FLAGS.filter(function (f) { return found[f.id]; }).length;
    flagsBox.querySelector("[data-flag-count]").textContent = count;
    flagsBox.querySelector("[data-flag-total]").textContent = FLAGS.length;
    flagsBox.classList.toggle("is-complete", count === FLAGS.length);
    flagsBox.querySelector("[data-flag-list]").innerHTML = FLAGS.map(function (f) {
      return found[f.id]
        ? '<li class="is-found"><span><code>flag{' + f.id + "}</code></span></li>"
        : '<li><span class="hint">' + Cipher.esc(f.hint) + "</span></li>";
    }).join("");
  }

  Cipher.flags = {
    has: function (id) { return !!found[id]; },
    capture: function (id) {
      if (found[id] || !FLAGS.some(function (f) { return f.id === id; })) return false;
      found[id] = true;
      store("cipher-flags", Object.keys(found).join(","));
      renderFlags();
      var count = Object.keys(found).length;
      Cipher.toast(count === FLAGS.length
        ? "All " + FLAGS.length + " flags captured. Respect."
        : "Flag captured: " + id);
      return true;
    }
  };

  if (flagsPill) {
    renderFlags();
    flagsPill.addEventListener("click", function () {
      var open = flagsPanel.hidden;
      flagsPanel.hidden = !open;
      flagsPill.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!flagsPanel.hidden && !flagsBox.contains(e.target)) {
        flagsPanel.hidden = true;
        flagsPill.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Flag: console */
  window.cipher = {
    hack: function () {
      Cipher.flags.capture("console");
      return "access granted. flag{console}";
    }
  };
  try {
    console.log(
      "%ccipher.%c\nCurious? Good. Type cipher.hack() to claim a flag.",
      "font: 600 28px/1.2 system-ui; color: #8b3dff;",
      "font: 13px/1.6 monospace; color: #b794ff;"
    );
  } catch (e) {}

  /* Flag: konami */
  var KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  var konamiPos = 0;
  document.addEventListener("keydown", function (e) {
    var key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiPos = key === KONAMI[konamiPos] ? konamiPos + 1 : (key === KONAMI[0] ? 1 : 0);
    if (konamiPos === KONAMI.length) {
      konamiPos = 0;
      Cipher.flags.capture("konami");
      root.classList.add("is-glitch");
      setTimeout(function () { root.classList.remove("is-glitch"); }, 900);
    }
  });

  /* ---------- theme: paper / X-ray ---------- */

  var xrayBtn = document.querySelector(".xray-toggle");
  var xrayLayer = document.querySelector(".xray-layer");
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  Cipher.theme = function () {
    return root.getAttribute("data-theme") === "xray" ? "xray" : "default";
  };

  function applyTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (xrayBtn) xrayBtn.setAttribute("aria-pressed", String(theme === "xray"));
    if (themeMeta) themeMeta.setAttribute("content", theme === "xray" ? "#f5f5f7" : "#09090b");
    if (persist) store("cipher-theme", theme);
    drawSpecs();
    document.dispatchEvent(new CustomEvent("cipher:theme", { detail: { theme: theme } }));
  }

  if (xrayBtn) {
    xrayBtn.addEventListener("click", function () {
      var next = Cipher.theme() === "xray" ? "default" : "xray";
      applyTheme(next, true);
      if (next === "xray") Cipher.flags.capture("xray");
    });
  }

  /* In X-ray mode every element with data-spec gets a red box with its live
     size, e.g. "Heading 851×100", plus an optional data-spec-note line. */
  var specTimer = 0;

  /* Boxes live on a fixed layer and are re-positioned every scroll frame, so they
     stay on their element even inside pinned or sliding sections. */
  var specs = [];
  var specRaf = 0;

  function drawSpecs() {
    if (!xrayLayer) return;
    xrayLayer.innerHTML = "";
    specs = [];
    if (Cipher.theme() !== "xray") return;

    document.querySelectorAll("[data-spec]").forEach(function (el) {
      if (el.closest("[hidden]")) return;
      var note = el.getAttribute("data-spec-note");
      var box = document.createElement("div");
      box.className = "xray-box";
      box.innerHTML = "<i></i><i></i><i></i><i></i>" +
        '<div class="xray-tag"><span class="spec-label"></span>' +
        (note ? '<span class="xray-note">' + Cipher.esc(note) + "</span>" : "") + "</div>";
      xrayLayer.appendChild(box);
      specs.push({ el: el, box: box, label: box.querySelector(".spec-label"), name: el.getAttribute("data-spec"), w: -1, h: -1 });
    });
    placeSpecs();
  }

  function placeSpecs() {
    specRaf = 0;
    var vh = window.innerHeight;
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i];
      var r = s.el.getBoundingClientRect();
      var off = r.width < 2 || r.height < 2 || r.bottom < -40 || r.top > vh + 40;
      s.box.style.display = off ? "none" : "";
      if (off) continue;
      s.box.style.transform = "translate3d(" + r.left + "px," + r.top + "px,0)";
      var w = Math.round(r.width), h = Math.round(r.height);
      if (w !== s.w || h !== s.h) {
        s.w = w;
        s.h = h;
        s.box.style.width = r.width + "px";
        s.box.style.height = r.height + "px";
        s.label.textContent = s.name + "\u00a0\u00a0" + w + "\u00d7" + h;
      }
    }
  }

  function queuePlace() {
    if (specs.length && !specRaf) specRaf = requestAnimationFrame(placeSpecs);
  }

  // listen after the section scripts, so their scroll-driven transforms are
  // applied earlier in the same frame than the boxes are measured
  function listenScroll() {
    window.addEventListener("scroll", queuePlace, { passive: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", listenScroll);
  else listenScroll();
  // reveal and hover motion moves elements without a scroll, so re-place when it settles
  document.addEventListener("transitionend", queuePlace, true);
  document.addEventListener("animationend", queuePlace, true);

  function queueSpecs() {
    if (Cipher.theme() !== "xray") return;
    clearTimeout(specTimer);
    specTimer = setTimeout(drawSpecs, 150);
  }

  Cipher.refreshSpecs = queueSpecs;
  window.addEventListener("resize", queueSpecs);
  window.addEventListener("load", queueSpecs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueSpecs);
  if ("ResizeObserver" in window) new ResizeObserver(queueSpecs).observe(document.body);

  /* HUD: pointer position, viewport and clock while in X-ray mode */
  var hudX = document.querySelector("[data-hud-x]");
  var hudY = document.querySelector("[data-hud-y]");
  var hudVp = document.querySelector("[data-hud-vp]");
  var hudTime = document.querySelector("[data-hud-time]");

  if (hudX) {
    window.addEventListener("pointermove", function (e) {
      if (Cipher.theme() !== "xray") return;
      hudX.textContent = Math.round(e.clientX);
      hudY.textContent = Math.round(e.clientY);
    }, { passive: true });
    setInterval(function () {
      if (Cipher.theme() !== "xray") return;
      var d = new Date();
      hudVp.textContent = window.innerWidth + "×" + window.innerHeight;
      hudTime.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) {
        return n < 10 ? "0" + n : n;
      }).join(":");
    }, 1000);
  }

  applyTheme(Cipher.theme(), false);

  /* ---------- menu ---------- */

  var menu = document.getElementById("menu");
  var menuBtn = document.querySelector(".menu-btn");
  var menuClose = menu && menu.querySelector(".menu-close");
  var lastFocus = null;

  function setMenu(open) {
    if (!menu) return;
    if (open) {
      lastFocus = document.activeElement;
      menu.hidden = false;
      document.body.style.overflow = "hidden";
      menuBtn.setAttribute("aria-expanded", "true");
      menu.querySelectorAll(".menu-nav li").forEach(function (li, i) {
        li.style.setProperty("--i", i);
      });
      menuClose.focus();
    } else {
      menu.hidden = true;
      document.body.style.overflow = "";
      menuBtn.setAttribute("aria-expanded", "false");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }

  if (menu && menuBtn) {
    menuBtn.addEventListener("click", function () { setMenu(true); });
    menuClose.addEventListener("click", function () { setMenu(false); });
    menu.addEventListener("click", function (e) {
      var link = e.target.closest("a[href^='#']");
      if (link) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) setMenu(false);
      if (e.key === "Tab" && !menu.hidden) {
        var focusables = menu.querySelectorAll("a, button");
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- "More" mega panel in the fixed nav ---------- */

  var moreBtn = document.querySelector(".nav-more");
  var panel = document.getElementById("nav-panel");
  var scrim = document.querySelector(".nav-scrim");
  var headerEl = document.getElementById("site-header");
  var closeTimer = 0;

  function setPanel(open) {
    if (!panel) return;
    clearTimeout(closeTimer);
    if (open === !panel.hidden) return;
    panel.hidden = !open;
    moreBtn.setAttribute("aria-expanded", String(open));
    headerEl.classList.toggle("is-open", open);
    if (scrim) scrim.classList.toggle("is-on", open);
  }

  if (moreBtn && panel) {
    moreBtn.addEventListener("click", function () { setPanel(panel.hidden); });
    if (Cipher.finePointer) {
      moreBtn.addEventListener("mouseenter", function () { setPanel(true); });
      headerEl.addEventListener("mouseleave", function () {
        closeTimer = setTimeout(function () { setPanel(false); }, 220);
      });
      headerEl.addEventListener("mouseenter", function () { clearTimeout(closeTimer); });
    }
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setPanel(false);
    });
    if (scrim) scrim.addEventListener("click", function () { setPanel(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) {
        setPanel(false);
        moreBtn.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth < 1024) setPanel(false);
    });
  }

  /* ---------- header + rail on scroll ---------- */

  var header = document.getElementById("site-header");
  var rail = document.querySelector(".rail");
  var railDot = rail && rail.querySelector(".rail-dot");
  var railChip = rail && rail.querySelector(".rail-chip");
  var lastY = window.scrollY;
  var ticking = false;
  var chapters = [];

  function collectChapters() {
    chapters = Array.prototype.slice.call(document.querySelectorAll("[data-chapter]"));
  }

  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;

    if (header) {
      header.classList.toggle("is-scrolled", y > 8);
    }
    lastY = y;

    if (rail && railDot) {
      var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      railDot.style.setProperty("--rail-y", p * rail.clientHeight + "px");
      var mid = window.innerHeight * 0.45;
      var current = "Home";
      for (var i = 0; i < chapters.length; i++) {
        var r = chapters[i].getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) current = chapters[i].getAttribute("data-chapter");
      }
      if (railChip.textContent !== current) railChip.textContent = current;
    }
  }

  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- page ruler (left edge) ---------- */

  var ruler = document.querySelector(".ruler");
  var rulerTicks = ruler && ruler.querySelector(".ruler-ticks");
  var rulerBox = ruler && ruler.querySelector(".ruler-labels");
  var rulerY = ruler && ruler.querySelector("[data-ruler-y]");
  var rulerLabels = [];
  var STEP = 128;

  function buildRuler() {
    if (!ruler) return;
    var n = Math.ceil(window.innerHeight / STEP) + 2;
    if (rulerLabels.length === n) return;
    rulerBox.innerHTML = "";
    rulerLabels = [];
    for (var i = 0; i < n; i++) {
      var el = document.createElement("span");
      el.className = "ruler-label";
      rulerBox.appendChild(el);
      rulerLabels.push(el);
    }
  }

  function updateRuler() {
    if (!ruler || !ruler.offsetWidth) return; // hidden below 1200px
    var y = Math.round(window.scrollY);
    var shift = -(y % STEP);
    rulerTicks.style.setProperty("--ruler-shift", shift + "px");
    var base = y - (y % STEP);
    for (var i = 0; i < rulerLabels.length; i++) {
      var top = shift + i * STEP;
      rulerLabels[i].style.transform = "translate3d(0," + top + "px,0)";
      rulerLabels[i].textContent = base + i * STEP;
    }
    var txt = String(y);
    while (txt.length < 4) txt = "0" + txt;
    rulerY.textContent = txt;
  }

  var rulerTick = false;
  window.addEventListener("scroll", function () {
    if (!rulerTick) {
      rulerTick = true;
      requestAnimationFrame(function () { rulerTick = false; updateRuler(); });
    }
  }, { passive: true });
  window.addEventListener("resize", function () { buildRuler(); updateRuler(); });
  buildRuler();
  updateRuler();

  /* ---------- boot ---------- */

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  function boot() {
    collectChapters();
    Cipher.reveal();
    onScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* Section scripts that render late (JSON) call this so the rail picks them up. */
  Cipher.refreshChapters = function () {
    collectChapters();
    onScroll();
    queueSpecs();
  };
})();
