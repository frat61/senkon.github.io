# Stage 2: View-Only Uploads and Owner Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fırat logs in at `/model/panel.html`, adds a model from a `.glb`, `.gltf`, `.ifc` or `.json` file, gets a share link with a preview, and clients open uploaded 3D files on the same viewer page as parametric models.

**Architecture:** Files are converted to GLB in the owner's browser (IFC through web-ifc, embedded glTF through three.js's exporter) and stored in a public-by-path Supabase Storage bucket under the model's random slug. The public viewer gains a file mode that loads a GLB with three.js's `GLTFLoader` into the existing `SenkonViewer`. Pure helpers (`slug.js`, `ingest.js`) are Node-tested; the page flows are verified in the browser.

**Tech Stack:** plain HTML/CSS/JS, three.js r128 + `GLTFLoader`/`GLTFExporter` from the same release (vendored), web-ifc 0.0.78 (vendored IIFE + WASM, owner page only), supabase-js 2.117.3 UMD (vendored, owner page only), Supabase Postgres + Storage, Node 24 `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-08-stage2-uploads-design.md` (and, for the viewer and data format, `docs/superpowers/specs/2026-10-08-model-viewer-design.md`)

## Global Constraints

- Branch `stage2-uploads` in `C:\Dev\senkon`, cut from `main`. Never push; Fırat pushes and merges.
- Only `model/`, `docs/`, `tools/`, `tests/` change. No other page of the site changes.
- Client data never under a served path: `local/` is gitignored and holds samples, dev rows and the one-off extractor.
- Interface text is Turkish. The status line "Ön tasarım modelidir, uygulama için değildir." stays visible in the viewer for file models too.
- Only the publishable key appears in the pages (`model/config.js`). No secret key anywhere.
- Vendored, pinned dependencies with source URL and SHA-256 recorded in `docs/model/README.md`: three.js r128 `examples/js/loaders/GLTFLoader.js` and `examples/js/exporters/GLTFExporter.js` from `https://cdn.jsdelivr.net/npm/three@0.128.0/...`; supabase-js from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js`; web-ifc from `https://cdn.jsdelivr.net/npm/web-ifc@0.0.78/web-ifc-api-iife.js` and `.../web-ifc.wasm`. No CDN script tags in any page.
- Stored file format is always GLB at storage path `<slug>/model.glb`, MIME `model/gltf-binary`, limit 50 MB (52428800 bytes).
- Slugs: 12 characters from `abcdefghjkmnpqrstuvwxyz23456789` via `crypto.getRandomValues` with rejection sampling (bytes ≥ 248 discarded).
- Test gate: the bare `node --test` (not `node --test tests/`) passes before each commit.
- Commit author `git -c user.name="Fırat Şentürk" -c user.email="sfiratsenturk@gmail.com"`; every commit message ends with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- The owner's real Supabase password is never typed by an agent. Tasks that need a logged-in owner page stop at the login screen; Fırat logs in himself in the browser pane (Task 8).

---

### Task 1: Vendor the Stage 2 dependencies

**Files:**
- Create: `model/vendor/GLTFLoader.r128.js`, `model/vendor/GLTFExporter.r128.js`, `model/vendor/supabase-js.v2.117.3.min.js`, `model/vendor/web-ifc/web-ifc-api-iife.js`, `model/vendor/web-ifc/web-ifc.wasm`
- Modify: `docs/model/README.md` (vendored dependencies table)

**Interfaces:**
- Produces: globals `THREE.GLTFLoader`, `THREE.GLTFExporter` (after `three.r128.min.js`), `supabase` (UMD, `supabase.createClient`), `WebIFC` (IIFE, `new WebIFC.IfcAPI()`), and the WASM next to the IIFE so `SetWasmPath('vendor/web-ifc/', true)` resolves `web-ifc.wasm`.

- [ ] **Step 1: Download the five files**

From `C:\Dev\senkon` in Git Bash:
```bash
mkdir -p model/vendor/web-ifc
curl -sSL -o model/vendor/GLTFLoader.r128.js   https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js
curl -sSL -o model/vendor/GLTFExporter.r128.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js
curl -sSL -o model/vendor/supabase-js.v2.117.3.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js
curl -sSL -o model/vendor/web-ifc/web-ifc-api-iife.js https://cdn.jsdelivr.net/npm/web-ifc@0.0.78/web-ifc-api-iife.js
curl -sSL -o model/vendor/web-ifc/web-ifc.wasm https://cdn.jsdelivr.net/npm/web-ifc@0.0.78/web-ifc.wasm
ls -l model/vendor model/vendor/web-ifc
```
Expected sizes (bytes, approximately): GLTFLoader 96550, GLTFExporter 57871, supabase 217907, web-ifc IIFE 6089952, WASM 1595268.

- [ ] **Step 2: Verify each file is what it claims**

```bash
grep -c "THREE.GLTFLoader = " model/vendor/GLTFLoader.r128.js       # expect 1
grep -c "THREE.GLTFExporter = " model/vendor/GLTFExporter.r128.js   # expect 1
head -c 120 model/vendor/supabase-js.v2.117.3.min.js                 # a UMD header mentioning "supabase"
head -c 40 model/vendor/web-ifc/web-ifc-api-iife.js                  # starts with: "use strict"; var WebIFC =
head -c 4 model/vendor/web-ifc/web-ifc.wasm | od -c                   # \0 a s m
sha256sum model/vendor/GLTFLoader.r128.js model/vendor/GLTFExporter.r128.js model/vendor/supabase-js.v2.117.3.min.js model/vendor/web-ifc/web-ifc-api-iife.js model/vendor/web-ifc/web-ifc.wasm
```

- [ ] **Step 3: Record them in the README table**

In `docs/model/README.md`, under "Vendored dependencies", add one row per file with the exact source URL from Step 1 and the hash from Step 2, in the same table format as the three.js row. Add after the table:
```markdown
`GLTFLoader` is loaded by the viewer only when a model is a file; `GLTFExporter`, supabase-js
and web-ifc are loaded by the owner page only.
```

- [ ] **Step 4: Commit**

```bash
git add model/vendor docs/model/README.md
git commit -m "Vendor GLTFLoader, GLTFExporter, supabase-js and web-ifc for Stage 2

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Shared slug generator (`model/slug.js`)

**Files:**
- Create: `model/slug.js`, `tests/slug.test.js`
- Modify: `tools/make-model-sql.js` (use the shared module)

**Interfaces:**
- Produces: `SenkonSlug` (browser global; `module.exports` in Node) with `ALPHABET` (string of 31 symbols), `randomSlug(n = 12, rng?) -> string`, `isSlug(s) -> boolean`. `rng` is an object with `getRandomValues(Uint8Array)`; default is the platform `crypto`.

- [ ] **Step 1: Write the failing tests**

`tests/slug.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../model/slug.js');

test('slug has 12 characters from the look-alike-free alphabet', () => {
  assert.equal(S.ALPHABET, 'abcdefghjkmnpqrstuvwxyz23456789');
  assert.equal(S.ALPHABET.length, 31);
  for (let i = 0; i < 50; i++) {
    const s = S.randomSlug();
    assert.equal(s.length, 12);
    assert.ok(S.isSlug(s), s);
    assert.ok(!/[01ilo]/.test(s), 'no look-alikes in ' + s);
  }
});

test('two slugs differ', () => {
  assert.notEqual(S.randomSlug(), S.randomSlug());
});

test('isSlug rejects wrong length, characters and types', () => {
  assert.equal(S.isSlug('abcdefghjkm'), false);
  assert.equal(S.isSlug('abcdefghjkm1'), false);
  assert.equal(S.isSlug('ABCDEFGHJKMN'), false);
  assert.equal(S.isSlug(12), false);
  assert.equal(S.isSlug('hwh8zs6h4h7k'), true);
});

