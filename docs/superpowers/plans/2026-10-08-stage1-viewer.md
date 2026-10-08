# Stage 1: Viewer From the Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/model/?m=<slug>` on senkonmuhendislik.com draws any parametric SENKON model from Supabase, and the laboratory model looks and behaves like `lab-frame-3d.html`.

**Architecture:** A pure builder (`model/builder.js`) turns a model data object into a plain list of items (bars, rods, boxes, triangles, lines, tags). A three.js renderer (`model/viewer.js`) draws that list and handles orbit, layers, measuring and still renders. A thin page shell (`model/index.html`) fetches the row by slug with one `fetch` call and wires the buttons. The database is one table behind a `get_model(slug)` function; clients can never list models.

**Tech Stack:** plain HTML/CSS/JS, three.js r128 (vendored), Supabase (Postgres + PostgREST RPC), Node 24 `node:test` for the builder tests, Python's `http.server` for local serving. No build step.

**Spec:** `docs/superpowers/specs/2026-10-08-model-viewer-design.md`

## Global Constraints

- Work on branch `model-viewer` in `C:\Dev\senkon`. Never push; Fırat pushes and merges.
- Only `model/`, `docs/`, `tools/`, `tests/`, `.gitignore` and `.nojekyll` are added. No other page of the site changes.
- Client data (the lab model, the original HTML, generated inserts) lives only in the gitignored `local/` folder. Never commit it, never place it under a served path.
- Interface text is Turkish. The status line "Ön tasarım modelidir, uygulama için değildir." is always visible in the viewer.
- Plan coordinates everywhere in the builder: `[x east, y south, z up]` in metres. The viewer maps plan `[x, y, z]` to three.js `(x, z, y)`.
- Only the Supabase anon key may appear in `model/config.js`. No service-role key anywhere.
- three.js is pinned to r128 and vendored at `model/vendor/three.r128.min.js`; no CDN script tags in the pages.
- Slugs: 12 characters from `abcdefghjkmnpqrstuvwxyz23456789`, from `crypto.getRandomValues`.
- Commit after every task with the message trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Tests: `node --test` (bare; it discovers tests/*.test.js — `node --test tests/` fails on Node 24) must pass before each commit (from Task 3 on).

---

### Task 1: Repository scaffold and vendored three.js

**Files:**
- Create: `.gitignore`, `.nojekyll`, `.claude/launch.json`, `model/config.js`, `model/vendor/three.r128.min.js`, `docs/model/README.md`

**Interfaces:**
- Produces: `window.SENKON_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }` (read by Task 8's shell).

- [ ] **Step 1: Create `.gitignore` and `.nojekyll`**

`.gitignore`:
```
local/
.claude/
node_modules/
```

`.nojekyll` is an empty file. (It stops GitHub Pages from running Jekyll, which otherwise ignores some folder names; the site is plain HTML and does not use Jekyll.)

Run from `C:\Dev\senkon` (PowerShell):
```powershell
Set-Content -Encoding utf8 .gitignore "local/`n.claude/`nnode_modules/`n"; New-Item -ItemType File .nojekyll | Out-Null; New-Item -ItemType Directory -Force local, model\vendor, docs\model, tools, tests, .claude | Out-Null
```

- [ ] **Step 2: Download and verify three.js r128**

```powershell
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" -OutFile model\vendor\three.r128.min.js; (Get-FileHash model\vendor\three.r128.min.js -Algorithm SHA256).Hash; Select-String -Path model\vendor\three.r128.min.js -Pattern 'REVISION="128"' -Quiet
```
Expected: a 64-character hash printed and `True` (the file declares revision 128). Record the hash in `docs/model/README.md` (Step 4).

- [ ] **Step 3: Create `model/config.js` and the launch config**

`model/config.js`:
```js
// Public configuration of the model viewer. Only the Supabase *anon* key belongs here.
// The anon key is designed to be public; row level security and the get_model function
// decide what it can see. Never put the service-role key in this file.
window.SENKON_CONFIG = {
  SUPABASE_URL: '',       // e.g. https://abcdefghijkl.supabase.co
  SUPABASE_ANON_KEY: ''   // "anon public" key from Project Settings > API
};
```

`.claude/launch.json` (gitignored, local serving only):
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "site",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8080", "--bind", "127.0.0.1"],
      "port": 8080
    }
  ]
}
```

- [ ] **Step 4: Write the first version of `docs/model/README.md`**

```markdown
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
| `model/vendor/three.r128.min.js` | https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js | `<hash from Task 1 Step 2>` |

## Local development

Serve the repository root (the viewer fetches `config.js` and vendor files relatively):

    python -m http.server 8080 --bind 127.0.0.1

Then open `http://127.0.0.1:8080/model/?src=../local/lab-model.json`. The `src` parameter works
only on localhost and loads a row-shaped JSON file instead of the database.

Run the builder tests with `node --test tests/`.
```
Replace `<hash from Task 1 Step 2>` with the real hash.

- [ ] **Step 5: Commit**

```bash
git add .gitignore .nojekyll model/config.js model/vendor/three.r128.min.js docs/model/README.md
git commit -m "Scaffold model viewer folder and vendor three.js r128

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Extract the laboratory model into `local/`

**Files:**
- Create: `tools/extract-lab-model.js`
- Create (gitignored): `local/lab-model.json`, `local/lab-frame-3d.html`

**Interfaces:**
- Produces: `local/lab-model.json`, a row-shaped object `{ name, description, kind: 'parametric', updated_at, data }` where `data` follows spec section 6. Tests (Task 3+) and the dev shell (Task 8) read this file.

- [ ] **Step 1: Copy the original file into `local/`**

```powershell
Copy-Item "C:\Users\Firat\Downloads\lab-frame-3d.html" local\lab-frame-3d.html
```

- [ ] **Step 2: Write `tools/extract-lab-model.js`**

```js
// Builds local/lab-model.json (a row-shaped object) from the original lab-frame-3d.html.
// The walls, doors and axes come from the DATA constant in the file; every other value was
// hard-coded in its script and is written out here in the v1 data format.
// Usage: node tools/extract-lab-model.js local/lab-frame-3d.html
'use strict';
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join('local', 'lab-frame-3d.html');
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/const DATA=(\{[\s\S]*?\});\r?\n/);
if (!m) throw new Error('DATA constant not found in ' + file);
const D = JSON.parse(m[1]);

const rooms = [['Lab', 8.9, 15.2], ['Kimyasal depo', 7.6, 4.2], ['Numune giriş', 3.0, 7.3], ['Numune kabul', 3.0, 12.3],
  ['Kadın soyunma', 13.6, 7.0], ['WC', 16.9, 7.0], ['WC', 19.8, 7.0], ['Erkek soyunma', 22.9, 7.0], ['Arşiv', 26.0, 7.0],
  ['Çay ocağı', 24.0, 1.6], ['Temizlik', 19.8, 1.6], ['Koridor', 14.0, 10.0], ['Analiz', 20.3, 15.3], ['Toplantı', 25.2, 13.8],
  ['Ofis', 25.2, 18.0], ['Ofis 1', 32.2, 17.7], ['Ofis 2', 32.2, 13.8], ['Ofis 3', 32.2, 9.9], ['Ofis 4', 32.2, 6.0], ['Ofis 5', 32.2, 2.0]];
const labels = [['Malzeme girişi', -0.3, 2.35, 2.9], ['Numune girişi', -0.3, 10.06, 2.9], ['Bina girişi', 28.45, 18.6, 2.9], ['Acil çıkış', 28.24, -0.3, 2.9]];

const row = {
  name: 'Laboratuvar binası, taşıyıcı sistem ön tasarımı',
  description: 'Tek katlı çelik çerçeve, 35.05 × 19.66 m. 4.00 m tavan yüksekliğinde laboratuvar katı, üzerinde mekanik kat ve az eğimli çatı. Üç cephe panel, güney cephe cam.',
  kind: 'parametric',
  updated_at: '2026-10-05T00:00:00Z',
  data: {
    v: 1,
    outline: { x: 35.05, y: 19.66 },
    axes: { x: D.xs, y: D.ys },
    interiorRows: [1],
    levels: { ceiling: 4.0, deck: 4.45, eave: 5.75, ridge: 6.3 },
    roof: { type: 'gable', ridgeAxisY: 1, purlinBays: 14 },
    frame: { type: 'beams', column: 0.25, fixedBases: true },
    deck: { enabled: true, secondarySpacing: 2.2 },
    facades: { north: 'panel', east: 'panel', west: 'panel', south: 'glass' },
    claddingOffset: 0.16,
    glassModule: 1.2,
    windPosts: { west: [5.65, 13.53], east: [4.04, 11.84, 15.74] },
    entrance: { side: 'south', from: 27.55, to: 29.35, height: 2.4, canopy: true },
    walls: D.walls,
    doors: D.doors,
    rooms: rooms.map(([name, x, y]) => ({ name, x, y })),
    labels: labels.map(([name, x, y, z]) => ({ name, x, y, z })),
    source: 'ENL-26_336-F-001 (02.10.2026)'
  }
};
fs.mkdirSync('local', { recursive: true });
fs.writeFileSync(path.join('local', 'lab-model.json'), JSON.stringify(row, null, 1));
console.log('walls', D.walls.length, 'doors', D.doors.length, 'xs', D.xs.length, 'ys', D.ys.length);
```

- [ ] **Step 3: Run it and check the counts**

```bash
node tools/extract-lab-model.js local/lab-frame-3d.html
```
Expected output: `walls 262 doors 32 xs 6 ys 3`, and `local/lab-model.json` exists.

- [ ] **Step 4: Commit the tool only**

```bash
git status --short   # local/ must NOT appear
git add tools/extract-lab-model.js
git commit -m "Add tool that extracts the laboratory model into local/

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Builder skeleton: defaults, roof profile, layers

**Files:**
- Create: `model/builder.js`, `tests/builder.test.js`

**Interfaces:**
- Produces: global `SenkonBuilder` (also `module.exports` in Node) with
  `VERSION` (1), `LAYERS`, `DEFAULTS`, `normalize(model) -> m`, `roofProfile(m) -> (y => z)`, `ridgeY(m) -> y`, `levelTags(m, zt) -> [[y, z, name]]`, `build(model) -> { v, items, snaps, layers, center:[x,y], size, levels:{ceiling,deck,eave,ridge}, model }`, `parts` (array of sub-builders, filled by Tasks 4 to 6).
- Item shapes (all coordinates are plan `[x, y, z]`): `{ kind:'bar', layer, role, a, b, w, h, mat }`, `{ kind:'rod', layer, role, a, b, r, mat }`, `{ kind:'box', layer, role, center:[x,y,z], size:[dx,dy,dz], mat }`, `{ kind:'tris', layer, role, pos:[x,y,z,...], mat }`, `{ kind:'lines', layer, role, pos:[x,y,z,x,y,z,...], mat }`, `{ kind:'tag', layer, role, text, p, color, k }`, `{ kind:'bubble', layer:'axes', role:'axis', text, p }`.
- Build context passed to each sub-builder: `{ m, xs, ys, nx, ny, L, zt, yr, items, snaps, quad, bar, rod, box, tris, lines, tag, bubble }` where `bar(layer, role, a, b, w, h, mat)`, `rod(layer, role, a, b, r, mat)`, `box(layer, role, center, size, mat)`, `tris(layer, role, pos, mat)`, `lines(layer, role, pos, mat)`, `tag(layer, role, text, p, color, k)`, `bubble(text, p)`, `quad(a, b, c, d) -> 18 numbers (two triangles)`.

- [ ] **Step 1: Write the failing tests**

`tests/builder.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const B = require('../model/builder.js');

const LAB_FILE = path.join(__dirname, '..', 'local', 'lab-model.json');
const lab = fs.existsSync(LAB_FILE) ? JSON.parse(fs.readFileSync(LAB_FILE, 'utf8')).data : null;
const labTest = (name, fn) => test(name, { skip: lab ? false : 'local/lab-model.json missing' }, fn);
const count = (out, role, layer) => out.items.filter(i => i.role === role && (!layer || i.layer === layer)).length;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('normalize applies defaults and derives the outline', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 10] } });
  assert.equal(m.frame.column, 0.25);
  assert.equal(m.roof.type, 'gable');
  assert.deepEqual(m.windPosts, { west: [], east: [] });
  assert.equal(m.entrance, null);
  assert.deepEqual(m.outline, { x: 6.1, y: 10.1 });
  assert.deepEqual(m.interiorRows, []);
});

test('normalize keeps given values and sorts axes', () => {
  const m = B.normalize({ axes: { x: [12, 0, 6], y: [10, 0] }, frame: { type: 'truss' }, interiorRows: [1, 5] });
  assert.deepEqual(m.axes.x, [0, 6, 12]);
  assert.equal(m.frame.type, 'truss');
  assert.equal(m.frame.column, 0.25);
  assert.deepEqual(m.interiorRows, []);  // 1 is not interior for two y rows, 5 is out of range
});

test('normalize rejects missing axes and newer versions', () => {
  assert.throws(() => B.normalize({}), /axes/);
  assert.throws(() => B.normalize({ axes: { x: [0], y: [0, 1] } }), /axes/);
  assert.throws(() => B.normalize({ v: 2, axes: { x: [0, 1], y: [0, 1] } }), /version/);
});

test('gable profile: eave at the ends, ridge on the ridge axis, linear between', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 8, 20] }, levels: { eave: 5, ridge: 7 } });
  const zt = B.roofProfile(m);
  near(zt(0), 5); near(zt(8), 7); near(zt(20), 5); near(zt(4), 6); near(zt(14), 6);
});

test('butterfly profile has its low point on the ridge axis', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 8, 20] }, levels: { eave: 6, ridge: 4 }, roof: { type: 'butterfly' } });
  const zt = B.roofProfile(m);
  near(zt(0), 6); near(zt(8), 4); near(zt(20), 6);
});

test('mono profile is linear from eave to ridge', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 10] }, levels: { eave: 5, ridge: 7 }, roof: { type: 'mono' } });
  near(B.roofProfile(m)(5), 6);
});

test('gable with only two rows puts the ridge at mid-span', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 10] }, levels: { eave: 5, ridge: 7 } });
  near(B.ridgeY(m), 5); near(B.roofProfile(m)(5), 7);
});

test('build returns centre, size, levels and layers', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, outline: { x: 35.05, y: 19.66 } });
  assert.deepEqual(out.center, [17.525, 9.83]);
  assert.equal(out.size, 35.05);
  assert.ok(out.layers.find(l => l.key === 'steel' && l.button === false));
  assert.ok(!out.layers.find(l => l.key === 'glass'), 'no glass layer without a glass facade');
  assert.ok(!out.layers.find(l => l.key === 'walls'), 'no walls layer without walls');
  assert.equal(out.levels.ceiling, 4);
});

test('deck disabled drops the floor and deck layers', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, deck: { enabled: false } });
  assert.ok(!out.layers.find(l => l.key === 'floor'));
  assert.ok(!out.layers.find(l => l.key === 'deck'));
});

test('rooms layer starts hidden', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, rooms: [{ name: 'A', x: 1, y: 1 }] });
  assert.equal(out.layers.find(l => l.key === 'rooms').visible, false);
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
node --test tests/
```
Expected: failures with `Cannot find module '../model/builder.js'`.

- [ ] **Step 3: Write `model/builder.js`**

```js
/* SenkonBuilder: pure geometry builder for SENKON parametric models (format v1).
   Input: a model data object (docs/superpowers/specs/2026-10-08-model-viewer-design.md, section 6).
   Output: plain JS objects only; no three.js, no DOM. All coordinates are plan coordinates
   [x east, y south, z up] in metres. The viewer turns these items into three.js objects. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SenkonBuilder = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 1;
  const SIDES = ['north', 'east', 'south', 'west'];
  const DEFAULTS = {
    interiorRows: [],
    levels: { ceiling: 4.0, deck: 4.45, eave: 5.75, ridge: 6.3 },
    roof: { type: 'gable', ridgeAxisY: 1, purlinBays: 14 },
    frame: { type: 'beams', column: 0.25, fixedBases: true },
    deck: { enabled: true, secondarySpacing: 2.2 },
    facades: { north: 'panel', east: 'panel', west: 'panel', south: 'panel' },
    claddingOffset: 0.16,
    glassModule: 1.2,
    windPosts: { west: [], east: [] },
    entrance: null,
    walls: [], doors: [], rooms: [], labels: [],
    source: ''
  };
  // Layer catalogue. button:false layers are always visible and get no switch in the page.
  const LAYERS = [
    { key: 'base',  label: 'Zemin',            visible: true,  button: false },
    { key: 'steel', label: 'Çelik',            visible: true,  button: false },
    { key: 'raf',   label: 'Çatı kirişleri',   visible: true,  button: false },
    { key: 'doors', label: 'Kapılar',          visible: true,  button: false },
    { key: 'axes',  label: 'Akslar',           visible: true,  button: false },
    { key: 'clad',  label: 'Paneller',         visible: true,  button: true },
    { key: 'skin',  label: 'Çatı kaplaması',   visible: true,  button: true },
    { key: 'walls', label: 'İç duvarlar',      visible: true,  button: true },
    { key: 'floor', label: 'Döşeme kirişleri', visible: true,  button: true },
    { key: 'deck',  label: 'Döşeme',           visible: true,  button: true },
    { key: 'roof',  label: 'Aşıklar',          visible: true,  button: true },
    { key: 'glass', label: 'Cam cephe',        visible: true,  button: true },
    { key: 'rb',    label: 'Çatı çaprazları',  visible: true,  button: true },
    { key: 'dim',   label: 'Ölçüler',          visible: true,  button: true },
    { key: 'rooms', label: 'Mahal adları',     visible: false, button: true }
  ];

  function normalize(model) {
    if (!model || typeof model !== 'object') throw new Error('model missing');
    if ((model.v || 1) > VERSION) throw new Error('unsupported model version ' + model.v);
    const ax = model.axes;
    if (!ax || !Array.isArray(ax.x) || ax.x.length < 2 || !Array.isArray(ax.y) || ax.y.length < 2) throw new Error('axes missing: need at least two x and two y axes');
    const m = { v: VERSION };
    Object.keys(DEFAULTS).forEach(k => {
      const d = DEFAULTS[k], given = model[k];
      if (d && typeof d === 'object' && !Array.isArray(d)) m[k] = Object.assign({}, d, given || {});
      else m[k] = given !== undefined && given !== null ? given : d;
    });
    m.axes = { x: ax.x.map(Number).sort((a, b) => a - b), y: ax.y.map(Number).sort((a, b) => a - b) };
    const nx = m.axes.x.length - 1, ny = m.axes.y.length - 1;
    m.outline = Object.assign({ x: +(m.axes.x[nx] + 0.1).toFixed(3), y: +(m.axes.y[ny] + 0.1).toFixed(3) }, model.outline || {});
    m.interiorRows = (m.interiorRows || []).map(Number).filter(i => i > 0 && i < ny);
    return m;
  }

  // y position of the ridge (gable) or valley (butterfly). Falls back to mid-span when the
  // ridge axis index is not an interior row.
  function ridgeY(m) {
    const ys = m.axes.y, ny = ys.length - 1, k = m.roof.ridgeAxisY;
    return (k >= 1 && k <= ny - 1) ? ys[k] : (ys[0] + ys[ny]) / 2;
  }

  // Roof height at plan position y (top of steel). The only place that depends on roof.type.
  function roofProfile(m) {
    const ys = m.axes.y, ny = ys.length - 1, L = m.levels;
    if (m.roof.type === 'mono') return y => L.eave + (L.ridge - L.eave) * (y - ys[0]) / (ys[ny] - ys[0]);
    const yr = ridgeY(m);
    return y => y <= yr ? L.eave + (L.ridge - L.eave) * (y - ys[0]) / (yr - ys[0])
                        : L.eave + (L.ridge - L.eave) * (ys[ny] - y) / (ys[ny] - yr);
  }

  // Named roof levels for the dimension tags: [[y, z, name], ...]
  function levelTags(m, zt) {
    const ys = m.axes.y, ny = ys.length - 1, L = m.levels;
    if (m.roof.type === 'mono') {
      const lo = L.eave <= L.ridge ? ys[0] : ys[ny], hi = lo === ys[0] ? ys[ny] : ys[0];
      return [[lo, zt(lo), 'saçak'], [hi, zt(hi), 'üst saçak']];
    }
    const yr = ridgeY(m);
    return [[ys[ny], zt(ys[ny]), 'saçak'], [yr, zt(yr), m.roof.type === 'butterfly' ? 'dere' : 'mahya']];
  }

  const quad = (a, b, c, d) => [].concat(a, b, c, a, c, d);

  const PARTS = [];  // sub-builders (frame, floor, envelope, architecture, annotations), each called with the context

  function build(model) {
    const m = normalize(model);
    const xs = m.axes.x, ys = m.axes.y, nx = xs.length - 1, ny = ys.length - 1;
    const L = m.levels, zt = roofProfile(m), yr = ridgeY(m);
    const items = [], snaps = [];
    const add = (layer, it) => { it.layer = layer; items.push(it); return it; };
    const ctx = {
      m, xs, ys, nx, ny, L, zt, yr, items, snaps, quad, SIDES,
      bar: (layer, role, a, b, w, h, mat) => add(layer, { kind: 'bar', role, a, b, w, h, mat }),
      rod: (layer, role, a, b, r, mat) => add(layer, { kind: 'rod', role, a, b, r, mat }),
      box: (layer, role, center, size, mat) => add(layer, { kind: 'box', role, center, size, mat }),
      tris: (layer, role, pos, mat) => add(layer, { kind: 'tris', role, pos, mat }),
      lines: (layer, role, pos, mat) => add(layer, { kind: 'lines', role, pos, mat }),
      tag: (layer, role, text, p, color, k) => add(layer, { kind: 'tag', role, text, p, color, k: k || 1 }),
      bubble: (text, p) => add('axes', { kind: 'bubble', role: 'axis', text, p })
    };
    PARTS.forEach(f => f(ctx));
    const anyGlass = SIDES.some(s => m.facades[s] === 'glass'), anyPanel = SIDES.some(s => m.facades[s] === 'panel');
    const keep = { floor: m.deck.enabled, deck: m.deck.enabled, glass: anyGlass, clad: anyPanel,
      walls: m.walls.length > 0, rooms: m.rooms.length + m.labels.length > 0 };
    const layers = LAYERS.filter(l => keep[l.key] !== false).map(l => Object.assign({}, l));
    return {
      v: VERSION, items, snaps, layers,
      center: [m.outline.x / 2, m.outline.y / 2], size: Math.max(m.outline.x, m.outline.y),
      levels: { ceiling: L.ceiling, deck: L.deck, eave: zt(ys[ny]), ridge: zt(yr) },
      model: m
    };
  }

  return { VERSION, LAYERS, DEFAULTS, normalize, ridgeY, roofProfile, levelTags, quad, build, parts: PARTS };
});
```

- [ ] **Step 4: Run the tests**

```bash
node --test tests/
```
Expected: all tests pass (10 pass, 0 fail).

- [ ] **Step 5: Commit**

```bash
git add model/builder.js tests/builder.test.js
git commit -m "Add builder skeleton: defaults, roof profile, layer catalogue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Builder: frame, truss, floor and annotations

**Files:**
- Modify: `model/builder.js` (insert the three functions below before `const PARTS = [];` and the `PARTS.push` lines after it)
- Modify: `tests/builder.test.js` (append)

**Interfaces:**
- Consumes: the build context of Task 3.
- Produces roles: `column`, `base`, `joint`, `rafter`, `tie` (layer `steel`/`raf`), `trussChord`, `trussDiag`, `trussPost` (layer `raf`), `floorPrimary`, `floorJoint`, `floorEdge`, `floorSecondary` (layer `floor`), `deck` (layer `deck`), `slab` (layer `base`), `bay`, `total`, `span`, `level` tags and `dimLine` (layer `dim`), `axis` bubbles (layer `axes`); `ctx.snaps` filled with `[x, y, z]` column points.

- [ ] **Step 1: Append the failing tests**

```js
labTest('lab frame: columns, rafters, joints, ties', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'column', 'steel'), 18);
  assert.equal(count(out, 'base', 'steel'), 18);
  assert.equal(count(out, 'joint', 'raf'), 18);
  assert.equal(count(out, 'rafter', 'raf'), 12);
  assert.equal(count(out, 'tie', 'steel'), 3);
  const col = out.items.find(i => i.role === 'column');
  assert.deepEqual(col.a, [0.1, 0.1, 0]); near(col.b[2], 5.75); assert.equal(col.w, 0.25);
});

labTest('lab floor: primaries, edges, secondaries, deck plane, slab', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'floorPrimary', 'floor'), 12);
  assert.equal(count(out, 'floorJoint', 'floor'), 18);
  assert.equal(count(out, 'floorEdge', 'floor'), 3);
  assert.equal(count(out, 'floorSecondary', 'floor'), 7);
  assert.equal(count(out, 'deck', 'deck'), 1);
  assert.equal(count(out, 'slab', 'base'), 1);
});

labTest('lab annotations: dimension tags, axis bubbles, snaps', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'bay', 'dim'), 5);
  assert.equal(count(out, 'span', 'dim'), 2);
  assert.equal(count(out, 'total', 'dim'), 2);
  const levels = out.items.filter(i => i.role === 'level').map(i => i.text).sort();
  assert.deepEqual(levels, ['mahya +6.30', 'mekanik kat +4.45', 'saçak +5.75', 'tavan +4.00']);
  assert.equal(count(out, 'dimLine', 'dim'), 1);
  assert.equal(out.items.filter(i => i.kind === 'bubble').map(i => i.text).join(''), '123456ABC');
  assert.equal(out.snaps.length, 72);
});

test('deck disabled removes floor items, the deck tag and the deck snap', () => {
  const out = B.build({ axes: { x: [0, 6, 12], y: [0, 10] }, deck: { enabled: false } });
  assert.equal(out.items.filter(i => i.layer === 'floor' || i.layer === 'deck').length, 0);
  assert.ok(!out.items.find(i => i.role === 'level' && /mekanik/.test(i.text)));
  assert.equal(out.snaps.length, 3 * 2 * 3);
});

test('truss frame: no interior columns, chords on every x axis, no floor primaries', () => {
  const out = B.build({ axes: { x: [0, 6, 12], y: [0, 8, 20] }, interiorRows: [1], frame: { type: 'truss' } });
  assert.equal(count(out, 'column'), 6);
  assert.equal(count(out, 'trussChord'), 9);            // 3 axes x (1 bottom + 2 top)
  assert.ok(count(out, 'trussDiag') > 0 && count(out, 'trussPost') > 0);
  assert.equal(count(out, 'rafter'), 0);
  assert.equal(count(out, 'floorPrimary'), 0);
  assert.equal(count(out, 'floorEdge'), 3);
});

test('beams frame without interior rows spans the full depth', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 8, 20] } });
  assert.equal(count(out, 'column'), 4);
  assert.equal(count(out, 'rafter'), 2);
  const r = out.items.find(i => i.role === 'rafter');
  assert.equal(r.a[1], 0); assert.equal(r.b[1], 20);
});

test('mono and butterfly level tags', () => {
  const mono = B.build({ axes: { x: [0, 6], y: [0, 10] }, roof: { type: 'mono' }, levels: { eave: 5, ridge: 7 } });
  assert.deepEqual(mono.items.filter(i => i.role === 'level').map(i => i.text).sort(), ['mekanik kat +4.45', 'saçak +5.00', 'tavan +4.00', 'üst saçak +7.00']);
  const bf = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, roof: { type: 'butterfly' }, levels: { eave: 6, ridge: 4 } });
  assert.ok(bf.items.find(i => i.role === 'level' && i.text === 'dere +4.00'));
});
```

- [ ] **Step 2: Run the tests to see the new ones fail**

```bash
node --test tests/
```
Expected: the new tests fail on counts of 0.

- [ ] **Step 3: Add the sub-builders to `model/builder.js`**

Insert before `const PARTS = [];`:

```js
  // ---- primary steel: columns, rafters or trusses, eave and ridge beams
  function buildFrame(c) {
    const { m, xs, ys, nx, ny, L, zt, bar, snaps } = c;
    const truss = m.frame.type === 'truss';
    const rows = truss ? [0, ny] : [0].concat(m.interiorRows, [ny]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const cw = m.frame.column;
    c.box('base', 'slab', [m.outline.x / 2, m.outline.y / 2, -0.06], [m.outline.x + 1.2, m.outline.y + 1.2, 0.12], 'slab');
    xs.forEach(x => {
      rows.forEach(i => {
        const y = ys[i], top = zt(y);
        bar('steel', 'column', [x, y, 0], [x, y, top], cw, cw, 'steel');
        if (m.frame.fixedBases) bar('steel', 'base', [x, y, 0], [x, y, 0.06], 0.6, 0.6, 'fix');
        bar('raf', 'joint', [x, y, top - 0.36], [x, y, top + 0.02], 0.34, 0.34, 'fix');   // rigid joint zone
        [0, L.ceiling].concat(m.deck.enabled ? [L.deck] : [], [top]).forEach(z => snaps.push([x, y, z]));
      });
      if (!truss) {
        for (let k = 0; k < rows.length - 1; k++) {
          const ya = ys[rows[k]], yb = ys[rows[k + 1]];
          bar('raf', 'rafter', [x, ya, zt(ya) - 0.135], [x, yb, zt(yb) - 0.135], 0.135, 0.27, 'raf');
        }
      } else trussAt(c, x);
    });
    ys.forEach(y => bar('steel', 'tie', [xs[0], y, zt(y) - 0.2], [xs[nx], y, zt(y) - 0.2], 0.15, 0.3, 'tie'));
  }

  // Clear-span lattice truss on one x axis: level bottom chord at the deck level, top chord
  // along the roof, N-diagonals with posts at about 2.2 m, pinned on the two outer columns.
  function trussAt(c, x) {
    const { ys, ny, L, zt, bar } = c;
    const zb = L.deck, top = y => zt(y) - 0.08;
    bar('raf', 'trussChord', [x, ys[0], zb], [x, ys[ny], zb], 0.14, 0.14, 'raf');
    for (let i = 0; i < ny; i++) bar('raf', 'trussChord', [x, ys[i], top(ys[i])], [x, ys[i + 1], top(ys[i + 1])], 0.14, 0.14, 'raf');
    const pts = [ys[0]];
    for (let i = 0; i < ny; i++) {
      const n = Math.max(2, Math.round((ys[i + 1] - ys[i]) / 2.2));
      for (let j = 1; j <= n; j++) pts.push(ys[i] + (ys[i + 1] - ys[i]) * j / n);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (i % 2 === 0) bar('raf', 'trussDiag', [x, a, zb], [x, b, top(b)], 0.08, 0.08, 'raf');
      else bar('raf', 'trussDiag', [x, a, top(a)], [x, b, zb], 0.08, 0.08, 'raf');
      if (i > 0) bar('raf', 'trussPost', [x, a, zb], [x, a, top(a)], 0.06, 0.06, 'raf');
    }
    [ys[0], ys[ny]].forEach(y => bar('raf', 'joint', [x, y, zb - 0.12], [x, y, zb + 0.12], 0.34, 0.34, 'fix'));
  }

  // ---- mechanical floor: primary beams on the frames (beams type only), edge beams on every
  // row, secondaries at about deck.secondarySpacing, and the translucent deck plane
  function buildFloor(c) {
    const { m, xs, ys, nx, ny, L, bar, tris, quad } = c;
    if (!m.deck.enabled) return;
    const ZB = L.deck, beams = m.frame.type === 'beams';
    xs.forEach(x => {
      if (!beams) return;
      for (let i = 0; i < ny; i++) bar('floor', 'floorPrimary', [x, ys[i], ZB - 0.2], [x, ys[i + 1], ZB - 0.2], 0.18, 0.4, 'floorBeam');
      ys.forEach(y => bar('floor', 'floorJoint', [x, y, ZB - 0.5], [x, y, ZB + 0.05], 0.34, 0.34, 'fix'));
    });
    ys.forEach(y => bar('floor', 'floorEdge', [xs[0], y, ZB - 0.17], [xs[nx], y, ZB - 0.17], 0.16, 0.33, 'floorBeam'));
    for (let i = 0; i < ny; i++) {
      const n = Math.max(1, Math.round((ys[i + 1] - ys[i]) / m.deck.secondarySpacing));
      for (let j = 1; j < n; j++) {
        const y = ys[i] + (ys[i + 1] - ys[i]) * j / n;
        bar('floor', 'floorSecondary', [xs[0], y, ZB - 0.12], [xs[nx], y, ZB - 0.12], 0.1, 0.24, 'floorBeam');
      }
    }
    const z = ZB + 0.03;
    tris('deck', 'deck', quad([xs[0], ys[0], z], [xs[nx], ys[0], z], [xs[nx], ys[ny], z], [xs[0], ys[ny], z]), 'deck');
  }

  // ---- fixed dimensions, level tags and axis bubbles
  function buildAnnotations(c) {
    const { m, xs, ys, nx, ny, L, zt, tag, lines, bubble } = c;
    const pts = [], DC = '#3b4651', h = 0.05, f2 = v => v.toFixed(2);
    const seg = (a, b) => pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    // bays and total along the south side
    const y1 = ys[ny] + 1.0, y2 = ys[ny] + 3.2;
    seg([xs[0], y1, h], [xs[nx], y1, h]); xs.forEach(x => seg([x, y1 - 0.3, h], [x, y1 + 0.3, h]));
    for (let i = 0; i < nx; i++) tag('dim', 'bay', f2(xs[i + 1] - xs[i]), [(xs[i] + xs[i + 1]) / 2, y1, h], DC);
    seg([xs[0], y2, h], [xs[nx], y2, h]); [xs[0], xs[nx]].forEach(x => seg([x, y2 - 0.3, h], [x, y2 + 0.3, h]));
    tag('dim', 'total', f2(xs[nx] - xs[0]) + ' m', [(xs[0] + xs[nx]) / 2, y2, h], DC);
    // spans and total along the east side
    const x1 = xs[nx] + 1.0, x2 = xs[nx] + 3.2;
    seg([x1, ys[0], h], [x1, ys[ny], h]); ys.forEach(y => seg([x1 - 0.3, y, h], [x1 + 0.3, y, h]));
    for (let j = 0; j < ny; j++) tag('dim', 'span', f2(ys[j + 1] - ys[j]), [x1, (ys[j] + ys[j + 1]) / 2, h], DC);
    seg([x2, ys[0], h], [x2, ys[ny], h]); [ys[0], ys[ny]].forEach(y => seg([x2 - 0.3, y, h], [x2 + 0.3, y, h]));
    tag('dim', 'total', f2(ys[ny] - ys[0]) + ' m', [x2, (ys[0] + ys[ny]) / 2, h], DC);
    // levels on the west gable
    const xl = xs[0] - 1.0, yl = ys[ny];
    seg([xl, yl, 0], [xl, yl, zt(yl)]); [0, L.ceiling, zt(yl)].forEach(z => seg([xl - 0.3, yl, z], [xl + 0.3, yl, z]));
    tag('dim', 'level', 'tavan +' + f2(L.ceiling), [xl, yl, L.ceiling - 0.25], DC);
    if (m.deck.enabled) tag('dim', 'level', 'mekanik kat +' + f2(L.deck), [xl, yl, L.deck + 0.25], DC);
    levelTags(m, zt).forEach(([y, z, name]) => {
      if (y !== yl) { seg([xl, y, 0], [xl, y, z]); [0, z].forEach(zz => seg([xl - 0.3, y, zz], [xl + 0.3, y, zz])); }
      tag('dim', 'level', name + ' +' + f2(z), [xl, y, z], DC);
    });
    lines('dim', 'dimLine', pts, 'dimLine');
    // axis bubbles: numbers along x, letters along y
    xs.forEach((x, i) => bubble(String(i + 1), [x, ys[ny] + 2.0, 0.2]));
    ys.forEach((y, j) => bubble('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[j % 26], [xs[0] - 4.8, y, 0.2]));
  }
```

Insert after `const PARTS = [];`:

```js
  PARTS.push(buildFrame, buildFloor, buildAnnotations);
```

- [ ] **Step 4: Run the tests**

```bash
node --test tests/
```
Expected: all pass. If `mono and butterfly level tags` fails on the mono list, check that `levelTags` returns `'üst saçak'` for the high side and that the ceiling and deck tags are always added.

- [ ] **Step 5: Commit**

```bash
git add model/builder.js tests/builder.test.js
git commit -m "Builder: frame, clear-span truss, mechanical floor, dimensions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Builder: envelope (facades, glass, entrance, roof skin, caps, purlins, wind posts, bracing)

**Files:**
- Modify: `model/builder.js` (insert before `const PARTS = [];`, extend the `PARTS.push` line)
- Modify: `tests/builder.test.js` (append)

**Interfaces:**
- Consumes: the build context; `levelTags`/`ridgeY` from Task 3.
- Produces roles: `panel` (tris) and `panelLine` (lines) in layer `clad`; `glassPane` (tris), `mullion`, `transom` (bars) in layer `glass`; `entranceFrame`, `leaf`, `canopy`, `step` in layer `doors`; `roofSkin` in `skin`; `ridgeCap`, `gutter`, `windpost` in `steel`; `purlin` in `roof`; `brace` rods in `rb`.
- Helper `sideFrame(m, side)` returns `{ P(along, out, z) -> [x,y,z], a0, a1, alongX }`; `profile(m, side, zt, lift)` returns the top edge `[[along, z], ...]`.

- [ ] **Step 1: Append the failing tests**

```js
labTest('lab envelope: panels on three sides, glass on the south', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'panel', 'clad'), 3);
  assert.equal(count(out, 'panelLine', 'clad'), 3);
  assert.equal(count(out, 'glassPane', 'glass'), 1);
  const mull = out.items.filter(i => i.role === 'mullion');
  assert.equal(mull.length, 30);
  const raised = mull.filter(i => i.a[2] > 2.4 && i.a[2] < 2.5);
  assert.equal(raised.length, 2, 'two mullions start above the entrance door');
  assert.equal(count(out, 'transom', 'glass'), 4);
  const pane = out.items.find(i => i.role === 'glassPane');
  near(pane.pos[1], 19.71);                 // plane at ys[last] + claddingOffset
  near(Math.max(...pane.pos.filter((v, i) => i % 3 === 2)), 5.85);   // zt + 0.10
});

labTest('lab entrance, roof skin, caps, gutters, purlins, posts, bracing', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'entranceFrame', 'doors'), 4);
  assert.equal(count(out, 'leaf', 'doors'), 2);
  assert.equal(count(out, 'canopy', 'doors'), 1);
  assert.equal(count(out, 'step', 'doors'), 1);
  const canopy = out.items.find(i => i.role === 'canopy');
  near(canopy.size[0], 3); near(canopy.size[1], 1.5); near(canopy.size[2], 0.1);   // door width 1.80 + 1.20
  near(canopy.center[2], 2.62); near(canopy.center[1], 19.71 + 0.79);
  assert.equal(count(out, 'roofSkin', 'skin'), 1);
  assert.equal(count(out, 'ridgeCap', 'steel'), 1);
  assert.equal(count(out, 'gutter', 'steel'), 2);
  assert.equal(count(out, 'purlin', 'roof'), 15);
  assert.equal(count(out, 'windpost', 'steel'), 5);
  assert.equal(count(out, 'brace', 'rb'), 16);
});

test('all-panel box has four panels, no glass, no entrance', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] } });
  assert.equal(count(out, 'panel'), 4);
  assert.equal(out.items.filter(i => i.layer === 'glass').length, 0);
  assert.equal(count(out, 'entranceFrame'), 0);
});

test('glass on a gable side follows the roof line and the entrance can sit on the west', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, facades: { west: 'glass' }, entrance: { side: 'west', from: 3, to: 5 } });
  const pane = out.items.find(i => i.role === 'glassPane');
  const zs = pane.pos.filter((v, i) => i % 3 === 2);
  assert.ok(Math.max(...zs) > 6.3 && Math.max(...zs) < 6.5, 'ridge height + 0.10');
  const fr = out.items.filter(i => i.role === 'entranceFrame');
  assert.equal(fr.length, 4);
  assert.ok(fr.every(i => i.a[0] < 0), 'entrance frame outside the west axis');
  const canopy = out.items.find(i => i.role === 'canopy');
  assert.deepEqual(canopy.size, [1.5, 3.2, 0.1]);
});

test('butterfly roof gets a valley gutter and no ridge cap; mono gets one gutter', () => {
  const bf = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, roof: { type: 'butterfly' }, levels: { eave: 6, ridge: 4 } });
  assert.equal(count(bf, 'ridgeCap'), 0); assert.equal(count(bf, 'gutter'), 1);
  const mono = B.build({ axes: { x: [0, 6], y: [0, 10] }, roof: { type: 'mono' } });
  assert.equal(count(mono, 'ridgeCap'), 0); assert.equal(count(mono, 'gutter'), 1);
});

test('open facade draws nothing on that side', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, facades: { north: 'open' } });
  assert.equal(count(out, 'panel'), 3);
});
```

- [ ] **Step 2: Run the tests to see the new ones fail**

```bash
node --test tests/
```
Expected: the six new tests fail.

- [ ] **Step 3: Add the envelope builder to `model/builder.js`**

Insert before `const PARTS = [];`:

```js
  // ---- facade helpers. A side frame maps (along, out, z) on a facade to plan coordinates;
  // "along" runs with x on north/south and with y on east/west, "out" points outwards.
  function sideFrame(m, side) {
    const xs = m.axes.x, ys = m.axes.y, nx = xs.length - 1, ny = ys.length - 1, o = m.claddingOffset;
    const x0 = xs[0] - o, x1 = xs[nx] + o, yN = ys[0] - o, yS = ys[ny] + o;
    switch (side) {
      case 'north': return { P: (a, out, z) => [a, yN - out, z], a0: x0, a1: x1, alongX: true };
      case 'south': return { P: (a, out, z) => [a, yS + out, z], a0: x0, a1: x1, alongX: true };
      case 'west':  return { P: (a, out, z) => [x0 - out, a, z], a0: yN, a1: yS, alongX: false };
      default:      return { P: (a, out, z) => [x1 + out, a, z], a0: yN, a1: yS, alongX: false };
    }
  }
  // Top edge of a facade as [[along, z], ...]. North/south are level at the eave of their row;
  // east/west follow the roof line through every y axis.
  function profile(m, side, zt, lift) {
    const f = sideFrame(m, side), ys = m.axes.y, ny = ys.length - 1;
    if (side === 'north') return [[f.a0, zt(ys[0]) + lift], [f.a1, zt(ys[0]) + lift]];
    if (side === 'south') return [[f.a0, zt(ys[ny]) + lift], [f.a1, zt(ys[ny]) + lift]];
    const p = [[f.a0, zt(ys[0]) + lift]];
    for (let i = 1; i < ny; i++) p.push([ys[i], zt(ys[i]) + lift]);
    p.push([f.a1, zt(ys[ny]) + lift]);
    return p;
  }
  function heightAt(prof, a) {
    if (a <= prof[0][0]) return prof[0][1];
    for (let i = 0; i < prof.length - 1; i++) {
      const [a0, h0] = prof[i], [a1, h1] = prof[i + 1];
      if (a <= a1) return a1 === a0 ? h1 : h0 + (h1 - h0) * (a - a0) / (a1 - a0);
    }
    return prof[prof.length - 1][1];
  }
  // Sub-profile between a0 and a1 (keeps the interior points in between).
  function clipProfile(prof, a0, a1) {
    const p = [[a0, heightAt(prof, a0)]];
    prof.forEach(([a, h]) => { if (a > a0 && a < a1) p.push([a, h]); });
    p.push([a1, heightAt(prof, a1)]);
    return p;
  }
  // Portions of a horizontal line at height z that lie under the profile: [[a0, a1], ...]
  function under(prof, z) {
    const out = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [a0, h0] = prof[i], [a1, h1] = prof[i + 1];
      if (h0 > z && h1 > z) out.push([a0, a1]);
      else if (h0 > z || h1 > z) { const ac = a0 + (a1 - a0) * (z - h0) / (h1 - h0); out.push(h0 > z ? [a0, ac] : [ac, a1]); }
    }
    const merged = [];
    out.forEach(s => { const last = merged[merged.length - 1]; if (last && Math.abs(last[1] - s[0]) < 1e-9) last[1] = s[1]; else merged.push(s.slice()); });
    return merged;
  }
  function facePos(P, prof, quad) {
    const pos = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [a0, h0] = prof[i], [a1, h1] = prof[i + 1];
      pos.push.apply(pos, quad(P(a0, 0, 0), P(a1, 0, 0), P(a1, 0, h1), P(a0, 0, h0)));
    }
    return pos;
  }

  // ---- envelope: cladding, glazing, entrance, roof skin, ridge cap and gutters, purlins,
  // gable wind posts, roof bracing
  function buildEnvelope(c) {
    const { m, xs, ys, nx, ny, L, zt, yr, bar, rod, box, tris, lines, quad } = c;
    const o = m.claddingOffset;
    SIDES.forEach(side => {
      const kind = m.facades[side];
      if (kind !== 'panel' && kind !== 'glass') return;
      const f = sideFrame(m, side);
      if (kind === 'panel') {
        const prof = profile(m, side, zt, 0.25);
        tris('clad', 'panel', facePos(f.P, prof, quad), 'clad');
        const ln = [], hmax = Math.max.apply(null, prof.map(p => p[1]));
        for (let z = 1; z < hmax; z += 1) under(prof, z).forEach(([a0, a1]) => ln.push.apply(ln, f.P(a0, 0, z).concat(f.P(a1, 0, z))));
        lines('clad', 'panelLine', ln, 'cladLine');
      } else {
        const gp = clipProfile(profile(m, side, zt, 0.10), f.a0 + 0.04, f.a1 - 0.04);
        tris('glass', 'glassPane', facePos(f.P, gp, quad), 'glassPane');
        const w = gp[gp.length - 1][0] - gp[0][0], n = Math.max(1, Math.round(w / m.glassModule));
        const e = m.entrance && m.entrance.side === side ? m.entrance : null, eh = e ? (e.height || 2.4) : 0;
        for (let i = 0; i <= n; i++) {
          const a = gp[0][0] + w * i / n, h = heightAt(gp, a);
          const inDoor = e && a > e.from - 0.05 && a < e.to + 0.05;
          bar('glass', 'mullion', f.P(a, 0, inDoor ? eh + 0.05 : 0), f.P(a, 0, h), 0.06, 0.12, 'al');
        }
        const hmax = Math.max.apply(null, gp.map(p => p[1]));
        [0.03, 2.6, L.ceiling + 0.15, hmax - 0.03].forEach(z => under(gp, z).forEach(([a0, a1]) => bar('glass', 'transom', f.P(a0, 0, z), f.P(a1, 0, z), 0.06, 0.1, 'al')));
      }
    });
    // entrance: frame, two leaves, canopy and step on the facade of entrance.side
    if (m.entrance && SIDES.indexOf(m.entrance.side) >= 0) {
      const e = m.entrance, f = sideFrame(m, e.side), eh = e.height || 2.4, mid = (e.from + e.to) / 2, out = 0.04;
      const sideBox = (role, a, outPos, z, along, depth, height, mat) =>
        box('doors', role, f.P(a, outPos, z), f.alongX ? [along, depth, height] : [depth, along, height], mat);
      [e.from, e.to].forEach(a => bar('doors', 'entranceFrame', f.P(a, out, 0), f.P(a, out, eh), 0.1, 0.16, 'fr'));
      bar('doors', 'entranceFrame', f.P(e.from, out, eh), f.P(e.to, out, eh), 0.16, 0.1, 'fr');
      bar('doors', 'entranceFrame', f.P(mid, out, 0), f.P(mid, out, eh), 0.05, 0.1, 'fr');
      [[e.from + 0.05, mid - 0.03], [mid + 0.03, e.to - 0.05]].forEach(([a, b]) => sideBox('leaf', (a + b) / 2, out, eh / 2, b - a, 0.05, eh - 0.1, 'leaf'));
      if (e.canopy !== false) {
        sideBox('canopy', mid, out + 0.75, eh + 0.22, e.to - e.from + 1.2, 1.5, 0.1, 'fr');
        sideBox('step', mid, out + 0.9, 0, e.to - e.from + 1.2, 1.5, 0.06, 'step');
      }
    }
    // roof skin: one strip per y bay, extended by the cladding offset at both ends
    (function () {
      const x0 = xs[0] - o, x1 = xs[nx] + o, t = 0.2, pos = [];
      for (let i = 0; i < ny; i++) {
        const ya = i === 0 ? ys[0] - o : ys[i], yb = i === ny - 1 ? ys[ny] + o : ys[i + 1], za = zt(ys[i]) + t, zb = zt(ys[i + 1]) + t;
        pos.push.apply(pos, quad([x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb]));
      }
      tris('skin', 'roofSkin', pos, 'skin');
    })();
    // ridge cap and gutters
    const gutter = (yAxis, y) => bar('steel', 'gutter', [xs[0] - 0.3, y, zt(yAxis) + 0.12], [xs[nx] + 0.3, y, zt(yAxis) + 0.12], 0.2, 0.14, 'gutter');
    if (m.roof.type === 'gable') {
      bar('steel', 'ridgeCap', [xs[0] - 0.3, yr, zt(yr) + 0.24], [xs[nx] + 0.3, yr, zt(yr) + 0.24], 0.5, 0.06, 'ridgeCap');
      gutter(ys[0], ys[0] - 0.3); gutter(ys[ny], ys[ny] + 0.3);
    } else if (m.roof.type === 'butterfly') gutter(yr, yr);
    else if (L.eave <= L.ridge) gutter(ys[0], ys[0] - 0.3); else gutter(ys[ny], ys[ny] + 0.3);
    // purlins
    const pb = Math.max(1, m.roof.purlinBays | 0);
    for (let i = 0; i <= pb; i++) { const y = ys[0] + (ys[ny] - ys[0]) * i / pb; bar('roof', 'purlin', [xs[0], y, zt(y) + 0.08], [xs[nx], y, zt(y) + 0.08], 0.05, 0.12, 'pur'); }
    // gable wind posts
    [[xs[0], m.windPosts.west || []], [xs[nx], m.windPosts.east || []]].forEach(([x, list]) =>
      list.forEach(y => bar('steel', 'windpost', [x, y, 0], [x, y, zt(y) - 0.36], 0.16, 0.16, 'brace')));
    // roof bracing in the end bays, crossing between mid-bay points
    const pts = [ys[0]];
    for (let i = 0; i < ny; i++) pts.push((ys[i] + ys[i + 1]) / 2, ys[i + 1]);
    const bays = nx >= 2 ? [[0, 1], [nx - 1, nx]] : [[0, 1]];
    bays.forEach(([i, j]) => { for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      rod('rb', 'brace', [xs[i], a, zt(a) - 0.05], [xs[j], b, zt(b) - 0.05], 0.025, 'brace');
      rod('rb', 'brace', [xs[i], b, zt(b) - 0.05], [xs[j], a, zt(a) - 0.05], 0.025, 'brace');
    } });
  }
```

Change the `PARTS.push` line to:
```js
  PARTS.push(buildFrame, buildFloor, buildEnvelope, buildAnnotations);
```

- [ ] **Step 4: Run the tests**

```bash
node --test tests/
```
Expected: all pass. Known subtle points if something fails: the mullion count is `round(w / glassModule) + 1` with `w = (a1 - 0.04) - (a0 + 0.04)`; the canopy on an east/west side has size `[1.5, along, 0.1]` because `alongX` is false.

- [ ] **Step 5: Commit**

```bash
git add model/builder.js tests/builder.test.js
git commit -m "Builder: facades, glazing, entrance, roof skin, purlins, bracing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Builder: walls, doors, room names and labels

**Files:**
- Modify: `model/builder.js` (insert before `const PARTS = [];`, extend the `PARTS.push` line)
- Modify: `tests/builder.test.js` (append)

**Interfaces:**
- Produces roles: `wall` (tris) and `wallEdge` (lines) in layer `walls`; `door` (box) in `doors`; `room` and `label` tags in `rooms`.

- [ ] **Step 1: Append the failing tests**

```js
labTest('lab architecture: walls skip the glass face, doors, rooms, labels', () => {
  const out = B.build(lab);
  const wall = out.items.find(i => i.role === 'wall');
  assert.equal(wall.pos.length, 256 * 18, '262 wall lines minus 6 on the south glass face, 18 numbers each');
  assert.equal(out.items.find(i => i.role === 'wallEdge').pos.length, 256 * 6);
  assert.equal(count(out, 'door', 'doors'), 32);
  const ext = out.items.filter(i => i.role === 'door' && i.size[2] === 2.3);
  assert.equal(ext.length, 3, 'exterior doors are 2.3 m high');
  assert.equal(count(out, 'room', 'rooms'), 20);
  assert.equal(count(out, 'label', 'rooms'), 4);
  const lbl = out.items.find(i => i.role === 'label');
  assert.equal(lbl.k, 0.8); assert.equal(lbl.p[2], 2.9);
});

test('doors along x and along y get the right box orientation', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, doors: [{ h: 1, a: 1, b: 2, c: 5, e: 0 }, { h: 0, a: 3, b: 4, c: 2, e: 1 }] });
  const [dx, dy] = out.items.filter(i => i.role === 'door');
  assert.deepEqual(dx.center, [1.5, 5, 1.05]); assert.deepEqual(dx.size, [1, 0.14, 2.1]);
  assert.deepEqual(dy.center, [2, 3.5, 1.15]); assert.deepEqual(dy.size, [0.5, 1, 2.3]);
});

test('walls on a west glass face are skipped', () => {
  const out = B.build({ axes: { x: [0.1, 6], y: [0.1, 10] }, outline: { x: 6.1, y: 10.1 }, facades: { west: 'glass' },
    walls: [[0, 0, 0, 10], [0.05, 1, 0.05, 9], [3, 0, 3, 10]] });
  assert.equal(out.items.find(i => i.role === 'wall').pos.length, 18);
});
```

- [ ] **Step 2: Run the tests to see the new ones fail**

```bash
node --test tests/
```

- [ ] **Step 3: Add the architecture builder to `model/builder.js`**

Insert before `const PARTS = [];`:

```js
  // ---- architecture: wall faces as translucent planes up to the ceiling, doors, room names
  function buildArchitecture(c) {
    const { m, L, tris, lines, box, tag, quad } = c;
    const H = L.ceiling, pos = [], edge = [];
    // wall lines lying on a glazed side's outer face are part of the curtain wall, not interior walls
    const glassFaces = SIDES.filter(s => m.facades[s] === 'glass').map(s =>
      s === 'north' ? [1, 0] : s === 'south' ? [1, m.outline.y] : s === 'west' ? [0, 0] : [0, m.outline.x]);
    const onGlass = w => glassFaces.some(([ax, v]) => Math.abs(w[ax] - v) < 0.12 && Math.abs(w[ax + 2] - v) < 0.12);
    m.walls.forEach(w => {
      if (w.length !== 4 || onGlass(w)) return;
      const [x1, y1, x2, y2] = w;
      pos.push.apply(pos, quad([x1, y1, 0], [x2, y2, 0], [x2, y2, H], [x1, y1, H]));
      edge.push(x1, y1, H, x2, y2, H);
    });
    if (pos.length) { tris('walls', 'wall', pos, 'wallFace'); lines('walls', 'wallEdge', edge, 'wallEdge'); }
    m.doors.forEach(d => {
      const h = d.e ? 2.3 : 2.1, t = d.e ? 0.5 : 0.14, len = d.b - d.a, mid = (d.a + d.b) / 2;
      box('doors', 'door', d.h ? [mid, d.c, h / 2] : [d.c, mid, h / 2], d.h ? [len, t, h] : [t, len, h], 'door');
    });
    m.rooms.forEach(r => tag('rooms', 'room', r.name, [r.x, r.y, 0.3], '#5b6670', 0.72));
    m.labels.forEach(l => tag('rooms', 'label', l.name, [l.x, l.y, l.z !== undefined ? l.z : 2.9], '#b35c00', 0.8));
  }
```

Change the `PARTS.push` line to:
```js
  PARTS.push(buildFrame, buildFloor, buildEnvelope, buildArchitecture, buildAnnotations);
```

- [ ] **Step 4: Run the tests**

```bash
node --test tests/
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add model/builder.js tests/builder.test.js
git commit -m "Builder: interior walls, doors, room names and labels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: three.js viewer (`model/viewer.js`)

**Files:**
- Create: `model/viewer.js`

**Interfaces:**
- Consumes: `SenkonBuilder.build(model)` output of Tasks 3 to 6; `THREE` r128.
- Produces: global `SenkonViewer.mount(container, model, opts) -> handle` with `handle.layers` (getter, `[{ key, label, button, visible }]`), `setLayer(key, on) -> bool`, `setView(name)`, `setMeasuring(on)`, `onMeasure(fn)`, `rebuild(model)`, `resize()`, `shot(opts)`, `draw()`, `dispose()`, `built()`. `opts`: `{ compact?: bool, offsetX?: number }`.

- [ ] **Step 1: Write `model/viewer.js`**

```js
/* SenkonViewer: three.js renderer and interaction for SenkonBuilder output.
   Global: SenkonViewer.mount(container, model, opts) -> handle (spec section 5).
   Needs THREE r128 and SenkonBuilder loaded first. Plan [x, y, z] maps to scene (x, z, y):
   three.js Y is up, so plan z becomes Y and plan y (south) becomes Z. */
(function (root) {
  'use strict';

  const BAR_COLORS = { steel: 0x2f363d, raf: 0xb3261e, tie: 0x0b7f93, brace: 0x1557b0, pur: 0x9aa1a9, door: 0xe08a00, fix: 0xd6a500,
    floorBeam: 0x6a4c93, al: 0x59626b, fr: 0x232b33, step: 0x8d949b, ridgeCap: 0x8a939c, gutter: 0x3d6f8a };

  function makeMaterials() {
    const M = {};
    Object.keys(BAR_COLORS).forEach(k => { M[k] = new THREE.MeshStandardMaterial({ color: BAR_COLORS[k], roughness: 0.6, metalness: 0.25 }); });
    M.slab = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.95 });
    M.leaf = new THREE.MeshStandardMaterial({ color: 0x2f4654, transparent: true, opacity: 0.72, roughness: 0.1, metalness: 0.4 });
    M.wallFace = new THREE.MeshBasicMaterial({ color: 0xc3ccd5, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false });
    M.wallEdge = new THREE.LineBasicMaterial({ color: 0x7d8791 });
    M.glassPane = new THREE.MeshStandardMaterial({ color: 0x6fb4cf, transparent: true, opacity: 0.36, roughness: 0.05, metalness: 0.35, side: THREE.DoubleSide, depthWrite: false });
    M.clad = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    M.cladLine = new THREE.LineBasicMaterial({ color: 0x8a939c });
    M.skin = new THREE.MeshStandardMaterial({ color: 0xd3d8dd, roughness: 0.7, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    M.deck = new THREE.MeshStandardMaterial({ color: 0x8d99a6, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    M.dimLine = new THREE.LineBasicMaterial({ color: 0x3b4651 });
    M.meas = new THREE.MeshBasicMaterial({ color: 0xd81b60, depthTest: false });
    M.measLine = new THREE.LineBasicMaterial({ color: 0xd81b60, depthTest: false });
    return M;
  }

  const V = p => new THREE.Vector3(p[0], p[2], p[1]);
  function swapYZ(flat) {
    const o = new Array(flat.length);
    for (let i = 0; i < flat.length; i += 3) { o[i] = flat[i]; o[i + 1] = flat[i + 2]; o[i + 2] = flat[i + 1]; }
    return o;
  }

  function mount(container, model, opts) {
    opts = opts || {};
    if (typeof SenkonBuilder === 'undefined' || typeof THREE === 'undefined') throw new Error('SenkonBuilder and THREE must be loaded first');

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement; canvas.style.touchAction = 'none'; container.appendChild(canvas);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9099, 0.85); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-20, 40, 30); scene.add(sun);
    const M = makeMaterials();
    const rootG = new THREE.Group(), measG = new THREE.Group(), siteG = new THREE.Group(); scene.add(rootG, measG, siteG);

    // state
    const G = {}, tags = [], layerState = {}, measureCbs = [];
    let built = null, snaps = [], shotMode = false, tagMul = 1, measuring = false, mPts = [];
    const tgt = new THREE.Vector3(); let az = -0.62, el = 0.5, dist = 58;

    // ---- theme: clear colour follows the page's --bg variable
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    function applyTheme() { renderer.setClearColor(new THREE.Color(css('--bg') || '#e9ecef'), 1); }
    const mq = matchMedia('(prefers-color-scheme: dark)'), onTheme = () => { applyTheme(); draw(); };
    mq.addEventListener('change', onTheme);
    const mo = new MutationObserver(onTheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ---- sprites
    function makeTag(t, p, col, k) {
      const c = document.createElement('canvas'), ctx = c.getContext('2d'); ctx.font = '600 44px Arial';
      const w = Math.ceil(ctx.measureText(t).width) + 36; c.width = w; c.height = 64; ctx.font = '600 44px Arial';
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, 64); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, 60);
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, w / 2, 35);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
      sp.userData.ar = w / 64; sp.userData.k = k || 1; sp.position.copy(p); sp.renderOrder = 10; tags.push(sp); return sp;
    }
    function makeBubble(t, p) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d');
      k.beginPath(); k.arc(64, 64, 54, 0, 7); k.fillStyle = '#fff'; k.fill(); k.lineWidth = 8; k.strokeStyle = '#b3261e'; k.stroke();
      k.fillStyle = '#b3261e'; k.font = '700 68px Arial'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(t, 64, 70);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
      s.scale.set(1.5, 1.5, 1); s.position.copy(p); return s;
    }

    // ---- builder items -> three.js objects
    function toObject(it) {
      const mat = M[it.mat];
      switch (it.kind) {
        case 'bar': case 'rod': {
          const a = V(it.a), b = V(it.b), len = a.distanceTo(b);
          if (len < 1e-6) return null;
          let g;
          if (it.kind === 'bar') g = new THREE.BoxGeometry(it.w, it.h, len);
          else { g = new THREE.CylinderGeometry(it.r, it.r, len, 10); g.rotateX(Math.PI / 2); }
          const o = new THREE.Mesh(g, mat); o.position.copy(a).add(b).multiplyScalar(0.5); o.lookAt(b); return o;
        }
        case 'box': {
          const o = new THREE.Mesh(new THREE.BoxGeometry(it.size[0], it.size[2], it.size[1]), mat);
          o.position.set(it.center[0], it.center[2], it.center[1]); return o;
        }
        case 'tris': {
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(swapYZ(it.pos), 3));
          g.computeVertexNormals(); return new THREE.Mesh(g, mat);
        }
        case 'lines': {
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(swapYZ(it.pos), 3));
          return new THREE.LineSegments(g, mat);
        }
        case 'tag': return makeTag(it.text, V(it.p), it.color, it.k);
        case 'bubble': return makeBubble(it.text, V(it.p));
      }
      return null;
    }
    function clear() {
      rootG.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } });
      while (rootG.children.length) rootG.remove(rootG.children[0]);
      Object.keys(G).forEach(k => delete G[k]); tags.length = 0; clearMeas();
    }
    function build(m) {
      clear();
      built = SenkonBuilder.build(m); snaps = built.snaps.map(V);
      built.layers.forEach(l => {
        const g = new THREE.Group(); g.name = l.key;
        g.visible = l.key in layerState ? layerState[l.key] : l.visible !== false;
        G[l.key] = g; rootG.add(g);
      });
      built.items.forEach(it => { const g = G[it.layer] || G.steel; const o = toObject(it); if (o && g) g.add(o); });
      tgt.set(built.center[0], 2.6, built.center[1]);
      fitTags();
    }

    // ---- camera: simple orbit around tgt
    const compact = () => opts.compact !== undefined ? opts.compact : window.innerWidth < 640;
    function views() {
      const s = built ? built.size : 35;
      return { iso: [-0.62, 0.5, s * (compact() ? 3.2 : 1.65)], west: [-1.45, 0.3, s * 1.48], south: [0, 0.3, s * 1.6], top: [0, 1.5, s * 1.77] };
    }
    function place() {
      const s = built ? built.size : 35;
      el = Math.max(0.03, Math.min(1.55, el)); dist = Math.max(8, Math.min(140 * s / 35, dist));
      cam.position.set(tgt.x + dist * Math.cos(el) * Math.sin(az), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(el) * Math.cos(az));
      cam.lookAt(tgt);
    }
    function draw() { place(); renderer.render(scene, cam); }
    function fitTags() {
      const w = container.clientWidth || 1, h = container.clientHeight || 1, th = (w < 640 ? 13 : 17) / h * tagMul;
      tags.forEach(t => t.scale.set(th * t.userData.ar * t.userData.k, th * t.userData.k, 1));
    }
    function resize() {
      const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 38;
      if (w > 900 && !shotMode) cam.setViewOffset(w, h, opts.offsetX !== undefined ? opts.offsetX : -150, 0, w, h); else cam.clearViewOffset();
      cam.updateProjectionMatrix(); fitTags(); draw();
    }
    function setView(name) {
      const vw = views()[name] || views().iso; az = vw[0]; el = vw[1]; dist = vw[2];
      if (built) tgt.set(built.center[0], 2.6, built.center[1]); draw();
    }

    // ---- measuring: tap two points, snap to column bases, tops and levels
    function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
    function emit(r) { measureCbs.forEach(f => f(r)); }
    function clearMeas() { mPts = []; while (measG.children.length) { const c = measG.children.pop(); const i = tags.indexOf(c); if (i >= 0) tags.splice(i, 1); } }
    function pickAt(cx, cy) {
      const r = canvas.getBoundingClientRect(), rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), cam);
      const list = []; rootG.traverse(o => { if (o.isMesh && !o.material.transparent && shown(o)) list.push(o); });
      const hit = rc.intersectObjects(list, false)[0]; if (!hit) return;
      let p = hit.point.clone(), best = 0.8; snaps.forEach(q => { const d = q.distanceTo(hit.point); if (d < best) { best = d; p = q.clone(); } });
      if (mPts.length === 2) clearMeas();
      mPts.push(p); const mk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.meas); mk.position.copy(p); mk.renderOrder = 9; measG.add(mk);
      if (mPts.length === 2) {
        const a = mPts[0], b = mPts[1], d = a.distanceTo(b), hz = Math.hypot(a.x - b.x, a.z - b.z), vt = Math.abs(a.y - b.y);
        measG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), M.measLine));
        measG.add(makeTag(d.toFixed(2) + ' m', a.clone().add(b).multiplyScalar(0.5), '#d81b60', 1)); fitTags();
        emit({ d: d, hz: hz, vt: vt });
      } else emit({ pending: true });
      draw();
    }
    function setMeasuring(on) { measuring = !!on; clearMeas(); canvas.style.cursor = measuring ? 'crosshair' : ''; emit(null); draw(); }

    // ---- pointer input: drag rotates, right drag or shift pans, wheel zooms, two fingers pinch and pan
    const ptr = new Map(); let pinch = 0;
    const onCtx = e => e.preventDefault();
    const onDown = e => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sx: e.clientX, sy: e.clientY }); };
    const onUp = e => { const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); pinch = 0;
      if (measuring && p && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 7) pickAt(e.clientX, e.clientY); };
    const onCancel = e => { ptr.delete(e.pointerId); pinch = 0; };
    const onMove = e => { const p = ptr.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
      if (ptr.size === 2) { const v = Array.from(ptr.values()), d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); if (pinch) dist *= pinch / d; pinch = d;
        const s = dist * 0.0006; tgt.addScaledVector(right, -dx * s); tgt.y += dy * s; }
      else if (p.b === 2 || e.shiftKey) { const s = dist * 0.0012; tgt.addScaledVector(right, -dx * s); tgt.y += dy * s; }
      else { az -= dx * 0.006; el += dy * 0.005; }
      draw(); };
    const onWheel = e => { e.preventDefault(); dist *= Math.exp(e.deltaY * 0.0012); draw(); };
    canvas.addEventListener('contextmenu', onCtx); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', resize);

    // ---- still renders: window.__shot({layers:{...}, opaque:true, view:[az,el,dist], tgt:[x,y,z], fov, tagScale})
    function shot(o) {
      o = o || {}; shotMode = true;
      Object.keys(o.layers || {}).forEach(k => { if (G[k]) G[k].visible = !!o.layers[k]; });
      if (o.opaque) {
        [[M.clad, 0xe4e8ec], [M.skin, 0xc2c9d0]].forEach(([mm, col]) => { mm.transparent = false; mm.opacity = 1; mm.depthWrite = true; mm.color.set(col); mm.needsUpdate = true; });
        M.glassPane.opacity = 0.5; M.glassPane.color.set(0x4f8fae); M.door.color.set(0x3a4149);
        scene.background = new THREE.Color(0xcfdde9); hemi.intensity = 0.68;
        scene.traverse(x => { if (x.isMesh && x.material === M.fix) x.visible = false; });
        const c = built.center, ol = built.model.outline;
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0xb3b9ab, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; ground.position.set(c[0], -0.13, c[1]); siteG.add(ground);
        const apron = new THREE.Mesh(new THREE.BoxGeometry(ol.x + 6, 0.05, ol.y + 6), new THREE.MeshStandardMaterial({ color: 0xa3a8ad, roughness: 1 }));
        apron.position.set(c[0], -0.1, c[1]); siteG.add(apron);
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        sun.position.set(-18, 34, 46); sun.intensity = 0.62; sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
        const sc = sun.shadow.camera, r = built.size * 1.3; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 160; sc.updateProjectionMatrix();
        sun.target.position.set(c[0], 0, c[1]); scene.add(sun.target); sun.shadow.bias = -0.0006;
        scene.traverse(x => { if (x.isMesh) { x.castShadow = !x.material.transparent; x.receiveShadow = true; } });
      }
      if (o.view) { az = o.view[0]; el = o.view[1]; dist = o.view[2]; }
      if (o.tgt) tgt.set(o.tgt[0], o.tgt[1], o.tgt[2]);
      resize();
      if (o.tagScale) { tagMul = o.tagScale; fitTags(); }
      if (o.fov) { cam.fov = o.fov; cam.updateProjectionMatrix(); }
      draw();
    }

    function dispose() {
      window.removeEventListener('resize', resize); mq.removeEventListener('change', onTheme); mo.disconnect();
      canvas.removeEventListener('contextmenu', onCtx); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('wheel', onWheel);
      clear(); renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    build(model); setView('iso'); applyTheme(); resize();

    return {
      get layers() { return built ? built.layers.map(l => ({ key: l.key, label: l.label, button: l.button, visible: G[l.key] ? G[l.key].visible : false })) : []; },
      setLayer(key, on) { const g = G[key]; if (!g) return false; g.visible = !!on; layerState[key] = g.visible; draw(); return g.visible; },
      setView: setView,
      setMeasuring: setMeasuring,
      onMeasure(fn) { measureCbs.push(fn); },
      rebuild(m) { build(m); draw(); },
      resize: resize,
      shot: shot,
      draw: draw,
      dispose: dispose,
      built: () => built
    };
  }

  root.SenkonViewer = { mount: mount };
})(window);
```

- [ ] **Step 2: Syntax check**

```bash
node --check model/viewer.js && node --check model/builder.js && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add model/viewer.js
git commit -m "Add three.js viewer that renders builder items with orbit, layers, measuring

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(The viewer is exercised in the browser in Task 8.)

