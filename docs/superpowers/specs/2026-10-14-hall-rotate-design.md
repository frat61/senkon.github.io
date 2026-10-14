# Steel hall: turn it around after it is built

Date: 2026-10-14. Builds on `2026-10-14-hall-erection-design.md` (merged into `main` at 13b554f). Branch
`hall-rotate`. Fırat's idea: after the hall erects itself in the hero, the visitor can turn it around like a
model in the `/model/` viewer. His choice on behaviour: it keeps turning slowly by itself until touched.

## 1. Behaviour

- The erection plays exactly as today, from the fixed default view, about 18 s on the page.
- When the last piece lands the camera starts orbiting the hall's centre: one full turn in 60 s, elevation
  unchanged. It turns until the first pointer-down on the drawing, then never resumes.
- Dragging sideways turns the hall (azimuth), dragging up or down tilts it (elevation clamped to 3°…70°).
  No zoom, no inertia. The cursor is a grab hand over the finished drawing, grabbing while dragging.
- Phones: vertical swipes scroll the page as before; only sideways drags rotate (`touch-action: pan-y` on
  the canvas, the browser cancels the pointer when it takes the gesture for scrolling).
- Without JavaScript or with reduced motion the still picture shows, as today. Document hidden pauses the
  clock as today; after the erection the frame loop runs only while the hall is turning or being dragged.
- The figure's `aria-label` says it can be turned by dragging: "Endüstriyel çelik yapının taşıyıcı
  sisteminin montaj animasyonu; sürükleyerek döndürülebilir".

## 2. Data file, format 2

`assets/senkon/hal.json` written by `tools/make-hall.js`:

```
{ v: 2, w: 1500, h: 1125,
  cam: { eye: [x,y,z], at: [x,y,z], focal: 1.85, s: <framing scale>, dx: <px>, dy: <px> },
  members: [[x1,y1,z1, x2,y2,z2, wm], …],      metres, Y up, 3 decimals; wm = width in metres
  pieces: [{ t, m: [member indices] }, …],
  order: [piece indices in erection order] }
```

`depthOrder` is gone: the runtime sorts per frame. `cam.s`, `cam.dx`, `cam.dy` are the framing of the default
view: the tool projects the members with `eye/at/focal` onto the 1500 × 1125 canvas, fits the bounding box
inside the margins of the erection spec (4 % sides, 8 % top, 4 % bottom) and records the scale and offset,
so the default view is pixel-for-pixel what the erection spec defined. Other views reuse the same framing;
the hall's plan is nearly square (100 × 96 m), so it stays inside the canvas while turning.

## 3. Projection, one formula in three places

Camera basis: `fwd = norm(at − eye)`, `right = norm(fwd × (0,1,0))`, `up = right × fwd`. For a point `p`:
`d = p − eye`, `depth = d · fwd`, `sx = (W/2 + (d · right) / depth · focal · W/2) · s + dx`,
`sy = (H/2 − (d · up) / depth · focal · W/2) · s + dy`, member width `wpx = wm · focal · W/2 / depth · s`.
Used by the tool (framing), by `tools/make-hall-still.py` (the still) and by `assets/senkon/hal.js`
(every frame). The runtime exports its `project` and `orbit` functions for Node tests the way `surec.js`
exports `setup` and `label`.

Orbit: the fixed eye is turned into spherical coordinates about `at`: `dist = |eye − at|`,
`el = asin((eye.y − at.y) / dist)`, `az = atan2(eye.x − at.x, eye.z − at.z)`; an eye for any `(az, el)` is
`at + dist · (cos el · sin az, sin el, cos el · cos az)`, the viewer's convention. Auto-turn: `az` grows by
2π / 60 per second (× `data-speed` is NOT applied; the turn is real time). Drag: `az −= dxPx · 0.006`,
`el += dyPx · 0.005`, clamped.

## 4. Runtime `assets/senkon/hal.js`

- Loads the format-2 file (`v === 2`; anything else: leave the still, as any failure does).
- Per frame: compute the eye from `(az, el)`, project every member (two points), depth-sort the member
  indices far to near (a typed index array sorted by depth), compute the frame's depth range for the fade,
  then draw as today: ink stroke `wpx + 1.5 · k` under a white stroke `wpx` (white only at `wpx ≥ 2 · k`),
  widths clamped to 1.2…6 picture px × k, alpha 0.95 nearest to 0.45 farthest, erection swings added in
  screen space after projection exactly as in the erection spec (lanes, overlap, swing, lift).
- States: `building` (clock runs, view fixed) → `turning` (auto-rotate, clock stopped) → `held` (pointer
  down: drag applies) → `still` (pointer up after a drag: no frame loop until the next pointer-down).
- Pointer events on the canvas: `pointerdown` sets `held`, captures the pointer, records the position;
  `pointermove` applies the delta; `pointerup`/`pointercancel` ends the hold. Dragging during `building` is
  ignored (the erection is not interrupted). Cursor `grab` from `turning` on, `grabbing` while held.
- The canvas gets `touch-action: pan-y` (set in `site.css` next to the other hall rules).

## 5. Still `tools/make-hall-still.py`

Reads format 2, projects with `cam` (section 3), sorts by depth itself, draws with the same stroke rules.
Output unchanged in look from the erection spec's still.

## 6. Tool `tools/make-hall.js`

`project(members, pieces, orderIdx, camera)` (2-D, kept for the framing step and its tests) and `fit` stay.
New `pack(members, pieces, orderIdx, camera = CAMERA) -> format-2 data`: projects for framing with
`project` + `fit`-style margins to get `s, dx, dy`, then emits 3-D members (3 decimals) and `cam`. `build()`
returns `pack(...)`. The CLI prints the same counts plus the file size.

## 7. Tests

- `tests/hall-tool.test.js`: `pack` writes `v: 2`, seven numbers per member, `cam` with `s > 0`; the
  default-view framing puts the members' projected bounding box inside the margins (project the packed
  members with the runtime's exported `project` and check); the real `hal.json` guard adapts to format 2.
- `tests/hall-runtime.test.js` (new): the runtime's `project` maps `cam.at` to the canvas centre scaled by
  `s` and shifted by `dx, dy`; `orbit(eye, at)` round-trips the fixed eye (spherical → eye within 1 mm);
  elevation clamp holds.
- `tests/hero.test.js`: source checks: `touch-action` rule in `site.css`, `pointerdown` handling,
  `TURN = 60` seconds per revolution, the `aria-label` with "sürükleyerek döndürülebilir", `v === 2` guard.
- Browser: watch the erection finish and the hall start turning; drag it with the mouse; at phone width
  confirm a vertical swipe over the drawing still scrolls the page.

## 8. Out of scope

Zoom, inertia, resetting to the default view, a visible "drag to turn" hint beyond the caption and the
label (the hero hides captions), three.js.
