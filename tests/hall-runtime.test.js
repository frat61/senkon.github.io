'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../assets/senkon/hal.js');
const cam = { eye: [-70, 40, 130], at: [50, -16, 5], focal: 1.85, s: 1, dx: 0, dy: 0 };

test('project maps the target to the canvas centre, scaled and shifted by the framing', () => {
  const [x, y, depth] = R.project(cam.at, cam, 1500, 1125);
  assert.ok(Math.abs(x - 750) < 1e-6 && Math.abs(y - 562.5) < 1e-6 && depth > 0);
  const [x2, y2] = R.project(cam.at, { ...cam, s: 0.5, dx: 100, dy: -20 }, 1500, 1125);
  assert.ok(Math.abs(x2 - 475) < 1e-6 && Math.abs(y2 - 261.25) < 1e-6);
});

test('spherical and eyeAt round-trip the fixed eye, and a full turn comes back', () => {
  const s = R.spherical(cam.eye, cam.at), back = R.eyeAt(cam.at, s.dist, s.az, s.el);
  back.forEach((v, i) => assert.ok(Math.abs(v - cam.eye[i]) < 1e-3));
  const turned = R.eyeAt(cam.at, s.dist, s.az + 2 * Math.PI, s.el);
  turned.forEach((v, i) => assert.ok(Math.abs(v - cam.eye[i]) < 1e-3));
});

test('the elevation clamp holds and projection stays finite at both limits', () => {
  assert.equal(R.clampEl(-1), 0.0524); assert.equal(R.clampEl(3), 1.2217);
  const s = R.spherical(cam.eye, cam.at);
  for (const el of [0.0524, 1.2217]) {
    const eye = R.eyeAt(cam.at, s.dist, s.az, el);
    const [x, y, d] = R.project([0, -35, -43], { ...cam, eye }, 1500, 1125);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && d > 0);
  }
});

test('widthPx scales a width in metres by the focal factor, the depth and the framing', () => {
  assert.ok(Math.abs(R.widthPx(1, 100, { focal: 2, s: 0.5 }, 1500) - 7.5) < 1e-9);
});
