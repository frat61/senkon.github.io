# SENKON 3D model viewer and editor: design

Date: 2026-10-08
Owner: Fırat Şentürk (Senkon Mühendislik)
Source brief: Fırat's "SENKON 3D model viewer and editor: brief for Claude Code" (08.10.2026)
Starting point: `lab-frame-3d.html` (steel laboratory building, single-project page)

## 1. Goal

Clients open a 3D structural concept model on their phone from a link, with no login
and no app. Fırat creates and edits the models himself in a small editor on his own
website. The starting file becomes a reusable viewer that draws any model from data,
plus an editor that produces that data.

## 2. Decisions

| Topic | Decision |
|---|---|
| Site | GitHub Pages, repo `frat61/senkon.github.io`, branch `main`, domain **senkonmuhendislik.com** (CNAME). The brief said senkon.com.tr; that domain does not resolve today. |
| Work branch | `model-viewer` in `C:\Dev\senkon` (clone of the repo). Fırat pushes and merges. Only `model/` and `docs/` are added; no other page of the site changes. |
| Build | None. Plain HTML, CSS and scripts. three.js r128 and supabase-js v2 are vendored under `model/vendor/` and pinned. |
| Client access | Link only: `/model/?m=<slug>`. No client accounts. |
| Storage | New, dedicated Supabase project. Only the anon key appears in the pages. |
| Editing | One owner login (email + password). Public sign-up disabled in Supabase; Fırat's user is created in the dashboard. |
| Versions | One link per model; the link always shows the latest save. "Duplicate" makes a frozen copy with its own link. |
| Language | Turkish interface. |
| Status line | "Ön tasarım modelidir, uygulama için değildir." is always visible in the viewer and in every exported image or drawing. |
| Home page redesign | Wanted by Fırat, but a separate piece of work after Stage 1 of the viewer (see section 10). |

## 3. Pages

| Page | Address | Who | Purpose |
|---|---|---|---|
| Viewer | `/model/?m=<slug>` | anyone with the link | Loads one model by slug and draws it. Read only. |
| Editor | `/model/editor.html` | Fırat, after login | Model list; create, edit, duplicate, delete; copy share link. |

### Viewer behaviour (kept from the starting file)
- Orbit, zoom and pan with mouse and touch (one finger rotate, pinch zoom, two fingers pan).
- Layer switches: panels, roof skin, interior walls, floor beams, deck, purlins, glass, roof bracing.
- Fixed dimensions and level tags, room names, tap-two-points measuring with snapping.
- View presets: overview, west, south, plan.
- Phone layout with the collapsible "Seçenekler" panel; light and dark theme.
- `window.__shot({...})` still-render hook for headless PNG renders.

### Viewer additions
- Unknown or missing slug: plain "Model bulunamadı" message, not an error page.
- Page title, header title and header paragraph come from the model's `name` and `description`.
- The status line is built from the fixed sentence, the model's `source` and its `updated_at`.
- `kind = 'file'` rows show "Bu model türü henüz desteklenmiyor." The page decides what to draw from `kind`; nothing outside the parametric builder assumes the model is parametric.

## 4. File layout

```
.nojekyll           tells GitHub Pages to serve files as they are
.gitignore          local/, .claude/, node_modules/
model/
  index.html        viewer shell: reads ?m=, fetches the row, mounts the viewer, wires buttons
  viewer.css        styles shared by viewer and editor shells
  builder.js        pure geometry builder: model object in, plain item list out (no three.js)
  viewer.js         three.js renderer and interaction for the builder's output
  config.js         SUPABASE_URL and SUPABASE_ANON_KEY (anon key only)
  editor.html       Stage 2
  editor.js         Stage 2
  vendor/
    three.r128.min.js
    supabase-js.v2.x.min.js     loaded by the editor only
tools/
  make-model-sql.js      writes an INSERT with a fresh random slug for one model JSON
tests/
  builder.test.js        node:test checks of the builder (skips lab checks if local/ is absent)
docs/
  model/
    schema.sql        table, RLS policy, get_model function, updated_at trigger
    README.md         Fırat's steps: Supabase setup, inserting a model, publishing
  superpowers/specs/  this document
  superpowers/plans/  implementation plans
local/                gitignored, never published: client data
  lab-frame-3d.html   the original file, for side-by-side comparison
  lab-model.json      the laboratory model as a row-shaped object {name, description, kind, data}
  lab-model.sql       the generated insert for the laboratory model
  extract-lab-model.js   one-off extractor for the laboratory model (embeds that project's names)
```

GitHub Pages serves the whole repository, so anything with client data (the lab model, the
original file, generated inserts) lives only in the gitignored `local/` folder. `docs/` and
`tools/` hold nothing secret.

The builder is split from the renderer on purpose: a pure builder can be tested in Node
without three.js, and Stage 3 (DXF export) and the later tonnage estimate can reuse its
item list directly.

