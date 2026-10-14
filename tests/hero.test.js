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

test('the steel hall erection sits in the hero media slot, drawn by hal.js from hal.json', () => {
  assert.match(hero(), /class="hero-media"/);
  assert.match(hero(), /<figure class="hall hero-figure"[^>]*data-hall="assets\/senkon\/hal\.json"[^>]*data-speed="1.4"/);
  assert.match(html, /<script src="assets\/senkon\/hal\.js\?v=[0-9a-f]{8}" defer><\/script>/);
  assert.match(css, /\.hall-stage\{/);
});

test('the hall is animated only once on the page, and the Esenboğa tower is off the page', () => {
  assert.equal(html.split('hal.json').length - 1, 1);
  assert.doesNotMatch(html, /esenboga\.(json|webp)/);
});

test('Deneyim is a banner: the figure, six still building types, and the cleared project names sliding, never Amazon', () => {
  const d = deneyim();
  assert.match(d, /<b>400\.000\+ m²<\/b>/);
  const types = [...d.matchAll(/<li><b>\d\d<\/b>([^<]+)<\/li>/g)].map(m => m[1]);
  assert.deepEqual(types, ['Havalimanı ve ulaşım', 'Endüstriyel', 'Ticari', 'Konut ve ofis', 'Bina değerlendirme', 'Güçlendirme']);
  for (const name of ['Esenboğa Havalimanı Kontrol Kulesi', 'Koç Üniversitesi', 'Antalya', 'Vem', 'Biem', 'Alfraganus', 'Karmall', 'Tuzla']) assert.match(d, new RegExp(name));
  assert.doesNotMatch(d, /Malatya/);   // removed by Fırat on 2026-10-14
  assert.match(d, /<ul class="xp-list" aria-hidden="true">/);   // the loop's second copy is hidden from screen readers
  assert.doesNotMatch(d, /Amazon/);
  assert.doesNotMatch(d, /GVN|Yapı Akademisi|Referanslar/);   // the note under the banner was removed
});

test('the sliding names stop for visitors who ask for less motion, and pause on hover', () => {
  assert.match(css, /prefers-reduced-motion: reduce\)\{ \.xp-run\{[^}]*\} \.xp-track\{animation:none\}/);
  assert.match(css, /\.xp-run:hover \.xp-track\{animation-play-state:paused\}/);
});

const css = fs.readFileSync(path.join(__dirname, '..', 'site.css'), 'utf8');

test('hero figure rule beats the generic figure margin and padding', () => {
  assert.match(css, /\.hall\.hero-figure\{[^}]*padding:0/);
});

test('the hero picture loads eagerly: it is on the first screen on every device', () => {
  assert.doesNotMatch(hero(), /<img class="hall-static"[^>]*loading="lazy"/);
  assert.match(hero(), /<img class="hall-static" src="assets\/senkon\/hal\.webp\?v=[0-9a-f]{8}"/);
});

test('on phones the hall shows above the headline, narrower', () => {
  const phone = css.match(/@media \(max-width:860px\)\{([^\n]*)\}/)[1];
  assert.doesNotMatch(phone, /\.hero-media\{[^}]*display:none/);
  assert.match(phone, /\.hero-media\{[^}]*order:-1/);
  assert.match(phone, /\.hero-figure\{[^}]*max-width:300px/);
  assert.match(css, /\.hall\.hero-figure\{[^}]*max-width:400px/);
});

test('both build animations run 1.4 times faster, through data-speed that hal.js and skyline.js read', () => {
  assert.match(hero(), /<figure class="hall hero-figure"[^>]*data-speed="1.4"/);
  assert.match(html, /<figure id="skyline"[^>]*data-speed="1.4"/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'skyline.js'), 'utf8'), /data-speed/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hal.js'), 'utf8'), /data-speed/);
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

test('skyline.js reads data-stagger, the seconds between neighbouring starts, so a figure can rise strip by strip', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'skyline.js'), 'utf8');
  assert.match(js, /data-stagger/);
});

test('the Deneyim banner is text only again: no figure, three columns of types', () => {
  assert.doesNotMatch(deneyim(), /<figure/);
  assert.match(css, /\.xp-types\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /\.xp-figure/);
});

test('hal.js fails quietly, waits for both the JSON and the view, and never draws unstarted pieces', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hal.js'), 'utf8');
  assert.match(js, /\.catch\(\(\) => \{\}\)/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /const TOTAL = 15, LANES = 5/);          // five work fronts assemble at once, 15 s in all at speed 1: the 25 s tempo with the roof as 21 pieces
  assert.match(js, /const SPAN = 0\.3/);                     // the big roof pieces swing in longer
  assert.match(js, /SWING_X = 0\.35, SWING_Y = -0\.3/);   // pieces swing in from above their zone, no hook lines
  assert.doesNotMatch(js, /hook/i);
  assert.match(js, /lane\[pi\] = /);                                   // each piece belongs to the zone it stands in
  assert.match(js, /if \(!started\[/);   // the per-member skip guard in the frame loop
});

test('hal.js scales line widths with the canvas, so the final frame matches the still at any figure size', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hal.js'), 'utf8');
  assert.match(js, /Math\.max\(W_MIN, Math\.min\(W_MAX, widthPx\([^)]*\)\)\) \* k/);   // picture px -> canvas px, never by dpr alone
  assert.match(js, /1\.5 \* k/);                                                  // the ink border too
  assert.doesNotMatch(js, /W_MAX, widthPx\([^)]*\)\)\) \* dpr/);
});
test('hal.js turns the hall after the erection and lets the visitor drag it, without stealing vertical swipes', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hal.js'), 'utf8');
  assert.match(js, /const TURN = 60/);
  assert.match(js, /data\.v !== 2/);                                   // old files leave the still
  assert.match(js, /addEventListener\('pointerdown'/);
  assert.match(js, /addEventListener\('pointercancel'/);
  assert.match(js, /if \(state === 'building'\) return;/);             // a drag never interrupts the erection
  assert.match(js, /if \(state === 'still'\) return;/);                // no frame loop while idle
  assert.match(css, /\.hall-stage canvas\{[^}]*touch-action:pan-y/);
  assert.match(hero(), /aria-label="Endüstriyel çelik yapının taşıyıcı sisteminin montaj animasyonu; sürükleyerek döndürülebilir"/);
});
test('hal.js stops turning off screen, keeps pinch-zoom, and follows one finger only', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'senkon', 'hal.js'), 'utf8');
  assert.match(js, /EL_MAX = 0\.4887/);                                 // 28°: steeper tilts crop the hall
  assert.match(js, /if \(!inView && state !== 'building'\)/);          // the turn pauses while the hero is scrolled away
  assert.match(js, /visibilitychange[\s\S]*last = null/);              // no jump after a hidden tab
  assert.match(js, /holdId/);                                          // a second finger never steers
  assert.match(js, /addEventListener\('lostpointercapture'/);
  assert.match(css, /\.hall-stage canvas\{[^}]*touch-action:pan-y pinch-zoom/);
  assert.match(js, /IDLE = 4;/);                                  // the turn resumes 4 s after the visitor lets go
  assert.match(js, /resumeTimer = setTimeout/);
});


