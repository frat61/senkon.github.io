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

test('build().levels reports the model levels for every roof type', () => {
  const mono = B.build({ axes: { x: [0, 6], y: [0, 10] }, roof: { type: 'mono' }, levels: { eave: 5, ridge: 7 } });
  assert.deepEqual(mono.levels, { ceiling: 4, deck: 4.45, eave: 5, ridge: 7 });
  const gable = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, levels: { eave: 5, ridge: 7 } });
  assert.deepEqual(gable.levels, { ceiling: 4, deck: 4.45, eave: 5, ridge: 7 });
});

labTest('lab frame: columns, rafters, joints, ties', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'column', 'steel'), 18);
  assert.equal(count(out, 'base', 'steel'), 18);
  assert.equal(count(out, 'joint', 'raf'), 18);
  assert.equal(count(out, 'rafter', 'raf'), 12);
  assert.equal(count(out, 'tie', 'steel'), 3);
  const col = out.items.find(i => i.role === 'column');
  assert.deepEqual(col.a, [0.1, 0.1, 0]); near(col.b[2], 5.75); assert.equal(col.w, 0.25);
});

labTest('lab floor: primaries, edges, secondaries, deck plane, slab', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'floorPrimary', 'floor'), 12);
  assert.equal(count(out, 'floorJoint', 'floor'), 18);
  assert.equal(count(out, 'floorEdge', 'floor'), 3);
  assert.equal(count(out, 'floorSecondary', 'floor'), 7);
  assert.equal(count(out, 'deck', 'deck'), 1);
  assert.equal(count(out, 'slab', 'base'), 1);
});

labTest('lab annotations: dimension tags, axis bubbles, snaps', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'bay', 'dim'), 5);
  assert.equal(count(out, 'span', 'dim'), 2);
  assert.equal(count(out, 'total', 'dim'), 2);
  const levels = out.items.filter(i => i.role === 'level').map(i => i.text).sort();
  assert.deepEqual(levels, ['mahya +6.30', 'mekanik kat +4.45', 'saçak +5.75', 'tavan +4.00']);
  assert.equal(count(out, 'dimLine', 'dim'), 1);
  assert.equal(out.items.filter(i => i.kind === 'bubble').map(i => i.text).join(''), '123456ABC');
  assert.equal(out.snaps.length, 72);
});

test('deck disabled removes floor items, the deck tag and the deck snap', () => {
  const out = B.build({ axes: { x: [0, 6, 12], y: [0, 10] }, deck: { enabled: false } });
  assert.equal(out.items.filter(i => i.layer === 'floor' || i.layer === 'deck').length, 0);
  assert.ok(!out.items.find(i => i.role === 'level' && /mekanik/.test(i.text)));
  assert.equal(out.snaps.length, 3 * 2 * 3);
});

test('truss frame: no interior columns, chords on every x axis, no floor primaries', () => {
  const out = B.build({ axes: { x: [0, 6, 12], y: [0, 8, 20] }, interiorRows: [1], frame: { type: 'truss' } });
  assert.equal(count(out, 'column'), 6);
  assert.equal(count(out, 'trussChord'), 9);            // 3 axes x (1 bottom + 2 top)
  assert.ok(count(out, 'trussDiag') > 0 && count(out, 'trussPost') > 0);
  assert.equal(count(out, 'rafter'), 0);
  assert.equal(count(out, 'floorPrimary'), 0);
  assert.equal(count(out, 'floorEdge'), 3);
});

test('beams frame without interior rows follows the roof profile across the span', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 8, 20] } });
  assert.equal(count(out, 'column'), 4);
  assert.equal(count(out, 'rafter'), 4);          // 2 axes x (0 -> 8, 8 -> 20)
  const r = out.items.filter(i => i.role === 'rafter');
  assert.equal(r[0].a[1], 0); assert.equal(r[0].b[1], 8); near(r[0].b[2], 6.3 - 0.135);
  assert.equal(r[1].a[1], 8); assert.equal(r[1].b[1], 20);
});

test('mono and butterfly level tags', () => {
  const mono = B.build({ axes: { x: [0, 6], y: [0, 10] }, roof: { type: 'mono' }, levels: { eave: 5, ridge: 7 } });
  assert.deepEqual(mono.items.filter(i => i.role === 'level').map(i => i.text).sort(), ['mekanik kat +4.45', 'saçak +5.00', 'tavan +4.00', 'üst saçak +7.00']);
  const bf = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, roof: { type: 'butterfly' }, levels: { eave: 6, ridge: 4 } });
  assert.ok(bf.items.find(i => i.role === 'level' && i.text === 'dere +4.00'));
});

