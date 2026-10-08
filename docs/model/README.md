# SENKON 3D model viewer

Viewer for parametric structural concept models at `/model/?m=<slug>`.
Design: `docs/superpowers/specs/2026-10-08-model-viewer-design.md`.

## Files

- `model/index.html` page shell, `model/builder.js` geometry, `model/viewer.js` three.js rendering,
  `model/config.js` Supabase URL and anon key, `model/vendor/three.r128.min.js` pinned three.js.
- `docs/model/schema.sql` database setup. `tools/make-model-sql.js` insert generator. `tests/` builder tests.
- `local/` (gitignored): client data for local testing. Never commit or publish it.

## Vendored dependencies

| File | Source | SHA-256 |
|---|---|---|
| `model/vendor/three.r128.min.js` | https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js | `9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2` |
| `model/vendor/GLTFLoader.r128.js` | https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js | `5c15967ba830918a9caea6338712c994c354bccd4edc4569bde411c3ec06a3e6` |
| `model/vendor/GLTFExporter.r128.js` | https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js | `a228cae09518e5034600a1aec65c3b3453f706f8943e542721c63c5e5727499c` |
| `model/vendor/supabase-js.v2.117.3.min.js` | https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js | `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3` |
| `model/vendor/web-ifc/web-ifc-api-iife.js` | https://cdn.jsdelivr.net/npm/web-ifc@0.0.78/web-ifc-api-iife.js | `c6f7ba2b407065eac53a2d47e152f79bc987b120c42a7ea17355f7cc55bfdbf4` |
| `model/vendor/web-ifc/web-ifc.wasm` | https://cdn.jsdelivr.net/npm/web-ifc@0.0.78/web-ifc.wasm | `1fbd30bd5515ff6ad15268e87aa26e41d57b29411c8461618b63bee92735d349` |

`GLTFLoader` is loaded by the viewer only when a model is a file; `GLTFExporter`, supabase-js
and web-ifc are loaded by the owner page only.

## Local development

Serve the repository root (the viewer fetches `config.js` and vendor files relatively):

    python -m http.server 8080 --bind 127.0.0.1

Then open `http://127.0.0.1:8080/model/?src=../local/lab-model.json`. The `src` parameter works
only on localhost and loads a row-shaped JSON file instead of the database.

Run the builder tests with `node --test` (bare; `node --test tests/` does not work on Node 24).

## Database setup (once)

1. Create a new Supabase project for senkonmuhendislik.com.
2. Authentication > Providers > Email: turn off "Allow new users to sign up".
3. Authentication > Users > Add user: your e-mail and a password (auto-confirm).
4. SQL editor: paste and run `docs/model/schema.sql`.
5. Project Settings > API: copy the Project URL and the `anon` `public` key into `model/config.js`.
   Only the anon key. Never the `service_role` key. Newer dashboards call it the `publishable` key; either works, the viewer sends it only as `apikey`.

## Adding the laboratory model (first row)

    node local/extract-lab-model.js local/lab-frame-3d.html
    node tools/make-model-sql.js local/lab-model.json <your-login-email> > local/lab-model.sql

The extractor lives in `local/` because it embeds the laboratory project's names; only `make-model-sql.js` is generic.

Run `local/lab-model.sql` in the SQL editor. The last line of the file is the share link.
`local/` is gitignored; do not commit these files.

## Publishing

Push `model-viewer` to GitHub and merge into `main`; GitHub Pages deploys within a minute.
Open the share link on an iPhone in Safari to check. Nothing links to `/model/`, and the slug
is random, so a model is reachable only by its link.

## Stage 2 setup (once)

1. SQL editor: run `docs/model/schema-stage2.sql` (preview column, `models` bucket, bucket policies).
2. Open `https://senkonmuhendislik.com/model/panel.html`, sign in with the owner e-mail and password.

## Adding a model

"Model ekle" on the owner page: name, optional description and source reference, and a file:
- `.glb` or self-contained `.gltf` (SketchUp: File > Export > 3D Model > glTF/GLB),
- `.ifc` (Revit, Tekla): converted to GLB in your browser; large models take a while,
- `.json` data sheet (parametric, like the laboratory model).
The card shows the link; "Bağlantıyı kopyala" copies it. "Dosyayı değiştir" keeps the link and
swaps the file. "Sil" removes the file and the row; the link then shows "Model bulunamadı".
Limit: 50 MB per file. The IFC file itself never leaves your computer.
