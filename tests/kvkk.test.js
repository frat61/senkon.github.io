'use strict';
// kvkk/index.html: the privacy page must say what happens to files sent with the tasarim/ form.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'kvkk', 'index.html'), 'utf8');

test('kvkk: uploaded files are kept only to prepare a quote and deleted after', () => {
  assert.ok(html.includes('Form ile gönderilen dosyalar yalnızca teklif hazırlamak amacıyla saklanır ve bu amaç sona erdiğinde silinir.'));
});

test('kvkk: Supabase is named as the storage service for files sent with the form', () => {
  assert.ok(html.includes('Form ile gönderilen dosyalar, Supabase hizmeti aracılığıyla saklanır.'));
});

test('kvkk: no draft marker is left on the page', () => {
  assert.ok(!html.includes('TASLAK'));
});
