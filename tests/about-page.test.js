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

test('the codes Fırat works to: TBDY 2018, ASCE, ACI and Eurocode, and never TS 500', () => {
  for (const code of ['TBDY 2018', 'ASCE', 'ACI', 'Eurocode']) assert.ok(html.includes('<span>' + code + '</span>'), code);
  assert.doesNotMatch(html, /TS 500/);
});

test('the software tags and the about text are there', () => {
  assert.ok(html.includes('<span>ETABS</span>'));
  assert.match(html, /İstanbul'da kurulu bir yapı mühendisliği ofisiyiz/);
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
