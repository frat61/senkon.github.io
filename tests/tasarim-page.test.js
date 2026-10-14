'use strict';
// tasarim/: the page the second ad campaign opens, for architects, contractors and investors who need
// the structural design of a new building. What we design, how the work goes, what they receive, contact.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tasarim', 'index.html'), 'utf8');
const quote = /<a class="btn btn-main" href="https:\/\/wa\.me\/905309250461\?text=[^"]+">/g;

test('the page has its own title, description and canonical address, and one headline', () => {
  assert.match(html, /<title>Statik proje: çelik ve betonarme yapı tasarımı · Senkon Mühendislik<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{80,}">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/senkonmuhendislik\.com\/tasarim\/">/);
  assert.equal(html.split('<h1').length - 1, 1);
  assert.ok(html.includes('<h1>Projeniz için statik proje: çelik ve betonarme</h1>'));
});

test('it speaks to professionals, not to building owners', () => {
  for (const w of ['mimarlık ofis', 'müteahhit', 'yatırımcı']) assert.ok(html.toLowerCase().includes(w), w);
  assert.doesNotMatch(html, /içinde yaşamak için güvenli mi/);
});

test('what we design: four building kinds, in order', () => {
  const kinds = [...html.matchAll(/<div class="item"><span class="num"[^>]*>\d\d<\/span><h3>([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(kinds, ['Çelik endüstriyel yapılar', 'Betonarme konut ve ticari yapılar', 'Havalimanı ve ulaşım yapıları', 'Platform, çatı ve özel çelik']);
});

test('the codes Fırat works to, named once in a sentence; never TS 500', () => {
  for (const c of ['TBDY 2018', 'ASCE', 'ACI', 'Eurocode']) assert.ok(html.includes(c), c);
  assert.doesNotMatch(html, /TS ?500/);
});

test('how the work goes: three numbered steps, from drawings to delivery', () => {
  const steps = [...html.matchAll(/<li class="item"><span class="num"[^>]*>\d\d<\/span><h3>([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(steps, ['Mimari projeyi gönderin', 'Kapsam, süre ve teklif', 'Tasarım ve teslim']);
});

test('what they receive: report, drawings and the phone-openable 3D model; no prices on the page', () => {
  assert.match(html, /<h3>Teslim ettiklerimiz<\/h3>/);
  for (const w of ['hesap raporu', 'donatı', 'imalat', '3B model']) assert.ok(html.includes(w), w);
  assert.doesNotMatch(html, /\d\s?TL\b|₺|fiyat listesi/i);
});

test('experience: the one figure and only the cleared project names; never the Tuzla client, never Malatya', () => {
  assert.match(html, /400\.000\+ m²/);
  assert.match(html, /Esenboğa/);
  assert.doesNotMatch(html, /Amazon/);
  assert.doesNotMatch(html, /Malatya/);
});

test('contact: WhatsApp quote button at the top, in the box, in İletişim and in the dock; e-mail; the form with a project-type field', () => {
  assert.ok((html.match(quote) || []).length >= 4);
  assert.match(html, /href="mailto:firatsenturk@senkonmuhendislik\.com"/);
  const form = html.match(/<form class="lead-form"[\s\S]*?<\/form>/);
  assert.ok(form, 'no .lead-form');
  const f = form[0];
  for (const name of ['ad', 'telefon', 'sehir', 'proje_turu', 'mesaj', '_gotcha']) assert.match(f, new RegExp(`name="${name}"`));
  assert.doesNotMatch(f, /name="yapim_yili"/);
  assert.match(f, /href="\/kvkk\/"/);
  assert.match(html, /<p class="lead-done" hidden>/);
});

test('firm voice: no personal names, no premium, no 6306, no slogans in headings', () => {
  assert.doesNotMatch(html, /Fırat|Şentürk/);
  assert.doesNotMatch(html, /premium/i);
  assert.doesNotMatch(html, /6306/);
  assert.doesNotMatch(html, /<h[23][^>]*>[^<]*!<\/h[23]>/);
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