test('bytes of 248 and above are discarded (no modulo bias)', () => {
  const rng = { getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = i < 12 ? 255 : (i - 12) % 31; return a; } };
  assert.equal(S.randomSlug(12, rng), S.ALPHABET.slice(0, 12));
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
node --test
```
Expected: `Cannot find module '../model/slug.js'` failures (the 32 Stage 1 tests still pass).

- [ ] **Step 3: Write `model/slug.js`**

```js
/* SenkonSlug: random, unguessable link codes. 12 symbols from a 31-letter alphabet without
   look-alikes (no 0/1/i/l/o), drawn from crypto.getRandomValues with rejection sampling.
   Usable as a browser global (SenkonSlug) and from Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SenkonSlug = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';   // 31 symbols
  const LIMIT = 248;                                     // 8 * 31: bytes at or above are discarded
  function platformCrypto() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto;
    return require('node:crypto').webcrypto;
  }
  function randomSlug(n, rng) {
    n = n || 12;
    const c = rng || platformCrypto(), out = [];
    while (out.length < n) {
      const buf = c.getRandomValues(new Uint8Array(n * 2));
      for (let i = 0; i < buf.length && out.length < n; i++) if (buf[i] < LIMIT) out.push(ALPHABET[buf[i] % 31]);
    }
    return out.join('');
  }
  const RE = new RegExp('^[' + ALPHABET + ']{12}$');
  const isSlug = s => typeof s === 'string' && RE.test(s);
  return { ALPHABET, randomSlug, isSlug };
});
```

- [ ] **Step 4: Make `tools/make-model-sql.js` use it**

Replace the `ALPHABET` constant and the `randomSlug` function in `tools/make-model-sql.js` with:
```js
const { randomSlug } = require('../model/slug.js');
```
and keep the call `const slug = randomSlug(12);`. Run `node tools/make-model-sql.js local/lab-model.json x@example.com | tail -1` and confirm a 12-character slug in the share link.

- [ ] **Step 5: Run the tests**

```bash
node --test && node --check model/slug.js && node --check tools/make-model-sql.js
```
Expected: 36 pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add model/slug.js tests/slug.test.js tools/make-model-sql.js
git commit -m "Add shared slug generator for browser and Node

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pure ingest helpers (`model/ingest.js`)

**Files:**
- Create: `model/ingest.js`, `tests/ingest.test.js`

**Interfaces:**
- Produces: `SenkonIngest` (browser global; `module.exports` in Node) with
  `LIMIT_BYTES` (52428800), `THUMB` (`{ width: 480, height: 300, quality: 0.7, mime: 'image/jpeg' }`), `MIME_GLB` (`'model/gltf-binary'`),
  `extensionOf(name) -> 'glb'|'gltf'|'ifc'|'json'|other`,
  `classify(name, bytes) -> { ext, kind: 'file'|'parametric'|null, error: string|null }`,
  `validateName(name) -> string|null`,
  `parseModelJson(text, builder) -> { data, name, description }` (throws Turkish messages),
  `isEmbeddedGltf(text) -> boolean`,
  `storagePath(slug) -> '<slug>/model.glb'`, `publicFileUrl(supabaseUrl, path) -> string`,
  `fileMetadata({ ext, name, bytes, glbBytes, converter, source }) -> { source_format, original_name, original_bytes, glb_bytes, converter, source }`,
  `makeRow({ slug, name, description, kind, data?, metadata? }) -> row for insert`.
- Consumes: `SenkonBuilder.normalize` and `SenkonBuilder.VERSION` (passed in as `builder`).

- [ ] **Step 1: Write the failing tests**

`tests/ingest.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../model/ingest.js');
const B = require('../model/builder.js');

test('classify accepts the four extensions and rejects others', () => {
  assert.deepEqual(I.classify('bina.glb', 100), { ext: 'glb', kind: 'file', error: null });
  assert.deepEqual(I.classify('Bina.GLTF', 100), { ext: 'gltf', kind: 'file', error: null });
  assert.deepEqual(I.classify('bina.ifc', 100), { ext: 'ifc', kind: 'file', error: null });
  assert.deepEqual(I.classify('bina.json', 100), { ext: 'json', kind: 'parametric', error: null });
  assert.equal(I.classify('bina.skp', 100).kind, null);
  assert.match(I.classify('bina.skp', 100).error, /Desteklenmeyen/);
  assert.match(I.classify('bina', 100).error, /Desteklenmeyen/);
});

test('classify enforces the 50 MB limit and refuses empty files', () => {
  assert.equal(I.LIMIT_BYTES, 52428800);
  assert.equal(I.classify('a.glb', 52428800).error, null);
  assert.match(I.classify('a.glb', 52428801).error, /50 MB/);
  assert.match(I.classify('a.glb', 0).error, /boş/);
  assert.match(I.classify('a.glb', undefined).error, /okunamadı/);
});

test('validateName', () => {
  assert.match(I.validateName(''), /gerekli/);
  assert.match(I.validateName('   '), /gerekli/);
  assert.match(I.validateName('x'.repeat(121)), /120/);
  assert.equal(I.validateName('Laboratuvar'), null);
});

test('parseModelJson accepts a bare data sheet and a row-shaped file', () => {
  const bare = JSON.stringify({ v: 1, axes: { x: [0, 6], y: [0, 10] } });
  const p1 = I.parseModelJson(bare, B);
  assert.deepEqual(p1.data.axes, { x: [0, 6], y: [0, 10] }); assert.equal(p1.name, null);
  const row = JSON.stringify({ name: 'Ad', description: 'Açıklama', data: { v: 1, axes: { x: [0, 6], y: [0, 10] } } });
  const p2 = I.parseModelJson(row, B);
  assert.equal(p2.name, 'Ad'); assert.equal(p2.description, 'Açıklama'); assert.ok(p2.data.axes);
});

test('parseModelJson rejects bad input with Turkish messages', () => {
  assert.throws(() => I.parseModelJson('{', B), /JSON okunamadı/);
  assert.throws(() => I.parseModelJson('[1]', B), /nesne/);
  assert.throws(() => I.parseModelJson('{"v":1}', B), /Veri sayfası geçersiz/);
  assert.throws(() => I.parseModelJson('{"v":2,"axes":{"x":[0,1],"y":[0,1]}}', B), /sürümü/);
});

test('isEmbeddedGltf', () => {
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"data:application/octet-stream;base64,AA=="}]}'), true);
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"scene.bin"}]}'), false);
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"data:x;base64,AA=="}],"images":[{"uri":"tex.png"}]}'), false);
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"data:x;base64,AA=="}],"images":[{"bufferView":0}]}'), true);
  assert.equal(I.isEmbeddedGltf('not json'), false);
});

test('storage path and public URL', () => {
  assert.equal(I.storagePath('hwh8zs6h4h7k'), 'hwh8zs6h4h7k/model.glb');
  assert.equal(I.publicFileUrl('https://x.supabase.co/', 'a/model.glb'), 'https://x.supabase.co/storage/v1/object/public/models/a/model.glb');
});

test('fileMetadata and makeRow', () => {
  const meta = I.fileMetadata({ ext: 'ifc', name: 'bina.ifc', bytes: 10, glbBytes: 20, converter: 'web-ifc 0.0.78', source: 'P-01' });
  assert.deepEqual(meta, { source_format: 'ifc', original_name: 'bina.ifc', original_bytes: 10, glb_bytes: 20, converter: 'web-ifc 0.0.78', source: 'P-01' });
  const f = I.makeRow({ slug: 'hwh8zs6h4h7k', name: ' Bina ', description: '', kind: 'file', metadata: meta });
  assert.deepEqual(f, { slug: 'hwh8zs6h4h7k', name: 'Bina', description: null, kind: 'file', data: { metadata: meta }, file_path: 'hwh8zs6h4h7k/model.glb', file_format: 'glb' });
  const p = I.makeRow({ slug: 'hwh8zs6h4h7k', name: 'Lab', description: 'x', kind: 'parametric', data: { v: 1 } });
  assert.deepEqual(p, { slug: 'hwh8zs6h4h7k', name: 'Lab', description: 'x', kind: 'parametric', data: { v: 1 }, file_path: null, file_format: null });
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
node --test
```

- [ ] **Step 3: Write `model/ingest.js`**

```js
/* SenkonIngest: pure decisions for the owner page's "Model ekle" flow: what a chosen file is,
   whether it is allowed, how a .json data sheet is read, where a GLB is stored, and what
   row goes into the models table. No DOM, no network; testable in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SenkonIngest = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LIMIT_BYTES = 50 * 1024 * 1024;
  const KIND_BY_EXT = { glb: 'file', gltf: 'file', ifc: 'file', json: 'parametric' };
  const THUMB = { width: 480, height: 300, quality: 0.7, mime: 'image/jpeg' };
  const MIME_GLB = 'model/gltf-binary';

  function extensionOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function classify(name, bytes) {
    const ext = extensionOf(name), kind = KIND_BY_EXT[ext] || null;
    if (!kind) return { ext, kind, error: 'Desteklenmeyen dosya türü: yalnızca .glb, .gltf, .ifc veya .json' };
    if (typeof bytes !== 'number' || !(bytes >= 0)) return { ext, kind, error: 'Dosya boyutu okunamadı' };
    if (bytes === 0) return { ext, kind, error: 'Dosya boş' };
    if (bytes > LIMIT_BYTES) return { ext, kind, error: 'Dosya 50 MB sınırını aşıyor' };
    return { ext, kind, error: null };
  }
  function validateName(name) {
    const s = String(name || '').trim();
    if (!s) return 'Model adı gerekli';
    if (s.length > 120) return 'Model adı en fazla 120 karakter olabilir';
    return null;
  }
  // A .json upload is either a row-shaped object { name, description, data } or a bare data sheet.
  function parseModelJson(text, builder) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('JSON okunamadı'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON bir nesne olmalı');
    const rowShaped = !!(obj.data && typeof obj.data === 'object' && !obj.axes);
    const data = rowShaped ? obj.data : obj;
    if ((data.v || 1) > builder.VERSION) throw new Error('Model sürümü desteklenmiyor');
    try { builder.normalize(data); } catch (e) { throw new Error('Veri sayfası geçersiz: ' + e.message); }
    return {
      data,
      name: rowShaped && typeof obj.name === 'string' ? obj.name : null,
      description: rowShaped && typeof obj.description === 'string' ? obj.description : null
    };
  }
  // Only a self-contained .gltf is accepted (buffers and images embedded as data URIs).
  function isEmbeddedGltf(text) {
    let g;
    try { g = JSON.parse(text); } catch (e) { return false; }
    if (!g || !Array.isArray(g.buffers)) return false;
    const isData = u => typeof u === 'string' && u.slice(0, 5) === 'data:';
    return g.buffers.every(b => b && isData(b.uri)) && (g.images || []).every(i => i && (i.bufferView !== undefined || isData(i.uri)));
  }
  const storagePath = slug => slug + '/model.glb';
  const publicFileUrl = (supabaseUrl, path) => String(supabaseUrl).replace(/\/$/, '') + '/storage/v1/object/public/models/' + path;
  function fileMetadata(o) {
    return { source_format: o.ext, original_name: o.name, original_bytes: o.bytes, glb_bytes: o.glbBytes, converter: o.converter || null, source: o.source || null };
  }
  function makeRow(o) {
    const row = { slug: o.slug, name: String(o.name).trim(), description: o.description && String(o.description).trim() ? String(o.description).trim() : null, kind: o.kind };
    if (o.kind === 'parametric') { row.data = o.data; row.file_path = null; row.file_format = null; }
    else { row.data = { metadata: o.metadata }; row.file_path = storagePath(o.slug); row.file_format = 'glb'; }
    return row;
  }
  return { LIMIT_BYTES, THUMB, MIME_GLB, extensionOf, classify, validateName, parseModelJson, isEmbeddedGltf, storagePath, publicFileUrl, fileMetadata, makeRow };
});
```

- [ ] **Step 4: Run the tests**

```bash
node --test && node --check model/ingest.js
```
Expected: 44 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add model/ingest.js tests/ingest.test.js
git commit -m "Add pure ingest helpers for the owner page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Database and storage setup for Stage 2

**Files:**
- Create: `docs/model/schema-stage2.sql`
- Modify: `docs/superpowers/specs/2026-10-08-stage2-uploads-design.md` (section 5 SQL block), `docs/model/README.md`

**Interfaces:**
- Produces: column `public.models.thumbnail text`; bucket `models` (public, 50 MB, GLB only); storage policies allowing any authenticated user (there is exactly one, sign-ups are closed) to insert, update, delete and select objects in that bucket. Anonymous callers can still fetch an object by exact path (public bucket) but cannot list.

- [ ] **Step 1: Write `docs/model/schema-stage2.sql`**

```sql
-- SENKON model viewer, Stage 2: preview column and the storage bucket for uploaded GLB files.
-- Run once in the Supabase SQL editor, after schema.sql.

alter table public.models add column if not exists thumbnail text;   -- JPEG data URL, about 30-60 KB

-- Public bucket: anyone with the exact path can fetch a file; nobody can list the bucket
-- because there is no select policy for anon on storage.objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('models', 'models', true, 52428800, array['model/gltf-binary'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800, allowed_mime_types = array['model/gltf-binary'];

-- The owner (the only authenticated user; sign-ups are disabled) may manage objects in the bucket.
create policy models_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'models');
create policy models_bucket_update on storage.objects for update to authenticated
  using (bucket_id = 'models') with check (bucket_id = 'models');
create policy models_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'models');
create policy models_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'models');
```

- [ ] **Step 2: Align the spec's SQL block**

In `docs/superpowers/specs/2026-10-08-stage2-uploads-design.md` section 5, replace the four `storage.objects` policies (the ones using `owner = auth.uid()`) with the four from Step 1 and add the sentence: "Policies are per bucket, not per owner: the project has exactly one user and sign-ups are closed, and Supabase's `owner` column on `storage.objects` is deprecated in favour of `owner_id`."

- [ ] **Step 3: Extend the README**

Append to `docs/model/README.md`:
```markdown
## Stage 2 setup (once)

1. SQL editor: run `docs/model/schema-stage2.sql` (preview column, `models` bucket, bucket policies).
2. Open `https://senkonmuhendislik.com/model/panel.html`, sign in with the owner e-mail and password.

## Adding a model

"Model ekle" on the owner page: name, optional description and source reference, and a file:
- `.glb` or self-contained `.gltf` (SketchUp: File > Export > 3D Model > glTF/GLB),
- `.ifc` (Revit, Tekla): converted to GLB in your browser; large models take a while,
- `.json` data sheet (parametric, like the laboratory model).
The card shows the link; "Bağlantıyı kopyala" copies it. "Dosyayı değiştir" keeps the link and
swaps the file. "Sil" removes the file and the row; the link then shows "Model bulunamadı".
Limit: 50 MB per file. The IFC file itself never leaves your computer.
```

- [ ] **Step 4: Commit**

```bash
node --test
git add docs/model/schema-stage2.sql docs/model/README.md docs/superpowers/specs/2026-10-08-stage2-uploads-design.md
git commit -m "Add Stage 2 schema: thumbnail column, models bucket and policies

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Viewer file mode and the public page's file path

**Files:**
- Modify: `model/viewer.js`, `model/index.html`, `model/viewer.css`
- Create (gitignored): `local/Box.glb`, `local/box-row.json`

**Interfaces:**
- Consumes: `THREE.GLTFLoader` (Task 1), the Stage 1 viewer internals.
- Produces: `SenkonViewer.mountFile(container, object3D, opts) -> handle` (same handle as `mount`); `mount`/`rebuild` accept a `THREE.Object3D` in place of a model object; `built()` for a file returns `{ v: 0, items: [], snaps: [], layers: [{ key: 'model', ... button: false }], center: [x, z], size, levels: {}, model: null, up }`. The shell renders `kind = 'file'` rows by fetching `publicFileUrl` (or a dev-only `row.file_url` on localhost) with progress and calling `mountFile`.

- [ ] **Step 1: Add file mode to `model/viewer.js`**

(a) In `build(m)`, replace its first lines so it branches on an Object3D:
```js
    function build(m) {
      if (m && m.isObject3D) { clear(); buildObject(m); return; }
      const next = SenkonBuilder.build(m); clear(); built = next; built.up = 2.6; snaps = built.snaps.map(V);
```
(keep the rest of `build` as it is), and add after it:
```js
    // File mode: an already-built three.js object (a loaded GLB scene). No builder, no snaps,
    // one always-on layer. The orbit target is the bounding-box centre.
    function buildObject(obj) {
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) throw new Error('empty model');
      const size = new THREE.Vector3(), c = new THREE.Vector3(); box.getSize(size); box.getCenter(c);
      built = { v: 0, items: [], snaps: [], layers: [{ key: 'model', label: 'Model', visible: true, button: false }],
        center: [c.x, c.z], size: Math.max(size.x, size.y, size.z), levels: {}, model: null, up: c.y,
        bounds: { min: box.min.toArray(), max: box.max.toArray() } };
      snaps = [];
      const g = new THREE.Group(); g.name = 'model'; g.visible = true; G.model = g; g.add(obj); rootG.add(g);
      tgt.set(c.x, c.y, c.z);
      fitTags();
    }
```
(b) In `setView`, change the target line to `if (built) tgt.set(built.center[0], built.up !== undefined ? built.up : 2.6, built.center[1]);`.
(c) In `pickAt`, support material arrays: replace the traverse callback with
```js
      rootG.traverse(o => { const mat = Array.isArray(o.material) ? o.material[0] : o.material; if (o.isMesh && mat && !mat.transparent && shown(o)) list.push(o); });
```
(d) In `shot`, replace `const c = built.center, ol = built.model.outline;` with `const c = built.center, ol = built.model ? built.model.outline : { x: built.size, y: built.size };`.
(e) Export the new entry point: change the last line to `root.SenkonViewer = { mount: mount, mountFile: function (container, object, opts) { return mount(container, object, opts); } };`.

Run `node --check model/viewer.js`.

- [ ] **Step 2: Rewrite the shell script in `model/index.html`**

Replace the whole inline `<script>` at the end of `model/index.html` with:
```html
<script>
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = $('state'), C = window.SENKON_CONFIG || {};
  const q = new URLSearchParams(location.search), slug = (q.get('m') || '').trim();
  const SLUG_RE = /^[a-z0-9]{8,32}$/, PATH_RE = /^[a-z0-9]{8,32}\/[A-Za-z0-9._-]+$/;
  const FIXED = 'Ön tasarım modelidir, uygulama için değildir. Ölçüler metre, aks–aks; kotlar çelik üst kotudur.';
  const dev = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) >= 0;

  function show(msg, retry) {
    state.hidden = false; state.innerHTML = '';
    const p = document.createElement('p'); p.textContent = msg; state.appendChild(p);
    if (retry) { const b = document.createElement('button'); b.textContent = 'Tekrar dene'; b.onclick = () => location.reload(); state.appendChild(b); }
  }
  function progress(msg) { state.hidden = false; const p = state.querySelector('p') || state.appendChild(document.createElement('p')); p.textContent = msg; }
  function hasWebGL() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
    catch (e) { return false; }
  }
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script ' + src)); document.head.appendChild(s); });
  }
  async function fetchWithProgress(url, onProgress) {
    const r = await fetch(url); if (!r.ok) throw new Error('http ' + r.status);
    const total = +r.headers.get('content-length') || 0;
    if (!r.body || !total) return await r.arrayBuffer();
    const reader = r.body.getReader(), chunks = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(got / total); }
    const out = new Uint8Array(got); let o = 0; chunks.forEach(c => { out.set(c, o); o += c.length; });
    return out.buffer;
  }
  async function load() {
    const src = q.get('src');
    if (src && dev) { const r = await fetch(src); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
    if (!SLUG_RE.test(slug)) return null;
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) throw new Error('config');
    const r = await fetch(C.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/get_model', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY }, body: JSON.stringify({ p_slug: slug })
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }
  // Shared wiring once a viewer handle exists: status line, buttons, menu, still-render hook.
  function wire(v, row, source) {
    state.hidden = true; document.body.classList.add('ready');
    const d = row.updated_at ? new Date(row.updated_at) : null, when = d && !isNaN(d) ? d.toLocaleDateString('tr-TR') : '';
    $('note').textContent = FIXED + (source ? ' Kaynak: ' + source + '.' : '') + (when ? ' Güncelleme ' + when + '.' : '');
    document.querySelectorAll('[data-layer]').forEach(b => {
      const l = v.layers.find(x => x.key === b.dataset.layer && x.button);
      if (!l) { b.hidden = true; return; }
      b.setAttribute('aria-pressed', String(l.visible));
      b.onclick = () => b.setAttribute('aria-pressed', String(v.setLayer(l.key, b.getAttribute('aria-pressed') !== 'true')));
    });
    document.querySelectorAll('.row').forEach(r => { if (r.querySelectorAll('button:not([hidden])').length === 0) r.hidden = true; });
    document.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => v.setView(b.dataset.view); });
    const measBtn = $('meas'), read = $('read');
    measBtn.onclick = () => {
      const on = measBtn.getAttribute('aria-pressed') !== 'true';
      measBtn.setAttribute('aria-pressed', String(on)); document.body.classList.toggle('measuring', on);
      read.hidden = !on; read.textContent = 'Yapı veya zemin üzerinde iki noktaya dokunun'; v.setMeasuring(on);
    };
    v.onMeasure(r => {
      if (!r) return;
      if (r.pending) read.textContent = 'İkinci noktaya dokunun';
      else read.innerHTML = '<b>' + r.d.toFixed(2) + ' m</b><br>yatay ' + r.hz.toFixed(2) + ' m, düşey ' + r.vt.toFixed(2) + ' m';
    });
    const menu = $('menu');
    if (matchMedia('(max-width:640px)').matches) document.body.classList.add('compact');
    menu.onclick = () => { const c = document.body.classList.toggle('compact'); menu.setAttribute('aria-expanded', String(!c)); menu.textContent = c ? 'Seçenekler' : 'Kapat'; };
    window.__shot = o => { document.body.classList.add('shot'); v.shot(o); };
    v.resize();
  }
  function header(row) {
    const name = typeof row.name === 'string' && row.name ? row.name : '3B model';
    document.title = name + ' – SENKON';
    $('title').textContent = name; $('desc').textContent = typeof row.description === 'string' ? row.description : '';
  }
  function renderParametric(row) {
    const data = row.data || {};
    if ((data.v || 1) > SenkonBuilder.VERSION) return show('Model sürümü desteklenmiyor');
    if (!hasWebGL()) return show('Tarayıcınız 3B görüntülemeyi desteklemiyor');
    let v;
    try { v = SenkonViewer.mount($('stage'), data); }
    catch (e) { console.error(e); return show('Model çizilemedi'); }
    wire(v, row, data.source ? 'mimari plan ' + data.source : '');
  }
  async function renderFile(row) {
    if (!hasWebGL()) return show('Tarayıcınız 3B görüntülemeyi desteklemiyor');
    const url = dev && row.file_url ? row.file_url : (PATH_RE.test(row.file_path || '') ? C.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/models/' + row.file_path : null);
    if (!url) return show('Model dosyası bulunamadı');
    let v;
    try {
      progress('Model yükleniyor…');
      await loadScript('vendor/GLTFLoader.r128.js');
      const buf = await fetchWithProgress(url, p => progress('Model yükleniyor… ' + Math.round(p * 100) + ' %'));
      const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', res, rej));
      v = SenkonViewer.mountFile($('stage'), gltf.scene);
    } catch (e) {
      console.error(e);
      const net = e && /^(http |script |Failed to fetch|NetworkError)/.test(e.message || '');
      return show(net ? 'Model yüklenemedi, lütfen tekrar deneyin' : 'Model dosyası okunamadı', net);
    }
    document.body.classList.add('file');
    const meta = row.data && row.data.metadata ? row.data.metadata : {};
    wire(v, row, meta.source || '');
  }
  function render(row) {
    header(row);
    if (row.kind === 'parametric') return renderParametric(row);
    if (row.kind === 'file') return renderFile(row);
    return show('Bu model türü henüz desteklenmiyor');
  }
  load().then(row => { if (!row) return show('Model bulunamadı'); return render(row); })
    .catch(e => { console.error(e); if (e.message === 'config') show('Yapılandırma eksik: model/config.js dosyasını doldurun'); else show('Model yüklenemedi, lütfen tekrar deneyin', true); });
})();
</script>
```
Also change the legend markup: wrap the existing `<ul>` in nothing new, but add after it `<p id="legendFile" class="file-only">Yüklenmiş 3B model. Renkler kaynak dosyadan gelir.</p>`.

- [ ] **Step 3: CSS for file mode**

Append to `model/viewer.css`:
```css
.file-only{display:none;margin:0;font-size:12.5px}
body.file #legend ul{display:none} body.file .file-only{display:block}
```

- [ ] **Step 4: Browser verification with a sample GLB**

```bash
curl -sSL -o local/Box.glb https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb
printf '{"name":"Kutu","description":"Örnek GLB","kind":"file","file_path":"abcdefghjkmn/model.glb","file_url":"../local/Box.glb","updated_at":"2026-10-08T00:00:00Z","data":{"metadata":{"source":"Khronos örnek"}}}\n' > local/box-row.json
```
Serve the repo root (`site` preview or `python -m http.server 8080 --bind 127.0.0.1`) and open `http://127.0.0.1:8080/model/?src=../local/box-row.json`. Check: the box renders centred; the "Göster" and "Ölçü" rows show only "Mesafe ölç" (no layer buttons); the legend shows the file sentence; the status line reads the fixed sentence, "Kaynak: Khronos örnek." and the date; views Genel/Batı/Güney/Plan work; measuring between two box corners gives about 2.00 m (the sample box is 2 units wide); phone width shows the compact layout and the status strip. Then open `http://127.0.0.1:8080/model/?src=../local/lab-model.json` and confirm the parametric page is unchanged (layer buttons present, dimensions drawn). No console errors in either.

- [ ] **Step 5: Tests and commit**

```bash
node --test && node --check model/viewer.js
git add model/viewer.js model/index.html model/viewer.css
git commit -m "Viewer: file mode for uploaded GLB models; shell loads files with progress

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: IFC to GLB conversion in the browser (`model/ifc2glb.js`)

**Files:**
- Create: `model/ifc2glb.js`
- Create (gitignored): `local/IfcOpenHouse_IFC4.ifc`, `local/ifc-test.html`

**Interfaces:**
- Consumes: `WebIFC` (loaded on demand from `vendor/web-ifc/`), `THREE`, `THREE.GLTFExporter`.
- Produces: `SenkonIfc.convert(arrayBuffer, { wasmPath?: string, onProgress?: (meshes, total) => void }) -> Promise<{ glb: ArrayBuffer, scene: THREE.Group, version: string, stats: { meshes, groups, types } }>` and `SenkonIfc.VERSION` (`'0.0.78'`). The scene has one child group per IFC entity type name (for example `IFCCOLUMN`), each holding one mesh per colour, Y-up, metres.

- [ ] **Step 1: Write `model/ifc2glb.js`**

```js
/* SenkonIfc: converts an IFC file to a GLB in the owner's browser using web-ifc (WASM).
   Geometry is merged per (entity type, colour) into one mesh each, grouped by type, so the
   result stays light for phones. web-ifc returns metres and Y-up coordinates. Loads the
   vendored web-ifc bundle on first use. Browser only. */
(function (root) {
  'use strict';
  const VERSION = '0.0.78';
  let apiPromise = null;

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('web-ifc yüklenemedi')); document.head.appendChild(s); });
  }
  async function getApi(wasmPath) {
    if (!apiPromise) apiPromise = (async () => {
      if (typeof WebIFC === 'undefined') await loadScript(wasmPath + 'web-ifc-api-iife.js');
      const api = new WebIFC.IfcAPI();
      api.SetWasmPath(wasmPath, true);
      await api.Init();
      return api;
    })();
    return apiPromise;
  }
  function colourKey(c) { return [c.x, c.y, c.z, c.w].map(v => v.toFixed(3)).join(','); }

  async function convert(buffer, opts) {
    opts = opts || {};
    const api = await getApi(opts.wasmPath || 'vendor/web-ifc/');
    const modelID = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true });
    if (modelID < 0) throw new Error('IFC dosyası okunamadı');
    try {
      const groups = new Map();   // "type|colour" -> { type, color, pos[], nor[], idx[], count }
      let meshes = 0;
      const m4 = new THREE.Matrix4(), m3 = new THREE.Matrix3(), v = new THREE.Vector3();
      api.StreamAllMeshes(modelID, mesh => {
        meshes++;
        if (opts.onProgress && meshes % 25 === 0) opts.onProgress(meshes, 0);
        let typeName = 'IFCELEMENT';
        try { typeName = api.GetNameFromTypeCode(api.GetLineType(modelID, mesh.expressID)) || typeName; } catch (e) { /* unknown type: keep default */ }
        const n = mesh.geometries.size();
        for (let i = 0; i < n; i++) {
          const pg = mesh.geometries.get(i);
          const geom = api.GetGeometry(modelID, pg.geometryExpressID);
          const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());   // x y z nx ny nz per vertex
          const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
          m4.fromArray(pg.flatTransformation); m3.getNormalMatrix(m4);
          const key = typeName + '|' + colourKey(pg.color);
          let g = groups.get(key);
          if (!g) { g = { type: typeName, color: pg.color, pos: [], nor: [], idx: [], count: 0 }; groups.set(key, g); }
          const base = g.count;
          for (let k = 0; k < verts.length; k += 6) {
            v.set(verts[k], verts[k + 1], verts[k + 2]).applyMatrix4(m4); g.pos.push(v.x, v.y, v.z);
            v.set(verts[k + 3], verts[k + 4], verts[k + 5]).applyMatrix3(m3).normalize(); g.nor.push(v.x, v.y, v.z);
          }
          for (let k = 0; k < idx.length; k++) g.idx.push(idx[k] + base);
          g.count += verts.length / 6;
          geom.delete();
        }
      });
      if (!groups.size) throw new Error('IFC dosyasında geometri bulunamadı');
      const scene = new THREE.Group(); scene.name = 'ifc';
      const byType = new Map();
      groups.forEach(g => {
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
        bg.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
        bg.setIndex(g.idx);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(g.color.x, g.color.y, g.color.z), roughness: 0.8, metalness: 0.1,
          transparent: g.color.w < 1, opacity: g.color.w, side: THREE.DoubleSide });
        let parent = byType.get(g.type);
        if (!parent) { parent = new THREE.Group(); parent.name = g.type; byType.set(g.type, parent); scene.add(parent); }
        parent.add(new THREE.Mesh(bg, mat));
      });
      if (opts.onProgress) opts.onProgress(meshes, meshes);
      const glb = await new Promise((res, rej) => { try { new THREE.GLTFExporter().parse(scene, res, { binary: true }); } catch (e) { rej(e); } });
      return { glb, scene, version: VERSION, stats: { meshes, groups: groups.size, types: byType.size } };
    } finally {
      api.CloseModel(modelID);
    }
  }
  root.SenkonIfc = { convert, VERSION };
})(window);
```

- [ ] **Step 2: Browser check with a public sample IFC**

```bash
curl -sSL -o local/IfcOpenHouse_IFC4.ifc https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/IfcOpenHouse_IFC4.ifc
ls -l local/IfcOpenHouse_IFC4.ifc    # about 253 KB
```
Write `local/ifc-test.html` (gitignored throwaway):
```html
<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>ifc test</title><link rel="stylesheet" href="../model/viewer.css"></head>
<body><div id="stage"></div><pre id="out" style="position:absolute;top:8px;left:8px;background:#fff8;padding:6px"></pre>
<script src="../model/vendor/three.r128.min.js"></script><script src="../model/vendor/GLTFLoader.r128.js"></script><script src="../model/vendor/GLTFExporter.r128.js"></script>
<script src="../model/builder.js"></script><script src="../model/viewer.js"></script><script src="../model/ifc2glb.js"></script>
<script>
(async () => {
  const out = document.getElementById('out'), log = s => { out.textContent += s + '\n'; };
  const t0 = performance.now();
  const buf = await (await fetch('IfcOpenHouse_IFC4.ifc')).arrayBuffer();
  const r = await SenkonIfc.convert(buf, { wasmPath: '../model/vendor/web-ifc/', onProgress: (d, t) => log('progress ' + d + '/' + t) });
  log('stats ' + JSON.stringify(r.stats) + ' glb ' + r.glb.byteLength + ' bytes in ' + Math.round(performance.now() - t0) + ' ms');
  const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(r.glb, '', res, rej));
  const v = SenkonViewer.mountFile(document.getElementById('stage'), gltf.scene);
  const b = v.built(); log('bounds ' + JSON.stringify(b.bounds) + ' size ' + b.size.toFixed(2));
  window.__v = v;
})().catch(e => { document.getElementById('out').textContent = 'ERROR ' + e.message; console.error(e); });
</script></body></html>
```
Serve the repo root and open `http://127.0.0.1:8080/local/ifc-test.html`. Expected: a small house renders (walls, roof, slab, window and door openings); `stats` reports a few dozen meshes and several types; `bounds` has a Y extent of a few metres and X/Z extents of about 10 metres (the open house is roughly 10 × 8 × 6 m); conversion well under 10 s; no console errors. If the house appears lying on its side (Y extent about 10, Z extent small), web-ifc did not deliver Y-up: then add, in `convert`, before export, `scene.rotation.x = -Math.PI / 2; scene.updateMatrixWorld(true);` and record that in the spec's open point 9.2 as resolved.

