# portfolio.github.io

Cipher's portfolio, served by GitHub Pages at [itsnetamji.in](https://itsnetamji.in).

## Editing

`index.html` is assembled from parts — edit the parts, then rebuild:

```bash
python3 src/build.py        # writes index.html
```

| What | Where |
|---|---|
| Page shell: header, menu, footer, flag hunt | `src/index.template.html` |
| One file per section (hero, process, about, …) | `src/partials/*.html` |
| Colours, fonts, buttons, shared components | `assets/css/main.css` (tokens at the top) |
| Section styles / scripts | `assets/css/sections/*.css`, `assets/js/sections/*.js` |
| Effects: loader, fluid cursor, scramble text, card ripple | `assets/js/fx/*.js` |
| Skills and certificates (data) | `skills.json`, `projects.json` |

Change the accent colour in one place: `--accent` (and `--accent-ink` for small text) in `assets/css/main.css`.

The fluid cursor is adapted from Pavel Dobryakov's [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) (MIT).
