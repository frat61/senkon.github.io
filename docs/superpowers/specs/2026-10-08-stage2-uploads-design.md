# SENKON model viewer, Stage 2: view-only uploads and the owner page

Date: 2026-10-08
Owner: Fırat Şentürk (Senkon Mühendislik)
Supersedes: Stage 2 ("editor") of `2026-10-08-model-viewer-design.md`, section 10.
Stage 1 (parametric viewer from the database) is live and accepted; this document only adds to it.

## 1. Decision that changed

Models are **view only**. Fırat does not edit models on the site; he makes them in SketchUp,
Revit or Tekla, or (for concept frames) as a parametric data sheet, and shares a link. The
parametric form editor planned as Stage 2 is dropped. In its place:

- an **owner page** where Fırat logs in, adds a model from a file, sees his models with a
  preview picture, copies a model's link, replaces its file, or deletes it;
- the **viewer** learns to draw uploaded 3D files (`kind = 'file'`) next to parametric ones.

Stage 3 of the original spec (DXF import, DXF and PNG export) is parked. A PNG export of the
current view may return later as its own small piece.

## 2. Decisions

| Topic | Decision |
|---|---|
| Owner page | `/model/panel.html`, Turkish, title "Modeller". Desktop first, usable on a phone. |
| Login | Supabase email + password with vendored supabase-js v2. No sign-up, no password reset on the page (reset through the Supabase dashboard). The session persists in the browser until "Çıkış". |
| Input formats | `.glb` and `.gltf` (SketchUp and others) uploaded as they are; `.ifc` (Revit, Tekla) converted to GLB in the owner's browser before upload; `.json` parametric data sheet stored as `kind = 'parametric'`. |
| Stored file format | Always GLB. `file_format = 'glb'`; the original format and file name are kept in `data` as metadata. The public viewer never loads IFC. |
| Storage | Supabase Storage bucket `models`, public read by exact path, no listing. Object path `<slug>/model.glb`. Only the owner may upload or delete. |
| Size limit | 50 MB per file (the free plan's default bucket limit). The page refuses larger files before uploading. |
| Preview | A JPEG thumbnail (480 × 300, quality 0.7, about 30 to 60 KB) rendered in the owner's browser after upload and stored in a new `thumbnail` column. The list shows thumbnails, never live 3D. |
| Links | Unchanged: `/model/?m=<slug>`, 12 random characters. "Dosyayı değiştir" keeps the slug, so a client's link shows the new file. |
| Delete | One confirm dialog ("Bu modeli silmek istediğinize emin misiniz?" Vazgeç / Sil). Deletes the storage object(s), then the row. The link then shows "Model bulunamadı". |
| Duplicate | Dropped. Models do not change, so frozen copies have no purpose. |
| Layers for file models | Not in this stage. Whether a SketchUp tag or an IFC storey becomes a switch is decided once real files from Fırat are available (open point, section 9). |
| Dependencies | three.js r128 (vendored already) plus its `GLTFLoader` and `GLTFExporter` from the same release, vendored; `web-ifc` (WASM) vendored and loaded only by the owner page; supabase-js v2 UMD vendored, loaded only by the owner page. Every vendored file gets its source URL and SHA-256 in `docs/model/README.md`. |

## 3. Owner page (`/model/panel.html`)

**Login card.** E-mail, password, "Giriş". Errors: "E-posta veya şifre hatalı", "Bağlantı
kurulamadı, tekrar deneyin".

**List.** Cards sorted by `updated_at` descending. Each card: thumbnail (or a neutral
placeholder for rows without one), name, kind badge ("Parametrik" or "Dosya"), last change
date, and buttons:
- **Aç**: opens the public link in a new tab.
- **Bağlantıyı kopyala**: puts `https://senkonmuhendislik.com/model/?m=<slug>` on the clipboard, shows "Kopyalandı".
- **Dosyayı değiştir** (file models only): same flow as adding, but into the existing slug; updates `file_path`, metadata, thumbnail; `updated_at` follows from the trigger. The source reference is kept unless a new one is typed.
- **Sil**: confirm dialog, then delete.
A "Çıkış" button and a "Model ekle" button sit in the header.

**Model ekle.** A dialog with name (required), description (optional), source reference
(optional, stored as `data.source` for parametric models and `data.metadata.source` for files)
and a file picker accepting `.glb,.gltf,.ifc,.json`. Flow by extension:

1. `.json`: parse; accept either a row-shaped object `{ name, description, data }` or a bare
   data sheet; the name field in the dialog wins over the file's; an empty dialog name falls back to the file's. Validate with
   `SenkonBuilder.normalize` (throws on bad input) and `data.v <= SenkonBuilder.VERSION`.
   Insert `kind = 'parametric'`. Render once with `SenkonViewer` to capture the thumbnail.
2. `.glb` / `.gltf`: check size, check that `GLTFLoader` parses it (a quick in-memory parse);
   `.gltf` with external buffers or textures is refused with "Yalnızca tek dosyalı .glb veya
   gömülü .gltf" (keeps the storage model to one object). Upload, insert row, render for
   the thumbnail.
3. `.ifc`: check size; load `web-ifc`, read the geometry, build a three.js scene with one
   mesh group per IFC entity type (names like `IfcColumn`, `IfcBeam`, `IfcSlab`), export to
   GLB with `GLTFExporter`; if the resulting GLB (from IFC or from an embedded `.gltf`) exceeds
   50 MB, stop with "Dönüştürülen model çok büyük" and the advice to simplify or export a
   smaller GLB. Upload the GLB, insert the row with
   `data.metadata = { source_format: 'ifc', original_name, original_bytes, glb_bytes,
   converter: 'web-ifc <version>' }`, render for the thumbnail.

Progress is shown per step (Okunuyor, Dönüştürülüyor, Yükleniyor, Önizleme). A failure at
any step leaves no half-made model: the row is inserted only after the upload succeeds, and a
failed thumbnail leaves `thumbnail` null rather than failing the add.

**Order of operations for a file model.** Generate the slug → upload the object to
`<slug>/model.glb` → insert the row → render the thumbnail → update the row with the
thumbnail. For "Dosyayı değiştir": upload to the same path with `upsert`, update `file_path`
(unchanged) and metadata, re-render, update thumbnail.

## 4. Viewer additions (`/model/index.html`)

The shell already branches on `kind`. For `kind = 'file'`:

- Load `vendor/GLTFLoader.r128.js` on demand (a script tag added at run time), so the
  parametric path stays as light as it is.
- Fetch `${SUPABASE_URL}/storage/v1/object/public/models/${file_path}` with progress
  (content length from the response headers; "Model yükleniyor… 37 %").
- Mount `SenkonViewer` in a new **file mode**: `SenkonViewer.mountFile(container, gltfScene, opts)`
  places the scene, computes its bounding box, centres the orbit target on it and sets the
  view distances from its size (the same 1.65 / 3.2 factors as the parametric views, so the
  framing feels the same). glTF is Y-up by definition, so a GLB is used as is; the IFC
  converter is responsible for rotating IFC's Z-up coordinates to Y-up before export. The
  viewer applies no guessing of its own (see open point 9.2).
- Available: orbit, zoom, pan, view presets, two-point measuring by raycast on the meshes
  (no snapping), light and dark theme, the status line. Hidden: all layer buttons, the
  legend's member colours (a short legend "Yüklenmiş model" instead), "Mahal adları".
- Header: name and description from the row; status line from the fixed sentence plus
  `data.metadata.source` and `updated_at`.
- Errors: fetch failure shows "Model yüklenemedi, lütfen tekrar deneyin" with retry; a parse
  failure shows "Model dosyası okunamadı".

Nothing in the parametric path changes.

## 5. Database and storage

```sql
-- docs/model/schema-stage2.sql, run once after schema.sql
alter table public.models add column if not exists thumbnail text;   -- data URL, JPEG

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('models', 'models', true, 52428800, array['model/gltf-binary'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800, allowed_mime_types = array['model/gltf-binary'];

-- Public read by exact path only (public bucket). No select policy for anon on
-- storage.objects, so the bucket cannot be listed.
create policy models_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'models');
create policy models_bucket_update on storage.objects for update to authenticated
  using (bucket_id = 'models') with check (bucket_id = 'models');
create policy models_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'models');
create policy models_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'models');
```

- Policies are per bucket, not per owner: the project has exactly one user and sign-ups are closed, and Supabase's `owner` column on `storage.objects` is deprecated in favour of `owner_id`.
- `get_model(p_slug)` is unchanged and still returns no `thumbnail`, `slug`, `id` or `owner`.
- The owner page reads `models` directly under the existing row-level policy (its own rows
  only), including `thumbnail`.
- `data` for file models holds metadata only; the viewer must never assume `data.axes`
  exists when `kind = 'file'` (already true of the Stage 1 shell).
- Slug generation moves into a shared browser helper (`model/slug.js`, same alphabet and
  rejection sampling as `tools/make-model-sql.js`), used by the owner page.

## 6. Security and privacy

- Only the publishable key is in the pages. Writes require the owner's session token, which
  supabase-js attaches after login.
- A client with a link can fetch exactly one row (through `get_model`) and exactly one storage
  object (by its path, which contains the slug). Neither the table nor the bucket can be
  listed with the publishable key; the plan's acceptance step checks both.
- The owner page is linked from nowhere and carries `noindex`.
- The IFC conversion runs entirely in the owner's browser; the IFC file never leaves the PC.
- Deleting a model removes the storage object before the row, so no orphaned file stays
  reachable. Replacing a file overwrites the same object.
- The thumbnail is a JPEG made from the owner's own render; it contains nothing but the model.

## 7. File layout (additions)

```
model/
  panel.html          owner page shell
  panel.css           owner page styles (shares viewer.css variables)
  panel.js            login, list, add/replace/delete flows, progress
  ingest.js           pure helpers: extension detection, size check, JSON validation,
                      storage path, metadata object, thumbnail options (Node-testable)
  ifc2glb.js          IFC -> three.js scene -> GLB, browser only, loads web-ifc
  slug.js             browser slug generator (shared alphabet with tools/make-model-sql.js)
  vendor/
    GLTFLoader.r128.js       three.js r128 examples/js/loaders
    GLTFExporter.r128.js     three.js r128 examples/js/exporters (owner page only)
    supabase-js.v2.<ver>.min.js   owner page only
    web-ifc/                 web-ifc-api.js + web-ifc.wasm, pinned version (owner page only)
docs/model/
  schema-stage2.sql
  README.md           extended: vendored files table, owner page setup, how to add a model
tests/
  ingest.test.js      node:test
  slug.test.js        node:test
```

## 8. Testing

- Node (`node --test`): `ingest.js` (extension and MIME decisions, size limit, JSON row vs
  bare data sheet, metadata object shape, storage path from slug) and `slug.js` (length,
  alphabet, no look-alikes, two calls differ).
- Browser, local server, with public sample files until Fırat's own arrive: a small GLB from
  the three.js r128 repository examples and a small IFC from the IFC.js/web-ifc test files.
  Checks: login and logout; add each of the three kinds; the thumbnail appears; copy link;
  the public link draws the file model with orbit, views, measuring and the status line on
  desktop and at phone width; replace a file and see the link update; delete and see "Model
  bulunamadı".
- Live, after merge: the same on an iPhone in Safari with a real SketchUp GLB and a real IFC
  from Fırat, plus the two listing checks with the publishable key (`/rest/v1/models` and
  `/storage/v1/object/list/models` both empty or refused).

## 9. Open points, to settle with real files

1. **Layer switches for file models.** SketchUp tags arrive as glTF node names; IFC storeys
   and types arrive as the groups the converter makes. Once Fırat's files are in `local/`,
   decide whether a generic "switch per top-level group" is useful, and whether the IFC
   converter should group by storey instead of by entity type.
2. **Up axis.** Resolved on the public sample (IfcOpenHouse, 2026-10-08): `web-ifc` 0.0.78
   delivers Y-up geometry in metres, so the converter applies no rotation. The converter also
   recentres the model at the origin (`COORDINATE_TO_ORIGIN`), so georeferenced coordinates are
   not preserved; fine for a viewer. SketchUp GLB is Y-up by the glTF definition. Still to
   confirm on Fırat's own exports.
3. **IFC performance.** If a Tekla model with tens of thousands of elements is too slow or
   runs out of memory in the browser, the fallback is a desktop converter (IfcConvert from
   IfcOpenShell, or Blender's IFC add-on) producing the GLB, uploaded through the same
   `.glb` path. The page design does not change.
4. **Units.** `web-ifc` converts IFC lengths to metres itself (confirmed on the sample: a
   2.2 m door). A SketchUp GLB exported in millimetres would arrive 1000× too large; the
   viewer scales its camera to the model's size so it still displays, but measuring would
   read millimetres. Verify on Fırat's own exports and add a unit option to "Model ekle" if
   needed.

## 10. Acceptance

Stage 2 is done when Fırat can, from his desktop without my help, add a SketchUp GLB and an
IFC model on the owner page, send each link, and open both on an iPhone with orbit, measuring
and the status line working; when a deleted model's link shows "Model bulunamadı"; and when
the publishable key can list neither models nor files.
