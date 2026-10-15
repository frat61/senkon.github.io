'use strict';
// tasarim/: the page the second ad campaign opens, for architects, contractors and investors who need
// the structural design of a new building. Written, not listed (Fırat, 2026-10-14: the first version read as
// generated): the headline with the steel hall beside it, two arguments side by side (optimize çözümler,
// ileri mühendislik çözümleri), how the work goes as prose, the experience line, contact and the form.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tasarim', 'index.html'), 'utf8');
const quote = /<a class="btn btn-main" href="https:\/\/wa\.me\/905309250461\?text=[^"]+">/g;
const h2s = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m => m[1]);

test('the page has its own title, description and canonical address, and one headline: the four-word claim', () => {
  assert.match(html, /<title>Statik proje: çelik ve betonarme yapı tasarımı · Senkon Mühendislik<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{80,}">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/senkonmuhendislik\.com\/tasarim\/">/);
  assert.equal(html.split('<h1').length - 1, 1);
  assert.ok(html.includes('<h1>Güvenli, ekonomik ve uygulanabilir taşıyıcı sistemler.</h1>'));
});

test('it speaks to professionals, not to building owners', () => {
  for (const w of ['mimarlık ofis', 'müteahhit', 'yatırımcı']) assert.ok(html.toLowerCase().includes(w), w);
  assert.doesNotMatch(html, /içinde yaşamak için güvenli mi/);
});

test('the steel hall stands beside the headline, in the home hero grid, with absolute paths and the still tagged', () => {
  assert.match(html, /<section class="wrap hero tsr-hero">/);
  assert.match(html, /<div class="hero-media">\s*(<!--[^]*?-->\s*)?<figure class="hall hero-figure" data-hall="\/assets\/senkon\/hal\.json"/);
  assert.match(html, /<img class="hall-static" src="\/assets\/senkon\/hal\.webp\?v=[0-9a-f]{8}"/);
  assert.equal((html.match(/<script src="\/assets\/senkon\/hal\.js\?v=[0-9a-f]{8}" defer><\/script>/g) || []).length, 1);
});

test('written, not listed: no eyebrows, no numbered items, no checklist box, no FAQ on this page', () => {
  assert.doesNotMatch(html, /class="eyebrow"/);
  assert.doesNotMatch(html, /class="num"/);
  assert.doesNotMatch(html, /class="(steps|list2|perf-get|faq)"/);
  assert.doesNotMatch(html, /<ol|<ul/);
});

test('the two arguments, side by side and in this order, with linear and nonlinear named', () => {
  assert.deepEqual(h2s.slice(0, 2), ['Optimize çözümler', 'İleri mühendislik çözümleri']);
  assert.match(html, /<div class="mv tsr-two">/);
  assert.match(html, /Lineer ve nonlineer çözümler /);
});

test('optimisation never reads as saving on safety (Fırat): no "en az malzeme", the codes are the fixed floor', () => {
  assert.doesNotMatch(html, /en az malzeme/i);
  assert.match(html, /yönetmeliklerin öngördüğü güvenlik düzeyi değişmeksizin/);
});

test('what we design, in a sentence: industrial, housing and commercial, airport; no transport line, no platform-and-roof line', () => {
  assert.match(html, /endüstriyel yapılar, konut ve ticari yapılar, havalimanı yapıları/);
  assert.doesNotMatch(html, /ulaşım yapıları/);
  assert.doesNotMatch(html, /Platform, çatı/);
});

test('the codes Fırat works to, named in a sentence; never TS 500', () => {
  for (const c of ['TBDY 2018', 'ASCE', 'ACI', 'Eurocode']) assert.ok(html.includes(c), c);
  assert.doesNotMatch(html, /TS ?500/);
});

test('how the work goes, as prose under #adimlar (the ad sitelink): report and drawings; no model link, no Revit/Tekla line (Fırat), no prices', () => {
  assert.match(html, /<section id="adimlar" class="wrap section rule tsr-how">\s*<h2>Nasıl çalışıyoruz<\/h2>/);
  for (const w of ['hesap raporu', 'donatı', 'imalat ve montaj', 'IFC']) assert.ok(html.includes(w), w);
  assert.doesNotMatch(html, /\d\s?TL\b|₺|fiyat listesi/i);
  assert.doesNotMatch(html, /telefonda açılan|Revit|Tekla/);
});

test('experience: the one figure and only the cleared project names; never the Tuzla client, never Malatya', () => {
  assert.match(html, /<p class="tsr-xp"><b>400\.000\+ m²<\/b>/);
  assert.match(html, /Esenboğa/);
  assert.doesNotMatch(html, /Amazon/);
  assert.doesNotMatch(html, /Malatya/);
});

test('contact: WhatsApp quote button at the top, in İletişim and in the dock; e-mail; the form with a project-type field', () => {
  assert.ok((html.match(quote) || []).length >= 3);
  assert.match(html, /href="mailto:firatsenturk@senkonmuhendislik\.com"/);
  const form = html.match(/<form class="lead-form"[\s\S]*?<\/form>/);
  assert.ok(form, 'no .lead-form');
  const f = form[0];
  for (const name of ['ad', 'telefon', 'sehir', 'proje_turu', 'mesaj', '_gotcha']) assert.match(f, new RegExp(`name="${name}"`));
  assert.doesNotMatch(f, /name="yapim_yili"/);
  assert.match(f, /href="\/kvkk\/"/);
  assert.match(html, /<p class="lead-done" hidden>/);
  assert.match(html, /document\.querySelector\('\.hero'\)/);   // the phone dock hides while the hero is on screen
});

test('firm voice: no personal names, no premium, no 6306, no slogans in headings', () => {
  assert.doesNotMatch(html, /Fırat|Şentürk/);
  assert.doesNotMatch(html, /premium/i);
  assert.doesNotMatch(html, /6306/);
  assert.doesNotMatch(html, /<h[123][^>]*>[^<]*!<\/h[123]>/);
});

test('the page links the shared stylesheet, fonts and track.js with absolute paths and cache tags', () => {
  assert.match(html, /href="\/site\.css\?v=[0-9a-f]{8}"/);
  assert.match(html, /href="\/assets\/senkon\/fonts\/fonts\.css\?v=[0-9a-f]{8}"/);
  assert.equal((html.match(/<script src="\/assets\/senkon\/track\.js\?v=[0-9a-f]{8}" defer><\/script>/g) || []).length, 1);
});

test('the sitemap lists the page, the versions tool checks it, and the home page links it from the design panel', () => {
  assert.match(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/senkonmuhendislik\.com\/tasarim\/<\/loc>/);
  assert.ok(require(path.join(root, 'tools', 'versions.js')).PAGES.includes('tasarim/index.html'));
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<a class="hero-more" href="tasarim\/">/);
});
