# Tasarım Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tasarim/` shows the work: a six-scene ink story of the design office, a zoomable sample sheet drawn from the office's steel hall, and a form that takes the visitor's project files.

**Architecture:** The story reuses `assets/senkon/surec.js` and its markup unchanged, with new pictures in `assets/senkon/tasarim-surec/`. The sample sheet is an SVG written by `tools/make-pafta.js` (frame elevation from `hal.json` + hand-drawn detail and title-block fragments) and shown by a small pan/zoom script `assets/senkon/pafta.js`. Uploads go from `assets/senkon/upload.js` by `XMLHttpRequest` straight to a private Supabase Storage bucket `talepler` (anon insert-only); the Formspree form carries a hidden `dosyalar` summary; the owner panel lists and deletes the folders.

**Tech Stack:** Static HTML/CSS, vanilla browser JS (no build), Node CommonJS + `node:test`, Python 3 + Pillow (pictures), Supabase Storage REST + SQL.

**Spec:** `docs/superpowers/specs/2026-10-15-tasarim-redesign-design.md`

## Global Constraints

- Branch `tasarim-redesign`. Commit each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push; Fırat merges and pushes.
- Tests: bare `node --test` from the repo root (not `node --test tests/`).
- After changing any file in `tools/versions.js` LINKS, run `node tools/versions.js`; `tests/versions.test.js` fails otherwise. New linked files go into LINKS.
- Edit HTML pages byte-for-byte (Edit tool or Node), never Python text mode: the logo tests break on line endings.
- No new dependencies, no CDN scripts on `/tasarim/`.
- Copy rules (tests already guard most): no eyebrows, no `.num` spans, no FAQ, no "en az malzeme", no figures/prices/durations beyond the existing "birkaç iş günü", no personal names, no "Amazon", no "Malatya", no "premium", no "6306", no "TS 500", no slogan headings.
- Sample sheet title-block text, verbatim: `ÖRNEK PAFTA`, `Senkon Mühendislik`, `Çizim standardını göstermek amacıyla hazırlanmış örnek paftadır; uygulama projesi değildir.`, sheet `Ö-01`.
- Page sentence under the sheet, verbatim: `Uygulama projelerimizin çizim standardını gösteren örnek bir paftadır; ölçü ve kesitler örnek amaçlıdır.`
- Upload limits: extensions `pdf dwg dxf ifc zip jpg jpeg png`; max 10 files; max 50 MB (52 428 800 bytes) each.
- Upload path regex (shared by browser and SQL policy, case-insensitive): `^[0-9]{8}-[a-z0-9]{12}/[^/]+\.(pdf|dwg|dxf|ifc|zip|jpg|jpeg|png)$`
- Supabase project from `model/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); the page loads `/model/config.js`.
- The file `<input type="file">` has **no `name`** attribute: `track.js` posts `new FormData(form)` to Formspree's free plan, which must not receive files.

## Review Focus

1. **A file name with Turkish letters, spaces or several dots** ("Zemin Etüdü (son).v2.PDF") — expect it to upload under a cleaned name that matches the policy regex, extension kept lower-case. Pinned in Task 6 `cleanName` tests.
2. **Gönder pressed while a file is still uploading, or after one failed** — expect Gönder disabled with "Dosyalar yükleniyor…" while any is uploading; after a failure, Gönder works again and `dosyalar` lists only the files that landed. Pinned in Task 7.
3. **The same file chosen twice, or more than 10 files** — expect the duplicate (same name + size) ignored and files beyond the tenth refused with a reason. Pinned in Task 6 `check` tests.
4. **Phone: a vertical swipe over the sample sheet at 1×** — expect the page to scroll, not the sheet to pan (`touch-action: pan-y` at 1×, `none` when zoomed). Pinned in Task 4 (`touchAction(scale)`).
5. **Story without JavaScript or with reduced motion** — expect the six pictures as a plain strip above the captions, as on Performans. Pinned in Task 2 page test (markup only; CSS already covers it).

---

### Task 1: Story pictures pipeline and stand-ins

**Files:**
- Modify: `tools/make-surec.py`
- Create: `assets/senkon/tasarim-surec/01.webp … 06.webp` (placeholders for now)
- Create: `local/tasarim-surec-prompts.md` (gitignored, not committed)
- Modify: `tests/surec-pictures.test.js`

**Interfaces:**
- Produces: `python tools/make-surec.py [--dir <folder>] <in.png> <n>` and `python tools/make-surec.py [--dir <folder>] --placeholder <n>`; default folder stays `assets/senkon/surec`.

- [ ] **Step 1: Write the failing test** — in `tests/surec-pictures.test.js`, loop the existing size/format test over both `assets/senkon/surec` and `assets/senkon/tasarim-surec` (test name: `six pictures 01–06 in <dir>, each a WebP under 120 KB`).
- [ ] **Step 2: Run** `node --test` — expect FAIL: `tasarim-surec/01.webp` missing.
- [ ] **Step 3: Add `--dir <folder>`** to `make-surec.py` (optional leading flag, path relative to the repo root; `out(n)` uses it). Update the docstring.
- [ ] **Step 4: Write placeholders**: `python tools/make-surec.py --dir assets/senkon/tasarim-surec --placeholder 1` … `6`.
- [ ] **Step 5: Run** `node --test` — expect PASS.
- [ ] **Step 6: Write `local/tasarim-surec-prompts.md`**: same structure as `local/surec-prompts.md` (usage lines with `--dir assets/senkon/tasarim-surec`, sources in `local/tasarim-surec-src/`); style preamble copied, the building sentence replaced by: "The building, when it appears, is always the same wide single-storey steel industrial hall: lattice (built-up) columns on a regular grid, pitched roof trusses spanning between them, no cladding drawn unless the prompt says so." One paragraph per scene from the spec's table, section 2, each written at the detail level of the Performans prompts (what is in the frame, where, what each figure holds; technically correct joints and crane rigging; no text or numbers on sheets or screens).
- [ ] **Step 7: Commit** `tools/make-surec.py`, `assets/senkon/tasarim-surec/`, `tests/surec-pictures.test.js` — "Tasarım story: picture folder and make-surec --dir".

### Task 2: The story on the page, and the hero buttons

**Files:**
- Modify: `tasarim/index.html` (hero `.btns`; replace the `#adimlar` section; add the `surec.js` script)
- Modify: `site.css` (`.steps-plain`)
- Modify: `tools/versions.js` (LINKS: six `tasarim-surec/0n.webp`)
- Modify: `tests/tasarim-page.test.js`

