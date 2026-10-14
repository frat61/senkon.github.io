# Steel Hall Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the hall erects itself in the hero, it turns slowly on its own until touched, and the visitor can turn and tilt it by dragging.

**Architecture:** The data file carries members in metres plus the camera and the default view's framing (format 2). The page script projects every frame with the same formula the tool and the still use, sorts far to near, and keeps the erection swings in screen space. An orbit state machine (building → turning → held → still) drives the camera.

**Tech Stack:** Node (CommonJS, `node:test`), vanilla browser JS with canvas 2D and pointer events, Python 3 + Pillow for the still.

**Spec:** `docs/superpowers/specs/2026-10-14-hall-rotate-design.md` (builds on `2026-10-14-hall-erection-design.md`)

## Global Constraints

- No new dependencies. Tests run with bare `node --test` from the repo root.
- `local/hall-ref/model.glb` stays gitignored; only `assets/senkon/hal.json` and `hal.webp` are committed.
- Run `node tools/versions.js` after changing `hal.js`, `hal.json`, `hal.webp` or `site.css`; `tests/versions.test.js` fails otherwise.
- Camera: eye (−70, 40, 130), target (50, −16, 5), focal 1.85, canvas 1500 × 1125; framing margins 4 % sides, 8 % top, 4 % bottom.
- Projection formula exactly as spec section 3, in the tool, the still and the runtime.
- Turn: one revolution per `TURN = 60` s real time; drag `az −= dx · 0.006`, `el += dy · 0.005`, `el` clamped to 3°…70° (0.0524…1.2217 rad).
- Stroke rules unchanged from the erection spec (ink `#3a3f44`, alpha 0.95→0.45, widths 1.2…6 picture px × k, white stroke from 2 · k).
- Commit each task on branch `hall-rotate` with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer. Never push.

## Review Focus

1. A touch that starts as a vertical swipe over the drawing must scroll the page, never rotate — Task 4 sets `touch-action: pan-y` and handles `pointercancel`; Task 5 checks it at phone width.
2. A drag during the erection must neither rotate nor stop the clock — Task 3 ignores pointer input while `building` (source test in Task 4).
3. A format-1 file (old cache, old JSON next to a new script) must leave the still, not throw mid-frame — Task 3 checks `data.v === 2` before `data-live` is set (source test in Task 4).
4. After the visitor lets go, the frame loop must stop, or an idle hero burns battery — Task 3's `still` state schedules no frame (source test: `if (state === 'still') return` before the next `requestAnimationFrame`).
5. Projection at the exact elevation clamp and at `az` wrapping past 2π must stay finite and continuous — Task 2's runtime tests cover the clamp and a full-turn round trip.

---

### Task 1: Tool writes format 2

**Files:**
- Modify: `tools/make-hall.js` (after `fit`, line 281; `build`, line 297; exports, line 309)
- Modify: `tests/hall-tool.test.js` (the `hal.json` guard test and the `project`/`fit` tests stay)

**Interfaces:**
- Consumes: `project(members, pieces, orderIdx, camera)` and `fit(data, margins)` as they are.
- Produces: `framing(members, camera = CAMERA, margins = MARGINS) -> { s: number, dx: number, dy: number }`: projects the members with `project` (empty pieces, empty order), takes the bounding box of the 2-D rows and returns the scale and offset `fit` would apply (same arithmetic as `fit`, returned instead of applied; `s` to 6 decimals, `dx`, `dy` to 1 decimal).
- Produces: `pack(members, pieces, orderIdx, camera = CAMERA) -> { v: 2, w, h, cam: { eye, at, focal, s, dx, dy }, members: number[][], pieces: [{ t, m }], order }` with each member `[x1, y1, z1, x2, y2, z2, wm]` rounded to 3 decimals.
- `build(buf)` returns `pack(...)` instead of `fit(project(...))`.

- [ ] **Step 1: Write the failing tests**

