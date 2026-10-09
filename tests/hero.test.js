'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('../tools/make-hero-svg.js');
const model = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hero-model.json'), 'utf8'));

test('hero model is a bare frame: columns, rafters, ties, purlins, bracing only', () => {
  const ls = H.lines(model);
  const by = r => ls.filter(l => l.role === r).length;
  assert.equal(by('column'), 15);     // 5 x-axes x 3 rows
  assert.equal(by('rafter'), 10);     // 5 x-axes x 2 segments (ridge on the middle row)
  assert.equal(by('tie'), 3);
  assert.equal(by('purlin'), 9);      // purlinBays 8
  assert.equal(by('brace'), 16);
  assert.ok(ls.every(l => ['column', 'rafter', 'tie', 'purlin', 'brace', 'windpost'].includes(l.role)));
});

test('projection keeps vertical lines vertical and fits the viewBox', () => {
  const pts = H.project([[0, 0, 0], [0, 0, 6]], { yaw: 0.6, pitch: 0.45 });
  near(pts[0][0], pts[1][0]);
  assert.ok(pts[1][1] < pts[0][1], 'up is up (smaller y)');
  const s = H.svg(model, { width: 520, height: 360 });
  assert.match(s, /^<svg [^>]*viewBox="0 0 520 360"/);
  assert.equal((s.match(/<line /g) || []).length, 53);
  assert.ok(!/NaN/.test(s));
});

test('the committed hero.svg matches the generator', () => {
  const file = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hero.svg'), 'utf8');
  assert.equal(file.trim(), H.svg(model, { width: 520, height: 360 }).trim());
});

function near(a, b) { assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b); }
