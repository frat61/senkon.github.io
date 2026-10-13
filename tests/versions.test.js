'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const V = require('../tools/versions.js');

test('every page links its versioned files with the tag of their current content, and every file is linked somewhere', () => {
  const bad = V.stale();
  assert.deepEqual(bad, [], 'run: node tools/versions.js\n' + bad.join('\n'));
});

test('a file linked only by a sub-page is tagged and checked there', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'senkon-v-'));
  for (const f of Object.values(V.LINKS).flat()) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), f); }
  for (const p of V.PAGES) { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), ''); }
  const want = V.expected(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), Object.keys(V.LINKS).filter(l => !l.includes('surec')).map(l => `<a href="${l}?v=${want[l]}">`).join(''));
  fs.writeFileSync(path.join(dir, 'deprem-performans/index.html'), Object.keys(V.LINKS).filter(l => l.includes('surec')).map(l => `<a href="/${l}?v=${want[l]}">`).join(''));
  assert.deepEqual(V.stale(dir), []);
  fs.writeFileSync(path.join(dir, 'deprem-performans/index.html'), '');
  assert.ok(V.stale(dir).some(m => m.includes('surec.js is not linked')));
  fs.rmSync(dir, { recursive: true });
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

test('found() reads only the links the tool manages, with or without a leading slash', () => {
  const html = '<link href="site.css?v=abc"><img src="assets/senkon/skyline.webp?v=def"><script src="x/other.js?v=1"><link href="/assets/senkon/fonts/fonts.css?v=ghi">';
  assert.deepEqual(V.found(html), [{ link: 'site.css', tag: 'abc' }, { link: 'assets/senkon/skyline.webp', tag: 'def' }, { link: 'assets/senkon/fonts/fonts.css', tag: 'ghi' }]);
});

test('404.html links site.css and the fonts with a tag, so a stale copy cannot outlive a stylesheet change', () => {
  const links = V.found(fs.readFileSync(path.join(__dirname, '..', '404.html'), 'utf8')).map(l => l.link);
  assert.ok(links.includes('site.css') && links.includes('assets/senkon/fonts/fonts.css'), links.join(', '));
});
