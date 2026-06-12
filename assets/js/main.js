/* =============================================
   CIPHER PORTFOLIO — MAIN JS
   ============================================= */

/* ── CURSOR ── */
const dot  = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  dot.style.left  = mx + 'px';
  dot.style.top   = my + 'px';
});

(function animateRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px';
  ring.style.top  = ry + 'px';
  requestAnimationFrame(animateRing);
})();

document.querySelectorAll('a, button, input, textarea').forEach(el => {
  el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
  el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
});

/* ── MATRIX RAIN ── */
(function matrixRain() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>{}[]|\\/@#$%^&*_-+=~`¥ΩΣΔΛΨΓΦΘΞΠαβγδε';
  let cols, drops;

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    cols  = Math.floor(canvas.width / 16);
    drops = Array(cols).fill(0).map(() => Math.floor(Math.random() * -50));
  }
  resize();
  window.addEventListener('resize', resize);

  setInterval(() => {
    ctx.fillStyle = 'rgba(8,12,10,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff88';
    ctx.font = '13px Share Tech Mono, monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.globalAlpha = 0.25 + Math.random() * 0.5;
      ctx.fillText(ch, i * 16, y * 16);
      ctx.globalAlpha = 1;
      if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
      else drops[i]++;
    });
  }, 45);
})();

/* ── TYPED HERO TEXT ── */
(function typedEffect() {
  const el = document.getElementById('typed-text');
  if (!el) return;
  const phrases = [
    'Cybersecurity Practitioner',
    'Malware Researcher',
    'Digital Forensics Analyst',
    'SOC Analyst',
    'Threat Hunter',
  ];
  let pi = 0, ci = 0, deleting = false;
  let pause = false;

  function tick() {
    const phrase = phrases[pi];
    if (deleting) {
      el.textContent = phrase.slice(0, ci--);
      if (ci < 0) { deleting = false; pi = (pi + 1) % phrases.length; ci = 0; pause = true; }
    } else {
      el.textContent = phrase.slice(0, ci++);
      if (ci > phrase.length) { deleting = true; pause = true; }
    }
    const speed = deleting ? 40 : 75;
    const delay = pause ? (deleting ? 200 : 1400) : speed;
    pause = false;
    setTimeout(tick, delay);
  }
  setTimeout(tick, 800);
})();

/* ── NAVBAR SCROLL & ACTIVE ── */
const header  = document.getElementById('header');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  // Header shadow
  header.classList.toggle('scrolled', window.scrollY > 40);

  // Scroll-top visibility
  const st = document.getElementById('scroll-top');
  if (st) st.classList.toggle('visible', window.scrollY > 300);

  // Active nav link via scroll position
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  navLinks.forEach(a => {
    a.classList.toggle('active', a.dataset.section === current);
  });
});

/* ── HAMBURGER ── */
const ham = document.getElementById('hamburger');
const nav = document.getElementById('navbar');
ham && ham.addEventListener('click', () => {
  nav.classList.toggle('open');
});
// Close on link click (mobile)
navLinks.forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

/* ── SMOOTH SCROLL ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ── SKILLS from JSON ── */
const SKILLS_FALLBACK = [
  { name: 'Python',      icon: 'assets/icons/1_python.svg' },
  { name: 'C / C++',     icon: 'assets/icons/1_c.svg' },
  { name: 'Bash',        icon: 'assets/icons/1_bash.svg' },
  { name: 'Linux',       icon: 'assets/icons/1_linux.svg' },
  { name: 'Burp Suite',  icon: 'assets/icons/1_burpsuite.svg' },
  { name: 'Metasploit',  icon: 'assets/icons/1_metasploit.svg' },
  { name: 'Wireshark',   icon: 'assets/icons/1_wireshark.svg' },
  { name: 'Docker',      icon: 'assets/icons/1_docker.svg' },
  { name: 'Networking',  icon: 'assets/icons/1_network-adapter.svg' },
  { name: 'WireGuard',   icon: 'assets/icons/1_wireguard.svg' },
  { name: 'Fortran',     icon: 'assets/icons/1_fortran.svg' },
  { name: 'LaTeX',       icon: 'assets/icons/1_latex.svg' },
];

function renderSkills(skills) {
  const grid = document.getElementById('skills-grid');
  if (!grid) return;
  grid.innerHTML = skills.map(s => `
    <div class="skill-item reveal">
      <img src="${s.icon}" alt="${s.name}" onerror="this.style.display='none'">
      <span class="skill-name">${s.name}</span>
    </div>
  `).join('');
  observeReveal();
}

fetch('skills.json')
  .then(r => r.json())
  .then(renderSkills)
  .catch(() => renderSkills(SKILLS_FALLBACK));

