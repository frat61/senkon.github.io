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
  assert.equal(R.clampEl(-1), 0.0524); assert.equal(R.clampEl(3), 0.4887);   // 3° and 28°
  const s = R.spherical(cam.eye, cam.at);
  for (const el of [0.0524, 0.4887]) {
    const eye = R.eyeAt(cam.at, s.dist, s.az, el);
    const [x, y, d] = R.project([0, -35, -43], { ...cam, eye }, 1500, 1125);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && d > 0);
  }
});

test('widthPx scales a width in metres by the focal factor, the depth and the framing', () => {
  assert.ok(Math.abs(R.widthPx(1, 100, { focal: 2, s: 0.5 }, 1500) - 7.5) < 1e-9);
});

// a hall of two members at the default camera: a short beam at the target and a 100 m chord along x, left of centre
const DATA = { v: 3, w: 1500, h: 1125, cam: { eye: [-70, 40, 130], at: [50, -16, 5], focal: 1.85, s: 1, dx: 0, dy: 0 },
  members: [[50, -16, 5, 51, -16, 5, 0.2], [-60, -16, 5, 40, -16, 5, 0.3]],
  pieces: [{ t: 'tower', k: {}, m: [0], at: 0 }, { t: 'roof', k: {}, m: [1], at: 3 }] };

test('timeline: crew slots become seconds, TOTAL / (last slot + OVERLAP) a slot, the last slot landing at TOTAL', () => {
  const tl = R.timeline(DATA), step = R.T.TOTAL / (3 + R.T.OVERLAP);
  assert.ok(Math.abs(tl.step - step) < 1e-9);
  assert.equal(tl.startAt[0], 0); assert.ok(Math.abs(tl.startAt[1] - 3 * step) < 1e-9);
  assert.ok(Math.abs(tl.flyOf[0] - step * R.T.OVERLAP) < 1e-9);          // a small piece: the usual swing
});

test('timeline: a piece spanning more than SPAN of the canvas swings in longer, in proportion, and the erection ends when it lands', () => {
  const tl = R.timeline(DATA), step = R.T.TOTAL / (3 + R.T.OVERLAP);
  const b = R.basis(DATA.cam), x0 = R.project([-60, -16, 5], DATA.cam, 1500, 1125, b)[0], x1 = R.project([40, -16, 5], DATA.cam, 1500, 1125, b)[0];
  const span = (x1 - x0) / 1500;
  assert.ok(span > R.T.SPAN, 'the chord is a big piece in the picture');
  assert.ok(Math.abs(tl.flyOf[1] - step * Math.min(R.T.FLY_MAX, R.T.OVERLAP * span / R.T.SPAN)) < 1e-9);
  assert.ok(tl.flyOf[1] > tl.flyOf[0] && tl.flyOf[1] <= step * R.T.FLY_MAX + 1e-9);   // longer, never past the tool's landing wait
  assert.ok(Math.abs(tl.end - (3 * step + tl.flyOf[1])) < 1e-9);          // later than TOTAL by the extra swing
});

test('the runtime never lets a piece fly longer than the tool waits for a dependency to land', () => {
  assert.equal(R.T.FLY_MAX, require('../tools/make-hall.js').LAND);
});

test('timeline: side says where a piece stands in the picture, so it leans in from its own side', () => {
  const tl = R.timeline(DATA);
  assert.ok(Math.abs(tl.side[0]) < 0.01);                                  // at the target: the middle, straight down
  assert.ok(tl.side[1] < 0 && tl.side[1] >= -1);                           // left of centre
});

const fs = require('fs'), path = require('path');
const real = path.join(__dirname, '..', 'assets', 'senkon', 'hal.json');
test('at the steepest tilt the whole hall stays inside the canvas through a full turn', { skip: !fs.existsSync(real) }, () => {
  const d = JSON.parse(fs.readFileSync(real, 'utf8')), s = R.spherical(d.cam.eye, d.cam.at);
  for (const el of [R.clampEl(-1), R.clampEl(9)]) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let a = 0; a < 360; a += 10) {
      const cam = { ...d.cam, eye: R.eyeAt(d.cam.at, s.dist, s.az + a * Math.PI / 180, el) }, b = R.basis(cam);
      d.members.forEach(m => { for (const p of [m, [m[3], m[4], m[5]]]) { const q = R.project(p, cam, d.w, d.h, b); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } });
    }
    assert.ok(x0 > -6 && x1 < d.w + 6 && y0 > 0 && y1 < d.h, `el ${el}: x ${x0.toFixed(0)}..${x1.toFixed(0)} y ${y0.toFixed(0)}..${y1.toFixed(0)}`);
  }
});
