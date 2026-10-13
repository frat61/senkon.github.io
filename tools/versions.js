#!/usr/bin/env node
'use strict';
/* Cache-busting tags for the pages. GitHub Pages caches every file for four hours, so each page links
   site.css, the fonts, the scripts and the drawings it uses with a ?v= tag that must change whenever
   the file does. The tag is the first eight hex digits of the file's SHA-1; a drawing's tag also
   covers its JSON sidecar, because skyline.js fetches the JSON with the picture's tag. Every file in
   LINKS must be linked by at least one page (the story pictures live only on deprem-performans/);
   404.html and the sub-pages link with a leading slash, since they are served from a folder.
     node tools/versions.js          rewrites the tags in index.html, 404.html and the sub-pages
     node tools/versions.js --check  prints the stale ones and exits 1 (what tests/versions.test.js does) */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', '404.html', 'deprem-performans/index.html', 'hakkinda/index.html', 'kvkk/index.html'];           // index.html must link every file; the others may link a subset
// link as written in index.html → files whose content the tag covers
const LINKS = {
  'site.css': ['site.css'],
  'assets/senkon/fonts/fonts.css': ['assets/senkon/fonts/fonts.css'],
  'assets/senkon/skyline.js': ['assets/senkon/skyline.js'],
  'assets/senkon/logo-sketch.js': ['assets/senkon/logo-sketch.js'],
  'assets/senkon/track.js': ['assets/senkon/track.js'],                         // Google tag, consent bar, conversions, contact form
  'assets/senkon/skyline.webp': ['assets/senkon/skyline.webp', 'assets/senkon/skyline.json'],
  'assets/senkon/esenboga.webp': ['assets/senkon/esenboga.webp', 'assets/senkon/esenboga.json'],
  'assets/senkon/hal.js': ['assets/senkon/hal.js'],                             // the steel hall erection in the Deneyim banner
  'assets/senkon/hal.webp': ['assets/senkon/hal.webp', 'assets/senkon/hal.json'],  // its still and the member JSON hal.js fetches with the still's tag
  'assets/senkon/surec.js': ['assets/senkon/surec.js'],                         // the story on deprem-performans/ only
  'assets/senkon/surec/01.webp': ['assets/senkon/surec/01.webp'],
  'assets/senkon/surec/02.webp': ['assets/senkon/surec/02.webp'],
  'assets/senkon/surec/03.webp': ['assets/senkon/surec/03.webp'],
  'assets/senkon/surec/04.webp': ['assets/senkon/surec/04.webp'],
  'assets/senkon/surec/05.webp': ['assets/senkon/surec/05.webp'],
  'assets/senkon/surec/06.webp': ['assets/senkon/surec/06.webp'],
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

// every "<link>?v=<tag>" in the html, as { link, tag }; "/site.css" counts as "site.css"
function found(html) {
  const re = /([\w./-]+)\?v=([\w-]*)/g, out = [];
  let m;
  while ((m = re.exec(html))) { const link = m[1].replace(/^\//, ''); if (LINKS[link]) out.push({ link, tag: m[2] }); }
  return out;
}

function stale(root) {
  const want = expected(root), bad = [], seen = new Set();
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(root || ROOT, page), 'utf8');
    for (const { link, tag: t } of found(html)) {
      seen.add(link);
      if (t !== want[link]) bad.push(`${page}: ${link}?v=${t} should be ?v=${want[link]}`);
    }
  }
  for (const link of Object.keys(LINKS)) if (!seen.has(link)) bad.push(`${link} is not linked with a ?v= tag`);   // by at least one page
  return bad;
}

function apply(root) {
  const want = expected(root);
  for (const page of PAGES) {
    const file = path.join(root || ROOT, page);
    const html = fs.readFileSync(file, 'utf8').replace(/([\w./-]+)\?v=[\w-]*/g, (all, link) => LINKS[link.replace(/^\//, '')] ? `${link}?v=${want[link.replace(/^\//, '')]}` : all);
    fs.writeFileSync(file, html);
  }
  return want;
}

module.exports = { LINKS, PAGES, tag, expected, found, stale, apply };

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