- [ ] **Step 3: Commit**

```bash
node --check model/ifc2glb.js && node --test
git add model/ifc2glb.js
git commit -m "Add in-browser IFC to GLB conversion with web-ifc

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Owner page (`model/panel.html`, `panel.css`, `panel.js`)

**Files:**
- Create: `model/panel.html`, `model/panel.css`, `model/panel.js`

**Interfaces:**
- Consumes: `supabase.createClient`, `SenkonSlug.randomSlug`, `SenkonIngest.*`, `SenkonIfc.convert`, `SenkonViewer.mount`/`mountFile`, `SenkonBuilder`, `THREE.GLTFLoader`/`GLTFExporter`, `window.SENKON_CONFIG`.
- Produces: the owner page. Supabase calls: `auth.getSession`, `auth.signInWithPassword`, `auth.signOut`, `auth.onAuthStateChange`; `from('models').select('id,slug,name,description,kind,file_path,updated_at,thumbnail')`, `.insert(row).select('id').single()`, `.update({...}).eq('id', id)`, `.delete().eq('id', id)`; `storage.from('models').upload(path, blob, { contentType, upsert: true })`, `.remove([path])`.

- [ ] **Step 1: Write `model/panel.html`**

```html
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Modeller – SENKON</title>
<link rel="stylesheet" href="viewer.css">
<link rel="stylesheet" href="panel.css">
</head>
<body class="panel">
<header id="top">
  <h1>Modeller</h1>
  <div id="topActions" hidden><button id="add">Model ekle</button><button id="logout">Çıkış</button></div>
