# Tasarım page: ink story, sample sheet, file upload

Date: 2026-10-15. Branch `tasarim-redesign` off `main` (a9f39f5). Builds on the live `/tasarim/` page and on
`2026-10-13-surec-animasyon-design.md` (the Performans story). The page is the landing page of the second
Google Ads campaign (`local/google-ads-campaign-2.md`) for architects, contractors and investors.

## 0. Why

A UX comparison of `/deprem-performans/` and `/tasarim/` (2026-10-15): Performans *shows* the work (six ink
scenes, concrete methods, a list of what you get); Tasarım *tells* it (the hall in the hero, then prose
only), and its main button says "Projeyi gönderin" while the page has no way to send a project.

Fırat's rulings in this session:

- No figures on the page (kg/m², savings, durations): they vary a lot by project and location and would
  mislead.
- No real project pictures or drawings: most are under NDA.
- Yes to a sample drawing made for the site from the office's own steel hall, clearly labelled as a sample.
  Claude draws it, Fırat checks and corrects it before it goes live.
- Uploads go to the office's own Supabase, not Formspree's paid plan.
- Six ink scenes, the steel hall throughout, captions without numbers.

Standing rules from earlier sessions still apply: no eyebrows, no numbered lists copied from another page,
no FAQ, no slogan headings, no element-by-element walk through the structure, never "en az malzeme", never
invent projects, never name Amazon. The safety-first framing stays: the codes are the fixed floor.

## 1. Page, top to bottom

| # | Section | Change |
|---|---|---|
| 1 | Hero: h1 "Güvenli, ekonomik ve uygulanabilir taşıyıcı sistemler.", lead, steel hall (`hal.js`) | The main button "Projeyi gönderin, teklif alın" now goes to `#iletisim` (the form with upload). WhatsApp becomes the second button; "Nasıl çalışıyoruz" link is dropped from the hero (the story follows two sections later). |
| 2 | `#yaklasim`: Optimize çözümler / İleri mühendislik çözümleri | Unchanged. |
| 3 | `#adimlar` "Nasıl çalışıyoruz": the ink story | New, replaces the two prose paragraphs (their content moves into the captions). |
| 4 | `#ornek-pafta` "Örnek pafta" | New. |
| 5 | `#iletisim` "Projeniz için teklif alın": buttons + form | The form gains a file box. |

`#adimlar` keeps its id: the ad sitelink points to it.

## 2. The ink story

Same component as Performans: `assets/senkon/surec.js` unchanged, the same `.surec / .surec-pin /
figure.surec-stage / ol.steps` markup and CSS, so behaviour matches (pen-sketch reveal 2.5 s, 5 s per frame,
Önceki/Sonraki, hover and focus hold, picture pinned at the top on phones, plain strip without JavaScript).

Differences from Performans:

- `ol.steps` items have no `.num` span (no 01–06). A modifier class `.steps-plain` removes the space the
  number column takes. The list stays an `<ol>` for screen readers.
- Pictures live in `assets/senkon/tasarim-surec/01.webp … 06.webp` (1200 × 900). `tools/make-surec.py`
  gets an optional output-directory argument; the default stays `assets/senkon/surec/` so Performans is
  untouched.

Scenes (one building throughout: the office's steel hall, a wide single-storey hall with lattice columns
and roof trusses, as in `hal.json`). Prompts go to `local/tasarim-surec-prompts.md` with the same style
preamble as `local/surec-prompts.md`, the building line replaced by the hall. Fırat generates them in
ChatGPT into `local/tasarim-surec-src/`; a frame with a wrong technical detail is regenerated, not retouched.

| Scene | Picture | Caption title | Caption text (draft, Fırat edits) |
|---|---|---|---|
| 1 | Engineer's desk, architect's plan and section of the hall spread out; the architect beside, pointing at the long span | Mimari projenin incelenmesi | Mimari planlar, kesitler ve varsa zemin raporu tarafımıza iletilir; birkaç iş günü içinde taşıyıcı sistem önerisini, iş aşamalarını ve süreyi içeren yazılı teklif sunulur. |
| 2 | Two pencil sketches side by side on paper: a truss roof and a solid-web portal frame over the same span; a hand with a pencil between them; no figures | Taşıyıcı sistem seçimi | Ön tasarım aşamasında alternatif taşıyıcı sistemler aynı analiz modelinde karşılaştırılır; sistem, mimari tasarımla birlikte işverenle netleştirilir. |
| 3 | Over the shoulder at two monitors: the hall's 3D frame model with its deformed shape drawn faintly over it | Analiz modeli | Yapının üç boyutlu analiz modeli kurulur; yapının türüne ve yönetmelik koşullarına göre lineer veya nonlineer hesap yapılır. |
| 4 | Close view of a sheet or screen: a truss-to-column joint with end plate, bolts and stiffeners | Birleşim detayları | Birleşimler ve kritik düğüm noktaları hesapla birlikte detaylandırılır; detaylar imalatta ve montajda uygulanabilir olacak şekilde çizilir. |
| 5 | Printed sheets with title blocks on a table, rolled sets beside them; engineer and contractor going through them | Uygulama projesi | Statik hesap raporu ile betonarme yapılarda kalıp ve donatı, çelik yapılarda imalat ve montaj çizimleri teslim edilir; teslim biçimi (DWG, PDF, IFC) işverenin iş akışına göre belirlenir. |
| 6 | The hall going up: a crane lifting a roof truss onto the columns; the engineer with a sheet answering a site question | Şantiye desteği | Şantiyeden gelen teknik sorular proje süresince yanıtlanır. |