---

### Task 8: Viewer page shell and side-by-side verification

**Files:**
- Create: `model/index.html`, `model/viewer.css`

**Interfaces:**
- Consumes: `window.SENKON_CONFIG` (Task 1), `SenkonBuilder.VERSION` (Task 3), `SenkonViewer.mount` (Task 7), the Supabase RPC `get_model(p_slug)` (Task 9) returning rows `{ name, description, kind, data, file_path, file_format, updated_at }`.
- Produces: `window.__shot(opts)` for headless renders; the public page.

- [ ] **Step 1: Write `model/viewer.css`**

```css
:root{
  --bg:#e9ecef; --panel:#ffffffee; --ink:#1d2329; --muted:#5b6670; --line:#c9cfd6;
  --steel:#2f363d; --rafter:#b3261e; --tie:#0b7f93; --brace:#1557b0; --door:#e08a00; --accent:#1557b0;
  box-sizing:border-box; padding-top:env(safe-area-inset-top,0px); padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#171b20; --panel:#20262dee; --ink:#e8ecf0; --muted:#9aa5b0; --line:#39424c; --accent:#6ea8ff; } }
:root[data-theme="dark"]{ --bg:#171b20; --panel:#20262dee; --ink:#e8ecf0; --muted:#9aa5b0; --line:#39424c; --accent:#6ea8ff; }
*{box-sizing:inherit}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--ink);font:14px/1.45 "Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;overflow:hidden}
#stage{position:fixed;inset:0;touch-action:none}
canvas{display:block;width:100%;height:100%}
body:not(.ready) .ui{display:none !important}
body.shot .card, body.shot #hint, body.shot #thint, body.shot #menu{display:none !important}
.card{position:absolute;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;backdrop-filter:blur(6px)}
#state{left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;max-width:min(360px,calc(100vw - 24px))}
#state p{margin:0 0 8px}
#state button{margin-top:4px}
#head{top:calc(12px + env(safe-area-inset-top,0px));left:12px;max-width:min(360px,calc(100vw - 24px))}
#head h1{font-size:16px;margin:0 0 2px;font-weight:650;letter-spacing:.1px}
#head p{margin:0;color:var(--muted);font-size:12.5px}
button{font:inherit;font-size:12.5px;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:4px;padding:5px 9px;cursor:pointer}
button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button[hidden]{display:none}
.row{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
.row span{color:var(--muted);font-size:12px;min-width:74px}
#legend{bottom:calc(12px + env(safe-area-inset-bottom,0px));left:12px;font-size:12.5px;max-width:min(360px,calc(100vw - 24px))}
#legend ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:3px 14px}
#legend i{display:inline-block;width:14px;height:5px;border-radius:1px;margin-right:7px;vertical-align:middle}
#note{margin:8px 0 0;color:var(--muted);font-size:12px}
#read{left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));font-size:13.5px;text-align:center;white-space:nowrap;z-index:4;border-color:#d81b60}
#read b{font-size:16px}
#hint{position:absolute;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));color:var(--muted);font-size:12px}
#thint{display:none;position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));text-align:center;color:var(--muted);font-size:12.5px;pointer-events:none}
#menu{display:none;position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:12px;background:var(--panel);z-index:5;padding:9px 13px;font-size:14px}
@media (max-width:640px){
  #hint{display:none} body.ready #menu{display:block} body.compact #thint{display:block} body.measuring #thint{display:none}
  #head{right:104px;max-width:none} #head h1{font-size:15px}
  #legend{max-width:none;right:12px} #legend ul{grid-template-columns:1fr 1fr}
  body.compact #head p, body.compact #head .row, body.compact #legend{display:none}
  body:not(.compact) #read{display:none}
  body:not(.compact) #head{right:12px;top:calc(60px + env(safe-area-inset-top,0px))}
  button{padding:8px 11px;font-size:13.5px}
}
```