</header>
<main>
  <p id="state">Yükleniyor…</p>
  <section id="login" class="card" hidden>
    <h2>Giriş</h2>
    <form id="loginForm" novalidate>
      <label>E-posta <input id="email" type="email" autocomplete="username" required></label>
      <label>Şifre <input id="password" type="password" autocomplete="current-password" required></label>
      <button type="submit" id="loginBtn">Giriş</button>
      <p id="loginMsg" class="msg" role="alert"></p>
    </form>
  </section>
  <section id="list" hidden>
    <p id="empty" hidden>Henüz model yok. "Model ekle" ile başlayın.</p>
    <div id="cards"></div>
  </section>
</main>
<dialog id="addDlg">
  <form id="addForm" novalidate>
    <h2 id="addTitle">Model ekle</h2>
    <label>Ad <input id="mName" maxlength="120"></label>
    <label>Açıklama <textarea id="mDesc" rows="2"></textarea></label>
    <label>Kaynak (çizim no, tarih) <input id="mSource"></label>
    <label>Dosya (.glb, .gltf, .ifc, .json) <input id="mFile" type="file" accept=".glb,.gltf,.ifc,.json"></label>
    <p id="addMsg" class="msg" role="alert"></p>
    <progress id="addProg" max="1" value="0" hidden></progress>
    <p id="addStep" class="step"></p>
    <div class="actions"><button type="button" id="addCancel">Vazgeç</button><button type="submit" id="addOk">Ekle</button></div>
  </form>
