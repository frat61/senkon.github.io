# senkonmuhendislik.com

Static site on GitHub Pages (branch `main`). No build step.

- `index.html` + `site.css`: the home page (design: `docs/superpowers/specs/2026-10-09-home-page-design.md`).
- `assets/senkon/`: logo, favicon, self-hosted fonts (`fonts/SOURCES.txt` records origin and hashes), the hero frame (`hero-model.json`, `hero.svg`, `hero.js`).
- `structkit/`: engineering calculators (own styles, own logo copy).
- `model/`: 3D model viewer and owner page (`docs/model/README.md`).
- `tools/`: `make-logo.py`, `fetch-fonts.js`, `make-hero-svg.js`, `make-model-sql.js`.
- `tests/`: `node --test` (bare) runs everything.

Regenerate the hero drawing after editing `assets/senkon/hero-model.json`: `node tools/make-hero-svg.js`.