```js
test('framing returns the scale and offset that fit the default view inside the margins', () => {
  const ms = [M([0, -35, -43], [100, -35, -43], 0.3, 'col'), M([0, 8, 53], [100, 8, 53], 0.3, 'col'), M([0, -35, 53], [0, 8, -43], 0.3, 'col')];
  const f = H.framing(ms);
  assert.ok(f.s > 0 && Number.isFinite(f.dx) && Number.isFinite(f.dy));
  const rows = H.fit(H.project(ms, [], []));                           // the applied version
  const raw = H.project(ms, [], []).members[0];
  assert.ok(Math.abs(raw[0] * f.s + f.dx - rows.members[0][0]) < 0.11 && Math.abs(raw[1] * f.s + f.dy - rows.members[0][1]) < 0.11);
});

test('pack writes format 2: members in metres, the camera with its framing, pieces and order', () => {
  const ms = [M([0, -35, -43], [0, 3, -43], 0.3, 'col'), M([0, -20, -41.5], [10, -20, -41.5], 0.2, 'beam')];
  const d = H.pack(ms, [{ t: 'tower', key: {}, m: [0] }, { t: 'floor', key: {}, m: [1] }], [0, 1]);
  assert.equal(d.v, 2); assert.equal(d.w, 1500); assert.equal(d.h, 1125);
  assert.deepEqual(d.members[0], [0, -35, -43, 0, 3, -43, 0.3]);
  assert.deepEqual(d.cam.eye, [-70, 40, 130]); assert.equal(d.cam.focal, 1.85); assert.ok(d.cam.s > 0);
  assert.deepEqual(d.pieces, [{ t: 'tower', m: [0] }, { t: 'floor', m: [1] }]);
  assert.deepEqual(d.order, [0, 1]);
  assert.equal(d.depthOrder, undefined);
});
```

Change the guard test on the real file: `d.v === 2`, every member has 7 numbers, `d.cam.s > 0`, no `depthOrder`; keep the piece and order checks.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hall-tool.test.js`
Expected: FAIL, `H.framing is not a function`; the real-file guard fails on `d.v`.

- [ ] **Step 3: Implement `framing`, `pack`, and switch `build`**

`framing` factors the bounding-box arithmetic out of `fit` into a helper both use, so the two cannot drift.

- [ ] **Step 4: Regenerate and run the tests**

Run: `node tools/make-hall.js local/hall-ref/model.glb assets/senkon/hal.json`
Expected: `members 3782, pieces 536, bytes` about 230000.
Run: `node --test tests/hall-tool.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/make-hall.js tests/hall-tool.test.js assets/senkon/hal.json
git commit -m "make-hall: format 2, members in metres with the camera and its framing"
```

### Task 2: Still from format 2, and the runtime's camera math with tests

**Files:**
- Modify: `tools/make-hall-still.py`
- Modify: `assets/senkon/hal.js` (restructure: pure functions first, exported for Node; the browser part guarded by `typeof window === 'undefined'`)
- Create: `tests/hall-runtime.test.js`

**Interfaces:**
- Produces (hal.js, exported): `project(p: number[], cam: { eye, at, focal, s, dx, dy }, W: number, H: number) -> [sx, sy, depth]` per spec section 3 (the camera basis recomputed from `cam.eye` each call; callers pass an `eye` they derived from `orbit`).
- Produces: `spherical(eye, at) -> { dist, az, el }` and `eyeAt(at, dist, az, el) -> number[]` per spec section 3; `clampEl(el) -> number` to 0.0524…1.2217.
- Produces: `widthPx(wm, depth, cam, W) -> number` = `wm · focal · W/2 / depth · s`.
- The still script computes the same three things in Python and draws in its own depth order; the output file must match the previous `hal.webp` to the eye.

- [ ] **Step 1: Write the failing runtime tests**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../assets/senkon/hal.js');
const cam = { eye: [-70, 40, 130], at: [50, -16, 5], focal: 1.85, s: 1, dx: 0, dy: 0 };

test('project maps the target to the canvas centre, scaled and shifted by the framing', () => {
  const [x, y, depth] = R.project(cam.at, cam, 1500, 1125);
  assert.ok(Math.abs(x - 750) < 1e-6 && Math.abs(y - 562.5) < 1e-6 && depth > 0);
  const [x2, y2] = R.project(cam.at, { ...cam, s: 0.5, dx: 100, dy: -20 }, 1500, 1125);
  assert.ok(Math.abs(x2 - 475) < 1e-6 && Math.abs(y2 - 261.25) < 1e-6);
});

test('spherical and eyeAt round-trip the fixed eye, and a full turn comes back', () => {
  const s = R.spherical(cam.eye, cam.at), back = R.eyeAt(cam.at, s.dist, s.az, s.el);
  back.forEach((v, i) => assert.ok(Math.abs(v - cam.eye[i]) < 1e-3));
  const turned = R.eyeAt(cam.at, s.dist, s.az + 2 * Math.PI, s.el);
  turned.forEach((v, i) => assert.ok(Math.abs(v - cam.eye[i]) < 1e-3));
});

test('the elevation clamp holds and projection stays finite at both limits', () => {
  assert.equal(R.clampEl(-1), 0.0524); assert.equal(R.clampEl(3), 1.2217);
  const s = R.spherical(cam.eye, cam.at);
  for (const el of [0.0524, 1.2217]) {
    const eye = R.eyeAt(cam.at, s.dist, s.az, el);
    const [x, y, d] = R.project([0, -35, -43], { ...cam, eye }, 1500, 1125);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && d > 0);
  }
});

test('widthPx scales a width in metres by the focal factor, the depth and the framing', () => {
  assert.ok(Math.abs(R.widthPx(1, 100, { focal: 2, s: 0.5 }, 1500) - 7.5) < 1e-9);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hall-runtime.test.js`