</dialog>
<dialog id="delDlg">
  <p>Bu modeli silmek istediğinize emin misiniz?</p>
  <p id="delName"></p>
  <p id="delMsg" class="msg" role="alert"></p>
  <div class="actions"><button id="delCancel">Vazgeç</button><button id="delOk" class="danger">Sil</button></div>
</dialog>
<div id="thumbStage" aria-hidden="true"></div>
<template id="cardT">
  <article class="mcard">
    <img alt="">
    <div class="body">
      <h3></h3>
      <p class="meta"></p>
      <div class="btns">
        <a class="open" target="_blank" rel="noopener">Aç</a>
        <button class="copy">Bağlantıyı kopyala</button>
        <button class="replace">Dosyayı değiştir</button>
        <button class="del danger">Sil</button>
      </div>
    </div>
  </article>
</template>
<script src="vendor/three.r128.min.js"></script>
<script src="vendor/GLTFLoader.r128.js"></script>
<script src="vendor/GLTFExporter.r128.js"></script>
<script src="vendor/supabase-js.v2.117.3.min.js"></script>
<script src="config.js"></script>
<script src="builder.js"></script>
<script src="viewer.js"></script>
<script src="slug.js"></script>
<script src="ingest.js"></script>
<script src="ifc2glb.js"></script>
<script src="panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `model/panel.css`**

