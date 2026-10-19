/* Proof of work: cards from projects.json on the right, a static index on the left
   that follows whichever card is in view. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  var stack = document.getElementById("certContainer");
  if (!stack || !C.getJSON) return;
  var sec = document.getElementById("cert");
  var index = sec.querySelector(".cert-index");
  var currentEl = sec.querySelector("[data-cert-current]");
  var ARROW = '<svg class="i-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>';
  var WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  C.getJSON("projects.json").then(function (certs) {
    var total = pad(certs.length);
    sec.querySelectorAll("[data-cert-count]").forEach(function (el) { el.textContent = total; });
    var words = sec.querySelector("[data-cert-words]");
    if (words) words.textContent = WORDS[certs.length] || String(certs.length);

    stack.innerHTML = certs.map(function (cert, i) {
      var link = cert.links && cert.links.view;
      var inner =
        '<span class="cert-card-top"><span class="cert-ico">' + pad(i + 1) + "</span>" +
          '<span class="cert-label">Certificate</span></span>' +
        '<span class="cert-media"' + (link ? ' data-ripple data-cursor="View certificate"' : "") + ">" +
          '<img src="assets/images/projects/' + C.esc(cert.image) + '.png" alt="" width="1080" height="1080" loading="lazy">' +
        "</span>" +
        '<span class="cert-card-title">' + C.esc(cert.name) + "</span>" +
        '<span class="cert-card-desc">' + C.esc(cert.desc) + "</span>" +
        '<span class="cert-card-foot">' + (link ? "View certificate " + ARROW : "Link coming soon") +
          ' <b>' + pad(i + 1) + " / " + total + "</b></span>";
      var id = "cert-" + (i + 1);
      return link
        ? '<a class="cert-card" id="' + id + '" href="' + C.esc(link) + '" target="_blank" rel="noopener">' + inner + "</a>"
        : '<div class="cert-card" id="' + id + '">' + inner + "</div>";
    }).join("");

    index.innerHTML = certs.map(function (cert, i) {
      return '<li><a href="#cert-' + (i + 1) + '"' + (i === 0 ? ' class="is-active"' : "") + ">" + C.esc(cert.name) + "</a></li>";
    }).join("");

    follow(certs.length);
    if (C.refreshChapters) C.refreshChapters();
  }).catch(function () {
    stack.innerHTML = '<p class="cert-empty mono">// could not load projects.json</p>';
  });

  function follow(n) {
    var cards = Array.prototype.slice.call(stack.querySelectorAll(".cert-card"));
    var links = Array.prototype.slice.call(index.querySelectorAll("a"));
    var active = 0;

    function setActive(i) {
      if (i === active) return;
      links[active].classList.remove("is-active");
      links[i].classList.add("is-active");
      active = i;
      if (currentEl) currentEl.textContent = pad(i + 1);
    }

    var ticking = false;
    function onScroll() {
      ticking = false;
      var mid = window.innerHeight * 0.5;
      var best = 0;
      for (var i = 0; i < cards.length; i++) {
        var r = cards[i].getBoundingClientRect();
        if (r.top <= mid) best = i;
        // cards settle in: a little lift and fade as they enter from below
        if (!C.reducedMotion) {
          var t = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.55)));
          cards[i].style.opacity = String(0.35 + 0.65 * t);
          cards[i].style.transform = "translateY(" + ((1 - t) * 40).toFixed(1) + "px) scale(" + (0.96 + 0.04 * t).toFixed(3) + ")";
        }
      }
      setActive(best);
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    index.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      var card = document.querySelector(a.getAttribute("href"));
      if (!card) return;
      var y = card.getBoundingClientRect().top + window.scrollY - (window.innerHeight - card.offsetHeight) / 2;
      window.scrollTo({ top: y, behavior: C.reducedMotion ? "auto" : "smooth" });
    });
  }
})();
