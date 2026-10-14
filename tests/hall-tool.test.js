'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../tools/make-hall.js');

/* A valid glTF 2 binary from plain arrays: one buffer, one bufferView and accessor per attribute,
   one node per mesh (named), so the parser sees the shapes the viewer's converter writes. */
function makeGlb(meshes) {
  const views = [], accessors = [], chunks = [], gltfMeshes = [], nodes = [];
  let offset = 0;
  const push = (bytes, componentType, type, count, extra) => {
    const pad = (4 - bytes.length % 4) % 4;
    const b = Buffer.concat([bytes, Buffer.alloc(pad)]);
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    accessors.push(Object.assign({ bufferView: views.length - 1, componentType, type, count }, extra || {}));
    chunks.push(b); offset += b.length; return accessors.length - 1;
  };
  meshes.forEach((m, i) => {
    const pos = Float32Array.from(m.positions);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < pos.length; k += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos[k + c]); mx[c] = Math.max(mx[c], pos[k + c]); }
    const p = push(Buffer.from(pos.buffer), 5126, 'VEC3', pos.length / 3, { min: mn, max: mx });
    const idx = m.index16 ? Uint16Array.from(m.indices) : Uint32Array.from(m.indices);
    const ix = push(Buffer.from(idx.buffer), m.index16 ? 5123 : 5125, 'SCALAR', idx.length);
    gltfMeshes.push({ primitives: [{ attributes: { POSITION: p }, indices: ix }] });
    if (m.parent) { nodes.push({ name: m.parent, children: [nodes.length + 1] }); nodes.push({ mesh: i }); }   // the viewer's converter names the group, not the mesh node
    else nodes.push({ name: m.name, mesh: i });
  });
  const bin = Buffer.concat(chunks);
  const roots = nodes.map((_, i) => i).filter(i => !nodes.some(n => n.children && n.children.includes(i)));
  const json = { asset: { version: '2.0' }, buffers: [{ byteLength: bin.length }], bufferViews: views, accessors, meshes: gltfMeshes, nodes, scenes: [{ nodes: roots }], scene: 0 };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([head, jh, js, bh, bin]);
}

/* A box of square section w around the axis a -> b: 6 faces of 4 vertices each (24 vertices, 12
   triangles), corners duplicated per face so welding has work to do. */
function prism(a, b, w) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), n = d.map(c => c / L);
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  let u = cr(n, ref); const lu = Math.hypot(...u); u = u.map(c => c / lu); const v = cr(n, u);
  const corner = (end, su, sv) => [0, 1, 2].map(c => end[c] + (su * u[c] + sv * v[c]) * w / 2);
  const C = [corner(a, -1, -1), corner(a, 1, -1), corner(a, 1, 1), corner(a, -1, 1), corner(b, -1, -1), corner(b, 1, -1), corner(b, 1, 1), corner(b, -1, 1)];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const positions = [], indices = [];
  faces.forEach(f => { const base = positions.length / 3; f.forEach(i => positions.push(...C[i])); indices.push(base, base + 1, base + 2, base, base + 2, base + 3); });
  return { positions, indices };
}

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
  const flanges = H.findGrid([M([19.7, -35, -43], [19.7, 3, -43], 0.3, 'col'), M([20.3, -35, -43], [20.3, 3, -43], 0.3, 'col'), M([20.3, -35, -40], [20.3, 3, -40], 0.3, 'col')]);
  assert.deepEqual(flanges.xs, [20]);                                // the two flanges of one chord are one tower x
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
    M([6, 3, -43], [6, 3, -33], 0.3, 'beam'),                      // roof truss chord along z at x=6: nearest line x=10
    M([0, 5, -41.5], [10, 5, -41.5], 0.1, 'beam'),                 // roof purlin along x
    M([0, -23.5, -41.5], [10, -23.5, -41.5], 0.2, 'beam')];        // lower chord of the floor truss at -20: same floor piece
  for (let i = 0; i < 25; i++) ms.push(M([i, -20, 0], [i + 0.5, -20, 0], 0.1, 'beam'), M([i, -10, 0], [i + 0.5, -10, 0], 0.1, 'beam'), M([i, -23.5, 0], [i + 0.5, -23.5, 0], 0.1, 'beam'));   // enough horizontals to make levels -23.5, -20 and -10 peaks
  const pieces = H.group(ms, H.findGrid(ms));
  const tower0 = pieces.find(p => p.t === 'tower' && p.key.x === 0 && p.key.row === 0);
  assert.deepEqual(tower0.m.sort((a, b) => a - b), [0, 1, 6]);
  const floor20 = pieces.find(p => p.t === 'floor' && p.key.level === -20 && p.key.x === 0);
  assert.ok(floor20.m.includes(7) && floor20.m.includes(8) && floor20.m.includes(12));   // beam, bracing above it, lower chord 3.5 m below: one bay piece
  assert.ok(pieces.some(p => p.t === 'floor' && p.key.level === -10 && p.m.includes(9)));
  assert.ok(pieces.every(p => p.t !== 'floor' || p.key.z !== undefined));  // bay by 10 m strip: small pieces for five work fronts
  assert.ok(pieces.some(p => p.t === 'roof' && p.key.x === 10 && p.key.z === undefined && p.m.includes(10)));   // a whole truss line, like a tower
  assert.ok(pieces.some(p => p.t === 'roofx' && p.key.x === 0 && p.key.z === undefined && p.m.includes(11)));   // purlins and bracing of a whole bay
  assert.ok(pieces.every(p => p.m.length > 0));
  const o = H.order(pieces, H.findGrid(ms));
  assert.equal(new Set(o).size, pieces.length);
  assert.equal(o[0], pieces.indexOf(tower0));                       // the near corner tower first
  const types = o.map(i => pieces[i].t);
  assert.ok(types.indexOf('roof') > types.indexOf('floor'));
});