```css
body.panel{overflow:auto;padding:0 16px calc(24px + env(safe-area-inset-bottom,0px))}
#top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid var(--line);margin-bottom:16px}
#top h1{font-size:18px;margin:0;font-weight:650}
#topActions{display:flex;gap:8px}
main{max-width:1100px;margin:0 auto}
#state{color:var(--muted)}
#login{position:static;max-width:360px;margin:40px auto}
#login h2, #addDlg h2{font-size:16px;margin:0 0 10px}
label{display:block;font-size:12.5px;color:var(--muted);margin:8px 0}
input,textarea{display:block;width:100%;margin-top:4px;font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:7px 9px}
input[type=file]{padding:4px 0;border:0;background:transparent}
.msg{color:#c62828;font-size:12.5px;min-height:1.2em;margin:6px 0 0}
.step{color:var(--muted);font-size:12.5px;margin:4px 0 0}
progress{width:100%;margin-top:8px}
#cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.mcard{background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.mcard img{display:block;width:100%;aspect-ratio:8/5;object-fit:cover;background:var(--line)}
.mcard img.none{opacity:.35}
.mcard .body{padding:10px 12px 12px}
.mcard h3{font-size:14.5px;margin:0 0 2px;font-weight:650}
.mcard .meta{margin:0 0 8px;color:var(--muted);font-size:12px}
.btns{display:flex;flex-wrap:wrap;gap:6px}
.btns a{font-size:12.5px;color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:4px;padding:5px 9px}
button.danger{border-color:#c62828;color:#c62828}
button:disabled{opacity:.5;cursor:default}
dialog{border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);padding:16px 18px;width:min(420px,calc(100vw - 32px))}
dialog::backdrop{background:#0006}
.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
#thumbStage{position:fixed;left:-9999px;top:0;width:480px;height:300px;pointer-events:none}
#empty{color:var(--muted)}
```

