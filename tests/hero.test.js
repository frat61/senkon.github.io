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

test('Deneyim is a banner: the figure, six still building types, and the cleared project names sliding, never Amazon', () => {
  const d = deneyim();
  assert.match(d, /<b>400\.000\+ m²<\/b>/);
  const types = [...d.matchAll(/<li><b>\d\d<\/b>([^<]+)<\/li>/g)].map(m => m[1]);
  assert.deepEqual(types, ['Havalimanı ve ulaşım', 'Endüstriyel', 'Ticari', 'Konut ve ofis', 'Bina değerlendirme', 'Güçlendirme']);
  for (const name of ['Esenboğa Havalimanı Kontrol Kulesi', 'Koç Üniversitesi', 'Antalya', 'Malatya', 'Vem', 'Biem', 'Alfraganus', 'Karmall', 'Tuzla']) assert.match(d, new RegExp(name));
  assert.match(d, /<ul class="xp-list" aria-hidden="true">/);   // the loop's second copy is hidden from screen readers
  assert.doesNotMatch(d, /Amazon/);
});

test('the sliding names stop for visitors who ask for less motion, and pause on hover', () => {
  assert.match(css, /prefers-reduced-motion: reduce\)\{ \.xp-run\{[^}]*\} \.xp-track\{animation:none\}/);
  assert.match(css, /\.xp-run:hover \.xp-track\{animation-play-state:paused\}/);
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

test('every service panel ends with a link onward (Performans to its steps, the others to contact)', () => {
  const services = hero().split('<div class="hero-panel" ').slice(1);
  assert.equal(services.length, 4);
  for (const s of services) assert.match(s, s.startsWith('id="hero-performans"') ? /href="deprem-performans\/"/ : /href="#iletisim"/);
});

test('panels share one grid cell so swapping text never moves the buttons', () => {
  assert.match(css, /\.hero-panel\{[^}]*grid-area:1\/1/);
});

// phone polish: tabs above the text with no reserved gap, and a WhatsApp + e-mail dock pinned to the bottom
test('on phones the hero buttons sit above the text and hidden panels take no space', () => {
  assert.match(css, /\.hero-tabs\{order:-1\}/);
  assert.match(css, /\.hero-panel:not\(\.on\)\{display:none\}/);
});

test('the phone dock offers WhatsApp and e-mail, and starts hidden', () => {
  const dock = block(/<nav class="dock[^"]*"[\s\S]*?<\/nav>/);
  assert.match(dock, /class="dock away" inert/);
  assert.match(dock, /href="https:\/\/wa\.me\/905309250461"/);
  assert.match(dock, /href="mailto:firatsenturk@senkonmuhendislik\.com"/);
});

test('the home page names no TS 500 and no vague "uluslararası yönetmelik" (the code tags live on hakkinda/)', () => {
  assert.doesNotMatch(html, /TS 500/);
  assert.doesNotMatch(html, /uluslararası yönetmelik/);
  assert.match(html, /<a href="hakkinda\/">Hakkında<\/a>/);
  assert.doesNotMatch(html, /id="hakkinda"/);
});

// Performans on the home page is a short summary; the six steps live on deprem-performans/ (tests/perf-page.test.js)
const perf = () => block(/<section id="performans"[\s\S]*?<\/section>/);

test('home Performans is a short summary that links to the full page', () => {
  assert.match(perf(), /href="deprem-performans\/"/);
  assert.doesNotMatch(perf(), /<li class="item">/);   // the steps are not duplicated here
});

test('the 3B model section sits at the bottom of the page, after İletişim', () => {
  assert.ok(html.indexOf('id="model"') > html.indexOf('id="iletisim"'));
});

test('the page never says premium and never cites law 6306', () => {
  assert.doesNotMatch(html, /premium/i);
  assert.doesNotMatch(html, /6306/);
});
