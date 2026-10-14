/* Scramble: headlines "decrypt" into place when they scroll into view, and links
   flicker through random glyphs on hover. Inspired by juncastudio.com.

   [data-scramble]        reveal once, when the element enters the viewport
   [data-scramble-hover]  quick scramble each time the pointer enters
   Every animated element is restored to its exact original markup afterwards,
   so layout, selection and screen readers see the real text. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  if (C.reducedMotion) return;

  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*/<>{}=+";
  function randomGlyph() {
    return GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
  }

  /* Wrap every non-space character of el's text in a fixed-width span, keeping words
     together so line breaks don't move. Returns the list of char spans. */
  function split(el) {
    var chars = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.trim() || n.nodeValue.length) nodes.push(n);
    }
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        var word = document.createElement("span");
        word.className = "scr-w";
        for (var i = 0; i < part.length; i++) {
          var c = document.createElement("span");
          c.className = "scr-c";
          c.textContent = part[i];
          c.dataset.ch = part[i];
          word.appendChild(c);
          chars.push(c);
        }
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });
    // freeze each glyph's width so swapping characters never reflows the line
    var widths = chars.map(function (c) { return c.getBoundingClientRect().width; });
    chars.forEach(function (c, i) {
      c.style.width = widths[i] + "px";
    });
    return chars;
  }

  /* mode "reveal": unrevealed chars are hidden; mode "hover": they stay visible */
  function play(el, mode, done) {
    if (el.__scrambling) return;
    el.__scrambling = true;
    var original = el.innerHTML;
    var label = el.getAttribute("aria-label");
    if (mode === "reveal") el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    el.classList.add("is-scrambling");
    var chars = split(el);
    var n = chars.length;
    var band = mode === "reveal" ? 7 : 4;
    var duration = mode === "reveal" ? Math.min(1400, 500 + n * 28) : Math.min(520, 220 + n * 18);
    var start = 0;
    var lastSwap = 0;

    function frame(now) {
      if (!start) start = now;
      var p = Math.min(1, (now - start) / duration) * (n + band);
      var swap = now - lastSwap > 45;
      if (swap) lastSwap = now;
      for (var i = 0; i < n; i++) {
        var c = chars[i];
        if (i < p - band) {
          if (c.className !== "scr-c") {
            c.className = "scr-c";
            c.textContent = c.dataset.ch;
          }
        } else if (i < p) {
          c.className = "scr-c is-glyph";
          if (swap) c.textContent = randomGlyph();
        } else if (mode === "reveal") {
          c.className = "scr-c is-hidden";
        }
      }
      if (p < n + band) {
        requestAnimationFrame(frame);
      } else {
        el.innerHTML = original;
        el.classList.remove("is-scrambling");
        if (mode === "reveal") {
          if (label === null) el.removeAttribute("aria-label");
          else el.setAttribute("aria-label", label);
        }
        el.__scrambling = false;
        if (done) done();
      }
    }

    if (mode === "reveal") chars.forEach(function (c) { c.className = "scr-c is-hidden"; });
    requestAnimationFrame(frame);
  }

  C.scramble = function (el) { play(el, "reveal"); };

  function init() {
    var reveal = Array.prototype.slice.call(document.querySelectorAll("[data-scramble]"));
    if (reveal.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          play(entry.target, "reveal", function () {
            entry.target.classList.add("scr-done");
          });
        });
      }, { threshold: 0.35 });
      reveal.forEach(function (el) { io.observe(el); });
    }

    document.addEventListener("pointerover", function (e) {
      if (e.pointerType === "touch") return;
      var el = e.target.closest && e.target.closest("[data-scramble-hover]");
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      var target = el.querySelector("[data-scramble-text]") || el;
      play(target, "hover");
    });
  }

  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var loaded = new Promise(function (resolve) {
    if (C.afterLoad) C.afterLoad(resolve);
    else resolve();
  });
  Promise.all([fontsReady, loaded]).then(init);
})();