- [ ] **Step 3: Write `model/panel.js`**

```js
/* Owner page: login, model list with previews, add / replace / delete. Writes go through
   supabase-js with the owner's session; files go to the "models" bucket as GLB. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = window.SENKON_CONFIG || {}, I = SenkonIngest;
  const SITE = 'https://senkonmuhendislik.com/model/?m=';
  const state = $('state');
  let sb = null, models = [], replacing = null, delTarget = null;

  const say = (el, msg) => { el.textContent = msg || ''; };
  const step = (text, p) => { $('addStep').textContent = text; if (p !== undefined) $('addProg').value = p; };
  const busy = on => { $('addOk').disabled = on; $('addCancel').disabled = on; $('mFile').disabled = on; $('addProg').hidden = !on; if (!on) step(''); };

  // ---- auth
  async function init() {
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) { state.textContent = 'Yapılandırma eksik: config.js'; return; }
    sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    showAuth(!!data.session);
    sb.auth.onAuthStateChange((event, session) => { if (event !== 'INITIAL_SESSION') showAuth(!!session); });
  }
  function showAuth(on) {
    state.hidden = true; $('login').hidden = on; $('list').hidden = !on; $('topActions').hidden = !on;
    if (on) refresh(); else { models = []; $('cards').innerHTML = ''; }
  }
  $('loginForm').onsubmit = async e => {
    e.preventDefault(); say($('loginMsg'), '');
    const email = $('email').value.trim(), password = $('password').value;
    if (!email || !password) return say($('loginMsg'), 'E-posta ve şifre gerekli');
    $('loginBtn').disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    $('loginBtn').disabled = false;
    if (error) say($('loginMsg'), /invalid|credentials/i.test(error.message) ? 'E-posta veya şifre hatalı' : 'Bağlantı kurulamadı, tekrar deneyin');
    else $('password').value = '';
  };
  $('logout').onclick = () => sb.auth.signOut();

  // ---- list
  async function refresh() {
    const { data, error } = await sb.from('models').select('id,slug,name,description,kind,file_path,updated_at,thumbnail').order('updated_at', { ascending: false });
    if (error) { state.hidden = false; state.textContent = 'Liste alınamadı: ' + error.message; return; }
    models = data || []; draw();
  }
  function draw() {
    const cards = $('cards'); cards.innerHTML = ''; $('empty').hidden = models.length > 0;
    models.forEach(m => {
      const n = $('cardT').content.cloneNode(true), img = n.querySelector('img');
      if (m.thumbnail) img.src = m.thumbnail; else img.classList.add('none');
      n.querySelector('h3').textContent = m.name;
      n.querySelector('.meta').textContent = (m.kind === 'file' ? 'Dosya' : 'Parametrik') + ' · ' + new Date(m.updated_at).toLocaleDateString('tr-TR');
      n.querySelector('.open').href = './?m=' + encodeURIComponent(m.slug);
      n.querySelector('.copy').onclick = ev => copyLink(ev.currentTarget, m.slug);
      const rep = n.querySelector('.replace'); if (m.kind !== 'file') rep.hidden = true; else rep.onclick = () => openAdd(m);
      n.querySelector('.del').onclick = () => askDelete(m);
      cards.appendChild(n);
    });
  }
  async function copyLink(btn, slug) {
    const link = SITE + slug;
    try { await navigator.clipboard.writeText(link); const t = btn.textContent; btn.textContent = 'Kopyalandı'; setTimeout(() => { btn.textContent = t; }, 1500); }
    catch (e) { window.prompt('Bağlantı:', link); }
  }

  // ---- add / replace
  $('add').onclick = () => openAdd(null);
  function openAdd(m) {
    replacing = m;
    $('addTitle').textContent = m ? 'Dosyayı değiştir: ' + m.name : 'Model ekle';
    $('mName').value = m ? m.name : ''; $('mName').disabled = !!m;
    $('mDesc').value = m ? (m.description || '') : ''; $('mDesc').disabled = !!m;
    $('mSource').value = ''; $('mFile').value = ''; $('mFile').accept = m ? '.glb,.gltf,.ifc' : '.glb,.gltf,.ifc,.json';
    $('addOk').textContent = m ? 'Değiştir' : 'Ekle';
    say($('addMsg'), ''); step(''); $('addProg').hidden = true; $('addProg').value = 0;
    $('addDlg').showModal();
  }
  $('addCancel').onclick = () => $('addDlg').close();
  $('addForm').onsubmit = async e => {
    e.preventDefault(); say($('addMsg'), '');
    const file = $('mFile').files[0];
    const nameErr = replacing ? null : I.validateName($('mName').value);
    if (nameErr) return say($('addMsg'), nameErr);
    if (!file) return say($('addMsg'), 'Dosya seçin');
    const cls = I.classify(file.name, file.size);
    if (cls.error) return say($('addMsg'), cls.error);
    if (replacing && cls.kind !== 'file') return say($('addMsg'), 'Değiştirmek için bir 3B dosya seçin (.glb, .gltf, .ifc)');
    busy(true);
    try {
      if (replacing) await replaceModel(replacing, file, cls); else await addModel(file, cls);
      busy(false); $('addDlg').close(); await refresh();
    } catch (err) { console.error(err); busy(false); say($('addMsg'), err.message || 'İşlem başarısız'); }
  };
  const parseGltf = input => new Promise((res, rej) => new THREE.GLTFLoader().parse(input, '', res, () => rej(new Error('Model dosyası okunamadı'))));
  const exportGlb = scene => new Promise((res, rej) => { try { new THREE.GLTFExporter().parse(scene, res, { binary: true }); } catch (e) { rej(e); } });
  // Turn the chosen file into { glb, scene, converter }.
  async function toGlb(file, cls) {
    step('Okunuyor', 0.1);
    const buf = await file.arrayBuffer();
    if (cls.ext === 'glb') { const gltf = await parseGltf(buf); return { glb: buf, scene: gltf.scene, converter: null }; }
    if (cls.ext === 'gltf') {
      const text = new TextDecoder().decode(buf);
      if (!I.isEmbeddedGltf(text)) throw new Error('Yalnızca tek dosyalı .glb veya gömülü .gltf yüklenebilir');
      const gltf = await parseGltf(text);
      step('Dönüştürülüyor', 0.4);
      return { glb: await exportGlb(gltf.scene), scene: gltf.scene, converter: 'three r128 GLTFExporter' };
    }
    step('Dönüştürülüyor', 0.3);
    const r = await SenkonIfc.convert(buf, { wasmPath: 'vendor/web-ifc/', onProgress: (d, t) => step('Dönüştürülüyor: ' + d + (t ? ' / ' + t : '') + ' eleman', t ? 0.3 + 0.3 * d / t : 0.4) });
    if (r.glb.byteLength > I.LIMIT_BYTES) throw new Error('Dönüştürülen model çok büyük (' + Math.round(r.glb.byteLength / 1048576) + ' MB). Modeli sadeleştirin veya bilgisayarda GLB olarak dışa aktarın.');
    return { glb: r.glb, scene: r.scene, converter: 'web-ifc ' + r.version };
  }
  async function upload(path, glb) {
    step('Yükleniyor', 0.7);
    const { error } = await sb.storage.from('models').upload(path, new Blob([glb], { type: I.MIME_GLB }), { contentType: I.MIME_GLB, upsert: true });
    if (error) throw new Error('Yükleme başarısız: ' + error.message);
  }
  // Render once in the hidden 480x300 stage and capture a JPEG. Returns null on failure.
  function thumbnail(mountFn) {
    step('Önizleme', 0.9);
    const st = $('thumbStage'); let v = null;
    try { v = mountFn(st); v.setView('iso'); v.draw(); return st.querySelector('canvas').toDataURL(I.THUMB.mime, I.THUMB.quality); }
    catch (e) { console.warn('thumbnail failed', e); return null; }
    finally { if (v) v.dispose(); }
  }
  async function addModel(file, cls) {
    const slug = SenkonSlug.randomSlug(), name = $('mName').value, description = $('mDesc').value, source = $('mSource').value.trim();
    let row, mountFn;
    if (cls.kind === 'parametric') {
      const p = I.parseModelJson(await file.text(), SenkonBuilder);
      if (source) p.data.source = source;
      row = I.makeRow({ slug, name, description: description || p.description, kind: 'parametric', data: p.data });
      mountFn = st => SenkonViewer.mount(st, p.data, { compact: false });
    } else {
      const g = await toGlb(file, cls);
      await upload(I.storagePath(slug), g.glb);
      row = I.makeRow({ slug, name, description, kind: 'file', metadata: I.fileMetadata({ ext: cls.ext, name: file.name, bytes: file.size, glbBytes: g.glb.byteLength, converter: g.converter, source }) });
      mountFn = st => SenkonViewer.mountFile(st, g.scene, { compact: false });
    }
    const ins = await sb.from('models').insert(row).select('id').single();
    if (ins.error) throw new Error('Kayıt başarısız: ' + ins.error.message);
    const thumb = thumbnail(mountFn);
    if (thumb) { const up = await sb.from('models').update({ thumbnail: thumb }).eq('id', ins.data.id); if (up.error) console.warn('thumbnail not saved', up.error); }
  }
  async function replaceModel(m, file, cls) {
    const g = await toGlb(file, cls);
    await upload(I.storagePath(m.slug), g.glb);
    const meta = I.fileMetadata({ ext: cls.ext, name: file.name, bytes: file.size, glbBytes: g.glb.byteLength, converter: g.converter, source: $('mSource').value.trim() || null });
    const thumb = thumbnail(st => SenkonViewer.mountFile(st, g.scene, { compact: false }));
    const up = await sb.from('models').update({ data: { metadata: meta }, file_path: I.storagePath(m.slug), file_format: 'glb', thumbnail: thumb }).eq('id', m.id);
    if (up.error) throw new Error('Kayıt güncellenemedi: ' + up.error.message);
  }

  // ---- delete
  function askDelete(m) { delTarget = m; $('delName').textContent = m.name; say($('delMsg'), ''); $('delDlg').showModal(); }
  $('delCancel').onclick = () => $('delDlg').close();
  $('delOk').onclick = async () => {
    const m = delTarget; $('delOk').disabled = true; say($('delMsg'), '');
    try {
      if (m.kind === 'file' && m.file_path) { const { error } = await sb.storage.from('models').remove([m.file_path]); if (error) throw new Error('Dosya silinemedi: ' + error.message); }
      const { error } = await sb.from('models').delete().eq('id', m.id);
      if (error) throw new Error('Kayıt silinemedi: ' + error.message);
      $('delDlg').close(); await refresh();
    } catch (err) { console.error(err); say($('delMsg'), err.message); }
    $('delOk').disabled = false;
  };

  init();
})();
```