Alt texts describe each picture in one Turkish sentence, as on Performans.

## 3. Örnek pafta

### Content

One A3 landscape sheet (420 × 297 mm drawing space), black line work on white, drawn as SVG:

- **Frame elevation**: one transverse axis of the hall from `hal.json` (lattice column, roof truss, lattice
  column), axis bubbles, level marks, overall dimensions taken from the model geometry.
- **Connection detail**, larger scale: truss top and bottom chord to lattice column cap. End plate,
  bolt group, stiffeners, welds with weld symbols, plate and bolt callouts, dimensions. A section cut.
- **Title block** (bottom right): "ÖRNEK PAFTA", "Senkon Mühendislik", "Çizim standardını göstermek
  amacıyla hazırlanmıştır; gerçek bir projeye ait değildir.", scales, sheet number "Ö-01".

Profiles, plate thicknesses, bolt sizes and grades and weld sizes are Claude's first proposal and are
listed in `local/ornek-pafta-check.md` for Fırat to correct. **The section ships only after Fırat has
checked the sheet** (the merge waits for it).

### Files

- `tools/make-pafta.js`: reads `hal.json`, picks the axis, writes the elevation geometry; the detail and
  title block are hand-written SVG fragments in `tools/pafta/`. Output `assets/senkon/ornek-pafta.svg`.
  Text stays as `<text>` (not paths) in the self-hosted Work Sans, so it stays sharp and small; `pafta.js`
  fetches the SVG and places it inline so the page fonts apply.
- `assets/senkon/pafta.js`: the viewer.

### Viewer

- On the page the whole sheet shows at column width with a thin frame, and a line under it: "Uygulama
  projelerimizin çizim standardını gösteren örnek bir paftadır; gerçek bir projeye ait değildir."
- Zoom: on the page, trackpad pinch (ctrl + wheel) on desktop, and the plain wheel only once the sheet is
  already zoomed in (over the whole sheet the wheel scrolls the page); in the full-screen dialog the plain wheel
  always zooms. Two-finger pinch on phones, double-click/tap toggles 1× ↔ 4× (a drag or a pinch is not a tap),
  drag pans when zoomed; zoom range 1×–8×; `+`, `−` and "Tam ekran" buttons in a corner.
- Phones: one-finger vertical swipes scroll the page while the sheet is at 1×; once zoomed, one finger pans.
- "Tam ekran" opens the sheet in a `<dialog>` filling the viewport, same controls, Esc or "Kapat" closes.
- No library: a small transform-based script (`translate + scale` on an inner `<g>`), in the style of the
  other `assets/senkon/*.js` files, with the pan/zoom maths exported for tests.
- Without JavaScript: the SVG shows as an `<img>` and a link "Paftayı büyük açın" opens the SVG file.

## 4. File upload

### Storage

