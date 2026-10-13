'use strict';
// deprem-performans/: the page the ads will open. Six plain steps, what the owner receives, three questions, quote buttons.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'deprem-performans', 'index.html'), 'utf8');
const quote = /<a class="btn btn-main" href="https:\/\/wa\.me\/905309250461\?text=[^"]+">/g;

test('the page has its own title, description and canonical address', () => {
  assert.match(html, /<title>Deprem performans değerlendirmesi · Senkon Mühendislik<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{80,}">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/senkonmuhendislik\.com\/deprem-performans\/">/);
  assert.equal(html.split('<h1').length - 1, 1);
});

test('the six assessment steps, in order', () => {
  const steps = [...html.matchAll(/<li class="item"><span class="num"[^>]*>\d\d<\/span><h3>([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(steps, ['Sismik zemin etüdü', 'Karot testi', 'Röntgen ve donatı okuması', 'Üç boyutlu analiz', 'Deprem performansının belirlenmesi', 'Gerekirse, güçlendirme projesi']);
});

test('the story figure: six pictures with alt text, in order, before the steps, plus the two buttons', () => {
  const figAt = html.indexOf('<figure class="surec-stage"'), stepsAt = html.indexOf('<ol class="steps">');
  assert.ok(figAt > 0 && figAt < stepsAt);
  const srcs = [...html.matchAll(/<img src="\/assets\/senkon\/surec\/(\d\d)\.webp\?v=[0-9a-f]{8}" alt="[^"]{10,}" width="1200" height="900" loading="lazy">/g)].map(m => m[1]);
  assert.deepEqual(srcs, ['01', '02', '03', '04', '05', '06']);
  assert.match(html, /<button type="button" class="surec-prev">/);
  assert.match(html, /<button type="button" class="surec-next">/);
});

test('what the owner receives, including a strengthening project if needed', () => {
  assert.match(html, /<h3>Çalışmanın sonunda<\/h3>/);
  assert.match(html, /güçlendirme projesi/);
});

test('the three questions Fırat answered', () => {
  for (const q of ['Ne kadar sürer?', 'Hangi binaları değerlendiriyorsunuz?', 'İlk adım ne?']) assert.ok(html.includes('<h3>' + q + '</h3>'), q);
  assert.match(html, /2–5 hafta/);
  assert.doesNotMatch(html, /yığma/i);   // only betonarme and çelik
});

test('the WhatsApp quote button appears at the top, in the box, in İletişim and in the phone dock', () => {
  assert.ok((html.match(quote) || []).length >= 4);
});

test('the page links the shared stylesheet with absolute paths (it lives in a folder)', () => {
  assert.match(html, /href="\/site\.css\?v=[0-9a-f]{8}"/);
  assert.match(html, /href="\/assets\/senkon\/fonts\/fonts\.css\?v=[0-9a-f]{8}"/);
});

test('never premium, never 6306, never the Tuzla client', () => {
  assert.doesNotMatch(html, /premium/i);
  assert.doesNotMatch(html, /6306/);
  assert.doesNotMatch(html, /Amazon/);
});

test('the sitemap lists the page', () => {
  const map = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
  assert.match(map, /<loc>https:\/\/senkonmuhendislik\.com\/deprem-performans\/<\/loc>/);
});

test('the headline asks the owner question in Fırat words', () => {
  assert.ok(html.includes('<h1>Binanız, içinde yaşamak için güvenli mi?</h1>'));
});
