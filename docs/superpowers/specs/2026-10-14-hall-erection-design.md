# Steel hall erection animation

Date: 2026-10-14. Replaces the raster "rise with cranes" figure for the steel hall in the Deneyim banner
(branch `hall-build`) with an element-by-element erection drawn from Fırat's own model.

## 1. Goal

The Deneyim banner on the home page shows Fırat's lattice-column steel hall (about 100 × 96 m in plan,
towers 35 m tall, roof to 43 m) being erected the way a site erects it: lattice towers one by one, then
floor beams and bracing bay by bay, then the roof trusses, each piece arriving in the air and settling into
place. The drawing is an ink line drawing produced from the real member geometry, not a redrawn picture,
and the finished drawing stays on the page. Without JavaScript or with reduced motion a still of the
finished drawing shows.

## 2. Source model

`local/hall-ref/model.glb` (gitignored, 14.5 MB) is the viewer's own GLB of the hall
(`/model/?m=mcxtnsnsdcbd`), written by `model/ifc2glb.js` from Fırat's IFC: two meshes, `IfcColumn` and
`IfcBeam`, each the merged triangles of all elements of that type, red material, Y up, metres. Vertices are
not shared between triangles, so elements are recovered by welding vertices on a 1 mm grid. Facts measured
from the file and relied on below:

- x runs 0…100 m along the long side, z runs −43…53 m across, y runs −35 m (ground) to about 8 m (ridge).
- Lattice towers stand at x = 0, 10, …, 100 on two rows, z ≈ −41.5 and z ≈ 51.5; each tower's two chords
  (I sections 3 m apart in z) are one `IfcColumn` element of 44 welded vertices, 38 m tall; the lacing
  diagonals are `IfcBeam` elements.
- Several roof and floor trusses are single `IfcBeam` elements 100 m long (about 1,260 vertices each).
- Welding and bundling the long feature edges gives about 5,200 member lines, widths 0.1–0.7 m.

The GLB never goes on the site. Only the derived JSON and the still picture are committed.

## 3. Offline tool: `tools/make-hall.js`

Node, no dependencies, run as `node tools/make-hall.js local/hall-ref/model.glb assets/senkon/hal.json`.
Pure functions exported for tests (`parseGlb`, `weld`, `featureEdges`, `bundle`, `splitAtGrid`, `group`,
`order`, `project`); the command line glues them.

1. **Parse** the GLB: JSON chunk, BIN chunk, POSITION and index accessors of every mesh (float32,
   uint16 or uint32 indices).
2. **Weld**: vertices within 1 mm share an id.
3. **Feature edges**: an edge is kept when it is a boundary edge or the dihedral angle between its two
   faces exceeds 30°, and it is at least 0.3 m long.
4. **Bundle** edges into members: two edges belong to the same member when they are parallel within 3°,
   the perpendicular distance between their lines is under 0.35 m, and their extents along the common axis
   overlap or leave a gap under 0.3 m. Union-find over edges, bucketed by quantised direction and position
   so it runs in seconds. A member is the bundle's axis (mean line), its extent along the axis, and a width
   (twice the largest perpendicular offset, never under 0.1 m). Members shorter than 0.3 m are dropped.
   Each member remembers its mesh (column or beam).
5. **Split at the grid** so an erection piece is one bay: members longer than 12 m are cut at the planes
   x = 0, 10, …, 100 (the tower x positions, found as the x values of the tallest column members) and, for
   members running along z, every 10 m between the two tower rows.
6. **Group** members into pieces with a type and a key:
   - `tower`: every member within 1.6 m in x of a tower x and within the tower's chord z range ± 0.6 m,
     whole height. One piece per tower (22).
   - `post`: a vertical member at x ≈ 0 or x ≈ 100 not in a tower, with the lacing within 0.6 m of it.
   - `floor`: members below the roof (y ≤ 0.5 m) not in a tower or post. Floor levels are the peaks of the
     histogram of horizontal members' y (bins of 0.5 m). A horizontal member belongs to its nearest level;
     a diagonal to the band between the two levels it spans. Grouped by (level or band, x bay, 10 m z strip).
   - `roof`: members above y = 0.5 m. Members along z (trusses) grouped by (nearest tower x, 10 m z
     segment); everything else by (x bay, 10 m z strip) as `roofx`.
7. **Order** the pieces: towers front row x ascending, back row x ascending; posts at x = 0 then x = 100,
   z ascending; floor pieces level by level from the bottom, within a level by x bay then z strip, beams
   before the bracing band above them; roof trusses by x line then z; `roofx` pieces by x bay then z.
8. **Project** with a fixed perspective camera: eye (−70, 40, 130), target (50, −16, 5), focal factor
   1.85, canvas 1500 × 1125 px (same framing as the probe renders). For each member write its two 2-D
   endpoints (0.1 px), its width in pixels at its depth, and its depth. For each piece write the member
   indices and the fly-in distance: 1.5 × the piece's projected height, at least 60 px.
9. **Write** `assets/senkon/hal.json`:
   `{ w, h, ground, members: [[x1,y1,x2,y2,wpx,depth], …], pieces: [{ t:"tower", m:[…], fly:px }, …],
   order: [piece indices in erection order], depthOrder: [member indices far to near] }`.
   Target under 200 KB raw. The script prints member and piece counts and the file size.

