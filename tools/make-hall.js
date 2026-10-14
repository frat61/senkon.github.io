#!/usr/bin/env node
'use strict';
/* The steel hall erection data: turns the viewer's GLB of Fırat's lattice-column hall (gitignored
   local/hall-ref/model.glb) into assets/senkon/hal.json, the projected member lines grouped into
   erection pieces in site order that assets/senkon/hal.js draws on the home page (format 2: members in
   metres with the camera and its framing, so the page can turn the hall after the erection).
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
  const nameOf = new Map();                              // mesh index -> own name or the nearest named ancestor's
  const nodes = json.nodes || [];
  const walk = (i, inherited) => { const nd = nodes[i], name = nd.name || inherited; if (nd.mesh !== undefined) nameOf.set(nd.mesh, name); (nd.children || []).forEach(c => walk(c, name)); };
  ((json.scenes && json.scenes[json.scene || 0] && json.scenes[json.scene || 0].nodes) || nodes.map((_, i) => i)).forEach(i => walk(i, ''));
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

// ---- member geometry helpers
const mlen = m => len(sub(m.b, m.a));
const mid = m => mul(add(m.a, m.b), 0.5);
const kind = m => {                                       // 'vertical' | 'horizontal' | 'diagonal', by the member's slope
  const L = mlen(m), dy = Math.abs(m.b[1] - m.a[1]);
  return dy > 0.9 * L ? 'vertical' : dy < 0.1 * L ? 'horizontal' : 'diagonal';
};
const along = (m, axis) => Math.abs(m.b[axis] - m.a[axis]) > 0.9 * mlen(m);
const r1 = v => Math.round(v * 10) / 10;

// ---- the plan grid: tower x positions and the chord rows, from the tall column members
function findGrid(members) {
  const tall = members.filter(m => m.mesh === 'col' && mlen(m) > 30);
  const xsRaw = tall.map(m => mid(m)[0]).sort((a, b) => a - b), xs = [];
  xsRaw.forEach(x => { const c = xs[xs.length - 1]; if (c && x - c.max <= 1.5) c.max = x; else xs.push({ min: x, max: x }); });   // the flanges of one chord are one tower x
  const xsOut = xs.map(c => r1((c.min + c.max) / 2));
  const zs = [...new Set(tall.flatMap(m => [r1(m.a[2]), r1(m.b[2])]))].sort((a, b) => a - b);
  const rows = [];
  zs.forEach(z => { const r = rows[rows.length - 1]; if (r && z - r.z1 <= 5) r.z1 = z; else rows.push({ z0: z, z1: z }); });   // chords of one tower sit 3 m apart, rows 93 m
  const allZ = members.flatMap(m => [m.a[2], m.b[2]]);
  return { xs: xsOut, rows, zMin: Math.min(...allZ), zMax: Math.max(...allZ) };
}

// ---- cut long members at the grid so a piece is one bay
function splitAtGrid(members, grid, opts) {
  const maxLen = (opts && opts.maxLen !== undefined) ? opts.maxLen : 12;
  const stepZ = (opts && opts.stepZ !== undefined) ? opts.stepZ : 10;
  const out = [];
  members.forEach(m => {
    const L = mlen(m);
    let axis = null, planes = [];
    if (L > maxLen && along(m, 0)) { axis = 0; planes = grid.xs; }
    else if (L > maxLen && along(m, 2)) { axis = 2; for (let z = grid.zMin; z <= grid.zMax; z += stepZ) planes.push(z); }
    if (axis === null) { out.push(m); return; }
    const lo = Math.min(m.a[axis], m.b[axis]), hi = Math.max(m.a[axis], m.b[axis]);
    const cuts = planes.filter(p => p > lo + 1e-6 && p < hi - 1e-6).map(p => (p - m.a[axis]) / (m.b[axis] - m.a[axis])).sort((a, b) => a - b);
    const ts = [0, ...cuts, 1];
    for (let i = 0; i + 1 < ts.length; i++) {
      if ((ts[i + 1] - ts[i]) * L < 0.05) continue;
      out.push({ a: add(m.a, mul(sub(m.b, m.a), ts[i])), b: add(m.a, mul(sub(m.b, m.a), ts[i + 1])), w: m.w, mesh: m.mesh });
    }
  });
  return out;
}

// ---- erection pieces: towers, end-wall posts, floor beams and bracing by level and bay, roof trusses by line
function group(members, grid) {
  const pieces = new Map();
  const piece = (t, key) => { const k = t + JSON.stringify(key); let p = pieces.get(k); if (!p) { p = { t, key, m: [] }; pieces.set(k, p); } return p; };
  const assigned = new Array(members.length).fill(false);
  const mids = members.map(mid), kinds = members.map(kind);
  grid.rows.forEach((row, ri) => grid.xs.forEach(x => {
    members.forEach((m, i) => {
      if (assigned[i]) return;
      const c = mids[i];
      if (Math.abs(c[0] - x) <= 1.6 && c[2] >= row.z0 - 0.6 && c[2] <= row.z1 + 0.6) { piece('tower', { row: ri, x }).m.push(i); assigned[i] = true; }
    });
  }));
  const ends = [grid.xs[0], grid.xs[grid.xs.length - 1]];
  const posts = [];
  members.forEach((m, i) => {
    if (assigned[i] || kinds[i] !== 'vertical') return;
    const c = mids[i];
    if (!ends.some(x => Math.abs(c[0] - x) <= 1)) return;
    const key = { x: r1(c[0]), z: r1(c[2]) }; piece('post', key).m.push(i); assigned[i] = true; posts.push({ key, x: c[0], z: c[2] });
  });
  members.forEach((m, i) => {
    if (assigned[i] || kinds[i] === 'vertical') return;
    const c = mids[i], post = posts.find(p => Math.abs(c[0] - p.x) <= 0.6 && Math.abs(c[2] - p.z) <= 0.6);
    if (post) { piece('post', post.key).m.push(i); assigned[i] = true; }
  });
  // floor levels: peaks of the horizontal members' y histogram, 0.5 m bins, at least 20 members; the chords of one
  // floor truss (levels under 4 m apart) are one floor, named by its top level
  const bins = new Map();
  members.forEach((m, i) => { if (!assigned[i] && kinds[i] === 'horizontal' && mids[i][1] <= 0.5) { const b = Math.round(mids[i][1] / 0.5); bins.set(b, (bins.get(b) || 0) + 1); } });
  const levels = [...bins.keys()].filter(b => bins.get(b) >= 20 && bins.get(b) >= (bins.get(b - 1) || 0) && bins.get(b) >= (bins.get(b + 1) || 0)).map(b => b * 0.5).sort((a, b) => a - b);
  const floorOf = new Map(); let run = [];
  const close = () => { if (run.length) { const top = run[run.length - 1]; run.forEach(l => floorOf.set(l, top)); } run = []; };
  levels.forEach(l => { if (run.length && l - run[run.length - 1] > 4) close(); run.push(l); }); close();
  const nearestLevel = y => levels.length ? levels.reduce((best, l) => Math.abs(l - y) < Math.abs(best - y) ? l : best, levels[0]) : Math.round(y);
  const floorAt = y => levels.length ? floorOf.get(nearestLevel(y)) : Math.round(y);
  const bay = x => { let i = 0; while (i + 1 < grid.xs.length - 1 && x >= grid.xs[i + 1]) i++; return i; };
  const strip = z => Math.floor((z - grid.zMin) / 10);
  members.forEach((m, i) => {                                         // small pieces: one bay by one 10 m strip, for several work fronts at once
    if (assigned[i]) return;
    const c = mids[i];
    if (c[1] <= 0.5) {
      const level = kinds[i] === 'horizontal' ? floorAt(c[1]) : floorAt(Math.min(m.a[1], m.b[1]));   // bracing joins the floor it stands on
      piece('floor', { level, x: bay(c[0]), z: strip(c[2]) }).m.push(i);
    } else if (along(m, 2)) {
      const x = grid.xs.reduce((best, v) => Math.abs(v - c[0]) < Math.abs(best - c[0]) ? v : best, grid.xs[0]);
      piece('roof', { x, z: strip(c[2]) }).m.push(i);                 // one segment of a truss line
    } else piece('roofx', { x: bay(c[0]), z: strip(c[2]) }).m.push(i);   // purlins and roof bracing of one bay strip
    assigned[i] = true;
  });
  return [...pieces.values()];
}

// ---- site order: towers, posts, floors bottom up bay by bay and strip by strip, roof truss segments, roof bracing
function order(pieces) {
  const sortKey = p => {
    const k = p.key;
    switch (p.t) {
      case 'tower': return [0, k.row, k.x, 0];
      case 'post': return [1, k.x, k.z, 0];
      case 'floor': return [2, k.level, k.x, k.z];
      case 'roof': return [3, k.x, k.z, 0];
      default: return [4, k.x, k.z, 0];
    }
  };
  const keys = pieces.map(sortKey);
  return pieces.map((_, i) => i).sort((i, j) => { const a = keys[i], b = keys[j]; for (let n = 0; n < Math.max(a.length, b.length); n++) { const d = (a[n] || 0) - (b[n] || 0); if (d) return d; } return i - j; });
}

// ---- projection: a fixed perspective camera, canvas pixels; wpx is the member's width at its depth
const CAMERA = { eye: [-70, 40, 130], at: [50, -16, 5], focal: 1.85, w: 1500, h: 1125 };
function project(members, pieces, orderIdx, camera) {
  const C = camera || CAMERA;
  const fwd = norm(sub(C.at, C.eye)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  const r1d = v => Math.round(v * 10) / 10;
  const pt = p => { const d = sub(p, C.eye), depth = dot(d, fwd); return [C.w / 2 + dot(d, right) / depth * C.focal * C.w / 2, C.h / 2 - dot(d, up) / depth * C.focal * C.w / 2, depth]; };
  const rows = members.map(m => {
    const a = pt(m.a), b = pt(m.b), depth = (a[2] + b[2]) / 2;
    return [r1d(a[0]), r1d(a[1]), r1d(b[0]), r1d(b[1]), r1d(m.w * C.focal * C.w / 2 / depth), Math.round(depth * 100) / 100];
  });
  const outPieces = pieces.map(p => ({ t: p.t, m: p.m }));
  const depthOrder = rows.map((_, i) => i).sort((i, j) => rows[j][5] - rows[i][5] || i - j);
  return { w: C.w, h: C.h, members: rows, pieces: outPieces, order: orderIdx.slice(), depthOrder };
}

// ---- fit: scale and shift the projected picture so the hall fills the canvas inside the margins (fractions of w, h);
//      the top margin leaves room for pieces swinging in. Depths stay; widths scale with the picture.
const MARGINS = { left: 0.04, right: 0.04, top: 0.08, bottom: 0.04 };
function framingOf(rows, W, H, margins) {                            // scale and offset that fit the rows' bounding box inside the margins
  const M = margins || MARGINS;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  rows.forEach(m => { x0 = Math.min(x0, m[0], m[2]); x1 = Math.max(x1, m[0], m[2]); y0 = Math.min(y0, m[1], m[3]); y1 = Math.max(y1, m[1], m[3]); });
  const bw = Math.max(x1 - x0, 1e-9), bh = Math.max(y1 - y0, 1e-9);
  const s = Math.min(W * (1 - M.left - M.right) / bw, H * (1 - M.top - M.bottom) / bh);
  const dx = W * M.left + (W * (1 - M.left - M.right) - bw * s) / 2 - x0 * s;   // centred in the slack direction
  const dy = H * M.top + (H * (1 - M.top - M.bottom) - bh * s) / 2 - y0 * s;
  return { s: Math.round(s * 1e6) / 1e6, dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 };
}
function fit(data, margins) {
  const { s, dx, dy } = framingOf(data.members, data.w, data.h, margins);
  const r1d = v => Math.round(v * 10) / 10;
  return Object.assign({}, data, {
    members: data.members.map(m => [r1d(m[0] * s + dx), r1d(m[1] * s + dy), r1d(m[2] * s + dx), r1d(m[3] * s + dy), r1d(m[4] * s), m[5]]),
    pieces: data.pieces.map(p => ({ t: p.t, m: p.m }))
  });
}
// the default view's framing, recorded in the data file so the page projects other views with the same scale
function framing(members, camera, margins) {
  const C = camera || CAMERA;
  return framingOf(project(members, [], [], C).members, C.w, C.h, margins);
}

// ---- format 2: members in metres with the camera and its framing; the page projects them itself every frame
function pack(members, pieces, orderIdx, camera) {
  const C = camera || CAMERA, f = framing(members, C), r3 = v => Math.round(v * 1000) / 1000;
  return {
    v: 2, w: C.w, h: C.h,
    cam: { eye: C.eye.slice(), at: C.at.slice(), focal: C.focal, s: f.s, dx: f.dx, dy: f.dy },
    members: members.map(m => [r3(m.a[0]), r3(m.a[1]), r3(m.a[2]), r3(m.b[0]), r3(m.b[1]), r3(m.b[2]), r3(m.w)]),
    pieces: pieces.map(p => ({ t: p.t, m: p.m })),
    order: orderIdx.slice()
  };
}

// ---- the whole pipeline on a GLB buffer
function build(buf) {
  const g = parseGlb(buf), edges = [];
  g.meshes.forEach(m => {
    const w = weld(m.positions, m.indices), mesh = m.name === 'IfcColumn' ? 'col' : 'beam';
    featureEdges(w.points, w.tris).forEach(e => edges.push({ a: e.a, b: e.b, mesh }));
  });
  const grid = findGrid(bundle(edges));
  const members = splitAtGrid(bundle(edges), grid);
  const pieces = group(members, grid);
  return pack(members, pieces, order(pieces));
}

module.exports = { parseGlb, weld, featureEdges, bundle, findGrid, splitAtGrid, group, order, project, fit, framing, pack, build, CAMERA, MARGINS };

if (require.main === module) {
  const [inFile, outFile] = process.argv.slice(2);
  if (!inFile || !outFile) { console.error('usage: node tools/make-hall.js <in.glb> <out.json>'); process.exit(2); }
  const data = build(fs.readFileSync(inFile));
  const text = JSON.stringify(data);
  fs.writeFileSync(outFile, text);
  console.log('members ' + data.members.length + ', pieces ' + data.pieces.length + ', bytes ' + Buffer.byteLength(text));
}