- [ ] **Step 4: Verification without the owner's credentials**

`node --check model/panel.js`. Serve the repo root and open `http://127.0.0.1:8080/model/panel.html`:
1. The login card shows; the header has no buttons; no console errors; the network tab shows no request before login except `config.js` and vendor files.
2. Submit with empty fields: "E-posta ve şifre gerekli". Submit `nobody@example.com` / `wrong`: "E-posta veya şifre hatalı" (Supabase answers 400 invalid credentials; that is expected and must not show the generic message).
3. In the console: `SenkonIngest.classify('x.ifc', 10)` returns the file kind; `typeof SenkonIfc.convert === 'function'`; `typeof supabase.createClient === 'function'`.
4. Resize to phone width: the login card fits; nothing overflows horizontally.
Stop here; the logged-in flows are Task 8.

- [ ] **Step 5: Commit**

```bash
node --test
git add model/panel.html model/panel.css model/panel.js
git commit -m "Add owner page: login, model list with previews, add/replace/delete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Live verification with the owner logged in (controller + Fırat)

**Files:** none new (fixes, if any, go to the files above with their own commits).

This task is run by the controller in the in-app browser pane, after Fırat has run `docs/model/schema-stage2.sql` and logged in to `http://127.0.0.1:8080/model/panel.html` himself in that pane. The session persists in the pane, so the steps below need no further typing of credentials.

- [ ] **Step 1: Preconditions**
  - `schema-stage2.sql` executed (check: `curl -s -H "apikey: <KEY>" "<URL>/storage/v1/object/public/models/none/model.glb"` answers 400 or 404 with a storage error JSON, not "Bucket not found").
  - Fırat is logged in on the panel page in the pane; the list shows the lab model's card (no preview yet).

- [ ] **Step 2: Add the three kinds**
  - `local/Box.glb` as "Kutu": progress steps show; a card with a preview appears; "Aç" opens `./?m=<slug>` and draws the box; "Bağlantıyı kopyala" shows "Kopyalandı".
  - `local/IfcOpenHouse_IFC4.ifc` as "Açık ev": conversion step counts elements; the card appears; its link draws the house.
  - `local/lab-model.json` as "Lab (JSON)": a second parametric row; its link draws the laboratory model identically to the first.
  - Check the database from outside: `get_model` for each new slug returns the row (file rows with `file_format = 'glb'`), and `curl -s -H "apikey: <KEY>" "<URL>/storage/v1/object/list/models" -X POST -H "Content-Type: application/json" -d '{"prefix":""}'` returns `[]` or an error, never file names.

- [ ] **Step 3: Replace and delete**
  - "Dosyayı değiştir" on "Kutu" with `local/IfcOpenHouse_IFC4.ifc`: the same link now draws the house; the card's preview changes; `updated_at` moved.
  - "Sil" on "Açık ev": confirm; the card disappears; its link shows "Model bulunamadı"; the storage object answers 400/404.
  - Delete the test rows "Kutu" and "Lab (JSON)" the same way, leaving only the original lab model.

- [ ] **Step 4: Phone layout** of the panel at 375 × 812: cards stack in one column, dialogs fit, buttons wrap.

- [ ] **Step 5: Hand over**: Fırat pushes `stage2-uploads`, opens a pull request, merges; then the acceptance check from the spec's section 10 on his iPhone with his own SketchUp GLB and IFC when he has them. Record in the spec's section 9 what the real files showed (up axis, units, performance, whether layer switches are wanted).

---

## Self-review notes

- Spec coverage: owner page flows (Task 7, verified in Task 8), formats and conversion (Tasks 6, 7), storage and policies (Task 4), viewer file mode and progress (Task 5), security checks (Task 8 Step 2), vendored dependencies with hashes (Task 1), slug sharing (Task 2), pure helpers and tests (Tasks 2, 3), README (Tasks 1, 4), open points carried to Task 6 Step 2 and Task 8 Step 5.
- Names used across tasks: `SenkonSlug.randomSlug`, `SenkonIngest` members as listed in Task 3's interface block, `SenkonIfc.convert/VERSION`, `SenkonViewer.mountFile` and the file-mode `built()` shape, `storagePath`/`publicFileUrl` and `data.metadata` layout match between `ingest.js`, `panel.js` and the viewer shell.
- Deliberate deviation from the spec text: storage policies are per bucket for `authenticated` (Task 4 Step 2 updates the spec with the reason).