## 5. viewer.js interface

`viewer.js` defines one global, `SenkonViewer`, with one function:

```
const v = SenkonViewer.mount(container, model, { compact: bool })
```

`model` is the parametric data object of section 6. The handle `v` offers:

| Member | Purpose |
|---|---|
| `v.layers` | ordered list of `{ key, label, visible }` for building the layer buttons |
| `v.setLayer(key, on)` | show or hide a group; returns the new state |
| `v.setView(name)` | `iso`, `west`, `south`, `top`; recentres the target |
| `v.setMeasuring(on)` | enters or leaves the measuring mode and clears points |
| `v.onMeasure(fn)` | callback with `{ d, hz, vt }` after the second point, `{ pending: true }` after the first, `null` on clear |
| `v.rebuild(model)` | replaces the scene content from a new model object, keeps the camera |
| `v.resize()` | re-fits the canvas to its container |
| `v.shot(opts)` | the still-render hook (`layers`, `opaque`, `view`, `tgt`, `fov`, `tagScale`); also exposed as `window.__shot` by the viewer shell |
| `v.dispose()` | frees GPU resources |

Everything about buttons, cards, menu and theme lives in the page shells. The viewer only
draws, handles pointer input on its own canvas, and reads the CSS variable `--bg` for the
clear colour so themes keep working. The editor reuses the same file for live redraw.

## 6. Model data format (`kind = 'parametric'`, `v = 1`)

Units are metres. Plan origin is the north-west outer corner of the building; `x` runs
east, `y` runs south, `z` is up. In the three.js scene: X = x, Z = y, Y = z.

```json
{
  "v": 1,
  "outline": { "x": 35.05, "y": 19.66 },
  "axes": { "x": [0.10, 5.85, 11.50, 19.45, 27.40, 34.95], "y": [0.10, 8.85, 19.55] },
  "interiorRows": [1],
  "levels": { "ceiling": 4.00, "deck": 4.45, "eave": 5.75, "ridge": 6.30 },
  "roof": { "type": "gable", "ridgeAxisY": 1, "purlinBays": 14 },
  "frame": { "type": "beams", "column": 0.25, "fixedBases": true },
  "deck": { "enabled": true, "secondarySpacing": 2.2 },
  "facades": { "north": "panel", "east": "panel", "west": "panel", "south": "glass" },
  "claddingOffset": 0.16,
  "glassModule": 1.2,
  "windPosts": { "west": [5.65, 13.53], "east": [4.04, 11.84, 15.74] },
  "entrance": { "side": "south", "from": 27.55, "to": 29.35, "height": 2.4, "canopy": true },
  "walls": [[x1, y1, x2, y2]],
  "doors": [{ "h": 1, "a": 11.77, "b": 12.73, "c": 8.93, "e": 0 }],
  "rooms": [{ "name": "Lab", "x": 8.9, "y": 15.2 }],
  "labels": [{ "name": "Bina girişi", "x": 28.45, "y": 18.6, "z": 2.9 }],
  "source": "<drawing number and date>"
}
```

Field notes:
- `roof.type`: `"gable"` (ridge high on `ridgeAxisY`), `"butterfly"` (valley low on
  `ridgeAxisY`) or `"mono"` (eave on the first y axis, ridge on the last). The roof height
  function is the only place that changes per type. `purlinBays` defaults to 14.
  `levels.ridge` is the high point for gable and mono, the low point for butterfly.
- `frame.type`: `"beams"` (rolled rafters, columns on every axis crossing, including the
  `interiorRows`) or `"truss"` (clear-span lattice truss between the outer rows, no interior
  columns; `interiorRows` ignored). The clear-span truss is new code; the three-support truss
  of the starting file is dropped.
- `deck.enabled` false removes the mechanical floor beams, deck plane and the deck level tag.
  Secondary beams per bay: `round(bay / secondarySpacing)` subdivisions.
- `facades`: `"panel"`, `"glass"` or `"open"` per side. A glass side gets the full-height
  curtain wall with mullions every `glassModule`; wall lines lying on that side's outer face
  are not drawn as interior walls. Gable sides follow the roof line.
- `claddingOffset`: distance of panel faces outside the axis lines, default 0.16.
- `windPosts`: plan positions along the west and east gables (y values), mid-bay posts.
- `entrance`: optional. `side` is one of the four sides; `from`/`to` run along that side.
- `walls`: wall face lines from the architect's DXF, 4 m high translucent planes.
- `doors`: `h` = 1 if the wall runs along x; `a`..`b` is the opening; `c` is the wall's
  position on the other axis; `e` = 1 for exterior doors.
- `rooms` are grey floor labels; `labels` are orange labels at height `z`.
- Member sizes are concept values. Section names are never shown unless a model includes them.
- Derived, never stored: dimension lines and level tags, measuring snap points, axis bubbles.

