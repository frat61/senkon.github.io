'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const V = require('../tools/versions.js');

test('index.html links every versioned file with the tag of its current content', () => {
  const bad = V.stale();
  assert.deepEqual(bad, [], 'run: node tools/versions.js\n' + bad.join('\n'));
});

test('a drawing tag covers its JSON sidecar, so a changed JSON changes the tag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'senkon-v-'));
  fs.writeFileSync(path.join(dir, 'a.webp'), 'picture');
  fs.writeFileSync(path.join(dir, 'a.json'), '{"cols":1}');
  const before = V.tag(['a.webp', 'a.json'], dir);
  fs.writeFileSync(path.join(dir, 'a.json'), '{"cols":2}');
  assert.notEqual(V.tag(['a.webp', 'a.json'], dir), before);
  assert.equal(V.tag(['a.webp'], dir), V.tag(['a.webp'], dir));
  fs.rmSync(dir, { recursive: true });
});

test('found() reads only the links the tool manages', () => {
  const html = '<link href="site.css?v=abc"><img src="assets/senkon/skyline.webp?v=def"><script src="x/other.js?v=1">';
  assert.deepEqual(V.found(html), [{ link: 'site.css', tag: 'abc' }, { link: 'assets/senkon/skyline.webp', tag: 'def' }]);
});
