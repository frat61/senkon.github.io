# Steel Hall Erection Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Deneyim banner erects Fırat's lattice-column steel hall element by element, drawn as ink lines from his own GLB.

**Architecture:** An offline Node tool turns the GLB into a compact JSON of projected member lines grouped into erection pieces in site order. A small vanilla runtime script draws the pieces on a canvas in painter's order as they fly in and land. A Python script renders the same JSON to the still picture used without JavaScript.

**Tech Stack:** Node (CommonJS, no dependencies, `node:test`), vanilla browser JS with canvas 2D, Python 3 + Pillow for the still.

**Spec:** `docs/superpowers/specs/2026-10-14-hall-erection-design.md`

## Global Constraints

- No new dependencies: Node scripts use only built-ins, the page script is vanilla, the still uses Pillow (already installed).
- Tests run with bare `node --test` from the repo root (`node --test tests/` fails on Node 24).
- `local/` is gitignored; the GLB stays there. Only `assets/senkon/hal.json` and `assets/senkon/hal.webp` are committed.
- Every linked asset carries a `?v=` tag: run `node tools/versions.js` after changing `hal.js`, `hal.webp` or `hal.json`; `tests/versions.test.js` fails otherwise.
- Camera: eye (−70, 40, 130), target (50, −16, 5), focal factor 1.85, canvas 1500 × 1125 px.
- Timing: 25 s total at speed 1, 0.6 s flight per piece; `data-speed="1.4"` on the page.
- Ink `#3a3f44`; alpha 0.95 nearest to 0.45 farthest; stroke widths clamped 1.2…6 px; white stroke of `wpx` over an ink stroke of `wpx + 1.5`.
- Commit each task on branch `hall-build` with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer. Never push.

## Review Focus

1. A GLB whose indices are uint16 (small meshes) must parse like the uint32 one — Task 1 tests both.
2. A member whose endpoint lies exactly on a grid plane must not produce a zero-length piece — Task 3 tests it.
3. If the JSON fetch fails or the figure has no stage, the still picture must stay and no error escape — Task 6 pins `.catch(() => {})` and the stage guard with a source test.
4. The figure may scroll into view before the JSON arrives: the erection must start when both are ready, not skip — Task 6's runtime starts the clock inside the fetch's `.then` only after the observer has fired (flag), tested by source inspection.
5. Pieces that have not started must not show through: the frame loop skips them — Task 6 source test checks the skip guard exists; the browser check in Task 7 confirms visually at mid-erection.

---

### Task 1: GLB parsing and welding

**Files:**
- Create: `tools/make-hall.js`
- Test: `tests/hall-tool.test.js`

**Interfaces:**
- Produces: `parseGlb(buf: Buffer) -> { meshes: [{ name: string, positions: Float32Array, indices: Uint32Array }] }` (name = the name of the node that references the mesh, `''` if none; uint16 indices are widened; a primitive without indices throws `Error('mesh without indices')`).
- Produces: `weld(positions: Float32Array, indices: Uint32Array, tol = 0.001) -> { points: number[][], tris: Uint32Array }` (points are `[x, y, z]`, grid-snapped to `tol`; tris are remapped index triples).
- Produces (test-only helper in the test file): `makeGlb(meshes: [{ name, positions: number[], indices: number[], index16?: boolean }]) -> Buffer` writing a valid glTF 2 binary with one buffer, one bufferView and accessor per attribute, one node per mesh.
- Produces (test-only helper): `prism(a: number[], b: number[], w: number) -> { positions: number[], indices: number[] }`: a box of square section `w` around axis a→b, 8 corners duplicated per face (24 vertices, 12 triangles) so welding has work to do.

- [ ] **Step 1: Write the failing tests**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../tools/make-hall.js');
// makeGlb and prism helpers here (see Interfaces)

test('parseGlb reads positions and indices, uint32 and uint16, with node names', () => {
  const p = prism([0, 0, 0], [5, 0, 0], 0.2);
  const g = H.parseGlb(makeGlb([{ name: 'IfcColumn', ...p }, { name: 'IfcBeam', ...p, index16: true }]));
  assert.equal(g.meshes.length, 2);
  assert.equal(g.meshes[0].name, 'IfcColumn');
  assert.equal(g.meshes[0].positions.length, 24 * 3);
  assert.equal(g.meshes[1].indices.length, 36);
  assert.ok(g.meshes[1].indices instanceof Uint32Array);
});

