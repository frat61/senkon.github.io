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

module.exports = { parseGlb, weld };