Supabase project `nrnjzgfbhvdzxtbqkwbm` (the viewer's). New private bucket `talepler`, created by a new
script `docs/model/schema-talepler.sql` that Fırat runs once in the SQL editor:

- `public = false`, `file_size_limit = 50 MB` (the free plan's per-file limit).
- `allowed_mime_types = null` (DWG/DXF/IFC arrive with unreliable types, often
  `application/octet-stream`); the type check is by extension in the browser and in the policy.
- Policies on `storage.objects`:
  - `anon` may **insert** into `talepler` when the object name matches
    `^[0-9]{8}-[a-z0-9]{12}/[^/]+\.(pdf|dwg|dxf|ifc|zip|jpg|jpeg|png)$` (case-insensitive).
  - No select, update or delete for `anon`: visitors cannot list, read, overwrite or remove anything.
  - `authenticated` (Fırat, the only user; sign-ups are closed) may select and delete in `talepler`.

### In the browser

- A new file box under the Mesaj field: "Planlarınızı ekleyin" — drag files in, or tap to choose. Accepts
  PDF, DWG, DXF, IFC, ZIP, JPG, PNG; up to 10 files, each up to 50 MB. A file of another type or too large
  is refused on the spot with a one-line reason, before any upload.
- Uploading starts as soon as a file is chosen, so pressing Gönder is quick. Each file shows its name, size,
  a progress bar and a remove (×) button. Upload by `XMLHttpRequest` (for progress) straight to the Storage
  REST endpoint `POST /storage/v1/object/talepler/<path>` with the publishable key; no supabase-js on this
  page.
- Path: `<YYYYMMDD>-<12 random [a-z0-9]>/<cleaned file name>`; one folder per visit, made when the first
  file is chosen. The file name is cleaned to ASCII letters, digits, `-`, `_`, `.` (Turkish letters
  transliterated), so the path always matches the policy.
- Gönder is disabled while a file is still uploading ("Dosyalar yükleniyor…"). A failed upload shows
  "Yüklenemedi, tekrar deneyin" with a retry button; the form can still be sent without it.
- On Gönder the form posts to Formspree as today, with a new hidden field `dosyalar` listing the folder and
  the file names and sizes, so Fırat's e-mail says which files to look for.
- Removing a file before sending only drops it from the list (anon cannot delete); such leftovers are
  cleaned up from the owner panel.
- The spam trap (`_gotcha`) and the conversion tracking in `track.js` stay as they are. The upload module
  is its own file, `assets/senkon/upload.js`, loaded only on `/tasarim/`; `track.js` reads the `dosyalar`
  field like any other.
- Without JavaScript the file box is hidden; the form works as today.

### Owner panel

`/model/panel.html` gains a "Gelen dosyalar" section (signed-in only): folders newest first, each with its
date, files, sizes, a download link (signed URL, 10 minutes) and "Sil" (deletes the folder after a
confirm). It uses the supabase-js the panel already loads.

### Privacy

`/kvkk/` gets one sentence: files sent with the form are kept only to prepare the offer and are deleted
when no longer needed. (Fırat to confirm the wording; no note is added on the Tasarım page itself.)

### Abuse

Anyone holding the public key could upload files that match the policy. Limits keep it small: 50 MB per
file, a fixed set of extensions, a fixed path shape, and the bucket being private (nothing uploaded can be
served to anyone). If it is ever abused, the next step is a Supabase Edge Function that hands out
one-time signed upload URLs after a check; not built now.

## 5. Tests (`node --test`)

- `tests/tasarim-page.test.js`, updated: the story markup (six images in `tasarim-surec/`, six `li` without
  `.num`, `#adimlar` present), `#ornek-pafta` with the sample sentence, the file input with the accepted
  extensions, the hidden `dosyalar` field, the hero main button pointing to `#iletisim`; still forbids "en az
  malzeme", eyebrows and an FAQ.
- `tests/upload.test.js`: name cleaning (Turkish letters, spaces, odd characters), path shape matches the
  policy regex, type and size refusals, the `dosyalar` summary text, Gönder disabled while uploading — with
  a fake `XMLHttpRequest`.
- `tests/pafta.test.js`: zoom clamped to 1×–8×, zoom about the pointer keeps that point fixed, pan clamped
  to the sheet, double-tap toggle.
- `tests/pafta-svg.test.js`: the SVG has the title block text "ÖRNEK PAFTA" and "gerçek bir projeye ait
  değildir", a viewBox in A3 proportions, and no project or client names from the CV.
- `tools/versions.js` covers the new linked files; `tests/versions.test.js` as today.
- Browser check (Claude, in the pane, desktop and phone width): story plays, sheet zooms and opens full
  screen, a real upload lands in the bucket, Formspree receives `dosyalar`, the panel lists and deletes it.
  Fırat checks on his iPhone.

## 6. Who does what, in order

1. Claude: prompts file; `make-surec.py` output argument; page markup and CSS for the story with the
   current Performans pictures as stand-ins.
2. Fırat: generates the six pictures; Claude converts them.
3. Claude: `make-pafta.js`, the sheet, `pafta.js`, the section; `local/ornek-pafta-check.md`.
4. Fırat: checks and corrects the sheet.
5. Claude: `schema-talepler.sql`, `upload.js`, form changes, panel section, `/kvkk/` sentence.
6. Fırat: runs the SQL once.
7. Claude: tests, versions, browser check; then Fırat merges/pushes as usual.

## 7. Out of scope

Separate çelik / betonarme landing variants, a promotional film, LinkedIn Ads, Microsoft Clarity — all
discussed and parked for after this page is live.
