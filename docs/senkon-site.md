# senkonmuhendislik.com

Static site on GitHub Pages (branch `main`). No build step.

- `index.html` + `site.css`: the home page (design: `docs/superpowers/specs/2026-10-09-home-page-design.md`).
- `assets/senkon/`: logo, favicon, self-hosted fonts (`fonts/SOURCES.txt` records origin and hashes), the skyline band (`skyline.webp` picture, `skyline.json` building columns, `skyline-names.txt`, `skyline.js` build animation).
- `structkit/`: engineering calculators (own styles, own logo copy).
- `model/`: 3D model viewer and owner page (`docs/model/README.md`).
- `tools/`: `make-logo.py`, `fetch-fonts.js`, `measure-skyline.py`, `make-model-sql.js`.
- `tests/`: `node --test` (bare) runs everything.

The skyline picture is composed from the ChatGPT drawing kept outside the repo (`local/skyline-chatgpt-v3.webp`): `python tools/compose-skyline.py <drawing> assets/senkon/skyline.webp --gap 60 --drop 1,7,10,11,15` (drops Flatiron, the İstanbul Airport tower, the Gherkin, SWFC and One WTC; `--insert i:file:height_px` can add a stand-alone drawing, e.g. the Esenboğa tower kept in `local/esenboga-ref/`). Then re-measure the building columns: `python tools/measure-skyline.py assets/senkon/skyline.webp assets/senkon/skyline.json assets/senkon/skyline-names.txt` (add `--split x` where two neighbours touch). Names in `skyline-names.txt` are in left-to-right order.
