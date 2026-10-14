/* Hero: a rotating network globe drawn on a 2D canvas.
   Dots on a sphere (denser "land" clusters), hub nodes, data packets travelling
   along arcs between hubs, a scan line sweeping the latitudes and two orbit rings.
   The globe leans toward the pointer; pressing and holding it runs a deep scan
   (flag: deep_scan). Static single frame with reduced motion. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  var hero = document.getElementById("home");
  var canvas = hero && hero.querySelector(".hero-globe");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduced = !!C.reducedMotion;

  /* ---------- live clock (India) ---------- */

  var clock = hero.querySelector("[data-hero-clock]");
  var fmt = null;
  try {
    fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch (e) {}
  function tick() {
    if (clock && fmt) clock.textContent = fmt.format(new Date());
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- colours from the theme ---------- */

  var col = {};
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    col.accent = cs.getPropertyValue("--accent").trim() || "#8b3dff";
    col.accentInk = cs.getPropertyValue("--accent-ink").trim() || "#b794ff";
    col.ink = cs.getPropertyValue("--ink").trim() || "#f4f4f6";
    col.faint = cs.getPropertyValue("--faint").trim() || "#4b4b55";
    col.dark = C.theme && C.theme() === "xray" ? false : true;
  }
  readColors();
  document.addEventListener("cipher:theme", function () {
    readColors();
    if (reduced) draw(0);
  });

  /* ---------- geometry ---------- */

  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;
  var small = false;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    small = W <= 900;
    if (small) {
      cx = W * 0.5;
      cy = H * 0.32;
      R = Math.min(W * 0.4, H * 0.24);
    } else {
      cx = W * 0.72;
      cy = H * 0.45;
      R = Math.min(W * 0.24, H * 0.38);
    }
  }

  // smooth pseudo-noise on the sphere, used to group dots into "continents"
  function land(x, y, z) {
    return Math.sin(3.1 * x + 1.7) * Math.sin(2.3 * y + 0.4) * Math.sin(2.9 * z + 2.1) +
      0.5 * Math.sin(5.3 * x - 2.2 * z + 0.9) * Math.sin(4.1 * y + 1.3);
  }

  var points = [];
  var hubs = [];
  (function build() {
    var n = window.innerWidth < 700 ? 650 : 1100;
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2;
      var r = Math.sqrt(1 - y * y);
      var th = golden * i;
      var x = Math.cos(th) * r;
      var z = Math.sin(th) * r;
      var isLand = land(x, y, z) > 0.08;
      points.push({ x: x, y: y, z: z, land: isLand });
    }
    var landPts = points.filter(function (p) { return p.land; });
    for (var h = 0; h < 22 && landPts.length; h++) {
      hubs.push(landPts[(h * 97 + 13) % landPts.length]);
    }
  })();

  /* ---------- state ---------- */

  var yaw = 0.6, pitch = 0.32;
  var targetYaw = 0, targetPitch = 0, offYaw = 0, offPitch = 0;
  var scanning = false, scanStart = 0, scanBoost = 0;
  var arcs = [], pings = [];
  var scrollP = 0;

  function rotate(p) {
    var cosY = Math.cos(yaw + offYaw), sinY = Math.sin(yaw + offYaw);
    var x = p.x * cosY - p.z * sinY;
    var z = p.x * sinY + p.z * cosY;
    var cosX = Math.cos(pitch + offPitch), sinX = Math.sin(pitch + offPitch);
    var y = p.y * cosX - z * sinX;
    z = p.y * sinX + z * cosX;
    return { x: x, y: y, z: z };
  }

  function project(v, radius) {
    return { x: cx + v.x * radius, y: cy - v.y * radius, z: v.z };
  }

  function slerp(a, b, t) {
    var dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
    var om = Math.acos(dot);
    if (om < 1e-4) return { x: a.x, y: a.y, z: a.z };
    var s = Math.sin(om);
    var k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
    return { x: a.x * k1 + b.x * k2, y: a.y * k1 + b.y * k2, z: a.z * k1 + b.z * k2 };
  }

  function newArc(now) {
    var a = hubs[(Math.random() * hubs.length) | 0];
    var b = hubs[(Math.random() * hubs.length) | 0];
    if (a === b) return;
    arcs.push({ a: a, b: b, start: now, dur: 1500 + Math.random() * 1400 });
  }

  /* ---------- drawing ---------- */

  function alphaHex(a) {
    return Math.max(0, Math.min(1, a));
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var radius = R * (1 + scrollP * 0.55);
    var fade = 1 - scrollP * 0.9;
    if (fade <= 0.01) return;
    ctx.globalAlpha = 1;

    // atmosphere
    var g = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.45);
    g.addColorStop(0, "rgba(139, 61, 255, " + (0.14 * fade) + ")");
    g.addColorStop(1, "rgba(139, 61, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // rim
    ctx.globalAlpha = 0.35 * fade;
    ctx.strokeStyle = col.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // orbit rings (behind and in front handled by alpha only; they're faint)
    drawOrbit(now, radius, 1.28, 0.95, 0.2, fade);
    drawOrbit(now, radius, 1.46, -0.55, 0.65, fade);

    // scan line latitude (sweeps top → bottom)
    var period = 6000 / (1 + scanBoost * 5);
    var scanY = 1 - ((now % period) / period) * 2;

    // dots
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var v = rotate(p);
      var s = project(v, radius);
      var front = v.z > 0;
      var depth = (v.z + 1) / 2; // 0 back … 1 front
      var near = Math.abs(p.y - scanY) < 0.035;
      var a, size;
      if (p.land) {
        a = front ? 0.5 + depth * 0.5 : 0.1 + depth * 0.14;
        size = front ? 1.4 + depth * 1.1 : 0.9;
      } else {
        a = front ? 0.16 + depth * 0.22 : 0.05;
        size = front ? 1 : 0.8;
      }
      ctx.globalAlpha = alphaHex(a * fade);
      ctx.fillStyle = near && front ? col.accentInk : col.ink;
      if (near && front) {
        ctx.globalAlpha = alphaHex(0.95 * fade);
        size += 0.8;
      }
      ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
    }

    // hubs
    for (var h = 0; h < hubs.length; h++) {
      var hv = rotate(hubs[h]);
      if (hv.z < 0) continue;
      var hs = project(hv, radius);
      ctx.globalAlpha = alphaHex((0.4 + hv.z * 0.6) * fade);
      ctx.strokeStyle = col.accentInk;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hs.x, hs.y, 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // arcs with packets
    for (var k = arcs.length - 1; k >= 0; k--) {
      var arc = arcs[k];
      var t = (now - arc.start) / arc.dur;
      if (t >= 1.25) {
        pings.push({ p: arc.b, start: now });
        arcs.splice(k, 1);
        continue;
      }
      var head = Math.min(1, t);
      var tail = Math.max(0, t - 0.45);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = col.accent;
      var prev = null;
      var STEPS = 28;
      for (var j = 0; j <= STEPS; j++) {
        var u = tail + (head - tail) * (j / STEPS);
        var q = slerp(arc.a, arc.b, u);
        var lift = 1 + 0.22 * Math.sin(Math.PI * u);
        var rv = rotate({ x: q.x * lift, y: q.y * lift, z: q.z * lift });
        var rs = project(rv, radius);
        if (prev) {
          var fadeTail = j / STEPS;
          ctx.globalAlpha = alphaHex((rv.z > -0.15 ? 0.9 : 0.15) * fadeTail * fade * (t > 1 ? 1 - (t - 1) * 4 : 1));
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(rs.x, rs.y);
          ctx.stroke();
        }
        prev = rs;
      }
      if (t <= 1 && prev) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = col.ink;
        ctx.beginPath();
        ctx.arc(prev.x, prev.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // pings where packets land
    for (var m = pings.length - 1; m >= 0; m--) {
      var pg = pings[m];
      var age = (now - pg.start) / 900;
      if (age >= 1) { pings.splice(m, 1); continue; }
      var pv = rotate(pg.p);
      if (pv.z < 0) continue;
      var ps = project(pv, radius);
      ctx.globalAlpha = alphaHex((1 - age) * fade);
      ctx.strokeStyle = col.accentInk;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, 3 + age * 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    // deep scan: a ring tightening around the globe while held
    if (scanning) {
      var held = Math.min(1, (now - scanStart) / 1500);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = col.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.12, -Math.PI / 2, -Math.PI / 2 + held * Math.PI * 2);
      ctx.stroke();
      ctx.font = "500 12px " + getComputedStyle(document.body).getPropertyValue("--font-mono");
      ctx.fillStyle = col.accentInk;
      ctx.textAlign = "center";
      ctx.fillText("deep scan " + Math.round(held * 100) + "%", cx, cy + radius * 1.12 + 22);
    }
    ctx.globalAlpha = 1;
  }

  function drawOrbit(now, radius, scale, tiltX, tiltZ, fade) {
    var segs = 72;
    ctx.lineWidth = 1;
    ctx.strokeStyle = col.faint;
    var cosT = Math.cos(tiltX), sinT = Math.sin(tiltX), cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);
    function orbitPoint(a) {
      var x = Math.cos(a) * scale, y = 0, z = Math.sin(a) * scale;
      var y2 = y * cosT - z * sinT, z2 = y * sinT + z * cosT;
      var x3 = x * cosZ - y2 * sinZ, y3 = x * sinZ + y2 * cosZ;
      return rotate({ x: x3, y: y3, z: z2 });
    }
    var prev = null;
    for (var i = 0; i <= segs; i++) {
      var v = orbitPoint((i / segs) * Math.PI * 2);
      var s = project(v, radius);
      if (prev && i % 2 === 0) {
        ctx.globalAlpha = alphaHex((v.z > 0 ? 0.55 : 0.18) * fade);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      prev = s;
    }
    // satellite
    var sv = orbitPoint((now / 1000) * (0.5 / scale));
    var ss = project(sv, radius);
    ctx.globalAlpha = alphaHex((sv.z > 0 ? 1 : 0.3) * fade);
    ctx.fillStyle = col.accent;
    ctx.beginPath();
    ctx.arc(ss.x, ss.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- loop ---------- */

  var raf = 0, running = false, last = 0, nextArc = 0;

  function frame(now) {
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    scanBoost += ((scanning ? 1 : 0) - scanBoost) * 0.06;
    yaw += dt * (0.12 + scanBoost * 1.6);
    offYaw += (targetYaw - offYaw) * 0.05;
    offPitch += (targetPitch - offPitch) * 0.05;

    if (now > nextArc && arcs.length < (small ? 5 : 8)) {
      newArc(now);
      nextArc = now + 260 + Math.random() * 420 - scanBoost * 200;
    }

    if (scanning && now - scanStart > 1500 && !scanning.done) {
      scanning = { done: true };
      if (C.flags) C.flags.capture("deep_scan");
      for (var i = 0; i < 6; i++) newArc(now);
    }

    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running || reduced) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* ---------- input ---------- */

  hero.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var r = hero.getBoundingClientRect();
    targetYaw = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
    targetPitch = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
  }, { passive: true });

  hero.addEventListener("pointerleave", function () {
    targetYaw = 0;
    targetPitch = 0;
  });

  function onGlobe(e) {
    var r = canvas.getBoundingClientRect();
    var dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    return Math.sqrt(dx * dx + dy * dy) < R * 1.15;
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (reduced || e.button !== 0 || !onGlobe(e)) return;
    scanning = true;
    scanStart = performance.now();
    canvas.classList.add("is-scanning");
  });

  function endScan() {
    scanning = false;
    canvas.classList.remove("is-scanning");
  }
  window.addEventListener("pointerup", endScan);
  canvas.addEventListener("pointercancel", endScan);

  // keep scroll position in sync for the zoom-out as the hero leaves
  function onScroll() {
    var r = hero.getBoundingClientRect();
    scrollP = Math.min(1, Math.max(0, -r.top / r.height));
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- boot ---------- */

  size();
  onScroll();
  window.addEventListener("resize", function () {
    size();
    if (reduced) draw(0);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !document.hidden) startLoop();
      else stopLoop();
    }).observe(hero);
  } else {
    startLoop();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopLoop();
    else if (hero.getBoundingClientRect().bottom > 0) startLoop();
  });

  function reveal() {
    canvas.classList.add("is-on");
  }
  if (C.afterLoad) C.afterLoad(reveal);
  else reveal();

  if (reduced) draw(4200);
})();