- [ ] **Step 2: Write `model/index.html`**

```html
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>3B model – SENKON</title>
<link rel="stylesheet" href="viewer.css">
</head>
<body>
<div id="stage"></div>
<div id="state" class="card"><p>Model yükleniyor…</p></div>
<button id="menu" class="ui" aria-expanded="false" aria-controls="head">Seçenekler</button>
<div id="head" class="card ui">
  <h1 id="title"></h1>
  <p id="desc"></p>
  <div class="row"><span>Göster</span>
    <button data-layer="clad" aria-pressed="true">Paneller</button>
    <button data-layer="skin" aria-pressed="true">Çatı kaplaması</button>
    <button data-layer="walls" aria-pressed="true">İç duvarlar</button>
    <button data-layer="floor" aria-pressed="true">Döşeme kirişleri</button>
    <button data-layer="deck" aria-pressed="true">Döşeme</button>
    <button data-layer="roof" aria-pressed="true">Aşıklar</button>
    <button data-layer="glass" aria-pressed="true">Cam cephe</button>
    <button data-layer="rb" aria-pressed="true">Çatı çaprazları</button>
  </div>
  <div class="row"><span>Ölçü</span>
    <button data-layer="dim" aria-pressed="true">Ölçüler</button>
    <button data-layer="rooms" aria-pressed="false">Mahal adları</button>
    <button id="meas" aria-pressed="false">Mesafe ölç</button>
  </div>
  <div class="row"><span>Görünüm</span>
    <button data-view="iso">Genel</button>
    <button data-view="west">Batı</button>
    <button data-view="south">Güney</button>
    <button data-view="top">Plan</button>
  </div>
</div>
<div id="legend" class="card ui">
  <ul>
    <li><i style="background:var(--steel)"></i>Kolonlar</li>
    <li><i style="background:var(--rafter)"></i>Çatı kirişleri</li>
    <li><i style="background:var(--tie)"></i>Saçak ve mahya kirişleri</li>
    <li><i style="background:#6a4c93"></i>Mekanik kat kirişleri</li>
    <li><i style="background:var(--brace)"></i>Çatı çaprazları, rüzgar dikmeleri</li>
    <li><i style="background:#d6a500"></i>Rijit birleşimler, ankastre tabanlar</li>
    <li><i style="background:var(--door)"></i>Kapılar</li>
    <li><i style="background:#6fb4cf"></i>Cam cephe</li>
    <li><i style="background:#cfd4d9"></i>Sandviç paneller</li>
    <li><i style="background:#3d6f8a"></i>Saçak olukları</li>
  </ul>
  <p id="note"></p>
</div>
<div id="read" class="card ui" hidden></div>
<div id="hint" class="ui">Döndürmek için sürükleyin, yakınlaştırmak için kaydırın, taşımak için sağ tuşla sürükleyin</div>
<div id="thint" class="ui">Tek parmakla döndürün, iki parmakla yakınlaştırın ve taşıyın</div>
<script src="vendor/three.r128.min.js"></script>
<script src="config.js"></script>
<script src="builder.js"></script>
<script src="viewer.js"></script>
<script>
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = $('state'), C = window.SENKON_CONFIG || {};
  const q = new URLSearchParams(location.search), slug = (q.get('m') || '').trim();
  const SLUG_RE = /^[a-z0-9]{8,32}$/;
  const FIXED = 'Ön tasarım modelidir, uygulama için değildir. Ölçüler metre, aks–aks; kotlar çelik üst kotudur.';

  function show(msg, retry) {
    state.hidden = false; state.innerHTML = '';
    const p = document.createElement('p'); p.textContent = msg; state.appendChild(p);
    if (retry) { const b = document.createElement('button'); b.textContent = 'Tekrar dene'; b.onclick = () => location.reload(); state.appendChild(b); }
  }
  function hasWebGL() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
    catch (e) { return false; }
  }
  async function load() {
    // Development only: ?src=<same-origin JSON file> on localhost draws a row-shaped file instead of the database.
    const src = q.get('src'), dev = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) >= 0;
    if (src && dev) { const r = await fetch(src); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
    if (!SLUG_RE.test(slug)) return null;
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) throw new Error('config');
    const r = await fetch(C.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/get_model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ p_slug: slug })
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }
  function render(row) {
    document.title = row.name + ' – SENKON';
    $('title').textContent = row.name; $('desc').textContent = row.description || '';
    if (row.kind !== 'parametric') return show('Bu model türü henüz desteklenmiyor');
    const data = row.data || {};
    if ((data.v || 1) > SenkonBuilder.VERSION) return show('Model sürümü desteklenmiyor');
    if (!hasWebGL()) return show('Tarayıcınız 3B görüntülemeyi desteklemiyor');
    let v;
    try { v = SenkonViewer.mount($('stage'), data); }
    catch (e) { console.error(e); return show('Model çizilemedi'); }
    state.hidden = true; document.body.classList.add('ready');

    const d = row.updated_at ? new Date(row.updated_at) : null, when = d && !isNaN(d) ? d.toLocaleDateString('tr-TR') : '';
    $('note').textContent = FIXED + (data.source ? ' Mimari plan ' + data.source + ' esas alınmıştır.' : '') + (when ? ' Güncelleme ' + when + '.' : '');

    document.querySelectorAll('[data-layer]').forEach(b => {
      const l = v.layers.find(x => x.key === b.dataset.layer);
      if (!l) { b.hidden = true; return; }
      b.setAttribute('aria-pressed', String(l.visible));
      b.onclick = () => b.setAttribute('aria-pressed', String(v.setLayer(l.key, b.getAttribute('aria-pressed') !== 'true')));
    });
    document.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => v.setView(b.dataset.view); });

    const measBtn = $('meas'), read = $('read');
    measBtn.onclick = () => {
      const on = measBtn.getAttribute('aria-pressed') !== 'true';
      measBtn.setAttribute('aria-pressed', String(on)); document.body.classList.toggle('measuring', on);
      read.hidden = !on; read.textContent = 'Yapı veya zemin üzerinde iki noktaya dokunun'; v.setMeasuring(on);
    };
    v.onMeasure(r => {
      if (!r) return;
      if (r.pending) read.textContent = 'İkinci noktaya dokunun';
      else read.innerHTML = '<b>' + r.d.toFixed(2) + ' m</b><br>yatay ' + r.hz.toFixed(2) + ' m, düşey ' + r.vt.toFixed(2) + ' m';
    });

    const menu = $('menu');
    if (matchMedia('(max-width:640px)').matches) document.body.classList.add('compact');
    menu.onclick = () => { const c = document.body.classList.toggle('compact'); menu.setAttribute('aria-expanded', String(!c)); menu.textContent = c ? 'Seçenekler' : 'Kapat'; };
    window.__shot = o => { document.body.classList.add('shot'); v.shot(o); };
    v.resize();
  }
  load().then(row => { if (!row) return show('Model bulunamadı'); render(row); })
    .catch(e => { console.error(e); if (e.message === 'config') show('Yapılandırma eksik: model/config.js dosyasını doldurun'); else show('Model yüklenemedi, lütfen tekrar deneyin', true); });
})();
</script>
</body>
</html>
```

