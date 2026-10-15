'use strict';
// assets/senkon/upload.js (pure rules): file names, folder names, limits, summary, and the shared path pattern.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EXT, MAX_FILES, MAX_BYTES, PATH_RE, cleanName, folderName, check, summary } = require('../assets/senkon/upload.js');

test('constants', () => {
  assert.deepEqual(EXT, ['pdf', 'dwg', 'dxf', 'ifc', 'zip', 'jpg', 'jpeg', 'png']);
  assert.equal(MAX_FILES, 10);
  assert.equal(MAX_BYTES, 52428800);
  assert.equal(PATH_RE.flags, 'i');
});

test('cleanName', () => {
  assert.equal(cleanName('Zemin Etüdü (son).v2.PDF'), 'Zemin-Etudu-son.v2.pdf');
  assert.equal(cleanName('ŞÇĞİÖÜ ışığ.dwg'), 'SCGIOU-isig.dwg');
  assert.equal(cleanName('???.pdf'), 'dosya.pdf');
  assert.equal(cleanName('a   b -- c.png'), 'a-b-c.png');
  assert.equal(cleanName('x'.repeat(200) + '.zip'), 'x'.repeat(80) + '.zip');
});

test('folderName', () => {
  assert.equal(folderName(new Date(2026, 9, 15), () => 0), '20261015-aaaaaaaaaaaa');
  assert.match(folderName(new Date(2026, 0, 5), () => 0.9999999), /^20260105-[a-z0-9]{12}$/);
});

test('every cleaned name fits PATH_RE', () => {
  let s = 12345;
  const rand = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pool = 'abcçdeğfgıhiİjklmnoöprsştuüvyzABC ŞÜ0123456789 ._-()[]/\\?*:"<>|éñ日本';
  for (let i = 0; i < 200; i++) {
    let n = '';
    for (let k = 0, len = Math.floor(rand() * 120); k < len; k++) n += pool[Math.floor(rand() * pool.length)];
    const p = folderName(new Date(2026, 9, 15), rand) + '/' + cleanName(n + '.pdf');
    assert.ok(PATH_RE.test(p), p);
  }
});

test('PATH_RE rejects', () => {
  for (const p of ['../x.pdf', '20261015-abc/x.pdf', '20261015-aaaaaaaaaaaa/x.exe', '20261015-aaaaaaaaaaaa/a/b.pdf'])
    assert.equal(PATH_RE.test(p), false, p);
  assert.ok(PATH_RE.test('20261015-aaaaaaaaaaaa/X.PDF'));
});

test('check', () => {
  const ok = { name: 'a.pdf', size: 100 };
  const badType = 'Bu dosya türü kabul edilmiyor (PDF, DWG, DXF, IFC, ZIP, JPG, PNG).';
  assert.equal(check(ok, []), null);
  assert.equal(check({ name: 'a.exe', size: 1 }, []), badType);
  assert.equal(check({ name: 'noext', size: 1 }, []), badType);
  assert.equal(check({ name: 'a.pdf', size: MAX_BYTES + 1 }, []), "Dosya 50 MB'tan büyük.");
  assert.equal(check({ name: 'a.pdf', size: MAX_BYTES }, []), null);
  const ten = Array.from({ length: 10 }, (_, i) => ({ name: 'f' + i + '.pdf', size: 1 }));
  assert.equal(check(ok, ten.slice(0, 9)), null);
  assert.equal(check(ok, ten), 'En fazla 10 dosya eklenebilir.');
  assert.equal(check(ok, [ok]), 'Bu dosya zaten eklendi.');
  assert.equal(check({ name: 'a.pdf', size: 101 }, [ok]), null);
});

test('summary', () => {
  assert.equal(summary('20261015-aaaaaaaaaaaa', [{ name: 'a.pdf', size: 1258291 }]), 'talepler/20261015-aaaaaaaaaaaa: a.pdf (1,2 MB)');
  assert.equal(summary('f', [{ name: 'a.pdf', size: 10 }, { name: 'b.dwg', size: 5242880 }]), 'talepler/f: a.pdf (0,1 MB); b.dwg (5,0 MB)');
  assert.equal(summary('f', []), '');
});

