#!/usr/bin/env node
'use strict';
/* The steel hall erection data: turns the viewer's GLB of Fırat's lattice-column hall (gitignored
   local/hall-ref/model.glb) into assets/senkon/hal.json, the projected member lines grouped into
   erection pieces in site order that assets/senkon/hal.js draws on the home page.
   Spec: docs/superpowers/specs/2026-10-14-hall-erection-design.md.
     node tools/make-hall.js local/hall-ref/model.glb assets/senkon/hal.json
   Every stage is a pure function, exported for tests/hall-tool.test.js. */

const fs = require('fs');

// ---- GLB: the JSON chunk, the BIN chunk, one entry per mesh with the node's name
function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const binLen = buf.readUInt32LE(20 + jsonLen);
  const bin = buf.subarray(binStart, binStart + binLen);
  const SIZE = { 5123: 2, 5125: 4, 5126: 4 }, DIM = { SCALAR: 1, VEC3: 3 };
  function accessor(i) {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), n = a.count * DIM[a.type];
    const bytes = bin.subarray(off, off + n * SIZE[a.componentType]);
    const copy = Buffer.from(bytes);                      // own, aligned memory for the typed array view
    if (a.componentType === 5126) return new Float32Array(copy.buffer, copy.byteOffset, n);
    if (a.componentType === 5125) return new Uint32Array(copy.buffer, copy.byteOffset, n);
    if (a.componentType === 5123) return Uint32Array.from(new Uint16Array(copy.buffer, copy.byteOffset, n));
    throw new Error('unsupported componentType ' + a.componentType);
  }
  const nameOf = new Map();
  (json.nodes || []).forEach(nd => { if (nd.mesh !== undefined && nd.name) nameOf.set(nd.mesh, nd.name); });
  const meshes = (json.meshes || []).map((m, i) => {
    const p = m.primitives[0];
    if (p.indices === undefined) throw new Error('mesh without indices');
    return { name: nameOf.get(i) || '', positions: accessor(p.attributes.POSITION), indices: accessor(p.indices) };
  });
  return { meshes };
}

// ---- weld: vertices within tol share a point; triangles remapped
function weld(positions, indices, tol) {
  tol = tol || 0.001;
  const key = new Map(), map = new Uint32Array(positions.length / 3), points = [];
  for (let v = 0; v < map.length; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const k = Math.round(x / tol) + ',' + Math.round(y / tol) + ',' + Math.round(z / tol);
    let id = key.get(k);
    if (id === undefined) { id = points.length; key.set(k, id); points.push([x, y, z]); }
    map[v] = id;
  }
  const tris = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) tris[i] = map[indices[i]];
  return { points, tris };
}

// ---- small vector helpers on [x, y, z]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- feature edges: boundary edges and creases sharper than angleDeg, at least minLen long
function featureEdges(points, tris, opts) {
  const angleDeg = (opts && opts.angleDeg !== undefined) ? opts.angleDeg : 30;
  const minLen = (opts && opts.minLen !== undefined) ? opts.minLen : 0.3;
  const flat = Math.cos(angleDeg * Math.PI / 180);
  const faces = new Map();                               // "i,j" (i < j) -> list of face normals
  for (let k = 0; k < tris.length; k += 3) {
    const a = tris[k], b = tris[k + 1], c = tris[k + 2];
    const n = norm(cross(sub(points[b], points[a]), sub(points[c], points[a])));
    for (const [i, j] of [[a, b], [b, c], [c, a]]) {
      const key = i < j ? i + ',' + j : j + ',' + i;
      let list = faces.get(key); if (!list) { list = []; faces.set(key, list); }
      list.push(n);
    }
  }
  const out = [];
  faces.forEach((ns, key) => {
    const [i, j] = key.split(',').map(Number);
    const crease = ns.length === 1 || ns.some(n => Math.abs(dot(ns[0], n)) < flat);
    if (!crease) return;
    if (len(sub(points[j], points[i])) < minLen) return;
    out.push({ a: points[i], b: points[j] });
  });
  return out;
}

