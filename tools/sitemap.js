#!/usr/bin/env node
'use strict';
/* The <lastmod> dates in sitemap.xml. Google reads them to decide which pages to crawl again, so each page's
   date is the day of its last change: the date of the page's last commit, or today when the page has changes
   not committed yet. The addresses stay as written in sitemap.xml; this only fills the dates beside them.
     node tools/sitemap.js          rewrites the dates in sitemap.xml
     node tools/sitemap.js --check  prints the pages whose date is behind git and exits 1 (what tests/seo.test.js does) */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'sitemap.xml');
const HOST = 'https://senkonmuhendislik.com';

// the file a sitemap address is served from
function fileOf(url) { return url === '/' ? 'index.html' : url.replace(/^\//, '') + 'index.html'; }

// { '/tasarim/': '2026-10-17' | null } for every <url> in the xml
function dates(xml) {
  const out = {};
  for (const m of xml.matchAll(/<url><loc>https:\/\/senkonmuhendislik\.com([^<]*)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?<\/url>/g)) out[m[1]] = m[2] || null;
  return out;
}

// the xml with each address's lastmod set from { url: 'YYYY-MM-DD' }
function render(xml, byUrl) {
  return xml.replace(/<url><loc>https:\/\/senkonmuhendislik\.com([^<]*)<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>/g,
    (all, url) => byUrl[url] ? `<url><loc>${HOST}${url}</loc><lastmod>${byUrl[url]}</lastmod></url>` : all);
}

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const today = () => new Date().toISOString().slice(0, 10);

// the day of the file's last change: today if it has uncommitted changes, else its last commit's date
function changed(file) {
  if (git(['status', '--porcelain', '--', file])) return today();
  return git(['log', '-1', '--format=%cs', '--', file]) || today();
}

function wanted() {
  const out = {};
  for (const url of Object.keys(dates(fs.readFileSync(FILE, 'utf8')))) out[url] = changed(fileOf(url));
  return out;
}

// the pages whose sitemap date is behind their last change
function stale() {
  const have = dates(fs.readFileSync(FILE, 'utf8')), want = wanted(), bad = [];
  for (const url of Object.keys(want)) if (!have[url] || have[url] < want[url]) bad.push(`${url}: lastmod ${have[url] || 'missing'} should be ${want[url]}`);
  return bad;
}

function apply() {
  const want = wanted();
  fs.writeFileSync(FILE, render(fs.readFileSync(FILE, 'utf8'), want));
  return want;
}

module.exports = { fileOf, dates, render, changed, stale, apply };

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const bad = stale();
    if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
    console.log('sitemap.xml dates are current');
  } else {
    const want = apply();
    for (const url of Object.keys(want)) console.log(`${url}  ${want[url]}`);
  }
}