test('weld merges the duplicated corners of a prism into 8 points and keeps 12 triangles', () => {
  const p = prism([0, 0, 0], [5, 0, 0], 0.2);
  const w = H.weld(Float32Array.from(p.positions), Uint32Array.from(p.indices));
  assert.equal(w.points.length, 8);
  assert.equal(w.tris.length, 36);
  assert.ok(w.tris.every(i => i < 8));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hall-tool.test.js`
Expected: FAIL, cannot find module `../tools/make-hall.js`.

- [ ] **Step 3: Implement `parseGlb` and `weld` in `tools/make-hall.js`**

CommonJS module: `module.exports = { parseGlb, weld }` grows with later tasks; the CLI (Task 4) runs only under `require.main === module`. Parse the 12-byte header, the JSON chunk and the BIN chunk; read accessors through their bufferViews with `byteOffset`s; componentType 5123 → Uint16Array widened to Uint32Array, 5125 → Uint32Array, 5126 → Float32Array. Weld through a `Map` keyed by `Math.round(v / tol)` triples.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/hall-tool.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/make-hall.js tests/hall-tool.test.js
git commit -m "make-hall: GLB parsing and vertex welding"
```

### Task 2: Feature edges and member bundling

**Files:**
- Modify: `tools/make-hall.js`
- Test: `tests/hall-tool.test.js`

**Interfaces:**
- Consumes: `weld` output.
- Produces: `featureEdges(points, tris, { angleDeg = 30, minLen = 0.3 } = {}) -> [{ a: number[], b: number[] }]`: each edge once; kept when it borders one face only or its faces' normals differ by more than `angleDeg`; dropped when shorter than `minLen`.
- Produces: `bundle(edges: [{ a, b, mesh: string }], { angleDeg = 3, perp = 0.35, gap = 0.3, minLen = 0.3 } = {}) -> [{ a: number[], b: number[], w: number, mesh: string }]`: union-find over edges; `w` = 2 × largest perpendicular offset from the mean axis, never under 0.1; `mesh` = the most common mesh among the bundle's edges; members shorter than `minLen` dropped.

- [ ] **Step 1: Write the failing tests**

```js
test('featureEdges keeps the 12 corner edges of a prism and drops the face diagonals', () => {
  const p = prism([0, 0, 0], [5, 0, 0], 0.2);
  const w = H.weld(Float32Array.from(p.positions), Uint32Array.from(p.indices));
  const e = H.featureEdges(w.points, w.tris, { minLen: 0 });
  assert.equal(e.length, 12);
  assert.equal(e.filter(x => Math.abs(x.a[0] - x.b[0]) > 4.9).length, 4);   // the four long edges
  assert.equal(H.featureEdges(w.points, w.tris).length, 4);                    // minLen 0.3 drops the 0.2 m end edges
});

test('bundle turns the four long edges of a prism into one member with the prism width, and keeps two prisms apart', () => {
  const edgesOf = (p, mesh) => { const w = H.weld(Float32Array.from(p.positions), Uint32Array.from(p.indices)); return H.featureEdges(w.points, w.tris).map(e => ({ ...e, mesh })); };
  const one = H.bundle(edgesOf(prism([0, 0, 0], [5, 0, 0], 0.2), 'beam'));
  assert.equal(one.length, 1);
  assert.ok(Math.abs(one[0].w - 0.2 * Math.SQRT2) < 0.02);        // corners sit on the section's diagonal
  assert.ok(Math.abs(one[0].a[0] - 0) < 0.01 && Math.abs(one[0].b[0] - 5) < 0.01);
  assert.equal(one[0].mesh, 'beam');
  const two = H.bundle([...edgesOf(prism([0, 0, 0], [5, 0, 0], 0.2), 'beam'), ...edgesOf(prism([0, 2, 0], [5, 2, 0], 0.2), 'beam')]);
  assert.equal(two.length, 2);
  const collinear = H.bundle([...edgesOf(prism([0, 0, 0], [5, 0, 0], 0.2), 'beam'), ...edgesOf(prism([5.1, 0, 0], [9, 0, 0], 0.2), 'beam')]);
  assert.equal(collinear.length, 1);                                // gap 0.1 < 0.3 joins them
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hall-tool.test.js`
Expected: FAIL, `H.featureEdges is not a function`.

- [ ] **Step 3: Implement `featureEdges` and `bundle`**

Feature edges: map `"min,max"` edge keys to the list of face normals. Bundle: normalise each edge's direction with a fixed sign (first non-zero component positive); bucket edges by direction quantised to 2° and by the perpendicular foot point of their midpoint quantised to `perp` cells; test each edge against edges in its bucket and the 26 neighbouring position cells (and the neighbouring direction cells); merge when parallel within `angleDeg`, line distance under `perp`, and axis intervals overlap or gap under `gap`. The real file has about 64,000 edges and must bundle in under 30 s.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/hall-tool.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/make-hall.js tests/hall-tool.test.js
git commit -m "make-hall: feature edges and member bundling"
```

### Task 3: Grid split, grouping into pieces, erection order

**Files:**
- Modify: `tools/make-hall.js`
- Test: `tests/hall-tool.test.js`

**Interfaces:**
- Consumes: members from `bundle`.
- Produces: `findGrid(members) -> { xs: number[], rows: [{ z0: number, z1: number }], zMin: number, zMax: number }`: `xs` = sorted distinct x (rounded to 0.1) of column members longer than 30 m; `rows` = clusters of those members' z extents (gap over 2 m starts a new row), each row `z0..z1` the chord range; `zMin/zMax` = the model's z range.
- Produces: `splitAtGrid(members, grid, { maxLen = 12, stepZ = 10 } = {}) -> members`: a member longer than `maxLen` running along x is cut at every `grid.xs` plane strictly inside its extent; one running along z is cut every `stepZ` from `grid.zMin`; pieces shorter than 0.05 m are not emitted; other members pass through unchanged.
- Produces: `group(members, grid) -> [{ t: 'tower'|'post'|'floor'|'roof'|'roofx', key: object, m: number[] }]` per spec section 3 step 6; `key` holds `{ row, x }` for towers, `{ x, z }` for posts, `{ level, band, x, z }` for floors (`band` true for diagonals between levels), `{ x, z }` for roof and roofx. Floor levels: histogram of horizontal members' y in 0.5 m bins, peaks with at least 20 members.
- Produces: `order(pieces) -> number[]` per spec section 3 step 7.

- [ ] **Step 1: Write the failing tests**

```js
const M = (a, b, w, mesh) => ({ a, b, w, mesh });
const towers = () => [M([0, -35, -43], [0, 3, -43], 0.3, 'col'), M([0, -35, -40], [0, 3, -40], 0.3, 'col'),
  M([10, -35, -43], [10, 3, -43], 0.3, 'col'), M([10, -35, -40], [10, 3, -40], 0.3, 'col'),
  M([0, -35, 50], [0, 3, 50], 0.3, 'col'), M([10, -35, 50], [10, 3, 50], 0.3, 'col')];

test('findGrid reads the tower x positions and the two rows from the tall columns', () => {
  const g = H.findGrid([...towers(), M([5, -20, -41.5], [5, -20, 51.5], 0.2, 'beam')]);
  assert.deepEqual(g.xs, [0, 10]);
  assert.equal(g.rows.length, 2);
  assert.ok(g.rows[0].z0 <= -43 && g.rows[0].z1 >= -40);
  assert.equal(g.zMin, -43); assert.equal(g.zMax, 51.5);
});

test('splitAtGrid cuts a long x member at the grid, leaves short ones, and never emits zero-length pieces', () => {
  const g = { xs: [0, 10, 20, 30], rows: [], zMin: -43, zMax: 53 };
  const out = H.splitAtGrid([M([0, -20, -41.5], [25, -20, -41.5], 0.2, 'beam'), M([2, -20, -41.5], [8, -20, -41.5], 0.2, 'beam')], g);
  assert.deepEqual(out.map(m => [m.a[0], m.b[0]]), [[0, 10], [10, 20], [20, 25], [2, 8]]);
  const onPlane = H.splitAtGrid([M([10, -20, -41.5], [30, -20, -41.5], 0.2, 'beam')], g);
  assert.deepEqual(onPlane.map(m => [m.a[0], m.b[0]]), [[10, 20], [20, 30]]);
  const alongZ = H.splitAtGrid([M([5, 2, -43], [5, 2, 53], 0.2, 'beam')], g);
  assert.equal(alongZ.length, 10);                                  // 96 m in 10 m steps from zMin
});

test('group makes a tower of chords plus lacing, floors by level and bay, roof by truss line; order lists towers, floors, roof', () => {
  const ms = [...towers(),
    M([0.2, -30, -43], [0.2, -27, -40], 0.1, 'beam'),              // lacing inside tower x=0 front
    M([0, -20, -41.5], [10, -20, -41.5], 0.2, 'beam'),             // floor beam, level -20
    M([0, -20, -41.5], [10, -10, -41.5], 0.15, 'beam'),            // bracing between -20 and -10
    M([0, -10, -41.5], [10, -10, -41.5], 0.2, 'beam'),             // floor beam, level -10
    M([5, 3, -43], [5, 3, -33], 0.3, 'beam'),                      // roof truss chord along z at x=5 -> nearest tower x 0 or 10
    M([0, 5, -41.5], [10, 5, -41.5], 0.1, 'beam')];                // roof purlin along x
  for (let i = 0; i < 25; i++) ms.push(M([i, -20, 0], [i + 0.5, -20, 0], 0.1, 'beam'), M([i, -10, 0], [i + 0.5, -10, 0], 0.1, 'beam'));   // enough horizontals to make levels -20 and -10 peaks
  const pieces = H.group(ms, H.findGrid(ms));
  const tower0 = pieces.find(p => p.t === 'tower' && p.key.x === 0 && p.key.row === 0);
  assert.deepEqual(tower0.m.sort(), [0, 1, 6]);
  assert.ok(pieces.some(p => p.t === 'floor' && p.key.level === -20 && !p.key.band && p.m.includes(7)));
  assert.ok(pieces.some(p => p.t === 'floor' && p.key.band && p.m.includes(8)));
  assert.ok(pieces.some(p => p.t === 'roof' && p.m.includes(10)));
  assert.ok(pieces.some(p => p.t === 'roofx' && p.m.includes(11)));
  assert.ok(pieces.every(p => p.m.length > 0));
  const o = H.order(pieces);
  assert.equal(new Set(o).size, pieces.length);
  const types = o.map(i => pieces[i].t);
  assert.ok(types.lastIndexOf('tower') < types.indexOf('floor') && types.lastIndexOf('floor') < types.indexOf('roof'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hall-tool.test.js`
Expected: FAIL, `H.findGrid is not a function`.

- [ ] **Step 3: Implement `findGrid`, `splitAtGrid`, `group`, `order`**

A member is "along x" when |dx| > 0.9·length, "along z" likewise, "vertical" when |dy| > 0.9·length, "horizontal" when |dy| < 0.1·length; a diagonal is anything else. Tower membership uses the member's midpoint. Posts: vertical members with midpoint x within 1 m of `grid.xs[0]` or the last `xs` entry, not in a tower; their lacing = non-vertical members within 0.6 m of the post's x and inside its z ± 0.6 m. Floor pieces use `x bay = index of the grid interval holding the midpoint`, `z strip = floor((zMid − zMin) / 10)`. Order: towers sorted by (row, x); posts by (x, z); floors by (level ascending; beams of a level before the band above it; x bay; z strip); roof by (x, z); roofx by (x, z).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/hall-tool.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/make-hall.js tests/hall-tool.test.js
git commit -m "make-hall: grid split, erection pieces and order"
```

### Task 4: Projection, build, CLI, and the real JSON

**Files:**
- Modify: `tools/make-hall.js`
- Create: `assets/senkon/hal.json` (generated; replaces the crane JSON of the raster version)
- Test: `tests/hall-tool.test.js`

**Interfaces:**
- Produces: `CAMERA = { eye: [-70, 40, 130], at: [50, -16, 5], focal: 1.85, w: 1500, h: 1125 }`.
- Produces: `project(members, pieces, orderIdx, camera = CAMERA) -> { w, h, members: number[][], pieces: [{ t, m: number[], fly: number }], order: number[], depthOrder: number[] }` where each member row is `[x1, y1, x2, y2, wpx, depth]` rounded to 0.1 (depth = distance along the view axis, metres, 2 decimals), `wpx = w · focal · W / 2 / depth` rounded to 0.1, `fly = max(60, 1.5 × the piece's projected height)` rounded, `depthOrder` = member indices sorted by depth descending.
- Produces: `build(buf: Buffer) -> object` running parse → weld → featureEdges (per mesh, tagging `mesh` as `'col'` for the node named `IfcColumn`, `'beam'` otherwise) → bundle → findGrid → splitAtGrid → group → order → project.
- CLI: `node tools/make-hall.js <in.glb> <out.json>` writes the JSON (no spaces) and prints `members N, pieces N, bytes N`.

- [ ] **Step 1: Write the failing tests**

```js
test('project maps a point in front of the camera inside the canvas, nearer members wider, far ones first in depthOrder', () => {
  const ms = [M([50, -16, 5], [60, -16, 5], 1, 'beam'), M([50, -16, -40], [60, -16, -40], 1, 'beam')];
  const out = H.project(ms, [{ t: 'floor', key: {}, m: [0, 1] }], [0]);
  assert.equal(out.w, 1500); assert.equal(out.h, 1125);
  const [x1, y1, , , w0, d0] = out.members[0];
  assert.ok(x1 > 0 && x1 < 1500 && y1 > 0 && y1 < 1125);
  assert.ok(Math.abs(x1 - 750) < 1 && Math.abs(y1 - 562.5) < 1);     // the target projects to the centre
  assert.ok(out.members[1][4] < w0);                                 // z=-40 is farther from the eye at z=130
  assert.deepEqual(out.depthOrder, [1, 0]);
  assert.ok(out.pieces[0].fly >= 60);
  assert.deepEqual(out.order, [0]);
});

test('the generated hal.json is sane', { skip: !require('fs').existsSync(require('path').join(__dirname, '..', 'assets', 'senkon', 'hal.json')) }, () => {
  const d = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'senkon', 'hal.json'), 'utf8'));
  assert.ok(d.members.length > 4000 && d.members.length < 8000);
  assert.ok(d.pieces.every(p => p.m.length > 0));
  assert.equal(new Set(d.order).size, d.pieces.length);
  assert.equal(d.depthOrder.length, d.members.length);
  assert.ok(d.pieces.filter(p => p.t === 'tower').length >= 20);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hall-tool.test.js`
Expected: FAIL, `H.project is not a function`; the hal.json test is skipped (the old crane JSON must be deleted first: `git rm --cached` is not needed, it was never committed; delete `assets/senkon/hal.json`).

- [ ] **Step 3: Implement `project`, `build` and the CLI**

Projection as in the spec: `fwd = norm(at − eye)`, `right = norm(fwd × (0,1,0))`, `up = right × fwd`; for a point `d = p − eye`, `depth = d·fwd`, `sx = W/2 + (d·right)/depth · focal · W/2`, `sy = H/2 − (d·up)/depth · focal · W/2`.

- [ ] **Step 4: Run the tool on the real model and the tests**

Run: `node tools/make-hall.js local/hall-ref/model.glb assets/senkon/hal.json`
Expected: prints `members` between 4000 and 8000, `pieces` a few hundred, `bytes` under 250000, in under a minute.
Run: `node --test tests/hall-tool.test.js`
Expected: PASS (9 tests, none skipped).

- [ ] **Step 5: Commit**

```bash
git add tools/make-hall.js tests/hall-tool.test.js assets/senkon/hal.json
git commit -m "make-hall: projection, build and the hall JSON from the model"
```

### Task 5: The still picture

**Files:**
- Create: `tools/make-hall-still.py`
- Modify: `assets/senkon/hal.webp` (regenerated from the JSON; the raster version is overwritten)

**Interfaces:**
- CLI: `python tools/make-hall-still.py assets/senkon/hal.json assets/senkon/hal.webp` renders every member in `depthOrder` with the spec's stroke rules (ink `#3a3f44`, alpha 0.95→0.45 by depth, ink width `wpx + 1.5` then white `wpx`, widths clamped 1.2…6 px) at 2× size on white, downsampled with LANCZOS, saved as WebP quality 90; prints the size.

- [ ] **Step 1: Write the script**

Pillow only; draw on an RGBA layer with `ImageDraw.line`, composite over white, convert to `L`.

- [ ] **Step 2: Run it and look**

Run: `python tools/make-hall-still.py assets/senkon/hal.json assets/senkon/hal.webp`
Expected: `1500x1125 -> assets/senkon/hal.webp`; open the file (Read tool) and confirm it shows the finished hall from the probe's viewpoint with no stray long lines.

- [ ] **Step 3: Commit**

```bash
git add tools/make-hall-still.py assets/senkon/hal.webp
git commit -m "Hall still picture rendered from the member JSON"
```

### Task 6: Runtime script, page markup, tags, docs

**Files:**
- Create: `assets/senkon/hal.js`
- Modify: `index.html` (the `figure.xp-figure` in `#deneyim`, the script tags at the bottom)
- Modify: `site.css` (`.hall-stage`, `.hall-static`, canvas rules next to the skyline rules, line 71–81)
- Modify: `tools/versions.js` LINKS (add `'assets/senkon/hal.js': ['assets/senkon/hal.js']`; keep `hal.webp` covering `hal.json`)
- Modify: `tests/hero.test.js` (replace the raster hall test)
- Modify: `docs/senkon-site.md`

**Interfaces:**
- Consumes: `assets/senkon/hal.json` shape from Task 4.
- Page: `<figure class="hall xp-figure" data-hall="assets/senkon/hal.json" data-speed="1.4" aria-label="Endüstriyel çelik yapının taşıyıcı sisteminin montaj animasyonu">` with `<div class="hall-stage"><img class="hall-static" src="assets/senkon/hal.webp?v=…" alt="Kafes kolonlu çelik endüstriyel yapının taşıyıcı sistem çizimi" width="1500" height="1125" loading="lazy"></div>` and the existing caption; `<script src="assets/senkon/hal.js?v=…" defer></script>` after the skyline script.
- Runtime constants: `TOTAL = 25`, `FLY = 0.6`, `INK = '#3a3f44'`, alpha `0.95 → 0.45`, width clamp `1.2…6` CSS px, ease-out `1 − (1 − p)³`, hook bar 6 px.

- [ ] **Step 1: Write the failing page tests** (replace the test named "the steel hall build animation sits in the Deneyim banner…")

```js
test('the steel hall erection sits in the Deneyim banner, once, drawn by hal.js from hal.json', () => {
  const d = deneyim();
  assert.match(d, /<figure class="hall xp-figure"[^>]*data-hall="assets\/senkon\/hal\.json"[^>]*data-speed="1.4"/);
  assert.match(d, /<img class="hall-static" src="assets\/senkon\/hal\.webp\?v=[0-9a-f]{8}"[^>]*loading="lazy"/);
  assert.equal(html.split('hal.json').length - 1, 1);
  assert.doesNotMatch(d, /data-skyline/);
  assert.match(html, /<script src="assets\/senkon\/hal\.js\?v=[0-9a-f]{8}" defer><\/script>/);
  assert.match(css, /\.hall-stage\{/);
});

test('hal.js fails quietly, waits for both the JSON and the view, and never draws unstarted pieces', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hal.js'), 'utf8');
  assert.match(js, /\.catch\(\(\) => \{\}\)/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /const TOTAL = 25, FLY = 0\.6/);
  assert.match(js, /if \(!started\[/);   // the per-member skip guard in the frame loop
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hero.test.js`
Expected: FAIL on both new tests (figure not found, hal.js missing).

- [ ] **Step 3: Write `assets/senkon/hal.js`**

Structure, mirroring `skyline.js`: header comment; bail-outs (`fetch`, `IntersectionObserver`, `document.createElement('canvas').getContext`, reduced motion); `document.querySelectorAll('figure[data-hall]').forEach(prepare)`. `prepare(fig)`: find `.hall-stage` and `.hall-static` (return if missing), read `speed` and the `?v=` tag, `fetch(json + tag).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(data => ready(data)).catch(() => {})`; an `IntersectionObserver` at threshold 0.25 sets `seen = true`, disconnects and calls `maybeStart()`; `ready` stores the data and calls `maybeStart()`; `maybeStart` runs once both are set. `run(data)`: canvas sized to the stage's client width × `min(devicePixelRatio, 2)`, height by `data.h / data.w`, `k = canvas.width / data.w`; `fig.setAttribute('data-live', '1')`; arrays `pieceOf[member]`, `startAt[piece] = order position × (TOTAL − FLY) / (N − 1)`, `started[member]` recomputed each frame as `t >= startAt[pieceOf[m]]`; per frame clear, then `for i of depthOrder: if (!started[i]) continue;` compute the piece's `p = clamp((t − startAt) / FLY)`, `dy = −fly · (1 − ease(p)) · k`, alpha factor `0.25 + 0.75·p`, stroke ink then white; after the member loop draw hook lines for pieces with `0 < p < 1`; stop when `t ≥ TOTAL`, set `data-done="1"`. Clock pauses while `document.hidden`, as in skyline.js.

- [ ] **Step 4: Markup, CSS, tags, docs**

Replace the raster figure in `index.html` with the page markup above (keep the HTML comment but reword it: the hall is drawn from Fırat's model, towers at true height). Delete the `data-tallest-m` comment about crane scale. Add to `site.css` after the skyline rules: `.hall-stage{position:relative;overflow:hidden}`, `.hall-static{width:100%;height:auto;display:block}`, `.hall[data-live="1"] .hall-static{visibility:hidden}`, `.hall-stage canvas{position:absolute;inset:0;width:100%;height:100%}`. Add the `hal.js` LINKS line in `tools/versions.js`. In `docs/senkon-site.md` replace the hall sentence from 2026-10-13 with: the hall is drawn by `hal.js` from `hal.json`, made by `node tools/make-hall.js local/hall-ref/model.glb assets/senkon/hal.json` from the viewer's GLB kept in gitignored `local/hall-ref/`, the still by `python tools/make-hall-still.py assets/senkon/hal.json assets/senkon/hal.webp`; drop the compose/measure sentence for the hall and the variants-page mention; keep the `data-stagger` note for `skyline.js`. Then run `node tools/versions.js`.

- [ ] **Step 5: Run all tests**

Run: `node --test`
Expected: all pass (the two new page tests, the tool tests, versions).

- [ ] **Step 6: Commit**

```bash
git add assets/senkon/hal.js index.html site.css tools/versions.js tests/hero.test.js docs/senkon-site.md 404.html deprem-performans/index.html hakkinda/index.html kvkk/index.html
git commit -m "Deneyim: the steel hall erected element by element from the model"
```

### Task 7: Browser verification and tuning

**Files:**
- Possibly modify: `assets/senkon/hal.js`, `tools/make-hall.js` CAMERA, `assets/senkon/hal.json`, `assets/senkon/hal.webp`

- [ ] **Step 1: Serve and watch**

Open `http://127.0.0.1:8080/index.html` in the browser pane (the repo-root server on 8080), scroll to `#deneyim`, screenshot at 3 s, 10 s, 20 s and after the end. Expected: towers appear one by one with hook lines, then floors, then roof; nothing from unstarted pieces shows; the final frame matches `hal.webp`.

- [ ] **Step 2: Phone width**

`resize_window` mobile, reload, scroll to the banner, screenshot mid-erection and at the end; then reset to desktop. Expected: the drawing fills the width below the types and stays sharp (device pixel ratio honoured).

- [ ] **Step 3: Fix what the screenshots show**

If painter's order leaves visible crossing glitches, shorten `maxLen` in `splitAtGrid` to 6 m and regenerate; if the frame rate on the phone preset stutters, cap the ink alpha work by skipping the white stroke for members narrower than 2 px. Regenerate JSON and still, rerun `node tools/versions.js` and `node --test` after any change.

- [ ] **Step 4: Commit and report**

```bash
git add -A assets/senkon tools index.html site.css docs tests 404.html deprem-performans hakkinda kvkk
git commit -m "Hall erection: tuning after the browser check"
```

Report to Fırat with the screenshots' findings; he decides on the push and the PR (compare URL from `local/`).