// ---- bundle parallel, near-coincident edges into members: the prism's corner lines become one axis with a width
function bundle(edges, opts) {
  const angleDeg = (opts && opts.angleDeg !== undefined) ? opts.angleDeg : 3;
  const perp = (opts && opts.perp !== undefined) ? opts.perp : 0.35;
  const gap = (opts && opts.gap !== undefined) ? opts.gap : 0.3;
  const minLen = (opts && opts.minLen !== undefined) ? opts.minLen : 0.3;
  const parallel = Math.cos(angleDeg * Math.PI / 180);
  const E = edges.map(e => {
    let d = norm(sub(e.b, e.a));
    if (d[0] < 0 || (d[0] === 0 && (d[1] < 0 || (d[1] === 0 && d[2] < 0)))) d = mul(d, -1);
    const ta = dot(e.a, d), tb = dot(e.b, d);
    const mid = mul(add(e.a, e.b), 0.5);
    return { a: e.a, b: e.b, d, t0: Math.min(ta, tb), t1: Math.max(ta, tb), mid, foot: sub(mid, mul(d, dot(mid, d))), mesh: e.mesh };
  });
  // buckets: direction rounded to 0.02 per component, foot rounded to perp cells
  const cellKey = (e, dx, dy, dz) => [Math.round(e.d[0] * 50), Math.round(e.d[1] * 50), Math.round(e.d[2] * 50),
    Math.round(e.foot[0] / perp) + dx, Math.round(e.foot[1] / perp) + dy, Math.round(e.foot[2] / perp) + dz].join(',');
  const buckets = new Map();
  E.forEach((e, i) => { const k = cellKey(e, 0, 0, 0); let l = buckets.get(k); if (!l) { l = []; buckets.set(k, l); } l.push(i); });
  const parent = E.map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const unite = (x, y) => { x = find(x); y = find(y); if (x !== y) parent[y] = x; };
  const close = (p, q) => {                               // same member?
    if (Math.abs(dot(p.d, q.d)) < parallel) return false;
    const off = sub(q.mid, p.a), dist = len(sub(off, mul(p.d, dot(off, p.d))));
    if (dist >= perp) return false;
    const u0 = Math.min(dot(q.a, p.d), dot(q.b, p.d)), u1 = Math.max(dot(q.a, p.d), dot(q.b, p.d));
    return u0 <= p.t1 + gap && u1 >= p.t0 - gap;
  };
  E.forEach((e, i) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = buckets.get(cellKey(e, dx, dy, dz)); if (!l) continue;
      for (const j of l) if (j > i && find(i) !== find(j) && close(e, E[j])) unite(i, j);
    }
  });
  const groups = new Map();
  E.forEach((e, i) => { const r = find(i); let l = groups.get(r); if (!l) { l = []; groups.set(r, l); } l.push(e); });
  const members = [];
  groups.forEach(es => {
    const d = norm(es.reduce((s, e) => add(s, e.d), [0, 0, 0]));
    const ends = []; es.forEach(e => ends.push(e.a, e.b));
    const feet = ends.map(p => sub(p, mul(d, dot(p, d))));
    const c = mul(feet.reduce((s, f) => add(s, f), [0, 0, 0]), 1 / feet.length);
    const ts = ends.map(p => dot(p, d));
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    if (t1 - t0 < minLen) return;
    const w = Math.max(0.1, 2 * Math.max(...feet.map(f => len(sub(f, c)))));
    const count = {}; es.forEach(e => { count[e.mesh] = (count[e.mesh] || 0) + 1; });
    const mesh = Object.keys(count).sort((x, y) => count[y] - count[x])[0];
    members.push({ a: add(c, mul(d, t0)), b: add(c, mul(d, t1)), w, mesh });
  });
  return members;
}

module.exports = { parseGlb, weld, featureEdges, bundle };
