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
    nodes.push({ name: m.name, mesh: i });
  });
  const bin = Buffer.concat(chunks);
  const json = { asset: { version: '2.0' }, buffers: [{ byteLength: bin.length }], bufferViews: views, accessors, meshes: gltfMeshes, nodes, scenes: [{ nodes: nodes.map((_, i) => i) }], scene: 0 };
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

module.exports = { makeGlb, prism };