- [ ] **Step 3: Serve and open the page next to the original**

Start the static server with the in-app browser (`preview_start` with name `site`, or `python -m http.server 8080 --bind 127.0.0.1` from the repo root). Open:
- new: `http://127.0.0.1:8080/model/?src=../local/lab-model.json`
- original: `http://127.0.0.1:8080/local/lab-frame-3d.html`

Check the console for errors (none expected) and take a screenshot of each at the default view.

- [ ] **Step 4: Verify behaviour against the original**

Go through this list on the new page and compare with the original:
1. Default view: same framing, same members visible, header shows the model name and description, legend and status line visible.
2. Each layer button hides and shows its group (Paneller, Çatı kaplaması, İç duvarlar, Döşeme kirişleri, Döşeme, Aşıklar, Cam cephe, Çatı çaprazları, Ölçüler, Mahal adları).
3. View presets Genel, Batı, Güney, Plan match the original framing.
4. Mesafe ölç: click a column base then a column top; the card shows the distance with yatay and düşey parts; a third click starts a new measurement.
5. Dimension tags read 5.75, 5.65, 7.95, 7.95, 7.55, 34.85 m along the south, 8.75, 10.70, 19.45 m along the east, and the four level tags on the west.
6. Dark mode: emulate `prefers-color-scheme: dark`; the canvas background and cards switch.
7. Phone width (375 × 812): the Seçenekler button shows, the panel collapses, the two-finger hint shows, orbit works with one pointer.
8. Error states: `?m=nope` shows "Model bulunamadı"; `?m=abcdefghjkmn` with empty config shows the "Yapılandırma eksik" message; `?src=../local/missing.json` shows the retry message.
9. In the console run `__shot({opaque:true, view:[-0.62,0.5,58]})`: the interface hides, cladding becomes opaque with shadows.

