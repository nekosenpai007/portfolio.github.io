/* The path: pin the section and swap the three stages as it scrolls past.
   Falls back to a plain stacked list on phones, short screens and reduced motion. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  var sec = document.getElementById("path");
  if (!sec) return;
  var stages = Array.prototype.slice.call(sec.querySelectorAll(".path-stage"));
  var bgs = Array.prototype.slice.call(sec.querySelectorAll(".path-bg"));
  var now = sec.querySelector("[data-path-now]");
  var n = stages.length;
  var current = 0;
  var ticking = false;

  function canPin() {
    return !C.reducedMotion && window.innerWidth > 640 && window.innerHeight >= 560;
  }

  function show(i) {
    if (i === current) return;
    stages[current].classList.remove("is-on");
    if (bgs[current]) bgs[current].classList.remove("is-on");
    stages[i].classList.add("is-on");
    if (bgs[i]) bgs[i].classList.add("is-on");
    current = i;
    if (now) now.textContent = "0" + (i + 1);
  }

  function update() {
    ticking = false;
    if (sec.classList.contains("is-static")) return;
    var r = sec.getBoundingClientRect();
    var span = sec.offsetHeight - window.innerHeight;
    var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    sec.style.setProperty("--path-p", p.toFixed(4));
    show(Math.min(n - 1, Math.floor(p * n)));
  }

  function mode() {
    sec.classList.toggle("is-static", !canPin());
    update();
  }

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", mode);
  mode();
})();
