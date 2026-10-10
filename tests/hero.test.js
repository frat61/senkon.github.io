'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = re => { const m = html.match(re); assert.ok(m, 'section not found: ' + re); return m[0]; };
const hero = () => block(/<section class="wrap hero">[\s\S]*?<\/section>/);
const deneyim = () => block(/<section id="deneyim"[\s\S]*?<\/section>/);

test('hero has no eyebrow (the logo already names the firm)', () => {
  assert.doesNotMatch(hero(), /class="eyebrow"/);
});

test('Esenboğa animation sits in the hero media slot', () => {
  assert.match(hero(), /class="hero-media"/);
  assert.match(hero(), /data-skyline="assets\/senkon\/esenboga\.json"/);
});

test('Esenboğa is animated only once on the page', () => {
  assert.equal(html.split('esenboga.json').length - 1, 1);
});

test('Deneyim keeps the project text with a placeholder', () => {
  assert.match(deneyim(), /Esenboğa Havalimanı Kontrol Kulesi/);
  assert.match(deneyim(), /class="ph featured-ph"/);
});
