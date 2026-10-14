/* Certifications: render work cards from projects.json. */
(function () {
  "use strict";

  var C = window.Cipher || {};
  var grid = document.getElementById("certContainer");
  if (!grid || !C.getJSON) return;
  var countEl = document.querySelector("[data-cert-count]");
  var ARROW = '<svg class="i-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>';

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  C.getJSON("projects.json").then(function (certs) {
    var total = pad(certs.length);
    if (countEl) countEl.textContent = total;
    grid.innerHTML = certs.map(function (cert, i) {
      var link = cert.links && cert.links.view;
      var media =
        '<span class="wcard-media cert-media"' + (link ? ' data-ripple data-cursor="View certificate"' : "") + ">" +
          '<img src="assets/images/projects/' + C.esc(cert.image) + '.png" alt="" width="1080" height="1080" loading="lazy">' +
          '<span class="wcard-tags"><span class="tag-box">Certificate</span></span>' +
        "</span>";
      var body =
        '<span class="wcard-body">' +
          '<span class="wcard-meta">' + pad(i + 1) + " / " + total + (link ? "" : " &middot; link coming soon") + "</span>" +
          '<span class="wcard-title">' + C.esc(cert.name) + "</span>" +
          '<span class="wcard-desc">' + C.esc(cert.desc) + "</span>" +
          '<span class="wcard-go">' + ARROW + "</span>" +
        "</span>";
      return link
        ? '<a class="wcard reveal" href="' + C.esc(link) + '" target="_blank" rel="noopener">' + media + body + "</a>"
        : '<div class="wcard wcard--muted reveal">' + media + body + "</div>";
    }).join("");
    if (C.reveal) C.reveal(grid);
    if (C.refreshChapters) C.refreshChapters();
  }).catch(function () {
    grid.innerHTML = '<p class="cert-empty mono">// could not load projects.json</p>';
  });
})();