Expected: FAIL, `R.project is not a function` (the IIFE exports nothing yet).

- [ ] **Step 3: Restructure `hal.js` and export the math; rewrite the still script for format 2**

`hal.js`: top-level pure functions `project`, `spherical`, `eyeAt`, `clampEl`, `widthPx`; then `if (typeof module !== 'undefined') module.exports = {…}; if (typeof window === 'undefined') return;` inside the IIFE, as `surec.js` does; the rest of the runtime unchanged for now (it still reads the old 2-D rows, so the page is broken until Task 3; that is fine on this branch).
`make-hall-still.py`: read `cam`, project each member's two endpoints with the formula, sort by mean depth descending, draw with widths from `wm`.

- [ ] **Step 4: Run tests and the still**

Run: `node --test tests/hall-runtime.test.js`
Expected: PASS (4 tests).
Run: `python tools/make-hall-still.py assets/senkon/hal.json assets/senkon/hal.webp`
Expected: `1500x1125 -> assets/senkon/hal.webp`; open it and confirm it looks like the committed still (same framing, same lines).

- [ ] **Step 5: Commit**

```bash
git add assets/senkon/hal.js tests/hall-runtime.test.js tools/make-hall-still.py assets/senkon/hal.webp
git commit -m "Hall: camera math shared and tested; still rendered from format 2"
```

### Task 3: Runtime projects per frame, turns, and takes the drag