**Interfaces:**
- Consumes: `assets/senkon/surec.js` as is (finds `.surec-stage`, its `.surec`, and `ol.steps`).

- [ ] **Step 1: Update the tests** in `tests/tasarim-page.test.js`:
  - `written, not listed`: keep the bans on `class="eyebrow"`, `class="num"`, `list2|perf-get|faq`; replace the blanket `<ol|<ul` ban with: no `<ul`, exactly one `<ol`, and it is `<ol class="steps steps-plain">`.
  - `how the work goes` → `the story under #adimlar`: `<section id="adimlar" class="wrap section rule tsr-how">` with `<h2>Nasıl çalışıyoruz</h2>` inside `.surec-pin`; six `<img src="/assets/senkon/tasarim-surec/0n.webp?v=[0-9a-f]{8}"` each with a non-empty `alt`, `width="1200" height="900" loading="lazy"`; six `<li class="item">` whose `<h3>` titles equal, in order, `Mimari projenin incelenmesi`, `Taşıyıcı sistem seçimi`, `Analiz modeli`, `Birleşim detayları`, `Uygulama projesi`, `Şantiye desteği`; `Önceki`/`Sonraki` buttons; one `surec.js?v=` script tag. Keep the word checks (`hesap raporu`, `donatı`, `imalat ve montaj`, `IFC`) and the price/Revit/Tekla bans.
  - New test `the hero sends the project to the form`: the first `.btn-main` in the hero has `href="#iletisim"` and text `Projeyi gönderin, teklif alın`; the hero's second button is the WhatsApp quote link (`btn btn-line`, text `WhatsApp ile yazın`); no `href="#adimlar"` in the hero. In `contact`, keep the `quote` regex (`btn btn-main` WhatsApp links) but lower the count from `>= 3` to `>= 2` (İletişim and the dock; the hero's WhatsApp is now `btn-line`).
