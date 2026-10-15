'use strict';
// tasarim/: the page the second ad campaign opens, for architects, contractors and investors who need
// the structural design of a new building. Written, not listed (Fırat, 2026-10-14: the first version read as
// generated): the headline with the steel hall beside it, two arguments side by side (optimize çözümler,
// ileri mühendislik çözümleri), how the work goes as prose, contact and the form.
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
  assert.doesNotMatch(html, /class="(list2|perf-get|faq)"/);
  assert.doesNotMatch(html.replace(/<form class="lead-form"[\s\S]*?<\/form>/, ''), /<ul/);   // the form's file list is the one list
  assert.equal((html.match(/<ol/g) || []).length, 1);
  assert.ok(html.includes('<ol class="steps steps-plain">'));
});

test('the two arguments, side by side and in this order, with linear and nonlinear named', () => {
  assert.deepEqual(h2s.slice(0, 2), ['Optimize çözümler', 'İleri mühendislik çözümleri']);
  assert.match(html, /<div class="mv tsr-two">/);
  assert.match(html, /lineer veya nonlineer/);
  assert.doesNotMatch(html, /aynı model üzerinde|teklif aşamasında belirlenir/);   // Fırat: that claim was controversial
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

test('the story under #adimlar (the ad sitelink): six pictures, six captions, report and drawings; no model link, no Revit/Tekla line (Fırat), no prices', () => {
  assert.match(html, /<section id="adimlar" class="wrap section rule tsr-how">[\s\S]*?<div class="surec-pin">\s*<h2>Nasıl çalışıyoruz<\/h2>/);
  const imgs = [...html.matchAll(/<img src="\/assets\/senkon\/tasarim-surec\/(0[1-6])\.webp\?v=[0-9a-f]{8}" alt="([^"]+)" width="1200" height="900" loading="lazy">/g)];
  assert.deepEqual(imgs.map(m => m[1]), ['01', '02', '03', '04', '05', '06']);
  const items = [...html.matchAll(/<li class="item"><h3>([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(items, ['Mimari projenin incelenmesi', 'Taşıyıcı sistem seçimi', 'Analiz modeli', 'Birleşim detayları', 'Uygulama projesi', 'Şantiye desteği']);
  assert.ok(html.includes('Önceki</button>') && html.includes('Sonraki'));
  assert.equal((html.match(/surec\.js\?v=/g) || []).length, 1);
  for (const w of ['hesap raporu', 'donatı', 'imalat ve montaj', 'IFC']) assert.ok(html.includes(w), w);
  assert.doesNotMatch(html, /\d\s?TL\b|₺|fiyat listesi/i);
  assert.doesNotMatch(html, /telefonda açılan|Revit|Tekla/);
});

test('the hero sends the project to the form; WhatsApp is the second button', () => {
  const hero = html.match(/<section class="wrap hero tsr-hero">[\s\S]*?<\/section>/)[0];
  const btns = [...hero.matchAll(/<a class="(btn [^"]+)" href="([^"]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(btns[0].slice(1), ['btn btn-main', '#iletisim', 'Projeyi gönderin, teklif alın']);
  assert.equal(btns[1][1], 'btn btn-line');
  assert.match(btns[1][2], /^https:\/\/wa\.me\/905309250461\?text=/);
  assert.equal(btns[1][3], 'WhatsApp ile yazın');
  assert.doesNotMatch(hero, /href="#adimlar"/);
});

test('no experience line on this page (Fırat, 2026-10-15: the home page carries it); never the Tuzla client, never Malatya', () => {
  assert.doesNotMatch(html, /tsr-xp|400\.000/);
  assert.doesNotMatch(html, /Amazon/);
  assert.doesNotMatch(html, /Malatya/);
});

test('contact: WhatsApp quote button at the top, in İletişim and in the dock; e-mail; the form with a project-type field', () => {
  assert.ok((html.match(quote) || []).length >= 2);
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

test('the form has a file box (hidden until upload.js attaches) whose input has no name, and a hidden dosyalar summary', () => {
  const f = html.match(/<form class="lead-form"[\s\S]*?<\/form>/)[0];
  const box = f.match(/<div class="lead-files wide" hidden>[\s\S]*?<\/ul>\s*<\/div>/);
  assert.ok(box, 'no .lead-files box in the form');
  const b = box[0];
  assert.match(b, /<input type="file" multiple accept="\.pdf,\.dwg,\.dxf,\.ifc,\.zip,\.jpg,\.jpeg,\.png">/);
  assert.doesNotMatch(f, /<input type="file"[^>]*name=/);   // track.js posts new FormData(form): Formspree must not get the files
  assert.match(b, /<label>Planlarınızı ekleyin/);
  assert.ok(b.includes('PDF, DWG, DXF, IFC, ZIP, JPG veya PNG · dosya başına en fazla 50 MB'));
  assert.match(b, /<ul class="lead-flist"><\/ul>/);
  assert.ok(f.indexOf('name="mesaj"') < f.indexOf('lead-files'));
  assert.match(f, /name="_subject"[^>]*>\s*<input type="hidden" name="dosyalar" value="">/);
  assert.equal((html.match(/<script src="\/model\/config\.js\?v=[0-9a-f]{8}" defer><\/script>/g) || []).length, 1);
  assert.equal((html.match(/<script src="\/assets\/senkon\/upload\.js\?v=[0-9a-f]{8}" defer><\/script>/g) || []).length, 1);
  assert.ok(html.indexOf('/assets/senkon/upload.js?v=') > html.indexOf('/assets/senkon/track.js?v='));
  assert.ok(html.indexOf('/assets/senkon/upload.js?v=') > html.indexOf('/model/config.js?v='));
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

test('the site menu links the page after Performans on the other pages; a page never lists itself', () => {
  const read = f => fs.readFileSync(path.join(root, f), 'utf8');
  assert.match(read('index.html'), /<a href="deprem-performans\/">Performans<\/a><a href="tasarim\/">Tasarım<\/a>/);
  for (const f of ['hakkinda/index.html', 'kvkk/index.html']) assert.match(read(f), /<a href="\/deprem-performans\/">Performans<\/a><a href="\/tasarim\/">Tasarım<\/a>/, f);
  assert.match(read('deprem-performans/index.html'), /<a href="\/">Ana sayfa<\/a><a href="\/tasarim\/">Tasarım<\/a>/);
  assert.doesNotMatch(html.match(/<nav id="nav"[\s\S]*?<\/nav>/)[0], /tasarim/);
});

test('the sitemap lists the page, the versions tool checks it, and the home page links it from the design panel', () => {
  assert.match(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/senkonmuhendislik\.com\/tasarim\/<\/loc>/);
  assert.ok(require(path.join(root, 'tools', 'versions.js')).PAGES.includes('tasarim/index.html'));
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<a class="hero-more" href="tasarim\/">/);
});

test('the sample sheet section', () => {
  assert.match(html, /<section id="ornek-pafta" class="wrap section rule">/);
  assert.ok(html.includes('<h2>Örnek pafta</h2>'));
  assert.ok(html.includes('Uygulama projelerimizin çizim standardını gösteren örnek bir paftadır; gerçek bir projeye ait değildir.'));
  assert.match(html, /<img class="pafta-static" src="\/assets\/senkon\/ornek-pafta\.svg\?v=[0-9a-f]{8}"/);
  assert.ok(html.includes('alt="Örnek pafta: çelik endüstriyel yapının çerçeve görünüşü ve kolon–makas birleşim detayı"'));
  assert.match(html, /<a href="\/assets\/senkon\/ornek-pafta\.svg">Paftayı büyük açın<\/a>/);
  assert.ok(html.includes('<dialog class="pafta-dlg"'));
  const dlg = html.slice(html.indexOf('<dialog class="pafta-dlg"'), html.indexOf('</dialog>'));
  assert.ok(dlg.includes('<button type="button" class="pafta-in" aria-label="Yakınlaştır">+</button>'), 'the dialog has its own + button');
  assert.ok(dlg.includes('<button type="button" class="pafta-out" aria-label="Uzaklaştır">−</button>'), 'the dialog has its own − button');
  assert.ok(dlg.includes('<button type="button" class="pafta-close">Kapat</button>'));
  assert.ok(!dlg.includes('pafta-full'));
  assert.equal((html.match(/pafta\.js\?v=/g) || []).length, 1);
  const at = id => html.indexOf('id="' + id + '"');
  assert.ok(at('yaklasim') < at('adimlar') && at('adimlar') < at('ornek-pafta') && at('ornek-pafta') < at('iletisim'));
});