Fix any difference in `builder.js` or `viewer.js` before moving on; keep `node --test tests/` green.

- [ ] **Step 5: Commit**

```bash
git add model/index.html model/viewer.css
git commit -m "Add viewer page shell with slug loading and error states

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Database schema, insert generator and Fırat's instructions

**Files:**
- Create: `docs/model/schema.sql`, `tools/make-model-sql.js`
- Modify: `docs/model/README.md`
- Create (gitignored): `local/lab-model.sql`

**Interfaces:**
- Produces: table `public.models`, function `public.get_model(p_slug text)` (called by Task 8's shell), trigger `models_updated_at`.
- `node tools/make-model-sql.js <row.json> <owner-email>` prints an INSERT statement with a fresh slug and the share link.

- [ ] **Step 1: Write `docs/model/schema.sql`**

```sql
-- SENKON model viewer: database setup. Run once in the Supabase SQL editor of the dedicated project.
-- Before running: Authentication > Providers > Email: disable "Allow new users to sign up";
-- Authentication > Users: create the owner user manually.

create table public.models (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- random, unguessable, used in the link
  name        text not null,
  description text,
  kind        text not null default 'parametric' check (kind in ('parametric','file')),
  data        jsonb,                          -- parametric model (spec section 6)
  file_path   text,                           -- for kind = 'file', path in Storage (future)
  file_format text,                           -- 'ifc' | 'glb' (future)
  owner       uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.models enable row level security;

-- Owner can do everything with their own rows. No policy for anon, so anon cannot read the table.
create policy models_owner_all on public.models
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Public lookup by slug only. security definer bypasses RLS for this one query.
create or replace function public.get_model(p_slug text)
returns table (name text, description text, kind text, data jsonb, file_path text, file_format text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select name, description, kind, data, file_path, file_format, updated_at
  from public.models where slug = p_slug limit 1;
$$;
revoke all on function public.get_model(text) from public;
grant execute on function public.get_model(text) to anon, authenticated;

-- updated_at follows every update
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger models_updated_at before update on public.models
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Write `tools/make-model-sql.js`**

```js
// Prints an INSERT for one model row from a row-shaped JSON file ({name, description, kind, data}).
// A fresh random slug is generated each run; the owner is looked up by e-mail in auth.users.
// Usage: node tools/make-model-sql.js local/lab-model.json owner@example.com > local/lab-model.sql
'use strict';
const fs = require('fs');
const file = process.argv[2], email = process.argv[3];
if (!file || !email) { console.error('usage: node tools/make-model-sql.js <row.json> <owner-email>'); process.exit(1); }
const row = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!row.name || !row.data) { console.error('row.json needs name and data'); process.exit(1); }

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';   // 31 symbols, no look-alikes
function randomSlug(n) {
  const out = [];
  while (out.length < n) {
    const buf = crypto.getRandomValues(new Uint8Array(n * 2));
    for (const b of buf) if (b < 248 && out.length < n) out.push(ALPHABET[b % 31]);   // 248 = 8 * 31, avoids modulo bias
  }
  return out.join('');
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const json = JSON.stringify(row.data);
if (json.indexOf('$j$') >= 0) throw new Error('data contains the $j$ delimiter');
const slug = randomSlug(12);
process.stdout.write(
  '-- generated ' + new Date().toISOString() + ' from ' + file + '\n' +
  'insert into public.models (slug, name, description, kind, data, owner)\n' +
  'values (' + q(slug) + ', ' + q(row.name) + ', ' + (row.description ? q(row.description) : 'null') + ', ' + q(row.kind || 'parametric') + ',\n' +
  '  $j$' + json + '$j$::jsonb,\n' +
  '  (select id from auth.users where email = ' + q(email) + '));\n' +
  '-- share link: https://senkonmuhendislik.com/model/?m=' + slug + '\n');
```

- [ ] **Step 3: Generate the lab insert and check it**

```bash
node tools/make-model-sql.js local/lab-model.json sfiratsenturk@gmail.com > local/lab-model.sql && head -c 300 local/lab-model.sql && echo && grep -oE "m=[a-z0-9]{12}$" local/lab-model.sql
```
Expected: the insert starts with `insert into public.models`, and the last line prints `m=` followed by exactly 12 characters from the alphabet. Run it twice and confirm the slugs differ.

- [ ] **Step 4: Extend `docs/model/README.md` with Fırat's steps**

Append:
```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git status --short     # local/ must NOT appear
git add docs/model/schema.sql tools/make-model-sql.js docs/model/README.md
git commit -m "Add database schema, insert generator and setup instructions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Connect to Supabase and run the live acceptance check

**Files:**
- Modify: `model/config.js` (URL and anon key from Fırat)

This task waits on Fırat: the Supabase project, the schema, the first row and the URL + anon key. Everything before it is complete and testable without them.

- [ ] **Step 1: Fill `model/config.js`** with the Project URL and anon key Fırat provides, and commit:

```bash
git add model/config.js
git commit -m "Point the viewer at the SENKON Supabase project

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 2: Local check against the real database**

Serve the repo and open `http://127.0.0.1:8080/model/?m=<slug from local/lab-model.sql>`. Expected: the lab model draws exactly as with `?src=`; the status line ends with the row's update date. Open `?m=aaaaaaaaaaaa`: "Model bulunamadı". In the network panel, confirm only one request to `/rest/v1/rpc/get_model` and no request that lists the table.

- [ ] **Step 3: Confirm the anon key cannot list models**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" "<SUPABASE_URL>/rest/v1/models?select=slug"
```
Expected: `200` with an empty array body (RLS hides every row) or `401`/`403`; never a list of slugs. Run also with the body printed to be sure: `curl -s ... | head -c 100` must print `[]`.

- [ ] **Step 4: Hand over for publishing**

Tell Fırat: push `model-viewer`, merge to `main`, then open the share link on the iPhone. Stage 1 is done when the iPhone check matches `lab-frame-3d.html` and a wrong slug shows "Model bulunamadı".

---

## Self-review notes

- Spec coverage: pages and viewer behaviour (Tasks 7, 8), additions and error states (Task 8), file layout (Tasks 1, 2, 9), viewer interface (Task 7), data format with defaults, derived values and the clear-span truss (Tasks 3 to 6), database rules and slug generation (Task 9), testing (Tasks 3 to 6 in Node, Task 8 in the browser, Task 10 live), constraints (global list). The `kind` switch and version check live in the shell (Task 8) so nothing outside the builder assumes a parametric model.
- Names used across tasks: roles and layer keys listed in each task's Interfaces block match the test file; `SenkonBuilder.parts`, `build`, `VERSION`; `SenkonViewer.mount` and the handle members `layers`, `setLayer`, `setView`, `setMeasuring`, `onMeasure`, `rebuild`, `resize`, `shot`, `draw`, `dispose`, `built`.