test('single-span gable: rafters and truss chords kink at the mid-span ridge', () => {
  const beams = B.build({ axes: { x: [0, 6], y: [0, 10] } });
  assert.equal(count(beams, 'rafter'), 4);
  assert.ok(beams.items.some(i => i.role === 'rafter' && Math.abs(i.b[1] - 5) < 1e-9 && Math.abs(i.b[2] - (6.3 - 0.135)) < 1e-9));
  const truss = B.build({ axes: { x: [0, 6], y: [0, 10] }, frame: { type: 'truss' } });
  assert.equal(count(truss, 'trussChord'), 6);     // 2 axes x (1 bottom + 2 top)
  assert.ok(truss.items.some(i => i.role === 'trussChord' && Math.abs(i.b[1] - 5) < 1e-9 && Math.abs(i.b[2] - (6.3 - 0.08)) < 1e-9));
});

test('truss bottom chord drops to the ceiling when the deck is disabled', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, frame: { type: 'truss' }, deck: { enabled: false } });
  const bottom = out.items.filter(i => i.role === 'trussChord' && i.a[2] === i.b[2]);
  assert.equal(bottom.length, 2);
  assert.ok(bottom.every(i => i.a[2] === 4));
  assert.equal(count(out, 'floorEdge'), 0);
});

labTest('lab envelope: panels on three sides, glass on the south', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'panel', 'clad'), 3);
  assert.equal(count(out, 'panelLine', 'clad'), 3);
  assert.equal(count(out, 'glassPane', 'glass'), 1);
  const mull = out.items.filter(i => i.role === 'mullion');
  assert.equal(mull.length, 30);
  const raised = mull.filter(i => i.a[2] > 2.4 && i.a[2] < 2.5);
  assert.equal(raised.length, 2, 'two mullions start above the entrance door');
  assert.equal(count(out, 'transom', 'glass'), 4);
  const pane = out.items.find(i => i.role === 'glassPane');
  near(pane.pos[1], 19.71);                 // plane at ys[last] + claddingOffset
  near(Math.max(...pane.pos.filter((v, i) => i % 3 === 2)), 5.85);   // zt + 0.10
});

labTest('lab entrance, roof skin, caps, gutters, purlins, posts, bracing', () => {
  const out = B.build(lab);
  assert.equal(count(out, 'entranceFrame', 'doors'), 4);
  assert.equal(count(out, 'leaf', 'doors'), 2);
  assert.equal(count(out, 'canopy', 'doors'), 1);
  assert.equal(count(out, 'step', 'doors'), 1);
  const canopy = out.items.find(i => i.role === 'canopy');
  near(canopy.size[0], 3); near(canopy.size[1], 1.5); near(canopy.size[2], 0.1);   // door width 1.80 + 1.20
  near(canopy.center[2], 2.62); near(canopy.center[1], 19.71 + 0.79);
  assert.equal(count(out, 'roofSkin', 'skin'), 1);
  assert.equal(count(out, 'ridgeCap', 'steel'), 1);
  assert.equal(count(out, 'gutter', 'steel'), 2);
  assert.equal(count(out, 'purlin', 'roof'), 15);
  assert.equal(count(out, 'windpost', 'steel'), 5);
  assert.equal(count(out, 'brace', 'rb'), 16);
});

test('all-panel box has four panels, no glass, no entrance', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] } });
  assert.equal(count(out, 'panel'), 4);
  assert.equal(out.items.filter(i => i.layer === 'glass').length, 0);
  assert.equal(count(out, 'entranceFrame'), 0);
});

test('glass on a gable side follows the roof line and the entrance can sit on the west', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, facades: { west: 'glass' }, entrance: { side: 'west', from: 3, to: 5 } });
  const pane = out.items.find(i => i.role === 'glassPane');
  const zs = pane.pos.filter((v, i) => i % 3 === 2);
  assert.ok(Math.max(...zs) > 6.3 && Math.max(...zs) < 6.5, 'ridge height + 0.10');
  const fr = out.items.filter(i => i.role === 'entranceFrame');
  assert.equal(fr.length, 4);
  assert.ok(fr.every(i => i.a[0] < 0), 'entrance frame outside the west axis');
  const canopy = out.items.find(i => i.role === 'canopy');
  assert.deepEqual(canopy.size, [1.5, 3.2, 0.1]);
});

test('butterfly roof gets a valley gutter and no ridge cap; mono gets one gutter', () => {
  const bf = B.build({ axes: { x: [0, 6], y: [0, 8, 20] }, roof: { type: 'butterfly' }, levels: { eave: 6, ridge: 4 } });
  assert.equal(count(bf, 'ridgeCap'), 0); assert.equal(count(bf, 'gutter'), 1);
  const mono = B.build({ axes: { x: [0, 6], y: [0, 10] }, roof: { type: 'mono' } });
  assert.equal(count(mono, 'ridgeCap'), 0); assert.equal(count(mono, 'gutter'), 1);
});

test('open facade draws nothing on that side', () => {
  const out = B.build({ axes: { x: [0, 6], y: [0, 10] }, facades: { north: 'open' } });
  assert.equal(count(out, 'panel'), 3);
});
