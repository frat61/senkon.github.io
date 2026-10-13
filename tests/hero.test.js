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

test('Deneyim shows six building types with the cleared project names, and never Amazon', () => {
  const d = deneyim();
  assert.equal([...d.matchAll(/<article class="type">/g)].length, 6);
  assert.match(d, /Esenboğa Havalimanı Kontrol Kulesi/);
  for (const name of ['Koç Üniversitesi', 'Antalya', 'Malatya', 'Vem', 'Biem', 'Alfraganus', 'Karmall', 'Tuzla']) assert.match(d, new RegExp(name));
  assert.doesNotMatch(d, /Amazon/);
  assert.doesNotMatch(d, /class="ph/);   // no grey picture placeholders
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
  for (const s of services) assert.match(s, s.startsWith('id="hero-performans"') ? /href="#performans"/ : /href="#iletisim"/);
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

test('the site names the codes it works to: TBDY 2018, ASCE, ACI and Eurocode (TS 500 dropped by choice)', () => {
  assert.doesNotMatch(html, /TS 500/);
  for (const code of ['ASCE', 'ACI', 'Eurocode']) assert.match(html, new RegExp('<span>' + code + '</span>'));
  assert.doesNotMatch(html, /uluslararası yönetmelik/);   // the vague wording is replaced by the code names
});

// Performans: the main target. Six plain steps, what the owner gets, and a quote button; no package names, no legal note
const perf = () => block(/<section id="performans"[\s\S]*?<\/section>/);

test('Performans lists the six assessment steps in order', () => {
  const steps = [...perf().matchAll(/<li class="item"><span class="num"[^>]*>(\d\d)<\/span><h3>([^<]+)<\/h3>/g)].map(m => m[2]);
  assert.deepEqual(steps, ['Sismik zemin etüdü', 'Karot testi', 'Röntgen', 'Donatı okuması', 'Üç boyutlu analiz', 'Gerçek deprem kayıtlarıyla analiz']);
});

test('Performans ends with what the owner receives and a WhatsApp quote button', () => {
  assert.match(perf(), /<h3>Çalışmanın sonunda<\/h3>/);
  assert.match(perf(), /güçlendirme projesi/);
  assert.match(perf(), /<a class="btn btn-main" href="https:\/\/wa\.me\/905309250461\?text=[^"]+">Binanız için teklif alın<\/a>/);
});

test('the page never says premium and never cites law 6306', () => {
  assert.doesNotMatch(html, /premium/i);
  assert.doesNotMatch(html, /6306/);
});
