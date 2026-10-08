# SENKON 3D model viewer

Viewer for parametric structural concept models at `/model/?m=<slug>`.
Design: `docs/superpowers/specs/2026-10-08-model-viewer-design.md`.

## Files

- `model/index.html` page shell, `model/builder.js` geometry, `model/viewer.js` three.js rendering,
  `model/config.js` Supabase URL and anon key, `model/vendor/three.r128.min.js` pinned three.js.
- `docs/model/schema.sql` database setup. `tools/` helper scripts. `tests/` builder tests.
- `local/` (gitignored): client data for local testing. Never commit or publish it.

## Vendored dependencies

| File | Source | SHA-256 |
|---|---|---|
| `model/vendor/three.r128.min.js` | https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js | `9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2` |

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
   Only the anon key. Never the `service_role` key.

## Adding the laboratory model (first row)

    node tools/extract-lab-model.js local/lab-frame-3d.html
    node tools/make-model-sql.js local/lab-model.json <your-login-email> > local/lab-model.sql

Run `local/lab-model.sql` in the SQL editor. The last line of the file is the share link.
`local/` is gitignored; do not commit these files.

## Publishing

Push `model-viewer` to GitHub and merge into `main`; GitHub Pages deploys within a minute.
Open the share link on an iPhone in Safari to check. Nothing links to `/model/`, and the slug
is random, so a model is reachable only by its link.
