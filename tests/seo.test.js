'use strict';
// what search engines read: robots.txt, the sitemap's dates, title and description lengths, the structured data, and the hero picture's loading hints
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../tools/sitemap.js');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const PAGES = ['index.html', 'deprem-performans/index.html', 'tasarim/index.html', 'hakkinda/index.html'];
const head = f => read(f).match(/<head>[\s\S]*?<\/head>/)[0];
const title = f => head(f).match(/<title>([^<]*)<\/title>/)[1];
const description = f => head(f).match(/<meta name="description" content="([^"]*)">/)[1];
const ld = f => [...head(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

test('robots.txt allows every crawler everywhere and names the sitemap', () => {
  const txt = read('robots.txt');
  assert.match(txt, /^User-agent: \*\r?\nAllow: \/\r?\n/);
  assert.doesNotMatch(txt, /Disallow: \/\S/);
  assert.match(txt, /^Sitemap: https:\/\/senkonmuhendislik\.com\/sitemap\.xml$/m);
});

test('every sitemap entry carries a lastmod date, none behind git', () => {
  const map = read('sitemap.xml');
  const urls = [...map.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
  assert.ok(urls.length >= 5);
  for (const u of urls) assert.match(u, /<loc>https:\/\/senkonmuhendislik\.com\/[^<]*<\/loc><lastmod>\d{4}-\d\d-\d\d<\/lastmod>/, u);
  const bad = S.stale();
  assert.deepEqual(bad, [], 'run: node tools/sitemap.js\n' + bad.join('\n'));
});

test('sitemap.js fills and refreshes the lastmod of each address from the dates it is given', () => {
  const xml = '<urlset>\n  <url><loc>https://senkonmuhendislik.com/</loc></url>\n  <url><loc>https://senkonmuhendislik.com/a/</loc><lastmod>2020-01-01</lastmod></url>\n</urlset>\n';
  const out = S.render(xml, { '/': '2026-10-20', '/a/': '2026-10-21' });
  assert.equal(out, '<urlset>\n  <url><loc>https://senkonmuhendislik.com/</loc><lastmod>2026-10-20</lastmod></url>\n  <url><loc>https://senkonmuhendislik.com/a/</loc><lastmod>2026-10-21</lastmod></url>\n</urlset>\n');
  assert.deepEqual(S.dates(xml), { '/': null, '/a/': '2020-01-01' });
  assert.equal(S.fileOf('/'), 'index.html');
  assert.equal(S.fileOf('/tasarim/'), 'tasarim/index.html');
});

test('titles fit a result line (60 characters) and descriptions a snippet (160), with the search terms', () => {
  for (const p of PAGES) {
    assert.ok([...title(p)].length <= 60, `${p}: title is ${[...title(p)].length} characters`);
    const d = [...description(p)].length;
    assert.ok(d >= 80 && d <= 160, `${p}: description is ${d} characters`);
  }
  assert.match(title('index.html'), /Senkon Mühendislik/);
  assert.match(description('index.html'), /statik proje/i);
  assert.match(description('index.html'), /çelik ve betonarme/i);
  assert.match(description('index.html'), /deprem performans değerlendirmesi/);
  assert.match(description('index.html'), /İstanbul/);
  assert.match(title('tasarim/index.html'), /statik proje/i);
  assert.match(title('deprem-performans/index.html'), /Deprem performans değerlendirmesi/);
  for (const p of PAGES) assert.doesNotMatch(title(p) + description(p), /premium|6306|TS 500/);
});

test('the home page and hakkinda/ describe the firm as a ProfessionalService with the same name, address, phone, e-mail, logo and picture', () => {
  const home = ld('index.html').find(d => d['@type'] === 'ProfessionalService');
  const about = ld('hakkinda/index.html').find(d => d['@type'] === 'ProfessionalService');
  assert.ok(home && about);
  for (const key of ['name', 'url', 'telephone', 'email', 'logo', 'image']) assert.equal(about[key], home[key], key);
  assert.equal(home.name, 'Senkon Mühendislik');
  assert.equal(home.url, 'https://senkonmuhendislik.com/');
  assert.equal(home.email, 'info@senkonmuhendislik.com');
  assert.equal(home.logo, 'https://senkonmuhendislik.com/assets/senkon/logo.svg');
  assert.equal(home.image, 'https://senkonmuhendislik.com/assets/senkon/og.png');
  assert.equal(home.address, undefined, 'no street address is known');
  assert.equal(about.address, undefined);
});

test('the hero still is fetched first, in the size the screen needs: srcset with the phone variants, and a preload in the head', () => {
  for (const [p, base] of [['index.html', ''], ['tasarim/index.html', '/']]) {
    const html = read(p);
    const img = html.match(/<img class="hall-static"[^>]*>/)[0];
    assert.match(img, /fetchpriority="high"/);
    const srcset = img.match(/srcset="([^"]*)"/)[1];
    assert.equal(srcset, `${base}assets/senkon/hal-640.webp?v=${tag(html, 'hal-640.webp')} 640w, ${base}assets/senkon/hal-960.webp?v=${tag(html, 'hal-960.webp')} 960w, ${base}assets/senkon/hal.webp?v=${tag(html, 'hal.webp')} 1500w`);
    assert.match(img, /sizes="\(max-width: 860px\) 300px, 400px"/);
    assert.match(img, /width="1500" height="1125"/);
    const pre = html.match(/<link rel="preload" as="image"[^>]*>/);
    assert.ok(pre, `${p}: no image preload`);
    assert.match(pre[0], /fetchpriority="high"/);
    assert.equal(pre[0].match(/imagesrcset="([^"]*)"/)[1], srcset);
    assert.match(pre[0], /imagesizes="\(max-width: 860px\) 300px, 400px"/);
  }
});

test('the phone variants exist, are much smaller than the full still, and keep its proportions', () => {
  const size = f => fs.statSync(path.join(root, 'assets/senkon', f)).size;
  const dims = f => { const b = fs.readFileSync(path.join(root, 'assets/senkon', f)); assert.equal(b.toString('ascii', 0, 4), 'RIFF'); assert.equal(b.toString('ascii', 8, 12), 'WEBP'); return webpSize(b); };
  assert.ok(size('hal-640.webp') < size('hal.webp') / 2, 'hal-640.webp');
  assert.ok(size('hal-960.webp') < size('hal.webp'), 'hal-960.webp');
  assert.deepEqual(dims('hal-640.webp'), [640, 480]);
  assert.deepEqual(dims('hal-960.webp'), [960, 720]);
  assert.deepEqual(dims('hal.webp'), [1500, 1125]);
});

// the tag the page links a file with
function tag(html, file) { return html.match(new RegExp(file.replace('.', '\\.') + '\\?v=([0-9a-f]{8})'))[1]; }

// width and height of a WebP: VP8 (lossy), VP8L (lossless) or VP8X (extended) chunk
function webpSize(b) {
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
  if (chunk === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  throw new Error('unknown WebP chunk ' + chunk);
}
