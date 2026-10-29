;(function () {
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
var specTimer = 0;
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
function listenScroll() {
window.addEventListener("scroll", queuePlace, { passive: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", listenScroll);
else listenScroll();
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
Cipher.refreshChapters = function () {
collectChapters();
onScroll();
queueSpecs();
};
})();
;(function () {
"use strict";
var root = document.documentElement;
var C = (window.Cipher = window.Cipher || {});
var done = false;
C.afterLoad = function (fn) {
if (done || !root.classList.contains("is-loading")) {
setTimeout(fn, 0);
} else {
document.addEventListener("cipher:loaded", function () { fn(); }, { once: true });
}
};
var el = document.querySelector(".loader");
function finish() {
if (done) return;
done = true;
root.classList.remove("is-loading");
try { sessionStorage.setItem("cipher-loaded", "1"); } catch (e) {}
if (el && el.parentNode) el.parentNode.removeChild(el);
document.dispatchEvent(new CustomEvent("cipher:loaded"));
}
if (!el || !root.classList.contains("is-loading")) {
done = true;
if (el && el.parentNode) el.parentNode.removeChild(el);
return;
}
var failsafe = setTimeout(finish, 7000);
var canvas = el.querySelector("canvas");
var count = el.querySelector(".loader-count b");
var ctx = canvas.getContext("2d");
if (!ctx) { finish(); return; }
var wordEl = document.querySelector(".site-header .wordmark");
var family = getComputedStyle(wordEl || document.body).fontFamily;
var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
function size() {
W = window.innerWidth;
H = window.innerHeight;
canvas.width = Math.round(W * dpr);
canvas.height = Math.round(H * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
size();
var COLORS = ["#8b3dff", "#a66bff", "#6d5dfc", "#c4a6ff", "#5b3fd9", "#e2d4ff"];
var particles = [];
var targets = [];
var glyphBox = { x: 0, y: 0, size: 0 };
function sampleGlyph() {
var fontSize = Math.round(Math.min(W, H) * 0.62);
var off = document.createElement("canvas");
var ow = Math.round(fontSize * 0.9), oh = Math.round(fontSize * 1.1);
off.width = ow;
off.height = oh;
var o = off.getContext("2d");
o.fillStyle = "#fff";
o.textAlign = "center";
o.textBaseline = "middle";
o.font = "600 " + fontSize + "px " + family;
o.fillText("c", ow / 2, oh / 2);
var data = o.getImageData(0, 0, ow, oh).data;
var edge = [], fill = [];
var stepPx = Math.max(3, Math.round(fontSize / 120));
function a(x, y) { return x < 0 || y < 0 || x >= ow || y >= oh ? 0 : data[(y * ow + x) * 4 + 3]; }
for (var y = 0; y < oh; y += stepPx) {
for (var x = 0; x < ow; x += stepPx) {
if (a(x, y) < 128) continue;
var isEdge = a(x - stepPx, y) < 128 || a(x + stepPx, y) < 128 || a(x, y - stepPx) < 128 || a(x, y + stepPx) < 128;
(isEdge ? edge : fill).push({ x: x - ow / 2, y: y - oh / 2, edge: isEdge });
}
}
for (var i = fill.length - 1; i > 0; i--) {
var j = Math.floor(Math.random() * (i + 1));
var t = fill[i]; fill[i] = fill[j]; fill[j] = t;
}
targets = edge.concat(fill.slice(0, Math.round(edge.length * 0.6)));
glyphBox.size = fontSize;
glyphBox.x = W / 2;
glyphBox.y = H / 2;
}
function makeParticles() {
var n = Math.min(targets.length, W < 700 ? 700 : 1400);
var R = Math.max(W, H) * 0.62;
particles = [];
for (var i = 0; i < n; i++) {
var t = targets[Math.floor((i / n) * targets.length)];
var k = Math.random();                       // position along the spiral arm
var jitter = (Math.random() - 0.5) * 0.22;   // ribbon thickness
particles.push({
tx: glyphBox.x + t.x,
ty: glyphBox.y + t.y,
edge: t.edge,
ang: k * Math.PI * 2.6 + jitter,
rad: R * (0.18 + 0.82 * k) * (1 + jitter * 0.6),
spin: 1.6 - k * 0.6,
x: 0,
y: 0,
size: t.edge ? 1.1 + Math.random() * 1.3 : 0.7 + Math.random() * 0.9,
color: COLORS[(Math.random() * COLORS.length) | 0],
delay: Math.random() * 0.35
});
}
}
function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
var start = 0;
var SWIRL = 1200, GATHER = 1100, HOLD = 450;
function draw(now) {
if (!start) start = now;
var t = now - start;
ctx.clearRect(0, 0, W, H);
var gather = clamp01((t - SWIRL * 0.55) / GATHER);
var fade = clamp01((t - SWIRL - GATHER) / HOLD);
ctx.globalCompositeOperation = "lighter";
for (var i = 0; i < particles.length; i++) {
var p = particles[i];
var local = clamp01((gather - p.delay * 0.6) / (1 - p.delay * 0.6));
var e = easeInOut(local);
var ang = p.ang + (t / 1000) * p.spin;
var rad = p.rad * (1 - 0.55 * clamp01(t / (SWIRL + GATHER)));
var sx = W / 2 + Math.cos(ang) * rad;
var sy = H / 2 + Math.sin(ang) * rad * 0.62;
p.x = sx + (p.tx - sx) * e;
p.y = sy + (p.ty - sy) * e;
var alpha = (0.35 + 0.65 * Math.min(1, t / 500)) * (1 - fade * (p.edge ? 0.6 : 1));
ctx.globalAlpha = alpha;
ctx.fillStyle = p.color;
ctx.beginPath();
ctx.arc(p.x, p.y, p.size * (1 + (1 - e) * 0.6), 0, Math.PI * 2);
ctx.fill();
}
ctx.globalAlpha = 1;
ctx.globalCompositeOperation = "source-over";
var pct = Math.round(clamp01(t / (SWIRL + GATHER)) * 100);
if (count) count.textContent = (pct < 10 ? "00" : pct < 100 ? "0" : "") + pct;
if (fade > 0) drawGlyph(glyphBox.x, glyphBox.y, 1, fade);
if (t < SWIRL + GATHER + HOLD) {
requestAnimationFrame(draw);
} else {
flyToWordmark();
}
}
function drawGlyph(cx, cy, scale, alpha) {
var size = glyphBox.size * scale;
var g = ctx.createLinearGradient(cx - size * 0.4, cy - size * 0.45, cx + size * 0.4, cy + size * 0.45);
g.addColorStop(0, "#f1e9ff");
g.addColorStop(0.28, "#b794ff");
g.addColorStop(0.52, "#8b3dff");
g.addColorStop(0.78, "#3b1d8f");
g.addColorStop(1, "#c4a6ff");
ctx.save();
ctx.globalAlpha = alpha;
ctx.font = "600 " + size + "px " + family;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.shadowColor = "rgba(139, 61, 255, 0.55)";
ctx.shadowBlur = 48 * scale;
ctx.fillStyle = g;
ctx.fillText("c", cx, cy);
ctx.restore();
}
function flyToWordmark() {
el.classList.add("is-leaving");
var word = document.querySelector(".site-header .wordmark");
var node = word && word.firstChild;
if (!node || node.nodeType !== 3) {
setTimeout(finish, 500);
return;
}
var range = document.createRange();
range.setStart(node, 0);
range.setEnd(node, 1);
var r = range.getBoundingClientRect();
var tx = r.left + r.width / 2;
var ty = r.top + r.height / 2;
var endScale = parseFloat(getComputedStyle(word).fontSize) / glyphBox.size;
var t0 = 0;
var DUR = 850;
function fly(now) {
if (!t0) t0 = now;
var k = clamp01((now - t0) / DUR);
var e = easeInOut(k);
ctx.clearRect(0, 0, W, H);
var scale = 1 + (endScale - 1) * e;
var alpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
drawGlyph(glyphBox.x + (tx - glyphBox.x) * e, glyphBox.y + (ty - glyphBox.y) * e, scale, alpha);
if (k < 1) requestAnimationFrame(fly);
else finish();
}
requestAnimationFrame(fly);
}
function begin() {
size();
sampleGlyph();
makeParticles();
requestAnimationFrame(draw);
}
var fontReady = document.fonts && document.fonts.load
? Promise.race([
document.fonts.load("600 100px 'Space Grotesk'"),
new Promise(function (r) { setTimeout(r, 1200); })
])
: Promise.resolve();
fontReady.then(begin, begin);
window.addEventListener("resize", function () {
if (!done) size();
});
el.addEventListener("click", function () {
clearTimeout(failsafe);
finish();
});
})();
;(function () {
"use strict";
var C = window.Cipher || {};
if (C.reducedMotion || !C.finePointer) return;
var config = {
SIM_RESOLUTION: 128,
DYE_RESOLUTION: 720,
DENSITY_DISSIPATION: 3.2,
VELOCITY_DISSIPATION: 2,
PRESSURE: 0.1,
PRESSURE_ITERATIONS: 16,
CURL: 3,
SPLAT_RADIUS: 0.18,
SPLAT_FORCE: 6000,
COLOR_UPDATE_SPEED: 8,
IDLE_MS: 3500
};
if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) {
config.SIM_RESOLUTION = 96;
config.DYE_RESOLUTION = 512;
config.PRESSURE_ITERATIONS = 10;
}
var canvas = document.createElement("canvas");
canvas.className = "fluid-canvas";
canvas.setAttribute("aria-hidden", "true");
var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
var gl = canvas.getContext("webgl2", params);
var isWebGL2 = !!gl;
if (!gl) gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);
if (!gl) return;
var halfFloat;
var supportLinearFiltering;
if (isWebGL2) {
gl.getExtension("EXT_color_buffer_float");
supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
} else {
halfFloat = gl.getExtension("OES_texture_half_float");
supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
}
var halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;
if (!halfFloatTexType || !supportLinearFiltering) return; // keep it simple: skip old GPUs
gl.clearColor(0, 0, 0, 0);
function supportRenderTextureFormat(internalFormat, format, type) {
var texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
var fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
gl.deleteFramebuffer(fbo);
gl.deleteTexture(texture);
return ok;
}
function getSupportedFormat(internalFormat, format, type) {
if (!supportRenderTextureFormat(internalFormat, format, type)) {
if (!isWebGL2) return null;
if (internalFormat === gl.R16F) return getSupportedFormat(gl.RG16F, gl.RG, type);
if (internalFormat === gl.RG16F) return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
return null;
}
return { internalFormat: internalFormat, format: format };
}
var formatRGBA = getSupportedFormat(isWebGL2 ? gl.RGBA16F : gl.RGBA, gl.RGBA, halfFloatTexType);
var formatRG = getSupportedFormat(isWebGL2 ? gl.RG16F : gl.RGBA, isWebGL2 ? gl.RG : gl.RGBA, halfFloatTexType);
var formatR = getSupportedFormat(isWebGL2 ? gl.R16F : gl.RGBA, isWebGL2 ? gl.RED : gl.RGBA, halfFloatTexType);
if (!formatRGBA || !formatRG || !formatR) return;
function compile(type, source) {
var shader = gl.createShader(type);
gl.shaderSource(shader, source);
gl.compileShader(shader);
if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
return shader;
}
function Program(vertexShader, fragmentSource) {
this.program = gl.createProgram();
gl.attachShader(this.program, vertexShader);
gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(this.program);
if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
this.uniforms = {};
var count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
for (var i = 0; i < count; i++) {
var name = gl.getActiveUniform(this.program, i).name;
this.uniforms[name] = gl.getUniformLocation(this.program, name);
}
}
Program.prototype.bind = function () {
gl.useProgram(this.program);
};
var PRE = "precision highp float;\nprecision highp sampler2D;\n";
var programs;
try {
var baseVertex = compile(gl.VERTEX_SHADER, PRE +
"attribute vec2 aPosition;\n" +
"varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
"uniform vec2 texelSize;\n" +
"void main () {\n" +
"  vUv = aPosition * 0.5 + 0.5;\n" +
"  vL = vUv - vec2(texelSize.x, 0.0);\n" +
"  vR = vUv + vec2(texelSize.x, 0.0);\n" +
"  vT = vUv + vec2(0.0, texelSize.y);\n" +
"  vB = vUv - vec2(0.0, texelSize.y);\n" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);\n" +
"}");
programs = {
clear: new Program(baseVertex, PRE +
"varying vec2 vUv; uniform sampler2D uTexture; uniform float value;\n" +
"void main () { gl_FragColor = value * texture2D(uTexture, vUv); }"),
splat: new Program(baseVertex, PRE +
"varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color;\n" +
"uniform vec2 point; uniform float radius;\n" +
"void main () {\n" +
"  vec2 p = vUv - point.xy; p.x *= aspectRatio;\n" +
"  vec3 splat = exp(-dot(p, p) / radius) * color;\n" +
"  vec3 base = texture2D(uTarget, vUv).xyz;\n" +
"  gl_FragColor = vec4(base + splat, 1.0);\n" +
"}"),
advection: new Program(baseVertex, PRE +
"varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;\n" +
"uniform vec2 texelSize; uniform float dt; uniform float dissipation;\n" +
"void main () {\n" +
"  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;\n" +
"  vec4 result = texture2D(uSource, coord);\n" +
"  gl_FragColor = result / (1.0 + dissipation * dt);\n" +
"}"),
divergence: new Program(baseVertex, PRE +
"varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
"uniform sampler2D uVelocity;\n" +
"void main () {\n" +
"  float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;\n" +
"  float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;\n" +
"  vec2 C = texture2D(uVelocity, vUv).xy;\n" +
"  if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; }\n" +
"  if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }\n" +
"  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);\n" +
"}"),
curl: new Program(baseVertex, PRE +
"varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
"uniform sampler2D uVelocity;\n" +
"void main () {\n" +
"  float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;\n" +
"  float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;\n" +
"  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);\n" +
"}"),
vorticity: new Program(baseVertex, PRE +
"varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
"uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;\n" +
"void main () {\n" +
"  float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;\n" +
"  float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;\n" +
"  float C = texture2D(uCurl, vUv).x;\n" +
"  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n" +
"  force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;\n" +
"  vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;\n" +
"  velocity = min(max(velocity, -1000.0), 1000.0);\n" +
"  gl_FragColor = vec4(velocity, 0.0, 1.0);\n" +
"}"),
pressure: new Program(baseVertex, PRE +
"varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
"uniform sampler2D uPressure; uniform sampler2D uDivergence;\n" +
"void main () {\n" +
"  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;\n" +
"  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;\n" +
"  float divergence = texture2D(uDivergence, vUv).x;\n" +
"  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);\n" +
"}"),
gradient: new Program(baseVertex, PRE +
"varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n" +
"uniform sampler2D uPressure; uniform sampler2D uVelocity;\n" +
"void main () {\n" +
"  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;\n" +
"  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;\n" +
"  vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);\n" +
"  gl_FragColor = vec4(velocity, 0.0, 1.0);\n" +
"}"),
display: new Program(baseVertex, PRE +
"varying vec2 vUv; uniform sampler2D uTexture;\n" +
"void main () {\n" +
"  vec3 c = texture2D(uTexture, vUv).rgb;\n" +
"  float a = max(c.r, max(c.g, c.b));\n" +
"  gl_FragColor = vec4(c, a);\n" +
"}")
};
} catch (err) {
return; // shader compile failure: no fluid, the page works the same
}
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0);
function blit(target) {
if (target) {
gl.viewport(0, 0, target.width, target.height);
gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
} else {
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}
function createFBO(w, h, internalFormat, format, type, filter) {
gl.activeTexture(gl.TEXTURE0);
var texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
var fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
gl.viewport(0, 0, w, h);
gl.clear(gl.COLOR_BUFFER_BIT);
return {
texture: texture,
fbo: fbo,
width: w,
height: h,
texelSizeX: 1 / w,
texelSizeY: 1 / h,
attach: function (id) {
gl.activeTexture(gl.TEXTURE0 + id);
gl.bindTexture(gl.TEXTURE_2D, texture);
return id;
},
destroy: function () {
gl.deleteFramebuffer(fbo);
gl.deleteTexture(texture);
}
};
}
function createDoubleFBO(w, h, internalFormat, format, type, filter) {
var a = createFBO(w, h, internalFormat, format, type, filter);
var b = createFBO(w, h, internalFormat, format, type, filter);
return {
width: w,
height: h,
texelSizeX: a.texelSizeX,
texelSizeY: a.texelSizeY,
get read() { return a; },
get write() { return b; },
swap: function () { var t = a; a = b; b = t; },
destroy: function () { a.destroy(); b.destroy(); }
};
}
function getResolution(resolution) {
var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
if (aspect < 1) aspect = 1 / aspect;
var min = Math.round(resolution);
var max = Math.round(resolution * aspect);
return gl.drawingBufferWidth > gl.drawingBufferHeight
? { width: max, height: min }
: { width: min, height: max };
}
var dye, velocity, divergence, curl, pressure;
function initFramebuffers() {
var simRes = getResolution(config.SIM_RESOLUTION);
var dyeRes = getResolution(config.DYE_RESOLUTION);
var type = halfFloatTexType;
gl.disable(gl.BLEND);
[dye, velocity, divergence, curl, pressure].forEach(function (f) { if (f) f.destroy(); });
dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, type, gl.LINEAR);
velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, type, gl.LINEAR);
divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, type, gl.NEAREST);
curl = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, type, gl.NEAREST);
pressure = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, type, gl.NEAREST);
}
function step(dt) {
gl.disable(gl.BLEND);
var tx = velocity.texelSizeX;
var ty = velocity.texelSizeY;
var p;
p = programs.curl; p.bind();
gl.uniform2f(p.uniforms.texelSize, tx, ty);
gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
blit(curl);
p = programs.vorticity; p.bind();
gl.uniform2f(p.uniforms.texelSize, tx, ty);
gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
gl.uniform1i(p.uniforms.uCurl, curl.attach(1));
gl.uniform1f(p.uniforms.curl, config.CURL);
gl.uniform1f(p.uniforms.dt, dt);
blit(velocity.write);
velocity.swap();
p = programs.divergence; p.bind();
gl.uniform2f(p.uniforms.texelSize, tx, ty);
gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
blit(divergence);
p = programs.clear; p.bind();
gl.uniform1i(p.uniforms.uTexture, pressure.read.attach(0));
gl.uniform1f(p.uniforms.value, config.PRESSURE);
blit(pressure.write);
pressure.swap();
p = programs.pressure; p.bind();
gl.uniform2f(p.uniforms.texelSize, tx, ty);
gl.uniform1i(p.uniforms.uDivergence, divergence.attach(0));
for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
gl.uniform1i(p.uniforms.uPressure, pressure.read.attach(1));
blit(pressure.write);
pressure.swap();
}
p = programs.gradient; p.bind();
gl.uniform2f(p.uniforms.texelSize, tx, ty);
gl.uniform1i(p.uniforms.uPressure, pressure.read.attach(0));
gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(1));
blit(velocity.write);
velocity.swap();
p = programs.advection; p.bind();
gl.uniform2f(p.uniforms.texelSize, tx, ty);
var velocityId = velocity.read.attach(0);
gl.uniform1i(p.uniforms.uVelocity, velocityId);
gl.uniform1i(p.uniforms.uSource, velocityId);
gl.uniform1f(p.uniforms.dt, dt);
gl.uniform1f(p.uniforms.dissipation, config.VELOCITY_DISSIPATION);
blit(velocity.write);
velocity.swap();
gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
gl.uniform1i(p.uniforms.uSource, dye.read.attach(1));
gl.uniform1f(p.uniforms.dissipation, config.DENSITY_DISSIPATION);
blit(dye.write);
dye.swap();
}
function render() {
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);
var p = programs.display;
p.bind();
gl.uniform1i(p.uniforms.uTexture, dye.read.attach(0));
blit(null);
}
function correctRadius(radius) {
var aspect = canvas.width / canvas.height;
return aspect > 1 ? radius * aspect : radius;
}
function splat(x, y, dx, dy, color) {
var p = programs.splat;
p.bind();
gl.uniform1i(p.uniforms.uTarget, velocity.read.attach(0));
gl.uniform1f(p.uniforms.aspectRatio, canvas.width / canvas.height);
gl.uniform2f(p.uniforms.point, x, y);
gl.uniform3f(p.uniforms.color, dx, dy, 0);
gl.uniform1f(p.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100));
blit(velocity.write);
velocity.swap();
gl.uniform1i(p.uniforms.uTarget, dye.read.attach(0));
gl.uniform3f(p.uniforms.color, color.r, color.g, color.b);
blit(dye.write);
dye.swap();
}
function hsv(h, s, v) {
var i = Math.floor(h * 6);
var f = h * 6 - i;
var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
var rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
return { r: rgb[0], g: rgb[1], b: rgb[2] };
}
function generateColor() {
var hue = Math.random() < 0.2 ? 0.66 + Math.random() * 0.04 : 0.72 + Math.random() * 0.1;
var c = hsv(hue, 0.85, 1);
var k = C.theme && C.theme() === "xray" ? 0.26 : 0.2;
c.r *= k; c.g *= k; c.b *= k;
return c;
}
var pointer = { x: 0, y: 0, prevX: 0, prevY: 0, dx: 0, dy: 0, moved: false, down: false, color: generateColor(), seen: false };
var lastTime = performance.now();
var colorTimer = 0;
var lastInput = 0;
var running = false;
var raf = 0;
function resizeCanvas() {
var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
var w = Math.floor(window.innerWidth * dpr);
var h = Math.floor(window.innerHeight * dpr);
if (canvas.width !== w || canvas.height !== h) {
canvas.width = w;
canvas.height = h;
initFramebuffers();
}
}
function frame(now) {
var dt = Math.min((now - lastTime) / 1000, 0.016666);
lastTime = now;
colorTimer += dt * config.COLOR_UPDATE_SPEED;
if (colorTimer >= 1) {
colorTimer %= 1;
pointer.color = generateColor();
}
if (pointer.moved) {
pointer.moved = false;
splat(pointer.x, pointer.y, pointer.dx * config.SPLAT_FORCE, pointer.dy * config.SPLAT_FORCE, pointer.color);
}
step(dt);
render();
if (now - lastInput > config.IDLE_MS || document.hidden) {
running = false;
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.clear(gl.COLOR_BUFFER_BIT);
return;
}
raf = requestAnimationFrame(frame);
}
function wake() {
lastInput = performance.now();
if (running) return;
running = true;
lastTime = performance.now();
raf = requestAnimationFrame(frame);
}
function onMove(e) {
var dpr = canvas.width / window.innerWidth;
var x = (e.clientX * dpr) / canvas.width;
var y = 1 - (e.clientY * dpr) / canvas.height;
pointer.prevX = pointer.seen ? pointer.x : x;
pointer.prevY = pointer.seen ? pointer.y : y;
pointer.seen = true;
pointer.x = x;
pointer.y = y;
var aspect = canvas.width / canvas.height;
var dx = pointer.x - pointer.prevX;
var dy = pointer.y - pointer.prevY;
if (aspect < 1) dx *= aspect;
if (aspect > 1) dy /= aspect;
pointer.dx = dx;
pointer.dy = dy;
pointer.moved = Math.abs(dx) > 0 || Math.abs(dy) > 0;
wake();
}
function onDown(e) {
if (e.button !== 0) return;
var dpr = canvas.width / window.innerWidth;
var c = generateColor();
c.r *= 8; c.g *= 8; c.b *= 8;
wake();
splat((e.clientX * dpr) / canvas.width, 1 - (e.clientY * dpr) / canvas.height,
10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5), c);
}
function start() {
document.body.appendChild(canvas);
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointermove", function (e) {
if (e.pointerType === "mouse" || e.pointerType === "pen") onMove(e);
}, { passive: true });
window.addEventListener("pointerdown", onDown, { passive: true });
}
if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", start);
} else {
start();
}
})();
;(function () {
"use strict";
var C = window.Cipher || {};
if (C.reducedMotion) return;
var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*/<>{}=+";
function randomGlyph() {
return GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
}
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
var widths = chars.map(function (c) { return c.getBoundingClientRect().width; });
chars.forEach(function (c, i) {
c.style.width = widths[i] + "px";
});
return chars;
}
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
;(function () {
"use strict";
var C = window.Cipher || {};
if (C.reducedMotion || !C.finePointer) return;
var root = document.documentElement;
root.classList.add("has-fx-cursor");
var cursor = document.createElement("div");
cursor.className = "view-cursor";
cursor.setAttribute("aria-hidden", "true");
cursor.innerHTML = '<span class="vc-label"></span><span class="vc-icon"><svg viewBox="0 0 16 16"><path d="M5 11 11 5M6 5h5v5"/></svg></span>';
var label = cursor.querySelector(".vc-label");
var px = -100, py = -100, cxp = -100, cyp = -100, cursorOn = false, cursorRaf = 0;
function cursorLoop() {
cxp += (px - cxp) * 0.18;
cyp += (py - cyp) * 0.18;
cursor.style.transform = "translate3d(" + cxp.toFixed(1) + "px," + cyp.toFixed(1) + "px,0)";
if (cursorOn || Math.abs(px - cxp) > 0.5 || Math.abs(py - cyp) > 0.5) {
cursorRaf = requestAnimationFrame(cursorLoop);
} else {
cursorRaf = 0;
}
}
function showCursor(text, x, y) {
if (!cursorOn) {
cxp = x;
cyp = y;
}
label.textContent = text;
cursorOn = true;
cursor.classList.add("is-on");
if (!cursorRaf) cursorRaf = requestAnimationFrame(cursorLoop);
}
function hideCursor() {
cursorOn = false;
cursor.classList.remove("is-on");
}
var canvas = document.createElement("canvas");
canvas.className = "ripple-canvas";
canvas.setAttribute("aria-hidden", "true");
var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
var prog = null, uni = {}, texture = null;
var MAX_DROPS = 8;
if (gl) {
var vsrc = "attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }";
var fsrc = [
"precision highp float;",
"varying vec2 uv;",
"uniform sampler2D tex;",
"uniform vec2 res;",
"uniform float time;",
"uniform float strength;",
"uniform vec3 drops[" + MAX_DROPS + "];", // x, y (0..1), start time (s); start < 0 = unused
"void main(){",
"  float aspect = res.x / res.y;",
"  vec2 offset = vec2(0.0);",
"  for (int i = 0; i < " + MAX_DROPS + "; i++) {",
"    vec3 d = drops[i];",
"    if (d.z < 0.0) continue;",
"    float age = time - d.z;",
"    if (age < 0.0 || age > 2.4) continue;",
"    vec2 dir = uv - d.xy; dir.x *= aspect;",
"    float dist = length(dir);",
"    float front = age * 0.42;",                       // ring radius grows over time
"    float band = smoothstep(front + 0.02, front - 0.02, dist) * smoothstep(0.0, 0.05, dist);",
"    float wave = sin(dist * 70.0 - age * 14.0) * band;",
"    float decay = exp(-age * 1.6) * exp(-dist * 2.2);",
"    offset += (dist > 0.0001 ? dir / dist : vec2(0.0)) * wave * decay * 0.022;",
"  }",
"  offset *= strength;",
"  offset.x /= aspect;",
"  vec2 zoom = (uv - 0.5) * (1.0 - 0.025 * strength) + 0.5;",
"  float r = texture2D(tex, zoom + offset * 1.0).r;",
"  float g = texture2D(tex, zoom + offset * 1.6).g;",
"  float b = texture2D(tex, zoom + offset * 2.3).b;",
"  float a = texture2D(tex, zoom + offset).a;",
"  gl_FragColor = vec4(r, g, b, a);",
"}"
].join("\n");
try {
prog = gl.createProgram();
[[gl.VERTEX_SHADER, vsrc], [gl.FRAGMENT_SHADER, fsrc]].forEach(function (pair) {
var sh = gl.createShader(pair[0]);
gl.shaderSource(sh, pair[1]);
gl.compileShader(sh);
if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
gl.attachShader(prog, sh);
});
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
["tex", "res", "time", "strength", "drops"].forEach(function (n) {
uni[n] = gl.getUniformLocation(prog, n);
});
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
var loc = gl.getAttribLocation(prog, "p");
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
} catch (e) {
prog = null;
}
}
var snap = document.createElement("canvas");
var sctx = snap.getContext("2d");
function snapshot(box, w, h, dpr) {
snap.width = Math.round(w * dpr);
snap.height = Math.round(h * dpr);
sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
var bg = getComputedStyle(box).backgroundColor;
sctx.clearRect(0, 0, w, h);
if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
sctx.fillStyle = bg;
sctx.fillRect(0, 0, w, h);
}
var img = box.querySelector("img");
if (!img || !img.complete || !img.naturalWidth) return false;
var br = box.getBoundingClientRect();
var ir = img.getBoundingClientRect();
var ix = ir.left - br.left, iy = ir.top - br.top, iw = ir.width, ih = ir.height;
var cs = getComputedStyle(img);
var fit = cs.objectFit;
var nw = img.naturalWidth, nh = img.naturalHeight;
var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
var pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
ix += pl; iy += pt; iw -= pl + pr; ih -= pt + pb;
var scale = fit === "contain" ? Math.min(iw / nw, ih / nh) : fit === "cover" ? Math.max(iw / nw, ih / nh) : 0;
try {
sctx.save();
sctx.beginPath();
sctx.rect(ix, iy, iw, ih);
sctx.clip();
if (scale) {
var dw = nw * scale, dh = nh * scale;
sctx.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
} else {
sctx.drawImage(img, ix, iy, iw, ih);
}
sctx.restore();
return true;
} catch (e) {
return false;
}
}
var active = null;      // the hovered media box
var drops = [];
var strength = 0, target = 0;
var rippleRaf = 0;
var t0 = performance.now();
var lastDrop = { x: -1, y: -1, t: 0 };
function now() { return (performance.now() - t0) / 1000; }
function addDrop(x, y) {
drops.push([x, y, now()]);
if (drops.length > MAX_DROPS) drops.shift();
}
function rippleLoop() {
strength += (target - strength) * 0.12;
var flat = new Float32Array(MAX_DROPS * 3);
for (var i = 0; i < MAX_DROPS; i++) {
var d = drops[i];
flat[i * 3] = d ? d[0] : 0;
flat[i * 3 + 1] = d ? d[1] : 0;
flat[i * 3 + 2] = d ? d[2] : -1;
}
gl.viewport(0, 0, canvas.width, canvas.height);
gl.uniform2f(uni.res, canvas.width, canvas.height);
gl.uniform1f(uni.time, now());
gl.uniform1f(uni.strength, strength);
gl.uniform3fv(uni.drops, flat);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
if (target === 0 && strength < 0.02) {
canvas.classList.remove("is-on");
if (active) active.classList.remove("is-rippling");
active = null;
rippleRaf = 0;
return;
}
rippleRaf = requestAnimationFrame(rippleLoop);
}
function startRipple(box, e) {
if (!prog) return;
var r = box.getBoundingClientRect();
var dpr = Math.min(window.devicePixelRatio || 1, 2);
if (!snapshot(box, r.width, r.height, dpr)) return;
if (active && active !== box) active.classList.remove("is-rippling");
active = box;
canvas.width = snap.width;
canvas.height = snap.height;
if (canvas.parentNode !== box) box.appendChild(canvas); // sits under the box's tags
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snap);
drops = [];
addDrop((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
target = 1;
canvas.classList.add("is-on");
box.classList.add("is-rippling");
if (!rippleRaf) rippleRaf = requestAnimationFrame(rippleLoop);
}
var currentCursorEl = null;
document.addEventListener("pointermove", function (e) {
if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
px = e.clientX;
py = e.clientY;
var el = e.target.closest ? e.target.closest("[data-cursor]") : null;
if (el !== currentCursorEl) {
currentCursorEl = el;
if (el) showCursor(el.getAttribute("data-cursor"), px, py);
else hideCursor();
}
var box = e.target.closest ? e.target.closest("[data-ripple]") : null;
if (box && box !== active) {
startRipple(box, e);
} else if (!box && active && target) {
target = 0;
}
if (box && box === active) {
target = 1;
var r = box.getBoundingClientRect();
var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
var t = now();
var moved = Math.abs(x - lastDrop.x) + Math.abs(y - lastDrop.y);
if (t - lastDrop.t > 0.16 && moved > 0.04) {
addDrop(x, y);
lastDrop = { x: x, y: y, t: t };
}
}
}, { passive: true });
document.addEventListener("pointerleave", function () {
hideCursor();
target = 0;
});
function mount() {
document.body.appendChild(cursor);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
})();
;(function () {
"use strict";
var C = window.Cipher || {};
var hero = document.getElementById("home");
var canvas = hero && hero.querySelector(".hero-globe");
if (!canvas || !canvas.getContext) return;
var ctx = canvas.getContext("2d");
var reduced = !!C.reducedMotion;
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
function alphaHex(a) {
return Math.max(0, Math.min(1, a));
}
function draw(now) {
ctx.clearRect(0, 0, W, H);
var radius = R * (1 + scrollP * 0.55);
var fade = 1 - scrollP * 0.9;
if (fade <= 0.01) return;
ctx.globalAlpha = 1;
var g = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.45);
g.addColorStop(0, "rgba(139, 61, 255, " + (0.14 * fade) + ")");
g.addColorStop(1, "rgba(139, 61, 255, 0)");
ctx.fillStyle = g;
ctx.beginPath();
ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
ctx.fill();
ctx.globalAlpha = 0.35 * fade;
ctx.strokeStyle = col.accent;
ctx.lineWidth = 1;
ctx.beginPath();
ctx.arc(cx, cy, radius, 0, Math.PI * 2);
ctx.stroke();
drawOrbit(now, radius, 1.28, 0.95, 0.2, fade);
drawOrbit(now, radius, 1.46, -0.55, 0.65, fade);
var period = 6000 / (1 + scanBoost * 5);
var scanY = 1 - ((now % period) / period) * 2;
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
var sv = orbitPoint((now / 1000) * (0.5 / scale));
var ss = project(sv, radius);
ctx.globalAlpha = alphaHex((sv.z > 0 ? 1 : 0.3) * fade);
ctx.fillStyle = col.accent;
ctx.beginPath();
ctx.arc(ss.x, ss.y, 2.6, 0, Math.PI * 2);
ctx.fill();
}
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
function onScroll() {
var r = hero.getBoundingClientRect();
scrollP = Math.min(1, Math.max(0, -r.top / r.height));
}
window.addEventListener("scroll", onScroll, { passive: true });
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
;(function () {
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
var mq = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 560px)");
var pinned = false;
var ticking = false;
var stageH = 0;
var progress = -1;
var active = -1;
var shownPct = -1;
var isFinal = false;
var t = [];
for (var s = 0; s < N; s++) t.push(-1);
function clamp(v, a, b) {
return v < a ? a : v > b ? b : v;
}
function each(list, fn) {
Array.prototype.forEach.call(list, fn);
}
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
if (p !== progress) {
progress = p;
render();
}
}
function onScroll() {
if (!pinned || ticking) return;
ticking = true;
requestAnimationFrame(update);
}
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
if (cta) {
cta.addEventListener("click", function () {
if (C.flags) C.flags.capture("case_closed");
});
}
})();
;(function () {
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
var mqRow = window.matchMedia("(min-width: 901px)");
var mqHover = window.matchMedia("(hover: hover) and (pointer: fine)");
var PATTERNS = ["grid", "hex", "scan", "rings"];
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
;(function () {
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
;(function () {
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
'<img src="assets/images/projects/' + C.esc(cert.image) + '.webp" alt="" width="800" height="800" decoding="async" loading="lazy">' +
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
;(function () {
"use strict";
var C = window.Cipher || {};
var sec = document.getElementById("work");
if (!sec) return;
var track = sec.querySelector(".work-track");
var cards = Array.prototype.slice.call(sec.querySelectorAll(".work-card"));
var now = sec.querySelector("[data-work-now]");
var total = sec.querySelector("[data-work-total]");
var distance = 0;
var ticking = false;
function pad(n) { return n < 10 ? "0" + n : String(n); }
if (total) total.textContent = pad(cards.length);
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
if (now) now.textContent = pad(Math.min(cards.length - 1, Math.round(p * (cards.length - 1))) + 1);
}
window.addEventListener("scroll", function () {
if (!ticking) { ticking = true; requestAnimationFrame(update); }
}, { passive: true });
window.addEventListener("resize", layout);
window.addEventListener("load", layout);
layout();
})();
;(function () {
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
;(function () {
"use strict";
var form = document.getElementById("contact-form");
if (!form) return;
var status = form.querySelector(".cf-status");
var button = form.querySelector('button[type="submit"]');
var trap = form.querySelector("#cf-website");
var FALLBACK = "Couldn't send. Email me directly at ciphersensei@proton.me.";
var COOLDOWN = 60000;
var SENT_KEY = "cipher-contact-sent";
var openedAt = Date.now();
var inited = false;
function ready() {
if (!window.emailjs) return false;
if (!inited) {
window.emailjs.init({ publicKey: "7CjxO3yjXAz6geZFb", blockHeadless: true });
inited = true;
}
return true;
}
function say(text, kind) {
status.textContent = text;
status.className = "cf-status mono" + (kind ? " is-" + kind : "");
}
function sent() {
form.reset();
say("Message sent. I'll get back to you.", "ok");
}
function lastSent() {
try { return Number(localStorage.getItem(SENT_KEY)) || 0; } catch (e) { return 0; }
}
function markSent() {
try { localStorage.setItem(SENT_KEY, String(Date.now())); } catch (e) {}
}
window.addEventListener("load", ready);
form.addEventListener("submit", function (e) {
e.preventDefault();
if (!form.reportValidity()) return;
if ((trap && trap.value) || Date.now() - openedAt < 3000) {
sent();
return;
}
if (Date.now() - lastSent() < COOLDOWN) {
say("You just sent one. Give it a minute.", "err");
return;
}
if (!ready()) {
say(FALLBACK, "err");
return;
}
button.disabled = true;
say("Sending…");
window.emailjs.sendForm("service_3cv5ga3", "template_r4fp27a", form).then(function () {
markSent();
sent();
}, function () {
say(FALLBACK, "err");
}).then(function () {
button.disabled = false;
});
});
})();
