#!/usr/bin/env node
'use strict';
/* Cache-busting tags for the home page. GitHub Pages caches every file for four hours, so index.html
   links site.css, the fonts, the skyline script and the two drawings with a ?v= tag that must change
   whenever the file does. The tag is the first eight hex digits of the file's SHA-1; a drawing's tag
   also covers its JSON sidecar, because skyline.js fetches the JSON with the picture's tag.
     node tools/versions.js          rewrites the tags in index.html
     node tools/versions.js --check  prints the stale ones and exits 1 (what tests/versions.test.js does) */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
// link as written in index.html → files whose content the tag covers
const LINKS = {
  'site.css': ['site.css'],
  'assets/senkon/fonts/fonts.css': ['assets/senkon/fonts/fonts.css'],
  'assets/senkon/skyline.js': ['assets/senkon/skyline.js'],
  'assets/senkon/skyline.webp': ['assets/senkon/skyline.webp', 'assets/senkon/skyline.json'],
  'assets/senkon/esenboga.webp': ['assets/senkon/esenboga.webp', 'assets/senkon/esenboga.json'],
};

function tag(files, root) {
  const h = crypto.createHash('sha1');
  for (const f of files) h.update(fs.readFileSync(path.join(root || ROOT, f)));
  return h.digest('hex').slice(0, 8);
}

function expected(root) {
  const out = {};
  for (const link of Object.keys(LINKS)) out[link] = tag(LINKS[link], root);
  return out;
}

// every "<link>?v=<tag>" in the html, as { link, tag }
function found(html) {
  const re = /([\w./-]+)\?v=([\w-]*)/g, out = [];
  let m;
  while ((m = re.exec(html))) if (LINKS[m[1]]) out.push({ link: m[1], tag: m[2] });
  return out;
}

function stale(root) {
  const html = fs.readFileSync(path.join(root || ROOT, 'index.html'), 'utf8');
  const want = expected(root), seen = new Set(), bad = [];
  for (const { link, tag: t } of found(html)) {
    seen.add(link);
    if (t !== want[link]) bad.push(`${link}?v=${t} should be ?v=${want[link]}`);
  }
  for (const link of Object.keys(LINKS)) if (!seen.has(link)) bad.push(`${link} is not linked with a ?v= tag`);
  return bad;
}

function apply(root) {
  const file = path.join(root || ROOT, 'index.html');
  const want = expected(root);
  const html = fs.readFileSync(file, 'utf8').replace(/([\w./-]+)\?v=[\w-]*/g, (all, link) => LINKS[link] ? `${link}?v=${want[link]}` : all);
  fs.writeFileSync(file, html);
  return want;
}

module.exports = { LINKS, tag, expected, found, stale, apply };

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const bad = stale();
    if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
    console.log('index.html tags are current');
  } else {
    const want = apply();
    for (const link of Object.keys(want)) console.log(`${link}?v=${want[link]}`);
  }
}
