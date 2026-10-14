(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- mobile menu ---------- */

  var header = document.querySelector(".site-header");
  var nav = document.getElementById("site-nav");
  var toggle = document.querySelector(".menu-toggle");

  function setMenu(open) {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    toggle.querySelector("i").className = open ? "fas fa-times" : "fas fa-bars";
  }

  toggle.addEventListener("click", function () {
    setMenu(!nav.classList.contains("open"));
  });

  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      setMenu(false);
      toggle.focus();
    }
  });

  /* ---------- header state + back-to-top ---------- */

  var scrollTop = document.getElementById("scroll-top");

  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle("scrolled", y > 10);
    scrollTop.classList.toggle("visible", y > 600);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- active nav link ---------- */

  var navLinks = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));

  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = "#" + entry.target.id;
        navLinks.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    document.querySelectorAll("main section[id]").forEach(function (s) {
      sectionObserver.observe(s);
    });
  }

  /* ---------- reveal on scroll ---------- */

  var revealObserver = null;

  if ("IntersectionObserver" in window && !reduceMotion) {
    revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  }

  function reveal(elements) {
    Array.prototype.forEach.call(elements, function (el, i) {
      if (revealObserver) {
        el.style.transitionDelay = Math.min(i % 4, 3) * 70 + "ms";
        revealObserver.observe(el);
      } else {
        el.classList.add("in-view");
      }
    });
  }

  reveal(document.querySelectorAll(".reveal"));

  /* ---------- typing effect ---------- */

  var typingEl = document.querySelector(".typing-text");
  var words = ["Cyber Security", "Web Designing", "Web Development", "Information Technology"];

  if (typingEl) {
    if (reduceMotion) {
      typingEl.textContent = words[0];
    } else {
      var w = 0, c = 0, deleting = false;
      (function tick() {
        var word = words[w];
        c += deleting ? -1 : 1;
        typingEl.textContent = word.slice(0, c);

        var delay = deleting ? 35 : 75;
        if (!deleting && c === word.length) {
          deleting = true;
          delay = 1400;
        } else if (deleting && c === 0) {
          deleting = false;
          w = (w + 1) % words.length;
          delay = 300;
        }
        setTimeout(tick, delay);
      })();
    }
  }

  /* ---------- data-driven sections ---------- */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function getJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + " " + res.status);
      return res.json();
    });
  }

  var skillsContainer = document.getElementById("skillsContainer");

  getJSON("skills.json").then(function (skills) {
    skillsContainer.innerHTML = skills.map(function (skill) {
      return '<li class="skill reveal">' +
        '<span class="skill-icon"><img src="' + esc(skill.icon) + '" alt="" width="28" height="28" loading="lazy"></span>' +
        "<span>" + esc(skill.name) + "</span>" +
        "</li>";
    }).join("");
    reveal(skillsContainer.querySelectorAll(".reveal"));
  }).catch(function () {
    skillsContainer.innerHTML = '<li class="cert-empty">// could not load skills.json</li>';
  });

  var certContainer = document.getElementById("certContainer");

  getJSON("projects.json").then(function (certs) {
    certContainer.innerHTML = certs.map(function (cert) {
      var link = cert.links && cert.links.view;
      var action = link
        ? '<a class="link-arrow" href="' + esc(link) + '" target="_blank" rel="noopener">view certificate <i class="fas fa-arrow-right" aria-hidden="true"></i></a>'
        : '<span class="link-arrow disabled">link coming soon</span>';

      return '<article class="card cert-card reveal">' +
        '<div class="cert-head">' +
          '<span class="cert-logo"><img src="assets/images/projects/' + esc(cert.image) + '.png" alt="" loading="lazy"></span>' +
          "<h3>" + esc(cert.name) + "</h3>" +
        "</div>" +
        "<p>" + esc(cert.desc) + "</p>" +
        action +
        "</article>";
    }).join("");
    reveal(certContainer.querySelectorAll(".reveal"));
  }).catch(function () {
    certContainer.innerHTML = '<p class="cert-empty">// could not load projects.json</p>';
  });

  /* ---------- contact form (EmailJS) ---------- */

  var form = document.getElementById("contact-form");
  var statusEl = document.getElementById("form-status");

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "form-status" + (kind ? " " + kind : "");
  }

  if (window.emailjs) {
    emailjs.init({ publicKey: "7CjxO3yjXAz6geZFb" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!window.emailjs) {
      setStatus("> mail service unavailable — email me at ciphersensei@proton.me", "err");
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus("> sending...");

    emailjs.sendForm("service_3cv5ga3", "template_r4fp27a", form)
      .then(function () {
        form.reset();
        setStatus("> message sent. thanks!", "ok");
      }, function (error) {
        console.error("EmailJS failed", error);
        setStatus("> send failed — please try again", "err");
      })
      .then(function () {
        button.disabled = false;
      });
  });

  /* ---------- small touches ---------- */

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  document.addEventListener("visibilitychange", function () {
    document.title = document.visibilityState === "visible" ? "Portfolio | Cipher" : "See you soon";
  });
})();
