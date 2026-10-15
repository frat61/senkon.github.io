'use strict';
// assets/senkon/pafta.js: the pan/zoom maths of the sample sheet viewer. Only the pure functions are tested here;
// the DOM part needs a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const { view, zoomAt, pan, toggle, touchAction, echo } = require('../assets/senkon/pafta.js');

test('view shows the whole sheet at scale 1', () => {
  assert.deepEqual(view(400, 283), { s: 1, x: 0, y: 0, w: 400, h: 283 });
});

test('zoomAt clamps the scale to 1..8', () => {
  assert.equal(zoomAt(view(400, 283), 100, 200, 140).s, 8);
  assert.equal(zoomAt(view(400, 283), 0.01, 200, 140).s, 1);
});

test('zoomAt keeps the sheet point under the cursor', () => {
  const v0 = view(400, 283), v = zoomAt(v0, 2, 100, 50);
  assert.equal(v.s, 2);
  assert.ok(Math.abs(v.s * 100 + v.x - 100) < 1e-9);   // the sheet point that was at (100, 50) is still there
  assert.ok(Math.abs(v.s * 50 + v.y - 50) < 1e-9);
});

test('pan cannot leave the sheet', () => {
  const v = pan(view(400, 283), 50, 50);
  assert.equal(v.x, 0); assert.equal(v.y, 0);
  const z = pan(zoomAt(view(400, 283), 2, 0, 0), -10000, -10000);
  assert.equal(z.x, -400); assert.equal(z.y, -283);
  assert.equal(pan(z, 10000, 10000).x, 0);
});

test('toggle goes 1 -> 4 -> 1', () => {
  const a = toggle(view(400, 283), 200, 140);
  assert.equal(a.s, 4);
  assert.equal(toggle(a, 200, 140).s, 1);
  assert.equal(toggle(zoomAt(view(400, 283), 2, 0, 0), 0, 0).s, 1);
});

test('touchAction lets the page scroll only at scale 1', () => {
  assert.equal(touchAction(1), 'pan-y');
  assert.equal(touchAction(1.5), 'none');
});

test('echo flags a dblclick within 500 ms of a touch toggle', () => {
  assert.equal(echo(null, 1000), false);
  assert.equal(echo(1000, 1300), true);
  assert.equal(echo(1000, 1600), false);
});