/* A keyed grid of pieces for the dependency, priority and crew-schedule tests: three tower lines (x = 0, 10, 20)
   by two rows (strips 0 and 1), floors in the two bays of strip 0 at two levels, a post on line 0, a truss on every
   line, roof bracing in both bays. Members are not needed: only the keys. */
const GRID = { xs: [0, 10, 20], rows: [{ z0: -42.9, z1: -39.9 }, { z0: -29.9, z1: -29.9 }], zMin: -42.93, zMax: 53.26 };
const K = (t, key) => ({ t, key, m: [0] });
const KEYED = [
  K('tower', { row: 0, x: 0 }), K('tower', { row: 1, x: 0 }), K('tower', { row: 0, x: 10 }), K('tower', { row: 1, x: 10 }), K('tower', { row: 0, x: 20 }), K('tower', { row: 1, x: 20 }),   // 0-5
  K('floor', { level: -20, x: 0, z: 0 }), K('floor', { level: -10, x: 0, z: 0 }), K('floor', { level: -20, x: 1, z: 0 }),   // 6-8
  K('post', { x: 0, z: -34.9 }),                                                                                            // 9
  K('roof', { x: 0 }), K('roof', { x: 10 }), K('roof', { x: 20 }),                                                           // 10-12
  K('roofx', { x: 0 }), K('roofx', { x: 1 })];                                                                               // 13-14

test('deps: a floor piece needs its corner towers and the floor below; a post the towers either side; a truss its towers and the floors either side; roof bracing both trusses; a tower line the floors two bays back', () => {
  const D = H.deps(KEYED, GRID);
  assert.deepEqual(D[0], []); assert.deepEqual(D[3], []);                 // the first two lines stand on their own
  assert.deepEqual(D[4], [6, 7]); assert.deepEqual(D[5], [6, 7]);         // line 20 waits for bay 0's floors: the column front keeps one bay ahead
  assert.deepEqual(D[6], [0, 1, 2, 3]);                                   // floor (-20, bay 0, strip 0): towers rows 0 and 1 on lines 0 and 10
  assert.deepEqual(D[7], [0, 1, 2, 3, 6]);                                // the level above: the same towers and the floor below
  assert.deepEqual(D[8], [2, 3, 4, 5]);
  assert.deepEqual(D[9], [0, 1]);                                         // post at z = -34.9 on line 0: between rows 0 and 1
  assert.deepEqual(D[10], [0, 1, 6, 7]);                                  // truss on line 0: its towers and bay 0's floors
  assert.deepEqual(D[11], [2, 3, 6, 7, 8]);                               // line 10: bays 0 and 1
  assert.deepEqual(D[12], [4, 5, 8]);
  assert.deepEqual(D[13], [10, 11]); assert.deepEqual(D[14], [11, 12]);
});

