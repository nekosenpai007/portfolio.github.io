// Particle network behind the hero. Skipped for visitors who prefer reduced motion.
if (window.particlesJS && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  particlesJS("particles-js", {
    particles: {
      number: { value: 60, density: { enable: true, value_area: 900 } },
      color: { value: "#3dff9a" },
      shape: { type: "circle" },
      opacity: { value: 0.5, random: true },
      size: { value: 2.4, random: true },
      line_linked: {
        enable: true,
        distance: 150,
        color: "#3dff9a",
        opacity: 0.18,
        width: 1
      },
      move: {
        enable: true,
        speed: 1.2,
        direction: "none",
        random: false,
        straight: false,
        out_mode: "out"
      }
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: { enable: true, mode: "grab" },
        onclick: { enable: false },
        resize: true
      },
      modes: {
        grab: { distance: 160, line_linked: { opacity: 0.5 } }
      }
    },
    retina_detect: true
  });
}