**Files:**
- Modify: `assets/senkon/hal.js` (`run`, lines 40–99 of the current file)
- Modify: `site.css` (hall rules, lines 82–86)
- Modify: `index.html` (the hero figure's `aria-label`)

**Interfaces:**
- Consumes: format-2 data and the exported math from Task 2.
- Produces: constants `TURN = 60` (seconds per revolution), `DRAG_AZ = 0.006`, `DRAG_EL = 0.005`; state variable `state` in `'building' | 'turning' | 'held' | 'still'`.

- [ ] **Step 1: Write the failing page tests** (in `tests/hero.test.js`, next to the existing `hal.js` source tests)

```js
test('hal.js turns the hall after the erection and lets the visitor drag it, without stealing vertical swipes', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hal.js'), 'utf8');
  assert.match(js, /const TURN = 60/);
  assert.match(js, /data\.v !== 2/);                                   // old files leave the still
  assert.match(js, /addEventListener\('pointerdown'/);
  assert.match(js, /addEventListener\('pointercancel'/);
  assert.match(js, /if \(state === 'building'\) return;/);             // a drag never interrupts the erection
  assert.match(js, /if \(state === 'still'\) return;/);                // no frame loop while idle
  assert.match(css, /\.hall-stage canvas\{[^}]*touch-action:pan-y/);
  assert.match(hero(), /aria-label="Endüstriyel çelik yapının taşıyıcı sisteminin montaj animasyonu; sürükleyerek döndürülebilir"/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/hero.test.js`
Expected: FAIL on the new test (no `TURN`, no pointer handlers).

- [ ] **Step 3: Implement the frame loop and the states**

In `run`: bail unless `data.v === 2` (before `data-live`). Keep `k`, lanes, `startAt`, `flyOf`, `sideOf` as they are. Per frame: `eye = eyeAt(at, dist, az, el)`, project both endpoints of every member into `Float32Array`s `px1, py1, px2, py2, depth`, `wpx[i] = clamp(widthPx(wm, depth, cam, W), W_MIN, W_MAX) · k`, then sort `idx` (an `Int32Array` of member indices) by `depth` descending, compute `dMin/dMax`, then the existing drawing loop reading from the arrays (the swing offsets unchanged). Clock: `t` advances only while `state === 'building'`; when `t ≥ TOTAL + 0.1` set `data-done`, `state = 'turning'`, `canvas.style.cursor = 'grab'`. `turning`: `az += 2π / TURN · dtSeconds` (real time, from `now`). Pointer: `pointerdown` → if `state === 'building'` return; `state = 'held'`, capture, cursor `grabbing`, remember `(x, y)`; `pointermove` while held → `az -= dx · DRAG_AZ`, `el = clampEl(el + dy · DRAG_EL)`, request a frame; `pointerup`/`pointercancel` → `state = 'still'`, cursor `grab`. The loop: at the end of `frame`, `if (state === 'still') return;` else `requestAnimationFrame(frame)`; a pointer event while `still` restarts the loop with one `requestAnimationFrame(frame)`.
`site.css`: add `touch-action:pan-y` to the `.hall-stage canvas` rule.
`index.html`: the new `aria-label`.

- [ ] **Step 4: Run all tests**

Run: `node tools/versions.js && node --test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add assets/senkon/hal.js site.css index.html tests/hero.test.js 404.html deprem-performans/index.html hakkinda/index.html kvkk/index.html
git commit -m "Hero hall: turns on its own after the erection, drag to turn and tilt"
```

### Task 4: Docs and the spec's source checks

**Files:**
- Modify: `docs/senkon-site.md` (the hall sentence)
- Modify: `docs/superpowers/specs/2026-10-14-hall-erection-design.md` (one line at the end pointing to the rotation spec and format 2)

- [ ] **Step 1: Update the docs**

`senkon-site.md`: the data file is format 2 (members in metres, camera and framing), `hal.js` projects per frame and the hall turns after the erection, drag to turn, `touch-action: pan-y` keeps phone scrolling. The erection spec gets: "Superseded in part by `2026-10-14-hall-rotate-design.md`: data format 2, runtime projection."

- [ ] **Step 2: Run the suite and commit**

Run: `node --test`
Expected: all pass.

```bash
git add docs/senkon-site.md docs/superpowers/specs/2026-10-14-hall-erection-design.md
git commit -m "Docs: hall data format 2 and the rotation"
```

### Task 5: Browser verification

**Files:** none expected; fixes go to the files above with their tests.

- [ ] **Step 1: Desktop**

`preview_start` the `site-8081` server, open `http://localhost:8081/index.html`, let the erection finish (about 18 s), take screenshots a few seconds apart to see the hall turning, then drag on the canvas with `left_click_drag` and screenshot: the view must change and the turning must have stopped. Expected: no console errors; `data-done="1"`; the cursor rule present.

- [ ] **Step 2: Phone**

`resize_window` mobile, reload, wait for the erection, then a horizontal `left_click_drag` over the drawing must rotate it. The pane sends mouse events, not touches, so the vertical-swipe-scrolls rule cannot be exercised here: confirm the `touch-action:pan-y` rule is applied via `javascript_tool` (`getComputedStyle(canvas).touchAction`), and ask Fırat to swipe over it on his phone. Reset to desktop.

- [ ] **Step 3: Fix what the check shows, with a test first, then commit**

```bash
git add -A assets/senkon site.css index.html tests docs 404.html deprem-performans hakkinda kvkk
git commit -m "Hall rotation: tuning after the browser check"
```