/* ── CERTIFICATIONS from projects.json ── */
const CERT_ICONS = {
  'android':    'fa-mobile-screen-button',
  'forensics':  'fa-fingerprint',
  'firewall':   'fa-fire',
  'network':    'fa-network-wired',
  'hpc':        'fa-microchip',
  'internship': 'fa-building',
};

function renderCerts(certs) {
  const grid = document.getElementById('certs-grid');
  if (!grid) return;
  grid.innerHTML = certs.map(c => {
    const icon = CERT_ICONS[c.image] || 'fa-certificate';
    const hasView = c.links.view && c.links.view !== 'Broken' && !c.links.view.startsWith('https://github.com/jigar');
    return `
    <div class="cert-card reveal">
      <div class="cert-icon"><i class="fas ${icon}"></i></div>
      <div class="cert-info">
        <h3>${c.name}</h3>
        <p>${c.desc}</p>
        ${hasView ? `<a href="${c.links.view}" target="_blank">View Certificate <i class="fas fa-arrow-right"></i></a>` : ''}
      </div>
    </div>`;
  }).join('');
  observeReveal();
}

fetch('projects.json')
  .then(r => r.json())
  .then(renderCerts)
  .catch(() => {});

/* ── CONTACT FORM ── */
const form   = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');

form && form.addEventListener('submit', e => {
  e.preventDefault();
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> TRANSMITTING...';
  submitBtn.disabled = true;

  emailjs.sendForm('service_3cv5ga3', 'template_r4fp27a', '#contact-form')
    .then(() => {
      status.textContent  = '> Message transmitted successfully.';
      status.className    = 'form-status success';
      form.reset();
    })
    .catch(() => {
      status.textContent  = '> Transmission failed. Try direct email.';
      status.className    = 'form-status error';
    })
    .finally(() => {
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> TRANSMIT';
      submitBtn.disabled  = false;
      setTimeout(() => status.textContent = '', 5000);
    });
});

/* ── SCROLL REVEAL ── */
function observeReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal, .tl-item').forEach(el => obs.observe(el));
}
observeReveal();

/* ── TIMELINE PHOTOS — auto-detect & lightbox ── */
(function initTimelinePhotos() {

  // Inject lightbox DOM once
  const lb = document.createElement('div');
  lb.className = 'tl-lightbox';
  lb.id = 'tl-lightbox';
  lb.innerHTML = `
    <img id="lb-img" src="" alt="">
    <div class="tl-lightbox-bar">
      <span class="tl-lightbox-caption" id="lb-caption"></span>
      <button class="tl-lightbox-close" id="lb-close">[ ESC / CLOSE ]</button>
    </div>`;
  document.body.appendChild(lb);

  const lbEl    = document.getElementById('tl-lightbox');
  const lbImg   = document.getElementById('lb-img');
  const lbCap   = document.getElementById('lb-caption');
  const lbClose = document.getElementById('lb-close');

  function openLightbox(src, caption) {
    lbImg.src = src; lbCap.textContent = caption;
    lbEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lbEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  lbClose.addEventListener('click', closeLightbox);
  lbEl.addEventListener('click', e => { if (e.target === lbEl) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  // For every photo wrap: try to load image, show if success, keep placeholder if fail
  document.querySelectorAll('.tl-photo-wrap').forEach(wrap => {
    const img = wrap.querySelector('.tl-photo');
    if (!img) return;

    const probe = new Image();
    probe.onload = () => {
      wrap.classList.add('has-photo');
      // Click to open lightbox
      img.addEventListener('click', () => {
        const card = wrap.closest('.tl-card');
        const title = card ? card.querySelector('h3').textContent : '';
        openLightbox(img.src, title);
      });
    };
    // If image fails — placeholder stays, no error in console
    probe.onerror = () => { /* placeholder stays visible, nothing to do */ };
    probe.src = img.src;
  });

})();

/* ── TITLE BLINK ON TAB CHANGE ── */
document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? 'See you soon...' : 'CIPHER\'s Portfolio';
});

/* ── TERMINAL TYPING (hero) ── */
(function terminalTyping() {
  const el = document.querySelector('.t-typing');
  if (!el) return;
  const cmds = ['cat skills.json', 'ls -la projects/', 'python3 watchdog.py', 'sudo nmap -sV target'];
  let ci = 0, charIdx = 0, deleting = false;

  function step() {
    const cmd = cmds[ci];
    if (!deleting) {
      el.textContent = cmd.slice(0, ++charIdx);
      if (charIdx >= cmd.length) { deleting = true; setTimeout(step, 2000); return; }
    } else {
      el.textContent = cmd.slice(0, --charIdx);
      if (charIdx === 0) { deleting = false; ci = (ci + 1) % cmds.length; }
    }
    setTimeout(step, deleting ? 35 : 90);
  }
  setTimeout(step, 1200);
})();