test('order: columns and posts first, line by line; then along the hall floors before the truss before the roof bracing', () => {
  const o = H.order(KEYED, GRID), pos = i => o.indexOf(i);
  assert.equal(o[0], 0); assert.equal(o[1], 1);                           // line 0, rows 0 then 1
  assert.ok(pos(9) > pos(1) && pos(9) < pos(2));                          // the post on line 0 before line 10's towers
  assert.ok(pos(5) < pos(6));                                             // every tower outranks every floor: the gate in deps holds a line back, not the priority
  assert.ok(pos(6) < pos(7));                                             // bottom up
  assert.ok(pos(7) < pos(10));                                            // truss 0 after bay 0's floors
  assert.ok(pos(8) < pos(11) && pos(11) < pos(13));                       // truss 10 after bay 1, bracing of bay 0 after truss 10
  assert.equal(o[o.length - 1], 14);
});

test('schedule: crews take the first ready piece in priority order, a piece is ready LAND slots after its last dependency started', () => {
  const D = H.deps(KEYED, GRID), o = H.order(KEYED, GRID);
  const at = H.schedule(D, o, 2, 1);
  assert.equal(at.length, KEYED.length); assert.ok(at.every(a => Number.isInteger(a) && a >= 0));
  assert.deepEqual([at[0], at[1]], [0, 0]);                               // two crews: both towers of line 0 in slot 0
  D.forEach((deps, i) => deps.forEach(j => assert.ok(at[i] >= at[j] + 1, `${i} at ${at[i]} before its dependency ${j} at ${at[j]} + LAND`)));
  assert.ok(at[9] >= 1 && at[9] <= 2);                                    // the post goes in as soon as its towers are up
  assert.ok(at[14] === Math.max(...at));                                  // the last bay's roof bracing closes the erection
  const slow = H.schedule(D, o, 1, 3);                                    // one crew, slow landing: still every piece, still in order
  D.forEach((deps, i) => deps.forEach(j => assert.ok(slow[i] >= slow[j] + 3)));
  assert.throws(() => H.schedule([[1], [0]], [0, 1], 1, 1), /cycle/);    // a cycle can never be placed
});

test('parseGlb takes the mesh name from the nearest named ancestor node, as the viewer converter writes it', () => {
  const p = prism([0, 0, 0], [5, 0, 0], 0.2);
  const g = H.parseGlb(makeGlb([{ parent: 'IfcColumn', ...p }, { parent: 'IfcBeam', ...p }]));
  assert.deepEqual(g.meshes.map(m => m.name), ['IfcColumn', 'IfcBeam']);
});

test('project maps a point in front of the camera inside the canvas, nearer members wider, far ones first in depthOrder', () => {
  const ms = [M([50, -16, 5], [60, -16, 5], 1, 'beam'), M([50, -16, -40], [60, -16, -40], 1, 'beam')];
  const out = H.project(ms, [{ t: 'floor', key: {}, m: [0, 1] }], [0]);
  assert.equal(out.w, 1500); assert.equal(out.h, 1125);
  const [x1, y1, , , w0] = out.members[0];
  assert.ok(x1 > 0 && x1 < 1500 && y1 > 0 && y1 < 1125);
  assert.ok(Math.abs(x1 - 750) < 1 && Math.abs(y1 - 562.5) < 1);     // the target projects to the centre
  assert.ok(out.members[1][4] < w0);                                 // z=-40 is farther from the eye at z=130
  assert.deepEqual(out.depthOrder, [1, 0]);
  assert.deepEqual(out.order, [0]);
});

