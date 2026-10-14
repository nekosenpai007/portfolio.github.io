/* Contact form, sent with EmailJS (loaded with defer by the page template). */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  if (!form) return;
  var status = form.querySelector(".cf-status");
  var button = form.querySelector('button[type="submit"]');
  var FALLBACK = "Couldn't send. Email me directly at ciphersensei@proton.me.";
  var inited = false;

  function ready() {
    if (!window.emailjs) return false;
    if (!inited) {
      window.emailjs.init({ publicKey: "7CjxO3yjXAz6geZFb" });
      inited = true;
    }
    return true;
  }

  function say(text, kind) {
    status.textContent = text;
    status.className = "cf-status mono" + (kind ? " is-" + kind : "");
  }

  window.addEventListener("load", ready);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (!ready()) {
      say(FALLBACK, "err");
      return;
    }
    button.disabled = true;
    say("Sending…");
    window.emailjs.sendForm("service_3cv5ga3", "template_r4fp27a", form).then(function () {
      form.reset();
      say("Message sent. I'll get back to you.", "ok");
    }, function () {
      say(FALLBACK, "err");
    }).then(function () {
      button.disabled = false;
    });
  });
})();