- [ ] **Step 2: Run** `node --test` — expect FAIL on the new assertions.
- [ ] **Step 3: Rewrite the markup.** Hero buttons: `<a class="btn btn-main" href="#iletisim">Projeyi gönderin, teklif alın</a><a class="btn btn-line" href="https://wa.me/905309250461?text=…">WhatsApp ile yazın</a>` (same prefilled text). `#adimlar`: the Performans structure (`.surec > .surec-pin > h2 + figure.surec-stage > .surec-pic imgs + .surec-ctrl`, then `ol.steps.steps-plain`), `aria-label="Tasarım sürecinin çizimleri"`, `<li class="item"><h3>…</h3><p>…</p></li>` with the spec's six caption texts verbatim, one Turkish alt sentence per picture describing the spec's scene. Keep the `METİN T3` comment, now saying it holds six titles and paragraphs. Add `<script src="/assets/senkon/surec.js?v=…" defer></script>` after `hal.js`.
- [ ] **Step 4: CSS** — `ol.steps-plain .item{padding-left:20px}` and the same inside `.surec:has(.surec-live)` (the live rule sets 44px; override to 20px for `.steps-plain`). Remove `#adimlar.tsr-how{padding-top:64px}` only if the pinned heading then misaligns; check in the browser at Task 9.
- [ ] **Step 5: LINKS** — add the six `assets/senkon/tasarim-surec/0n.webp` entries (comment: the story on tasarim/ only), then `node tools/versions.js`.
- [ ] **Step 6: Run** `node --test` — expect PASS.
- [ ] **Step 7: Commit** — "Tasarım page: the design-office story under #adimlar; main button goes to the form".

### Task 3: The sample sheet SVG

**Files:**
- Create: `tools/make-pafta.js`
- Create: `tools/pafta/detail.svg`, `tools/pafta/title.svg` (hand-written fragments: `<g>` content only, in sheet millimetres)
- Create: `assets/senkon/ornek-pafta.svg` (generated)
- Create: `tests/pafta-svg.test.js`
- Create: `local/ornek-pafta-check.md` (gitignored, not committed)

**Interfaces:**
- Produces: `assets/senkon/ornek-pafta.svg` with `viewBox="0 0 420 297"` (millimetres), root `<svg class="pafta-svg">`, one top-level `<g class="pafta-sheet">` (the viewer transforms this group). Exports from `make-pafta.js`: `planes(members) -> [{ z, count }]` (constant-z planes, most members first), `elevation(members, z) -> { lines: [[x1,y1,x2,y2,w]], box: [x0,y0,x1,y1] }` (metres, y up), `build() -> string` (the SVG).