test('the generated hal.json is sane', { skip: !require('fs').existsSync(require('path').join(__dirname, '..', 'assets', 'senkon', 'hal.json')) }, () => {
  const d = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'senkon', 'hal.json'), 'utf8'));
  assert.equal(d.v, 3);
  assert.ok(d.members.length > 2500 && d.members.length < 8000);   // 3,782 from the model; the spec's 4,000 came from an over-split probe
  assert.ok(d.members.every(m => m.length === 7));
  assert.ok(d.cam.s > 0 && d.cam.eye.length === 3);
  assert.ok(d.pieces.every(p => p.m.length > 0 && p.k && Number.isInteger(p.at)));
  assert.equal(d.order, undefined);
  assert.equal(d.depthOrder, undefined);
  assert.ok(d.pieces.filter(p => p.t === 'tower').length >= 20);
  assert.ok(d.pieces.filter(p => p.t === 'roof').length <= 12);     // one piece per truss line: 11 lines
  assert.ok(d.pieces.filter(p => p.t === 'roofx').length <= 10);    // one per bay
});

test('fit scales and shifts the projected members so the hall fills the canvas inside the margins', () => {
  const data = { w: 1500, h: 1125, members: [[100, 300, 1300, 300, 2, 50], [100, 300, 100, 600, 1, 60]], pieces: [{ t: 'floor', m: [0, 1] }], order: [0], depthOrder: [1, 0] };
  const out = H.fit(data, { left: 0.04, right: 0.04, top: 0.08, bottom: 0.04 });
  const xs = out.members.flatMap(m => [m[0], m[2]]), ys = out.members.flatMap(m => [m[1], m[3]]);
  assert.ok(Math.abs(Math.min(...xs) - 60) < 0.2 && Math.abs(Math.max(...xs) - 1440) < 0.2);   // 4 % margins: width is the limit
  assert.ok(Math.min(...ys) >= 90 && Math.max(...ys) <= 1080);
  assert.ok(Math.abs(out.members[0][4] - 2 * 1.15) < 0.01);                                 // widths scale with the picture
  assert.equal(out.members[0][5], 50);                                                      // depth untouched
});

test('framing returns the scale and offset that fit the default view inside the margins', () => {
  const ms = [M([0, -35, -43], [100, -35, -43], 0.3, 'col'), M([0, 8, 53], [100, 8, 53], 0.3, 'col'), M([0, -35, 53], [0, 8, -43], 0.3, 'col')];
  const f = H.framing(ms);
  assert.ok(f.s > 0 && Number.isFinite(f.dx) && Number.isFinite(f.dy));
  const rows = H.fit(H.project(ms, [], []));                           // the applied version
  const raw = H.project(ms, [], []).members[0];
  assert.ok(Math.abs(raw[0] * f.s + f.dx - rows.members[0][0]) < 0.11 && Math.abs(raw[1] * f.s + f.dy - rows.members[0][1]) < 0.11);
});

test('pack writes format 3: members in metres, the camera with its framing, pieces with their keys and crew slots', () => {
  const ms = [M([0, -35, -43], [0, 3, -43], 0.3, 'col'), M([0, -20, -41.5], [10, -20, -41.5], 0.2, 'beam')];
  const d = H.pack(ms, [{ t: 'tower', key: { row: 0, x: 0 }, m: [0] }, { t: 'floor', key: { level: -20, x: 0, z: 0 }, m: [1] }], [0, 3]);
  assert.equal(d.v, 3); assert.equal(d.w, 1500); assert.equal(d.h, 1125);
  assert.deepEqual(d.members[0], [0, -35, -43, 0, 3, -43, 0.3]);
  assert.deepEqual(d.cam.eye, [-70, 40, 130]); assert.equal(d.cam.focal, 1.85); assert.ok(d.cam.s > 0);
  assert.deepEqual(d.pieces, [{ t: 'tower', k: { row: 0, x: 0 }, m: [0], at: 0 }, { t: 'floor', k: { level: -20, x: 0, z: 0 }, m: [1], at: 3 }]);
  assert.equal(d.order, undefined);
  assert.equal(d.depthOrder, undefined);
});

module.exports = { makeGlb, prism };
