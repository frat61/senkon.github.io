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
    M([5, 3, -43], [5, 3, -33], 0.3, 'beam'),                      // roof truss chord along z at x=5
    M([0, 5, -41.5], [10, 5, -41.5], 0.1, 'beam')];                // roof purlin along x
  for (let i = 0; i < 25; i++) ms.push(M([i, -20, 0], [i + 0.5, -20, 0], 0.1, 'beam'), M([i, -10, 0], [i + 0.5, -10, 0], 0.1, 'beam'));   // enough horizontals to make levels -20 and -10 peaks
  const pieces = H.group(ms, H.findGrid(ms));
  const tower0 = pieces.find(p => p.t === 'tower' && p.key.x === 0 && p.key.row === 0);
  assert.deepEqual(tower0.m.sort((a, b) => a - b), [0, 1, 6]);
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
  assert.ok(out.pieces[0].fly >= 60);
  assert.deepEqual(out.order, [0]);
});

test('the generated hal.json is sane', { skip: !require('fs').existsSync(require('path').join(__dirname, '..', 'assets', 'senkon', 'hal.json')) }, () => {
  const d = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'senkon', 'hal.json'), 'utf8'));
  assert.ok(d.members.length > 2500 && d.members.length < 8000);   // 3,782 from the model; the spec's 4,000 came from an over-split probe
  assert.ok(d.pieces.every(p => p.m.length > 0));
  assert.equal(new Set(d.order).size, d.pieces.length);
  assert.equal(d.depthOrder.length, d.members.length);
  assert.ok(d.pieces.filter(p => p.t === 'tower').length >= 20);
});

module.exports = { makeGlb, prism };
