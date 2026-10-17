'use strict';
// Measurement for the ads: one script (assets/senkon/track.js) loads the Google tag for Analytics and Ads
// behind a consent bar, and reports WhatsApp / e-mail / form enquiries as conversions. The landing page
// carries a short contact form that posts to Formspree.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/senkon/track.js');
const css = read('site.css');
const pages = { 'index.html': read('index.html'), 'deprem-performans/index.html': read('deprem-performans/index.html'), 'hakkinda/index.html': read('hakkinda/index.html') };
const landing = pages['deprem-performans/index.html'];

test('the three content pages load track.js with a cache tag, once each', () => {
  for (const [name, html] of Object.entries(pages)) {
    const hits = html.match(/<script src="\/?assets\/senkon\/track\.js\?v=[0-9a-f]{8}" defer><\/script>/g) || [];
    assert.equal(hits.length, 1, name);
  }
});

test('the IDs sit at the top of track.js in one config block, where they can be edited on GitHub', () => {
  const head = js.slice(0, 1500);
  assert.match(head, /GA_ID:\s*'G-V7QE4T0NH4'/);
  assert.match(head, /AW_ID:\s*'AW-18511430201'/);
  for (const key of ['whatsapp', 'email', 'form']) assert.match(head, new RegExp(key + `:\\s*'[A-Za-z0-9_-]*'`));
  assert.match(head, /FORM_ENDPOINT:\s*'[^']*'/);
});

test('consent mode: everything is denied before the visitor answers, and the answer is remembered', () => {
  const def = js.indexOf("'consent', 'default'"), cfg = js.indexOf("'config'");
  assert.ok(def > 0 && cfg > def, 'consent default must come before any config call');
  for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) assert.match(js.slice(def, cfg), new RegExp(k + `:\\s*'denied'`));
  assert.match(js, /'consent', 'update'/);
  assert.match(js, /localStorage/);
});

test('the consent bar is Turkish, with accept and reject of equal standing', () => {
  assert.match(js, /Kabul et/);
  assert.match(js, /Reddet/);
  assert.match(css, /\.consent\{[^}]*position:fixed/);
});

test('WhatsApp, e-mail and form enquiries are reported as Ads conversions; phone taps only to Analytics', () => {
  assert.match(js, /wa\.me/);
  assert.match(js, /mailto:/);
  assert.match(js, /tel:/);
  assert.match(js, /'event', 'conversion'/);
  assert.match(js, /transport_type:\s*'beacon'/);
});

test('the landing page has the contact form: name, phone, city, optional year, message, a honeypot, the KVKK line', () => {
  const form = landing.match(/<form class="lead-form"[\s\S]*?<\/form>/);
  assert.ok(form, 'no .lead-form on the landing page');
  const f = form[0];
  for (const name of ['ad', 'telefon', 'eposta', 'sehir', 'yapim_yili', 'mesaj']) assert.match(f, new RegExp(`name="${name}"`));
  assert.match(f, /name="ad"[^>]*required/);
  assert.doesNotMatch(f, /name="telefon"[^>]*required/);   // phone or e-mail: track.js asks for at least one
  assert.match(f, /type="email" name="eposta"/);
  assert.doesNotMatch(f, /name="yapim_yili"[^>]*required/);
  assert.match(f, /name="_gotcha"/);
  assert.match(f, /<button type="submit" class="btn btn-main">/);
  assert.match(f, /yalnızca size dönüş yapmak için/);
  assert.match(f, /href="\/kvkk\/"/);
  assert.match(landing, /<p class="lead-done" hidden>/);
});

test('the form is submitted by track.js without leaving the page, and reports the Form conversion on success', () => {
  assert.match(js, /\.lead-form/);
  assert.match(js, /fetch\(/);
  assert.match(js, /Accept['"]?:\s*'application\/json'/);
  assert.match(js, /lead-done/);
});

test('the KVKK notice page exists, names the controller, the data, the purpose and the rights, and links the stylesheet', () => {
  const k = read('kvkk/index.html');
  assert.match(k, /<title>Kişisel verilerin korunması · Senkon Mühendislik<\/title>/);
  assert.match(k, /<link rel="canonical" href="https:\/\/senkonmuhendislik\.com\/kvkk\/">/);
  assert.match(k, /site\.css\?v=[0-9a-f]{8}/);
  assert.match(k, /Veri sorumlusu/);
  for (const w of ['Formspree', 'Google Analytics', 'Google Ads', 'çerez', '11\\. madde']) assert.match(k, new RegExp(w));
  assert.doesNotMatch(k, /6306|premium|Fırat|Şentürk/i);
  assert.match(k, /<script src="\/assets\/senkon\/track\.js\?v=[0-9a-f]{8}" defer><\/script>/);
});

test('the Formspree ID is set before the branch is merged', { skip: process.env.ALLOW_PLACEHOLDER === '1' }, () => {
  assert.doesNotMatch(js, /FORM_ENDPOINT:\s*''/, 'FORM_ENDPOINT is still empty: paste the Formspree form address');
});
