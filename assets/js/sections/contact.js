/* Contact form, sent with EmailJS (self-hosted SDK, loaded with defer by the page template). */
(function () {
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

  // one message a minute per browser, remembered across reloads
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
    // a filled trap or a form finished within seconds of the page opening is a bot:
    // look successful, send nothing
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
