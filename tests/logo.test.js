'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const LAYERS = ['cons', 'fills', 'inner', 'over', 'hatch', 'ink', 'word'];   // what logo-sketch.js draws, in order

test('the lockup inlined in index.html is the current assets/senkon/logo-lockup.svg', () => {
  const m = read('index.html').match(/<!-- logo-lockup -->\n([\s\S]*?)\n<!-- \/logo-lockup -->/);
  assert.ok(m, 'index.html has no logo-lockup markers');
  const expected = read('assets/senkon/logo-lockup.svg').trim()
    .replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg class="logo-sketch" aria-hidden="true" focusable="false"');
  assert.equal(m[1], expected, 'run: python tools/make-logo-svg.py');
});

test('both logo files carry every layer the sketch script draws, in drawing order', () => {
  for (const f of ['assets/senkon/logo.svg', 'assets/senkon/logo-lockup.svg']) {
    const svg = read(f);
    const at = LAYERS.map(id => svg.indexOf(`<g id="${id}"`));
    at.forEach((i, n) => assert.ok(i >= 0, `${f}: no #${LAYERS[n]}`));
    assert.deepEqual(at, [...at].sort((a, b) => a - b), `${f}: layers out of order`);
    assert.ok(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/.test(svg), `${f}: not a stand-alone svg`);
  }
});

test('the lockup spells SENKON and MÜHENDİSLİK as individual letter paths, line one before line two', () => {
  const ids = [...read('assets/senkon/logo-lockup.svg').matchAll(/<path id="([LM]\d+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']);
});

test('the generator is deterministic: running it again changes nothing', () => {
  const { execFileSync } = require('child_process');
  const before = ['assets/senkon/logo.svg', 'assets/senkon/logo-lockup.svg', 'index.html'].map(read);
  execFileSync('python', [path.join(ROOT, 'tools', 'make-logo-svg.py')], { stdio: 'pipe' });
  const after = ['assets/senkon/logo.svg', 'assets/senkon/logo-lockup.svg', 'index.html'].map(read);
  assert.deepEqual(after, before);
});
