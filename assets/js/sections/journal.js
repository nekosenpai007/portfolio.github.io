/* Journal: pin the section and turn the cube one face per screen of scroll. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  var sec = document.getElementById("journal");
  if (!sec) return;
  var cube = sec.querySelector(".jr-cube");
  var faces = sec.querySelectorAll(".jr-face");
  var now = sec.querySelector("[data-jr-now]");
  var n = faces.length;
  var ticking = false;

  function canPin() {
    return !C.reducedMotion && window.innerWidth > 760 && window.innerHeight >= 560;
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function update() {
    ticking = false;
    if (!sec.classList.contains("is-pinned")) return;
    var r = sec.getBoundingClientRect();
    var span = sec.offsetHeight - window.innerHeight;
    var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    // hold on each face, turn quickly between them
    var x = p * (n - 1);
    var k = Math.floor(x);
    var f = x - k;
    var turn = k + ease(Math.min(1, Math.max(0, (f - 0.3) / 0.4)));
    cube.style.setProperty("--jr-rot", (turn * 90).toFixed(2) + "deg");
    if (now) now.textContent = "0" + (Math.min(n - 1, Math.round(turn)) + 1);
  }

  function mode() {
    sec.classList.toggle("is-pinned", canPin());
    update();
  }

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", mode);
  mode();
})();