Missing optional fields take the defaults above, so the editor can save sparse objects.
The `v` field is checked on load; a higher version than the viewer knows shows
"Model sürümü desteklenmiyor".

The laboratory model's values are the first row in the database. `local/lab-model.json`
holds them; the rendered result must match `lab-frame-3d.html`.

## 7. Database (Supabase)

One table. Clients fetch a model by slug through a function; they can never list models.

```sql
create table public.models (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  kind        text not null default 'parametric' check (kind in ('parametric','file')),
  data        jsonb,
  file_path   text,
  file_format text,
  owner       uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.models enable row level security;
create policy models_owner_all on public.models
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create or replace function public.get_model(p_slug text)
returns table (name text, description text, kind text, data jsonb, file_path text, file_format text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select name, description, kind, data, file_path, file_format, updated_at
  from public.models where slug = p_slug limit 1;
$$;
revoke all on function public.get_model(text) from public;
grant execute on function public.get_model(text) to anon, authenticated;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger models_updated_at before update on public.models
  for each row execute function public.set_updated_at();
```

Rules:
- Slug: 12 characters from `abcdefghjkmnpqrstuvwxyz23456789` (no look-alikes), from
  `crypto.getRandomValues`. Never derived from the project name.
- The viewer calls `POST {SUPABASE_URL}/rest/v1/rpc/get_model` with plain `fetch` and the
  `apikey` header. No library on the public page.
- The editor uses vendored supabase-js for auth and table access under RLS.
- Service-role key: never in client code or in the repository.

## 8. Error handling

| Case | Viewer shows |
|---|---|
| No `?m=` or unknown slug | "Model bulunamadı" card, no canvas |
| Network error or Supabase down | "Model yüklenemedi, lütfen tekrar deneyin" with a retry button |
| `kind = 'file'` | "Bu model türü henüz desteklenmiyor" |
| `data.v` newer than the viewer | "Model sürümü desteklenmiyor" |
| WebGL unavailable | "Tarayıcınız 3B görüntülemeyi desteklemiyor" |

While loading, the shell shows "Model yükleniyor…". The header is filled only after the row
arrives, so a wrong slug never leaks another model's text.

## 9. Testing

- Stage 1 acceptance: `/model/?m=<lab slug>` looks and behaves like `lab-frame-3d.html` on
  desktop and on an iPhone, and a wrong slug shows "Model bulunamadı".
- Local: serve `C:\Dev\senkon` with a static server, open the viewer and the original file
  side by side in the in-app browser at desktop and phone widths; check every layer button,
  view preset, measuring, dark mode and the `__shot` hook.
- The builder is pure (model object in, item list out): `node --test tests/` loads
  `local/lab-model.json` into `builder.js` and counts items per role against the original
  file's numbers (columns, rafters, purlins, braces, wind posts, doors, walls, tags).
- During development the viewer shell accepts `?src=<same-origin JSON>` on localhost only, so
  the lab model can be drawn before the Supabase project exists.
- Live: after Fırat pushes, the real check is the link on his iPhone in Safari.

## 10. Stages

**Stage 1: viewer from the database** (this plan)
- Split the starting file into `viewer.js` and the page shell; move every hard-coded project
  value into the data format; clear-span truss; `kind` switch.
- `docs/model/schema.sql`, `local/lab-model.sql`, `local/lab-model.json`.
- Fırat: create the Supabase project, disable sign-ups, create his user, run both SQL files,
  paste URL and anon key into `model/config.js`.

**Stage 2: editor** (superseded on 2026-10-08 by `2026-10-08-stage2-uploads-design.md`: models are view only, no editor; Stage 2 is the owner upload page and file viewing)
- Login, model list, create, duplicate, delete, copy link. Side panel for every parametric
  field; live redraw with `v.rebuild`; explicit save. Done when the lab model can be recreated
  from an empty model using only the editor, apart from walls and doors.

**Stage 3: plan in, drawings out**
- DXF upload with manual layer selection for walls and doors; export axis plan as DXF and
  renders as PNG, each carrying the status line.

**Later, not now**
- `kind = 'file'`: IFC (Revit, Tekla) and glTF/GLB (SketchUp) uploads to Supabase Storage,
  shown view-only on the same page and link. Size limits and loading feedback.
- Rough steel tonnage, client comments.
- **Home page redesign** of senkonmuhendislik.com as a Senkon Mühendislik site. Separate
  design conversation, after Stage 1.

## 11. Constraints

- Phones first; test on iOS Safari. Everything is served from the site, never opened as a
  local file on the phone.
- No public listing of models anywhere: no sitemap entry, no directory index, no slugs in
  the page source.
- Pinned, vendored dependencies.
- Other pages of the site are not changed without asking.
