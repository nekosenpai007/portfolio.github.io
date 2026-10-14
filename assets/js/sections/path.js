/* Path: a campus photo trails the pointer while hovering an education row. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  var sec = document.getElementById("path");
  if (!sec || !C.finePointer) return;
  var float = sec.querySelector(".path-float");
  var img = float && float.querySelector("img");
  var cap = float && float.querySelector("figcaption");
  if (!float) return;

  var x = 0, y = 0, fx = 0, fy = 0, on = false, raf = 0, current = null;

  function loop() {
    var k = C.reducedMotion ? 1 : 0.14;
    fx += (x - fx) * k;
    fy += (y - fy) * k;
    var tilt = C.reducedMotion ? 0 : Math.max(-8, Math.min(8, (x - fx) * 0.05));
    float.style.transform = "translate3d(" + (fx + 24) + "px," + (fy - 120) + "px,0) rotate(" + (tilt - 3).toFixed(2) + "deg)";
    if (on || Math.abs(x - fx) > 0.5) raf = requestAnimationFrame(loop);
    else raf = 0;
  }

  sec.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var row = e.target.closest(".path-row");
    x = e.clientX;
    y = e.clientY;
    if (row !== current) {
      current = row;
      if (row) {
        if (!on) { fx = x; fy = y; }
        img.src = row.getAttribute("data-photo");
        cap.textContent = row.getAttribute("data-caption");
        on = true;
        float.classList.add("is-on");
      } else {
        on = false;
        float.classList.remove("is-on");
      }
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });

  sec.addEventListener("pointerleave", function () {
    current = null;
    on = false;
    float.classList.remove("is-on");
  });
})();