test('the SQL policy carries the PATH_RE source verbatim', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'docs', 'model', 'schema-talepler.sql'), 'utf8');
  assert.ok(sql.includes(PATH_RE.source), 'schema-talepler.sql must contain ' + PATH_RE.source);
});

// --- the DOM part: attach(form, opts) on a small fake DOM and a fake XMLHttpRequest ------------------
const { attach } = require('../assets/senkon/upload.js');

class El {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parent = null; this.attrs = {}; this.ev = {}; this.className = ''; this.hidden = false; this.disabled = false; this.value = ''; this._text = ''; this.style = {}; }
  get classList() {
    const el = this, list = () => el.className.split(/\s+/).filter(Boolean);
    return { contains: c => list().includes(c), add: c => { if (!list().includes(c)) el.className = list().concat(c).join(' '); }, remove: c => { el.className = list().filter(x => x !== c).join(' '); } };
  }
  set textContent(t) { this._text = String(t); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return k === 'class' ? (this.className || null) : k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.remove(); c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  addEventListener(t, f) { (this.ev[t] = this.ev[t] || []).push(f); }
  fire(t, e) { e = Object.assign({ type: t, preventDefault() { this.defaultPrevented = true; } }, e); for (const f of this.ev[t] || []) f(e); return e; }
  matches(sel) {   // tag, .class and [attr="value"] parts only: all this test needs
    const m = /^([a-z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/.exec(sel.trim());
    if (!m) throw new Error('fake DOM cannot match ' + sel);
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const c of m[2].split('.').filter(Boolean)) if (!this.classList.contains(c)) return false;
    for (const a of m[3].match(/\[[^\]]+\]/g) || []) {
      const [k, v] = a.slice(1, -1).split('='), got = this.getAttribute(k);
      if (got === null || (v !== undefined && got !== v.replace(/"/g, ''))) return false;
    }
    return true;
  }
  all() { return this.children.flatMap(c => [c].concat(c.all())); }
  querySelectorAll(sel) { return this.all().filter(e => e.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function page() {
  const doc = { createElement: t => new El(t, doc) };
  const mk = (tag, attrs, parent) => { const e = new El(tag, doc); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const form = mk('form', { class: 'lead-form' });
  mk('input', { type: 'hidden', name: '_subject' }, form);
  const dosyalar = mk('input', { type: 'hidden', name: 'dosyalar' }, form);
  const box = mk('div', { class: 'lead-files wide' }, form); box.hidden = true;
  const label = mk('label', {}, box);
  const input = mk('input', { type: 'file', multiple: '' }, label);
  mk('p', { class: 'lead-hint' }, box);
  const list = mk('ul', { class: 'lead-flist' }, box);
  const foot = mk('div', { class: 'lead-foot' }, form);
  const btn = mk('button', { type: 'submit', class: 'btn btn-main' }, foot); btn.textContent = 'Gönder';
  return { form, dosyalar, box, input, list, btn };
}

function fakeXHR() {
  const sent = [];
  class X {
    constructor() { this.headers = {}; this.upload = {}; this.status = 0; this.aborted = false; sent.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    send(body) { this.body = body; }
    abort() { this.aborted = true; }
    finish(status) { this.status = status; this.onload(); }
  }
  return { X, sent };
}

const URL0 = 'https://p.supabase.co', KEY0 = 'sb_publishable_x', FOLDER = '20261015-aaaaaaaaaaaa';
function setup() {
  const p = page(), x = fakeXHR();
  const up = attach(p.form, { url: URL0, key: KEY0, XHR: x.X, now: () => new Date(2026, 9, 15), rand: () => 0 });
  const choose = (...files) => { p.input.files = files; p.input.fire('change'); };
  return Object.assign(p, { up, sent: x.sent, choose });
}
const rows = list => list.querySelectorAll('li');

test('attach shows the box and starts with an empty summary', () => {
  const s = setup();
  assert.equal(s.box.hidden, false);
  assert.deepEqual(s.up.files, []);
  assert.equal(s.up.busy(), false);
  assert.equal(s.dosyalar.value, '');
});

test('choosing a file uploads it at once to the talepler bucket, with the key and no overwrite', () => {
  const s = setup(), file = { name: 'Zemin Etüdü.pdf', size: 2048, type: 'application/pdf' };
  s.choose(file);
  assert.equal(s.sent.length, 1);
  const r = s.sent[0];
  assert.equal(r.method, 'POST');
  assert.equal(r.url, URL0 + '/storage/v1/object/talepler/' + FOLDER + '/Zemin-Etudu.pdf');
  assert.equal(r.headers.apikey, KEY0);
  assert.equal(r.headers.Authorization, 'Bearer ' + KEY0);
  assert.equal(r.headers['x-upsert'], 'false');
  assert.equal(r.headers['Content-Type'], 'application/pdf');
  assert.equal(r.body, file);
  assert.equal(s.up.files[0].path, FOLDER + '/Zemin-Etudu.pdf');
  assert.ok(PATH_RE.test(s.up.files[0].path));
  assert.equal(s.input.value, '');   // the same file can be chosen again after a removal
});

test('a file without a type goes as octet-stream', () => {
  const s = setup();
  s.choose({ name: 'kat.dwg', size: 10, type: '' });
  assert.equal(s.sent[0].headers['Content-Type'], 'application/octet-stream');
});

test('Gönder waits while a file uploads, then comes back; the summary lists the uploaded files by their stored names', () => {
  const s = setup();
  s.choose({ name: 'Zemin Etüdü.pdf', size: 1258291, type: 'application/pdf' });
  assert.equal(s.up.busy(), true);
  assert.equal(s.btn.disabled, true);
  assert.equal(s.btn.textContent, 'Dosyalar yükleniyor…');
  assert.equal(s.dosyalar.value, '');
  s.sent[0].upload.onprogress({ lengthComputable: true, loaded: 629145, total: 1258291 });
  assert.equal(s.up.files[0].pct, 50);
  assert.equal(s.up.files[0].state, 'up');
  s.sent[0].finish(200);
  assert.equal(s.up.files[0].state, 'done');
  assert.equal(s.up.files[0].pct, 100);
  assert.equal(s.up.busy(), false);
  assert.equal(s.btn.disabled, false);
  assert.equal(s.btn.textContent, 'Gönder');
  assert.equal(s.dosyalar.value, summary(FOLDER, [{ name: 'Zemin-Etudu.pdf', size: 1258291 }]));
  assert.equal(s.dosyalar.value, 'talepler/' + FOLDER + ': Zemin-Etudu.pdf (1,2 MB)');
});

test('a failed upload says so, offers a retry on the same path, and does not hold Gönder', () => {
  const s = setup();
  s.choose({ name: 'a.pdf', size: 100, type: 'application/pdf' });
  s.sent[0].finish(400);
  assert.equal(s.up.files[0].state, 'fail');
  assert.equal(s.btn.disabled, false);
  assert.equal(s.dosyalar.value, '');
  const row = rows(s.list)[0];
  assert.ok(row.textContent.includes('Yüklenemedi, tekrar deneyin'));
  const retry = row.querySelector('button.lead-retry');
  assert.ok(retry);
  retry.fire('click');
  assert.equal(s.sent.length, 2);
  assert.equal(s.sent[1].url, s.sent[0].url);
  assert.equal(s.up.files[0].state, 'up');
  assert.equal(s.btn.disabled, true);
  s.sent[1].finish(200);
  assert.equal(s.up.files[0].state, 'done');
  assert.equal(s.dosyalar.value, summary(FOLDER, [{ name: 'a.pdf', size: 100 }]));
  assert.equal(rows(s.list)[0].querySelector('button.lead-retry'), null);
});

test('a network error is a failure too', () => {
  const s = setup();
  s.choose({ name: 'a.pdf', size: 100, type: 'application/pdf' });
  s.sent[0].onerror();
  assert.equal(s.up.files[0].state, 'fail');
  assert.equal(s.btn.disabled, false);
});

test('a refused file never opens a request and shows the reason', () => {
  const s = setup();
  s.choose({ name: 'virus.exe', size: 10, type: '' }, { name: 'big.pdf', size: MAX_BYTES + 1, type: 'application/pdf' });
  assert.equal(s.sent.length, 0);
  assert.equal(s.up.files.length, 0);
  assert.equal(s.btn.disabled, false);
  const msg = s.box.querySelector('.lead-fmsg');
  assert.ok(msg && !msg.hidden);
  assert.ok(msg.textContent.includes('virus.exe: Bu dosya türü kabul edilmiyor'));
  assert.ok(msg.textContent.includes("big.pdf: Dosya 50 MB'tan büyük."));
  s.choose({ name: 'ok.pdf', size: 10, type: '' });
  assert.equal(msg.hidden, true);
});

test('removing a row drops it from the summary; removing an upload in flight aborts it and frees Gönder', () => {
  const s = setup();
  s.choose({ name: 'a.pdf', size: 100, type: '' }, { name: 'b.pdf', size: 200, type: '' });
  s.sent[0].finish(200); s.sent[1].finish(200);
  assert.equal(s.dosyalar.value, summary(FOLDER, [{ name: 'a.pdf', size: 100 }, { name: 'b.pdf', size: 200 }]));
  rows(s.list)[0].querySelector('button.lead-x').fire('click');
  assert.equal(rows(s.list).length, 1);
  assert.deepEqual(s.up.files.map(f => f.name), ['b.pdf']);
  assert.equal(s.dosyalar.value, summary(FOLDER, [{ name: 'b.pdf', size: 200 }]));
  s.choose({ name: 'c.pdf', size: 300, type: '' });
  assert.equal(s.btn.disabled, true);
  rows(s.list)[1].querySelector('button.lead-x').fire('click');
  assert.equal(s.sent[2].aborted, true);
  assert.equal(s.btn.disabled, false);
  assert.equal(s.btn.textContent, 'Gönder');
});

test('all files of one visit share one folder; names that clean to the same path get a suffix', () => {
  let n = 0;
  const p = page(), x = fakeXHR();
  attach(p.form, { url: URL0, key: KEY0, XHR: x.X, now: () => new Date(2026, 9, 15), rand: () => (n++ % 36) / 36 });
  p.input.files = [{ name: 'a b.pdf', size: 1, type: '' }]; p.input.fire('change');
  p.input.files = [{ name: 'a-b.pdf', size: 2, type: '' }, { name: 'c.png', size: 3, type: '' }]; p.input.fire('change');
  const paths = x.sent.map(r => r.url.split('/talepler/')[1]);
  assert.equal(new Set(paths.map(q => q.split('/')[0])).size, 1);
  assert.deepEqual(paths.map(q => q.split('/')[1]), ['a-b.pdf', 'a-b-2.pdf', 'c.png']);
  for (const q of paths) assert.ok(PATH_RE.test(q), q);
});

test('dropping files on the box uploads them; dragging over marks the box', () => {
  const s = setup();
  const over = s.box.fire('dragover', {});
  assert.ok(over.defaultPrevented);
  assert.ok(s.box.classList.contains('drag'));
  s.box.fire('dragleave', {});
  assert.ok(!s.box.classList.contains('drag'));
  s.box.fire('dragover', {});
  const drop = s.box.fire('drop', { dataTransfer: { files: [{ name: 'a.pdf', size: 1, type: '' }] } });
  assert.ok(drop.defaultPrevented);
  assert.ok(!s.box.classList.contains('drag'));
  assert.equal(s.sent.length, 1);
});
