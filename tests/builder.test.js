'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const B = require('../model/builder.js');

const LAB_FILE = path.join(__dirname, '..', 'local', 'lab-model.json');
const lab = fs.existsSync(LAB_FILE) ? JSON.parse(fs.readFileSync(LAB_FILE, 'utf8')).data : null;
const labTest = (name, fn) => test(name, { skip: lab ? false : 'local/lab-model.json missing' }, fn);
const count = (out, role, layer) => out.items.filter(i => i.role === role && (!layer || i.layer === layer)).length;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('normalize applies defaults and derives the outline', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 10] } });
  assert.equal(m.frame.column, 0.25);
  assert.equal(m.roof.type, 'gable');
  assert.deepEqual(m.windPosts, { west: [], east: [] });
  assert.equal(m.entrance, null);
  assert.deepEqual(m.outline, { x: 6.1, y: 10.1 });
  assert.deepEqual(m.interiorRows, []);
});

test('normalize keeps given values and sorts axes', () => {
  const m = B.normalize({ axes: { x: [12, 0, 6], y: [10, 0] }, frame: { type: 'truss' }, interiorRows: [1, 5] });
  assert.deepEqual(m.axes.x, [0, 6, 12]);
  assert.equal(m.frame.type, 'truss');
  assert.equal(m.frame.column, 0.25);
  assert.deepEqual(m.interiorRows, []);  // 1 is not interior for two y rows, 5 is out of range
});

test('normalize rejects missing axes and newer versions', () => {
  assert.throws(() => B.normalize({}), /axes/);
  assert.throws(() => B.normalize({ axes: { x: [0], y: [0, 1] } }), /axes/);
  assert.throws(() => B.normalize({ v: 2, axes: { x: [0, 1], y: [0, 1] } }), /version/);
});

test('gable profile: eave at the ends, ridge on the ridge axis, linear between', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 8, 20] }, levels: { eave: 5, ridge: 7 } });
  const zt = B.roofProfile(m);
  near(zt(0), 5); near(zt(8), 7); near(zt(20), 5); near(zt(4), 6); near(zt(14), 6);
});

test('butterfly profile has its low point on the ridge axis', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 8, 20] }, levels: { eave: 6, ridge: 4 }, roof: { type: 'butterfly' } });
  const zt = B.roofProfile(m);
  near(zt(0), 6); near(zt(8), 4); near(zt(20), 6);
});

test('mono profile is linear from eave to ridge', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 10] }, levels: { eave: 5, ridge: 7 }, roof: { type: 'mono' } });
  near(B.roofProfile(m)(5), 6);
});

test('gable with only two rows puts the ridge at mid-span', () => {
  const m = B.normalize({ axes: { x: [0, 6], y: [0, 10] }, levels: { eave: 5, ridge: 7 } });
  near(B.ridgeY(m), 5); near(B.roofProfile(m)(5), 7);
});

test('build returns centre, size, levels and layers', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, outline: { x: 35.05, y: 19.66 } });
  assert.deepEqual(out.center, [17.525, 9.83]);
  assert.equal(out.size, 35.05);
  assert.ok(out.layers.find(l => l.key === 'steel' && l.button === false));
  assert.ok(!out.layers.find(l => l.key === 'glass'), 'no glass layer without a glass facade');
  assert.ok(!out.layers.find(l => l.key === 'walls'), 'no walls layer without walls');
  assert.equal(out.levels.ceiling, 4);
});

test('deck disabled drops the floor and deck layers', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, deck: { enabled: false } });
  assert.ok(!out.layers.find(l => l.key === 'floor'));
  assert.ok(!out.layers.find(l => l.key === 'deck'));
});

test('rooms layer starts hidden', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, rooms: [{ name: 'A', x: 1, y: 1 }] });
  assert.equal(out.layers.find(l => l.key === 'rooms').visible, false);
});
