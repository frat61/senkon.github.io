'use strict';
// hakkinda/: the about text and the code and software tags, on their own page
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'hakkinda', 'index.html'), 'utf8');

test('the page has its own title, canonical address and one h1', () => {
  assert.match(html, /<title>Hakkında · Senkon Mühendislik<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/senkonmuhendislik\.com\/hakkinda\/">/);
  assert.equal(html.split('<h1').length - 1, 1);
});

test('the about text names the codes Fırat works to (TBDY 2018, ASCE, ACI, Eurocode), never TS 500', () => {
  const text = (html.match(/<p class="about-text">([^<]+)<\/p>/) || [])[1] || '';
  assert.match(text, /^İstanbul'da kurulu bir yapı mühendisliği ofisiyiz/);
  for (const code of ['TBDY 2018', 'ASCE', 'ACI', 'Eurocode']) assert.ok(text.includes(code), code);
  assert.doesNotMatch(html, /TS 500/);
});

test('no code or software tag rows (Fırat removed them)', () => {
  assert.doesNotMatch(html, /class="chips"/);
});

test('contact at the bottom and the phone dock, with absolute links to the shared files', () => {
  assert.match(html, /<section id="iletisim"/);
  assert.match(html, /<nav class="dock away" inert/);
  assert.match(html, /href="\/site\.css\?v=[0-9a-f]{8}"/);
});

test('no personal names, premium, 6306 or Amazon', () => {
  assert.doesNotMatch(html, /Fırat|Şentürk|premium|6306|Amazon/i);
});

test('the sitemap lists the page', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8'), /<loc>https:\/\/senkonmuhendislik\.com\/hakkinda\/<\/loc>/);
});

test('Misyonumuz and Vizyonumuz, with the owner question in Fırat words', () => {
  assert.match(html, /<p class="eyebrow">Misyonumuz<\/p>/);
  assert.match(html, /<p class="eyebrow">Vizyonumuz<\/p>/);
  assert.ok(html.includes('"binam, içinde yaşamak için güvenli mi?"'));
});

test('no numbered principles section (Fırat found the slogans cheesy)', () => {
  assert.doesNotMatch(html, /Nasıl çalışıyoruz|class="item"/);
});