- [ ] **Step 1: Write `tests/pafta-svg.test.js`**: file exists; `viewBox="0 0 420 297"`; contains `ÖRNEK PAFTA`, `Senkon Mühendislik`, `Çizim standardını göstermek amacıyla hazırlanmış örnek paftadır; uygulama projesi değildir.`, `Ö-01`; no `<image`, no `<script`, no `href="http`; none of the CV names (`Esenboğa`, `Koç`, `Antalya`, `Malatya`, `Alfraganus`, `Vem`, `Biem`, `Karmall`, `Tuzla`, `Amazon`) case-insensitive; under 150 KB; `build()` output equals the committed file (the generator is the source); `planes()` on a two-member fixture at z = 1 and one at z = 2 returns `[{z:1,count:2},{z:2,count:1}]`; `elevation()` of a fixture returns lines in metres and a box enclosing them.
- [ ] **Step 2: Run** `node --test` — expect FAIL (no file).
- [ ] **Step 3: Implement `planes` and `elevation`** in `tools/make-pafta.js`. Run `node tools/make-pafta.js --list` (prints `planes()` top 12) and choose an **interior** transverse frame (both lattice columns and the full truss; not a gable end) as constant `AXIS_Z` with a comment why.
- [ ] **Step 4: Implement `build()`**: A3 border and 10 mm margin; elevation in the left ~60 % at a scale chosen to fit (written in the drawing label as `ÖLÇEK 1/200` or whatever fits, rounded to a standard 1/100, 1/200, 1/250), axis bubbles at column centrelines lettered A, B…, level marks ±0.00 and top-of-column from the model, one overall span dimension and the column height, a detail-callout circle "1" at the truss-to-column joint chosen for the detail; `tools/pafta/detail.svg` placed right-top with heading `DETAY 1 · ÖLÇEK 1/10`; `tools/pafta/title.svg` bottom-right with the Global-Constraints text. Line weights: 0.5 mm members, 0.25 mm dimensions, 0.18 mm hatch/centrelines (dash `6 2 1 2`). Text as `<text>` with `font-family="Work Sans, sans-serif"`, sizes 2.5 mm (notes) and 3.5 mm (headings). Running `node tools/make-pafta.js` writes the file.
- [ ] **Step 5: Draw `tools/pafta/detail.svg`**: lattice column cap with cap plate, truss top and bottom chords meeting it with end plates, bolt groups drawn as circles with centrelines, stiffeners, fillet-weld symbols on the leader lines, callouts (`PL 20`, `4 × M20 10.9`, `a = 6`, profiles such as `HEA 200`, `2 L 80×8`), a section cut A–A beside it. Values are a first proposal; consistent with each other (bolt edge distances ≥ 1.2 d0, plate wider than the profile).
- [ ] **Step 6: Write `local/ornek-pafta-check.md`**: every profile, plate, bolt, weld and dimension on the sheet as a table (item · value on sheet · Fırat's correction column), plus "the frame axis chosen: z = …".
- [ ] **Step 7: Generate and run** `node tools/make-pafta.js && node --test` — expect PASS. Open the SVG in the browser pane and look at it at 100 % and zoomed to the detail; fix overlaps.
- [ ] **Step 8: Commit** `tools/make-pafta.js`, `tools/pafta/`, `assets/senkon/ornek-pafta.svg`, `tests/pafta-svg.test.js` — "Örnek pafta: sample sheet from the hall model (to be checked by Fırat)".

### Task 4: Sheet viewer `pafta.js`

**Files:**
- Create: `assets/senkon/pafta.js`
- Create: `tests/pafta.test.js`

**Interfaces:**
- Consumes: the SVG from Task 3 (`g.pafta-sheet`), markup from Task 5 (`figure.pafta` holding `img.pafta-static` + `.pafta-ctrl` buttons `.pafta-in`, `.pafta-out`, `.pafta-full`, and `dialog.pafta-dlg` with `.pafta-close`).
- Produces (exported for tests, `module.exports = { view, zoomAt, pan, toggle, touchAction }`):
  - `view(w, h) -> { s: 1, x: 0, y: 0, w, h }` — state for a viewport of w × h CSS px showing the whole sheet at s = 1.
  - `zoomAt(v, factor, px, py) -> v'` — scale clamped to `[1, 8]`, the sheet point under (px, py) stays under it, then `clampPan`.
  - `pan(v, dx, dy) -> v'` — moved and clamped so the sheet always covers the viewport (at s = 1, x = y = 0).
  - `toggle(v, px, py) -> v'` — s = 1 → 4 about the point, any other s → `view(w, h)`.
  - `touchAction(s) -> 'pan-y' | 'none'` — `'pan-y'` at s = 1, else `'none'`.

- [ ] **Step 1: Write `tests/pafta.test.js`** with these assertions: `zoomAt(view(400,283), 100, …).s === 8` and `zoomAt(view(400,283), 0.01, …).s === 1`; after `zoomAt(v, 2, 100, 50)` the sheet point that was at (100, 50) maps to (100, 50) within 1e-9; `pan(view(400,283), 50, 50)` stays at x = y = 0; at s = 2, `pan` by −10000 clamps x to −400 (w·(s−1)); `toggle` from s = 1 gives 4 and from 4 gives 1; `touchAction(1) === 'pan-y'`, `touchAction(1.5) === 'none'`.
- [ ] **Step 2: Run** — expect FAIL (module missing).
- [ ] **Step 3: Implement the pure functions**, then the DOM part (runs only when `document` exists): fetch the SVG at the `img.pafta-static` src, insert it inline in place of the image (keep the image if the fetch fails), apply `transform="translate(x y) scale(s)"` in viewBox units to `g.pafta-sheet` (convert from CSS px by `420 / w`); wheel (`ctrlKey` or plain wheel over the sheet zooms with `factor = Math.exp(-deltaY * 0.002)`, `preventDefault` only when zooming changes s), pointer drag pans, two-pointer pinch zooms about the midpoint, `dblclick` and double-tap (two `pointerup` within 300 ms, < 10 px apart) call `toggle`; `+`/`−` buttons zoom ×1.5 / ÷1.5 about the centre; set `style.touchAction = touchAction(s)` after every change. "Tam ekran" moves the inline SVG into `dialog.pafta-dlg`, calls `showModal()`, resets the view to the dialog size; `close` (Esc or `.pafta-close`) moves it back and resets. Header comment in the style of `surec.js` explaining behaviour and the no-JS fallback.
- [ ] **Step 4: Run** `node --test` — expect PASS.
- [ ] **Step 5: Commit** — "Örnek pafta: pan and zoom viewer".

### Task 5: The `#ornek-pafta` section

**Files:**
- Modify: `tasarim/index.html` (new section between `#adimlar` and `#iletisim`; script tag)
- Modify: `site.css`
- Modify: `tools/versions.js` (LINKS: `assets/senkon/pafta.js`, `assets/senkon/ornek-pafta.svg`)
- Modify: `tests/tasarim-page.test.js`

- [ ] **Step 1: Test** `the sample sheet section`: `<section id="ornek-pafta" class="wrap section rule">` with `<h2>Örnek pafta</h2>`; the verbatim sentence from Global Constraints; `<img class="pafta-static" src="/assets/senkon/ornek-pafta.svg?v=[0-9a-f]{8}"` with alt `Örnek pafta: çelik endüstriyel yapının çerçeve görünüşü ve kolon–makas birleşim detayı`; a fallback link `href="/assets/senkon/ornek-pafta.svg"` with text `Paftayı büyük açın`; `<dialog class="pafta-dlg"`; one `pafta.js?v=` script tag; section order `#yaklasim`, `#adimlar`, `#ornek-pafta`, `#iletisim`.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Markup** (comment `METİN T4 · ÖRNEK PAFTA`; renumber the later METİN markers T5/T6 and the head comment "T1-T6"): heading, sentence (`p.about-text`), `figure.pafta` (img, `.pafta-ctrl` with buttons `+`, `−`, `Tam ekran`, aria-labels `Yakınlaştır`, `Uzaklaştır`, `Tam ekran aç`), the fallback link inside `<noscript>`, the dialog with a `Kapat` button.
- [ ] **Step 4: CSS**: `.pafta` bordered box (`1px solid var(--rule)`, white), aspect-ratio `420/297`, `overflow:hidden`, `cursor:grab` once live (`.pafta-live`); controls bottom-right in the `.surec-ctrl button` style; dialog full viewport (`width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0`), sheet centred, `Kapat` top-right.
- [ ] **Step 5: LINKS + versions**, run `node --test` — PASS.
- [ ] **Step 6: Commit** — "Tasarım page: Örnek pafta section".

### Task 6: Upload rules and the storage bucket

**Files:**
- Create: `assets/senkon/upload.js` (pure part)
- Create: `docs/model/schema-talepler.sql`
- Modify: `docs/model/README.md` (one paragraph: run `schema-talepler.sql` once after `schema-stage2.sql`)
- Create: `tests/upload.test.js`

**Interfaces:**
- Produces (`module.exports = { EXT, MAX_FILES, MAX_BYTES, PATH_RE, cleanName, folderName, check, summary }`):
  - `EXT = ['pdf','dwg','dxf','ifc','zip','jpg','jpeg','png']`, `MAX_FILES = 10`, `MAX_BYTES = 52428800`, `PATH_RE` = the Global-Constraints regex with flag `i`.
  - `cleanName(name: string) -> string` — Turkish letters transliterated (ç→c, ğ→g, ı→i, İ→I, ö→o, ş→s, ü→u and capitals), spaces → `-`, any other character outside `[A-Za-z0-9._-]` dropped, runs of `-` collapsed, extension lower-cased, base trimmed to 80 chars, empty base → `dosya`.
  - `folderName(date: Date, rand: () => number) -> string` — `YYYYMMDD-` + 12 chars from `[a-z0-9]`.
  - `check(file: {name,size}, list: [{name,size}]) -> null | string` — reason strings: `'Bu dosya türü kabul edilmiyor (PDF, DWG, DXF, IFC, ZIP, JPG, PNG).'`, `'Dosya 50 MB\'tan büyük.'`, `'En fazla 10 dosya eklenebilir.'`, `'Bu dosya zaten eklendi.'` (same name and size), `null` when fine.
  - `summary(folder: string, files: [{name,size}]) -> string` — `talepler/<folder>: ` + `name (1,2 MB)` joined with `; ` (MB with one decimal, Turkish comma; under 0.1 MB shows `0,1 MB`); empty list → `''`.

- [ ] **Step 1: Write `tests/upload.test.js`**: `cleanName('Zemin Etüdü (son).v2.PDF') === 'Zemin-Etudu-son.v2.pdf'`; `cleanName('ŞÇĞİÖÜ ışığ.dwg') === 'SCGIOU-isig.dwg'`; `cleanName('???.pdf') === 'dosya.pdf'`; `folderName(new Date(2026,9,15), () => 0)` is `'20261015-aaaaaaaaaaaa'`; for 200 random names (fixed seed) `PATH_RE.test(folder + '/' + cleanName(n + '.pdf'))` is true; `PATH_RE` rejects `../x.pdf`, `20261015-abc/x.pdf`, `20261015-aaaaaaaaaaaa/x.exe`, `20261015-aaaaaaaaaaaa/a/b.pdf`; each `check` reason above, including the 11th file and a duplicate; `summary('20261015-aaaaaaaaaaaa', [{name:'a.pdf',size:1258291}])` is `'talepler/20261015-aaaaaaaaaaaa: a.pdf (1,2 MB)'`; **the SQL file contains the regex source of `PATH_RE` verbatim** (one pattern, two places).
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** the pure functions at the top of `assets/senkon/upload.js` inside the usual IIFE with `if (typeof module !== 'undefined') module.exports = …; if (typeof document === 'undefined') return;`.
- [ ] **Step 4: Write `docs/model/schema-talepler.sql`**: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('talepler','talepler', false, 52428800, null) on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = null;` then policies: `talepler_anon_insert` for insert to `anon` with check `(bucket_id = 'talepler' and name ~* '<PATH_RE source>')`; `talepler_owner_select` and `talepler_owner_delete` to `authenticated` using `(bucket_id = 'talepler')`. Header comment: run once in the SQL editor; why no anon select/update/delete.
- [ ] **Step 5: Run** `node --test` — PASS.
- [ ] **Step 6: Commit** — "Uploads: file rules shared with the talepler bucket policy".
- [ ] **Step 7: Checkpoint for Fırat** — ask him to run `docs/model/schema-talepler.sql` once in the Supabase SQL editor (project `nrnjzgfbhvdzxtbqkwbm`) and say when done. Task 7's browser check needs it.

### Task 7: File box in the form

**Files:**
- Modify: `assets/senkon/upload.js` (DOM part)
- Modify: `tasarim/index.html` (file box in the form; `dosyalar` hidden field; scripts `/model/config.js` and `upload.js`)
- Modify: `site.css`
- Modify: `tools/versions.js` (LINKS: `assets/senkon/upload.js`, `model/config.js`)
- Modify: `tests/upload.test.js`, `tests/tasarim-page.test.js`

**Interfaces:**
- Consumes: Task 6 exports; `window.SENKON_CONFIG`.
- Produces (exported for tests): `attach(form, opts) -> { files, busy() }` where `opts = { url, key, XHR, now, rand }`. `files` is the list of `{ name, size, path, state: 'up'|'done'|'fail', pct }`.

- [ ] **Step 1: Tests.** Page test: inside `.lead-form`, `<div class="lead-files">` with `<input type="file" multiple accept=".pdf,.dwg,.dxf,.ifc,.zip,.jpg,.jpeg,.png"` and **no `name=`**; label text `Planlarınızı ekleyin`; hint `PDF, DWG, DXF, IFC, ZIP, JPG veya PNG · dosya başına en fazla 50 MB`; `<input type="hidden" name="dosyalar" value="">`; `/model/config.js?v=` and `upload.js?v=` script tags, `upload.js` after `track.js`. Upload tests with a fake form and fake `XMLHttpRequest`: choosing a file opens `POST <url>/storage/v1/object/talepler/<folder>/<cleaned>` with headers `apikey` and `Authorization: Bearer <key>` and `x-upsert: false`; while it is open the submit button is disabled and its text is `Dosyalar yükleniyor…`; on `load` with status 200 the row is `done`, the button is back to `Gönder` and enabled, `dosyalar.value === summary(folder, doneFiles)`; status 400 → row `fail` with `Yüklenemedi, tekrar deneyin` and a retry button that re-sends the same path; a refused file (by `check`) never opens a request and shows the reason; removing a row (×) drops it from `dosyalar`; all files of one visit share one folder.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Markup** in the form after the Mesaj label: `<div class="lead-files wide">` with a `<label>` wrapping the hidden-styled file input and a drop area text, the hint `<p>`, an empty `<ul class="lead-flist">` for rows; the hidden `dosyalar` input next to `_subject`. The whole `.lead-files` has `hidden`; `upload.js` removes `hidden` when it attaches (no JS → no box). Note: the page test from Task 2 forbids `<ul`; scope that ban to outside the form (`html` with the form removed).
- [ ] **Step 4: Implement `attach`**: change and drop events → `check` each file → row + upload with `XHR.upload.onprogress` → `pct`; Content-Type `file.type || 'application/octet-stream'`; button state recomputed after every change; `dosyalar` rewritten after every change. Drag-over adds `.drag` to the box. Auto-start: `attach(document.querySelector('.lead-form'), { url: SENKON_CONFIG.SUPABASE_URL, key: SENKON_CONFIG.SUPABASE_ANON_KEY })` only when both exist and the form is visible.
- [ ] **Step 5: CSS**: dashed drop box (`1.5px dashed var(--rule)`, `.drag` border `var(--ink)`), rows with name, size, a 3 px progress bar like `.surec-bar`, state text, `×` button; works at 375 px.
- [ ] **Step 6: LINKS + versions**, `node --test` — PASS.
- [ ] **Step 7: Real check** (needs Task 6 Step 7 done): serve with `preview_start` name `site`, upload a small PDF from the form, confirm the request returns 200 in `read_network_requests`; try the URL `…/storage/v1/object/public/talepler/<path>` — must not return the file. If the upload returns 4xx, record the response body and fix headers (try `apikey` only) before going on.
- [ ] **Step 8: Commit** — "Tasarım form: project files to the talepler bucket".

### Task 8: Owner panel "Gelen dosyalar", and the privacy sentence

**Files:**
- Modify: `model/panel.html`, `model/panel.js`, `model/panel.css`
- Modify: `kvkk/index.html`
- Modify: `tests/about-page.test.js` or a new `tests/kvkk.test.js` (whichever already reads `kvkk/index.html`; else new)

**Interfaces:**
- Consumes: the signed-in `sb` client in `panel.js`; bucket `talepler`.

- [ ] **Step 1: Test** `kvkk`: the page contains `Form ile gönderilen dosyalar yalnızca teklif hazırlamak amacıyla saklanır ve bu amaç sona erdiğinde silinir.`
- [ ] **Step 2: Run** — FAIL; add the sentence to the paragraph that lists what the form collects; run — PASS.
- [ ] **Step 3: Panel markup**: `<section id="inbox" hidden><h2>Gelen dosyalar</h2><p id="inboxEmpty" hidden>Henüz dosya yok.</p><div id="inboxList"></div></section>` after `#list`; shown together with `#list` when signed in.
- [ ] **Step 4: `panel.js`**: `async function loadInbox()` — `sb.storage.from('talepler').list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } })` for folders, then `list(folder)` per folder; each folder card shows the date from the folder name as `15.10.2026`, its files with size (`summary`-style MB) and an `İndir` button that opens `createSignedUrl(path, 600)` in a new tab, and `Sil` that confirms with the existing `#delDlg` pattern and calls `remove(paths)`. Called after sign-in and after delete.
- [ ] **Step 5: Browser check** (signed in by Fırat in the pane, or he checks): the file from Task 7 Step 7 shows, downloads, deletes.
- [ ] **Step 6: Commit** — "Owner panel: Gelen dosyalar; KVKK sentence for uploaded files".

### Task 9: Real pictures, the checked sheet, and the whole-page check

- [ ] **Step 1: Checkpoint for Fırat** — the six pictures generated from `local/tasarim-surec-prompts.md` into `local/tasarim-surec-src/01.png … 06.png`. Convert each: `python tools/make-surec.py --dir assets/senkon/tasarim-surec local/tasarim-surec-src/0n.png n`. Look at each; a wrong technical detail → ask for a regeneration, never retouch.
- [ ] **Step 2: Checkpoint for Fırat** — his corrections in `local/ornek-pafta-check.md`; apply them to `tools/pafta/*.svg` / `make-pafta.js`, regenerate, `node --test`.
- [ ] **Step 3:** `node tools/versions.js && node --test` — all PASS.
- [ ] **Step 4: Browser check** at 1440 × 900 and 375 × 812 (`resize_window`), reset to desktop afterwards: story plays and pins (desktop heading + picture; phone picture at top); the sheet zooms by wheel, buttons and double-click, opens and closes full screen, a vertical swipe at 1× scrolls the page; the form uploads, refuses a `.exe` and a 60 MB file, disables Gönder while uploading, sends to Formspree with `dosyalar` filled (check the request body in `read_network_requests`); no console errors. Screenshot each.
- [ ] **Step 5: Commit** — "Tasarım page: the six drawings and the checked sample sheet". Write `local/pr-tasarim-redesign-url.txt` with the compare URL `https://github.com/frat61/senkon.github.io/compare/main...tasarim-redesign` for Fırat; he pushes and merges.