`tools/make-hall-still.py` (PIL) renders `hal.json` to `assets/senkon/hal.webp` with the stroke rules of
section 5, at 2× and downscaled, for the no-JavaScript still. Rerun both after any change to the model or
the camera, then `node tools/versions.js`.

## 4. Page

`index.html`, Deneyim banner, the existing `figure.xp-figure` slot:

```html
<figure class="hall xp-figure" data-hall="assets/senkon/hal.json" data-speed="1.4" aria-label="Endüstriyel çelik yapının taşıyıcı sisteminin montaj animasyonu">
  <div class="hall-stage"><img class="hall-static" src="assets/senkon/hal.webp?v=…" alt="Kafes kolonlu çelik endüstriyel yapının taşıyıcı sistem çizimi" width="1500" height="1125" loading="lazy"></div>
  <figcaption class="skyline-caption">Endüstriyel çelik yapı, taşıyıcı sistem modeli</figcaption>
</figure>
<script src="assets/senkon/hal.js?v=…" defer></script>
```

The `data-skyline` attributes, the crane JSON and the raster `hal.webp` of the earlier version go away;
`skyline.js` keeps its new `data-stagger` option (harmless, tested). The banner layout from 2026-10-13
(drawing right of the types on desktop, below them on phones) stays; `.hall-stage` gets the same rules as
`.skyline-stage` and the canvas fills it.

## 5. Runtime: `assets/senkon/hal.js`

Vanilla script in the style of `skyline.js` and `surec.js`; about 150 lines.

- Bails out without `fetch`, `IntersectionObserver`, canvas 2D, or with `prefers-reduced-motion`.
- For every `figure[data-hall]`: fetch the JSON with the still picture's `?v=` tag, create a canvas the
  size of the stage over the picture (`data-live="1"` hides the picture, as skyline does), start when the
  figure is 25 % in view, once per page load.
- Time line: `speed` from `data-speed`. Pieces start in `order` with a uniform stagger so the whole
  erection takes 25 s at speed 1 (last piece lands at 25 s); each piece flies for 0.6 s. Document hidden
  pauses the clock (as in skyline.js).
- A piece's state at time t: not started, flying (progress p with ease-out, offset −fly·(1−p) px, alpha
  0.25 + 0.75·p), or landed. A flying piece shows a hook line: a thin vertical from the top of the piece's
  bounding box up past the canvas edge, with a small hook bar.
- Each frame: clear, then draw every member of started pieces in `depthOrder` (far to near): first an ink
  stroke of width `wpx + 1.5`, then a white stroke of width `wpx` on top, so wide members read as outlined
  bars and thin ones as single ink lines. Ink is `#3a3f44`; its alpha fades from 0.95 for the nearest
  depth to 0.45 for the farthest; line width is clamped to 1.2…6 px (scaled to the canvas's actual size
  and device pixel ratio).
- When the last piece lands the final frame stays on the canvas and the figure gets `data-done="1"`.
- Members of pieces that have not started are not drawn at all, so nothing shows through from the future.

## 6. Tests

- `tests/hall-tool.test.js`: on a tiny synthetic GLB built in the test (two welded prisms, one 25 m long
  along x crossing the grid, one vertical): `parseGlb` reads it, `weld` merges duplicates, `featureEdges`
  keeps the 90° corners and drops flat diagonals, `bundle` returns one member per prism with the right
  length and width, `splitAtGrid` cuts the long one at x = 10 and 20, `group` puts the vertical in a tower
  and the horizontal in floor pieces, `order` lists towers before floors, `project` maps a point in front
  of the camera inside the canvas. Plus one guard on the real output when `assets/senkon/hal.json` exists:
  member count between 4,000 and 8,000, every piece non-empty, `order` a permutation.
- `tests/hero.test.js`: the Deneyim banner holds the `figure.hall` with `data-hall` once, the still is
  lazy, `hal.js` is linked with a tag; `skyline.js` no longer mentioned for the hall.
- `tests/versions.test.js` unchanged; `tools/versions.js` LINKS gains `assets/senkon/hal.js` and the
  `hal.webp` entry covers `hal.json`.
- Visual check in the browser pane at desktop and phone widths; screenshots mid-erection and at the end.

## 7. Out of scope

Cranes, dust, sound; three.js on the home page (kept as the fallback if painter's ordering shows
artefacts: the same JSON would feed it); scroll-driven playback; naming the project.

## 8. Revision 2026-10-14, after Fırat watched it

The first build (556 pieces dropping straight down on hook lines, 0.6 s each) read as "lines moving down".
Changed, with his yes:

- **Coarser pieces.** A floor piece is one bay across the whole hall width at one floor (the chords of a floor
  truss, levels under 4 m apart, are one floor named by its top level; bracing joins the floor it stands on).
  A roof truss line is one piece; purlins and roof bracing group per bay. Towers and posts as before.
  Keys: `floor {level, x}`, `roof {x}`, `roofx {x}`. No `fly` field in the JSON.
- **A crane swing instead of a drop.** No hook lines. A piece starts off the upper right of the canvas,
  `SWING_X = 0.35` of the width and `SWING_Y = −0.3` of the height away from its place, and swings in along an
  arc with ease-in-out over `FLY = 1` s, fading in over the first third.
- **Columns quick, the rest deliberate.** Start times follow cumulative weights: towers and posts weigh 1,
  every other piece 3, over the same 25 s at speed 1.
