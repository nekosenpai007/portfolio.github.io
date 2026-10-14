/* skills: "Everything in the toolbox."
   Renders skills.json as an accordion of drawers. Wider than 900 px the
   drawers sit in a row and the open one takes the room (hover, focus or
   click). Narrower they stack, and a tap opens one at a time. */
(function () {
  "use strict";

  var root = document.getElementById("skills");
  if (!root) return;
  var acc = root.querySelector("[data-sk-acc]");
  if (!acc) return;

  var C = window.Cipher || {};
  var esc = C.esc || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };
  var countEl = root.querySelector("[data-sk-count]");

  /* must match the breakpoint in skills.css */
  var mqRow = window.matchMedia("(min-width: 901px)");
  var mqHover = window.matchMedia("(hover: hover) and (pointer: fine)");

  var PATTERNS = ["grid", "hex", "scan", "rings"];
  /* icons with a recognisable silhouette make the best faint backdrop;
     boxy ones (a filled square with a cut-out) read as a grey block */
  var GLYPH_PREF = /(python|metasploit|linux|docker|wireguard)\.svg$/;
  var HOVER_DELAY = 90; // ms of intent before a drawer opens under the pointer

  var panels = [];
  var buttons = [];
  var openIndex = 0;
  var lastOpen = 0;
  var hoverTimer = 0;

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /* only plain relative paths make it into a CSS url() */
  function safePath(p) {
    return typeof p === "string" && /^[\w./-]+$/.test(p) ? p : "";
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function panelHTML(g, i) {
    var items = Array.isArray(g.items) ? g.items : [];
    var name = esc(g.group);
    var num = pad(i + 1);
    var pattern = PATTERNS[i % PATTERNS.length];
    var pick = items.filter(function (it) { return GLYPH_PREF.test(String(it.icon)); })[0] || items[0];
    var glyph = pick && safePath(pick.icon);
    var glyphStyle = glyph
      ? ' style="-webkit-mask-image:url(\'' + glyph + '\');mask-image:url(\'' + glyph + '\')"'
      : "";

    var tools = items.map(function (it) {
      var icon = safePath(it.icon);
      return '<li class="sk-tool">' +
        '<span class="sk-tile">' + (icon ? '<img src="' + esc(icon) + '" alt="" width="20" height="20" decoding="async">' : "") + "</span>" +
        '<span class="sk-tool-name">' + esc(it.name) + "</span></li>";
    }).join("");

    return '<div class="sk-panel sk-panel--' + pattern + ' reveal" data-sk-i="' + i + '">' +
      '<div class="sk-bg" aria-hidden="true">' +
        '<span class="sk-pattern"></span>' +
        (glyph ? '<span class="sk-glyph"' + glyphStyle + "></span>" : "") +
        '<span class="sk-mark"></span>' +
      "</div>" +
      '<h3 class="sk-h">' +
        '<button class="sk-btn" type="button" id="sk-btn-' + i + '" aria-expanded="false" aria-controls="sk-body-' + i + '">' +
          '<span class="mono sk-num" aria-hidden="true">' + num + "</span>" +
          '<span class="sk-name">' + name + "</span>" +
          '<span class="sk-plus" aria-hidden="true"></span>' +
        "</button>" +
      "</h3>" +
      '<div class="sk-body" id="sk-body-' + i + '" role="region" aria-labelledby="sk-btn-' + i + '">' +
        '<div class="sk-body-in"><div class="sk-content">' +
          '<p class="mono sk-meta">' + plural(items.length, "tool") + "</p>" +
          '<div class="sk-main">' +
            '<p class="display-m sk-group" aria-hidden="true">' + name + "</p>" +
            (g.desc ? '<p class="sk-desc">' + esc(g.desc) + "</p>" : "") +
            '<ul class="sk-tools">' + tools + "</ul>" +
          "</div>" +
        "</div></div>" +
      "</div>" +
    "</div>";
  }

  function apply() {
    var row = mqRow.matches;
    for (var i = 0; i < panels.length; i++) {
      var open = i === openIndex;
      panels[i].classList.toggle("is-open", open);
      buttons[i].setAttribute("aria-expanded", String(open));
      /* in the row one drawer is always open, so its header cannot close it */
      if (row && open) buttons[i].setAttribute("aria-disabled", "true");
      else buttons[i].removeAttribute("aria-disabled");
    }
    if (C.refreshSpecs) C.refreshSpecs();
  }

  function open(i) {
    if (i === openIndex) return;
    openIndex = i;
    if (i >= 0) lastOpen = i;
    apply();
  }

  function onClick(e) {
    var i = buttons.indexOf(e.currentTarget);
    if (i < 0) return;
    if (mqRow.matches) open(i);
    else open(i === openIndex ? -1 : i);
  }

  function onFocus(e) {
    if (!mqRow.matches) return;
    var i = buttons.indexOf(e.currentTarget);
    if (i >= 0) open(i);
  }

  function onKey(e) {
    var i = buttons.indexOf(e.currentTarget);
    var n = buttons.length;
    var next = -1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": next = (i + 1) % n; break;
      case "ArrowLeft":
      case "ArrowUp": next = (i - 1 + n) % n; break;
      case "Home": next = 0; break;
      case "End": next = n - 1; break;
      default: return;
    }
    e.preventDefault();
    buttons[next].focus();
  }

  function onEnter(e) {
    if (!mqRow.matches || !mqHover.matches || e.pointerType !== "mouse") return;
    var i = panels.indexOf(e.currentTarget);
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () { open(i); }, HOVER_DELAY);
  }

  function onLeave() {
    clearTimeout(hoverTimer);
  }

  function onMode() {
    /* the row always shows one drawer */
    if (mqRow.matches && openIndex < 0) openIndex = lastOpen;
    apply();
  }

  function render(groups) {
    if (!Array.isArray(groups) || !groups.length) throw new Error("skills.json: no groups");

    acc.innerHTML = groups.map(panelHTML).join("");
    acc.style.setProperty("--sk-n", groups.length);
    acc.removeAttribute("aria-busy");

    panels = Array.prototype.slice.call(acc.querySelectorAll(".sk-panel"));
    buttons = panels.map(function (p) { return p.querySelector(".sk-btn"); });

    panels.forEach(function (p, i) {
      p.addEventListener("pointerenter", onEnter);
      p.addEventListener("pointerleave", onLeave);
      buttons[i].addEventListener("click", onClick);
      buttons[i].addEventListener("focus", onFocus);
      buttons[i].addEventListener("keydown", onKey);
    });

    if (countEl) {
      var total = groups.reduce(function (sum, g) {
        return sum + (Array.isArray(g.items) ? g.items.length : 0);
      }, 0);
      countEl.textContent = plural(total, "tool") + " · " + plural(groups.length, "drawer");
    }

    openIndex = 0;
    lastOpen = 0;
    apply();

    if (mqRow.addEventListener) mqRow.addEventListener("change", onMode);
    else if (mqRow.addListener) mqRow.addListener(onMode);

    if (C.reveal) C.reveal(root);
    if (C.refreshChapters) C.refreshChapters();
  }

  function fail() {
    acc.removeAttribute("aria-busy");
    acc.classList.add("is-error");
    acc.innerHTML = '<p class="mono sk-status" role="status">The toolbox did not load. Refresh the page to try again.</p>';
    if (countEl) countEl.textContent = "";
    if (C.refreshChapters) C.refreshChapters();
  }

  var load = C.getJSON
    ? C.getJSON("skills.json")
    : fetch("skills.json").then(function (r) {
        if (!r.ok) throw new Error("skills.json " + r.status);
        return r.json();
      });

  load.then(render).catch(fail);
})();
