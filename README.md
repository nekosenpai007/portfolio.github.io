# portfolio.github.io

Cipher's portfolio, served by GitHub Pages at [itsnetamji.in](https://itsnetamji.in).

## Editing

`index.html` is assembled from parts — edit the parts, then rebuild:

```bash
python3 src/build.py        # writes index.html + assets/dist/site.css + assets/dist/site.js
```

The page loads one CSS and one JS bundle (`assets/dist/`, versioned so visitors get
updates right away). Never edit `assets/dist/` by hand: it is rebuilt from the sources below.

| What | Where |
|---|---|
| Page shell: header, menu, footer, flag hunt | `src/index.template.html` |
| One file per section (hero, process, about, …) | `src/partials/*.html` |
| Colours, fonts, buttons, shared components | `assets/css/main.css` (tokens at the top) |
| Section styles / scripts | `assets/css/sections/*.css`, `assets/js/sections/*.js` |
| Effects: loader, fluid cursor, scramble text, card ripple | `assets/js/fx/*.js` |
| Fonts (self-hosted, Latin only) | `assets/fonts/` |
| Images | `assets/images/` (WebP, sized for how they are shown) |
| Skills and certificates (data) | `skills.json`, `projects.json` |

Change the accent colour in one place: `--accent` (and `--accent-ink` for small text) in `assets/css/main.css`.

The fluid cursor is adapted from Pavel Dobryakov's [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) (MIT).
