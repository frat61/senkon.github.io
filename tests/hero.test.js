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

const css = fs.readFileSync(path.join(__dirname, '..', 'site.css'), 'utf8');

test('hero figure rule beats the generic .skyline margin and padding', () => {
  assert.match(css, /\.skyline\.hero-figure\{[^}]*padding:0/);
});

test('phones do not download the hidden hero picture', () => {
  assert.match(hero(), /<img class="skyline-static"[^>]*loading="lazy"/);
});

// service switcher: four buttons under the text swap the headline and paragraph above them
const tabs = () => [...hero().matchAll(/<button class="[^"]*hero-tab[^"]*"[^>]*>([^<]*)<\/button>/g)];
const panels = () => [...hero().matchAll(/<div class="hero-panel[^"]*" id="([^"]+)"/g)].map(m => m[1]);

test('hero has four service buttons in order', () => {
  assert.deepEqual(tabs().map(m => m[1]), ['Yapı tasarımı', 'Performans', 'Güçlendirme', 'Danışmanlık']);
});

test('each service button controls its own text panel and starts unpressed', () => {
  const ids = panels();
  for (const m of tabs()) {
    assert.match(m[0], /aria-pressed="false"/);
    const id = /aria-controls="([^"]+)"/.exec(m[0])[1];
    assert.ok(ids.includes(id), 'missing panel ' + id);
  }
});

test('the overview panel is the one shown on load and holds the only h1', () => {
  assert.match(hero(), /<div class="hero-panel on" id="hero-overview">\s*<h1/);
  assert.equal(html.split('<h1').length - 1, 1);
});

test('every service panel ends with a contact link', () => {
  const services = hero().split('<div class="hero-panel" ').slice(1);
  assert.equal(services.length, 4);
  for (const s of services) assert.match(s, /href="#iletisim"/);
});

test('panels share one grid cell so swapping text never moves the buttons', () => {
  assert.match(css, /\.hero-panel\{[^}]*grid-area:1\/1/);
});
