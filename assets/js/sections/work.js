/* Selected work: pin the section and turn vertical scroll into a sideways
   slide of the card track. Swipeable row instead on phones / reduced motion. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  var sec = document.getElementById("work");
  if (!sec) return;
  var track = sec.querySelector(".work-track");
  var cards = Array.prototype.slice.call(sec.querySelectorAll(".work-card"));
  var now = sec.querySelector("[data-work-now]");
  var distance = 0;
  var ticking = false;

  function canPin() {
    return !C.reducedMotion && window.innerWidth > 900 && window.innerHeight >= 560;
  }

  function layout() {
    var pinned = canPin();
    sec.classList.toggle("is-pinned", pinned);
    if (!pinned) {
      sec.style.height = "";
      track.style.removeProperty("--work-x");
      return;
    }
    distance = Math.max(0, track.scrollWidth - window.innerWidth);
    sec.style.height = window.innerHeight + distance + "px";
    update();
  }

  function update() {
    ticking = false;
    if (!sec.classList.contains("is-pinned")) return;
    var r = sec.getBoundingClientRect();
    var span = sec.offsetHeight - window.innerHeight;
    var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    track.style.setProperty("--work-x", (-p * distance).toFixed(1) + "px");
    sec.style.setProperty("--work-p", p.toFixed(4));
    if (now) now.textContent = "0" + (Math.min(cards.length - 1, Math.round(p * (cards.length - 1))) + 1);
  }

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", layout);
  window.addEventListener("load", layout);
  layout();
})();
