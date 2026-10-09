# senkonmuhendislik.com home page: design

Date: 2026-10-09
Owner: Fırat Şentürk (Senkon Mühendislik)
Status: approved in chat on 2026-10-09; visual directions to follow as mockups before build.

## 1. Goal

Replace the current root page (a Şentürk Boya price tool) with the Senkon Mühendislik home
page: who Fırat is, what Senkon does, a few real projects, the StructKit tools, and how to
get in touch. Turkish, phone first, served by GitHub Pages with no build step, consistent
with the logo and distinct from template sites.

## 2. Decisions

| Topic | Decision |
|---|---|
| Audience | Project owners, architects and contractors in Turkey. Turkish, formal but plain. No English version in this round. |
| Sections | Giriş (hero), Hizmetler, Seçilmiş projeler, Hakkında, StructKit, İletişim. One page. |
| Look | **Direction C "Sade beyaz", chosen 2026-10-09 from three mockups** (canvas: https://claude.ai/artifact/48K38jL1ANn642vPSZFXmi). White ground, ink text `#1d2b33`, a serif display face (Fraunces) for the headline and section titles, Work Sans for text, pill buttons (ink fill for the primary, ink outline for secondary), thin rules between items instead of boxes, terracotta `#c47a5a` only inside the hero drawing and on hover, the mammoth mark at 40 px in the header. Dark mode follows the system: ground `#15191c`, text `#e6e2da`, rules `#2a3136`, primary button inverted. The drafting-grid idea from direction A is dropped. |
| Signature element | A three.js hero: a generic steel frame drawn by the existing `model/builder.js` as a slowly turning line drawing. Generic, not a client model. Lazy-loaded, one slow rotation, paused when off-screen, still image fallback. Nothing else on the page animates beyond hover and focus states. |
| Contact | Phone +90 530 925 04 61, WhatsApp on the same number (`wa.me/905309250461`), e-mail `firatsenturk@senkonmuhendislik.com`. No street address. |
| Projects | Three to six text cards from Fırat's list (type, size, location, year; no client names) with a photo slot per card, filled later. |
| Cleanup | Remove all Şentürk Boya material from the repository: `fiyat-listesi.html`, `alternatif_urunler.html`, `stargill_fiyat.html`, `index3.html`, `amazon/`, `assets/` (logos, Excel price lists). Recoverable from git history; old live addresses stop working. `senkonlogo.png` moves to `assets/senkon/`. |
| Untouched | `structkit/`, `model/`, `docs/`, `CNAME`, `.nojekyll`. StructKit's own pages are not restyled in this round. |
| Design docs | Stay public under `docs/` (Fırat's decision 2026-10-09). |
| Process | Spec (this) → two or three visual directions as design mockups → Fırat picks one → short plan → build on branch `home-redesign` → review → Fırat merges. |

## 3. Page content

Copy is Fırat's; the drafts below are placeholders to react to.

**Giriş.** Mark + "Senkon Mühendislik". Title line under the name (Fırat to confirm, for
example "İnşaat Yüksek Mühendisi"). One sentence: "Çelik ve betonarme yapılar için taşıyıcı
sistem tasarımı, deprem değerlendirmesi ve teknik raporlama." Two buttons: "İletişim" (scrolls
to the contact section) and "StructKit" (link). The three.js frame sits beside or behind the
text on desktop and above it on phones, at most 45 % of the first screen's height there.

**Hizmetler.** Four or five cards, one line each (draft):
- Çelik yapı tasarımı: endüstriyel yapılar, laboratuvar ve ofis binaları, çatı ve platformlar.
- Betonarme tasarım: TS 500 ve TBDY 2018'e göre taşıyıcı sistem tasarımı.
- Deprem performans değerlendirmesi: mevcut yapılar için TBDY 2018 kapsamında inceleme.
- Teknik rapor ve danışmanlık: statik rapor, güçlendirme önerileri, ikinci görüş.
- 3B ön tasarım modelleri: konsept aşamasında, telefonda açılan paylaşılabilir modeller.

**Seçilmiş projeler.** Six cards from Fırat's CV (decided 2026-10-09: names as in the CV, with
a line saying they were done at GVN Tasarım ve Mühendislik and Yapı Akademisi Mühendislik):
Antalya Havalimanı yeni terminal (statik tasarım, 10.000 m²), Esenboğa Havalimanı teknik blok
(12.000 m²), Vem İlaç fabrikası (200.000 m²), Alfraganus AVM Taşkent (54.000 m²), Karmall
Rezidans (27.000 m²), Koç Üniversitesi TBDY 2018 değerlendirmesi (25.000 m²). Photo slot per
card for later. No model links.

**Hakkında.** Compact block (decided 2026-10-09): education (İTÜ and SUNY Buffalo, İnşaat
Mühendisliği, 2018; GTÜ Deprem ve Yapı Mühendisliği yüksek lisans, 2025), experience (GVN
Tasarım ve Mühendislik 2023–2024, Yapı Akademisi Mühendislik 2021–2023) and the software
list (ETABS, SAP2000, IDEA StatiCa, ProtaStructure, Sta4CAD, Staad.Pro, AutoCAD, Python).
Title line: "İnşaat Yüksek Mühendisi"; full name Süleyman Fırat Şentürk. No founding year.

**StructKit.** One block: "Tarayıcıda çalışan mühendislik araçları", four named tools
(Kiriş tasarımı, Zımbalama, Temel donatısı, Rüzgar yükleri ASCE/Eurocode) and a link to
`/structkit/`.

**İletişim.** Phone (tel link), WhatsApp button, e-mail (mailto). Footer: "Senkon Mühendislik ·
İstanbul" and the year. Optional founding year if Fırat wants it.

## 4. Visual system

- Colours (final, from the C mockups): ground `#ffffff`, ink `#1d2b33`, body text `#3d4a52`,
  muted `#6b7a83`, rules `#e3e6e8`, tint panels `#f1f3f4`, link `#2f5f6f`, accent
  `#c47a5a` (hero drawing, hover). Dark mode: ground `#15191c`, text `#e6e2da`, body
  `#b7c2c8`, muted `#9aa6ad`, rules `#2a3136`, tint `#1f262b`, link `#9fd0dc`, accent `#e0936f`.
- Type: Fraunces (600, optical size axis) for h1 and h2; Work Sans 400/500/600 for everything
  else. Self-hosted woff2 under `assets/senkon/fonts/` (downloaded from Google Fonts once,
  recorded in the README with hashes) so the page has no third-party request.
- No background grid; the hero drawing carries the engineering character on its own.
- Layout: 16 px gutters on phones, a 1100 px content width on desktop, sections separated by
  generous space rather than boxes. Cards have a thin slate border, no shadows.
- Accessibility: contrast at least 4.5:1 for text, focus rings visible, images with alt text,
  reduced-motion preference respected (the frame does not rotate).

## 5. The hero frame

- Data: a generic parametric model (for example 4 bays × 2 rows, gable roof, panels off) in
  `assets/senkon/hero-model.json`, drawn with `model/builder.js` into a line-only scene:
  columns, rafters, ties and purlins as thin lines, no cladding, no labels, no dimensions.
- Rendering: three.js r128 from `model/vendor/`, loaded only after the page's first paint and
  only when the hero is visible; `LineSegments` in ink (rafters in terracotta) on the white
  ground (inverted in dark mode), an
  orthographic or long-lens perspective view, one rotation about every 40 s.
- Fallback: a static SVG or PNG of the same frame shown until three.js is ready and kept when
  WebGL is missing or `prefers-reduced-motion` is set. Rotation pauses when the hero leaves
  the viewport or the tab is hidden.
- The static SVG carries its own dark-mode colours in a `<style>` block so the fallback is readable in both schemes.
- Budget: three.js (600 KB) is deferred, so the page's first paint depends only on HTML, CSS
  and the fonts.

## 6. Files

```
index.html              the new home page
assets/senkon/
  logo.png              the mammoth mark at 160 px (displayed at 40 px); favicon and apple-touch-icon beside it
  hero-model.json       generic frame data sheet for the hero
  hero.svg              static fallback drawing of the frame
  hero.js               loads three.js lazily, builds the line scene, rotates, pauses
  fonts/                Fraunces and Work Sans woff2 (self-hosted)
site.css                home page styles (not shared with model/ or structkit/)
docs/superpowers/specs/2026-10-09-home-page-design.md   this document
```
Removed: `fiyat-listesi.html`, `alternatif_urunler.html`, `stargill_fiyat.html`, `index3.html`,
`amazon/`, `assets/data/`, `assets/images/`, root `senkonlogo.png` (moved).

## 7. Testing

- Browser pane at 375 × 812 and 1280 × 800, light and dark: layout, grid visibility, contrast,
  no horizontal scroll, buttons reachable with a thumb.
- Links: `tel:`, `wa.me`, `mailto:`, `/structkit/`, `/model/panel.html` is NOT linked
  (owner page stays unlinked).
- Hero: loads after first paint, rotates, pauses off-screen, fallback with WebGL disabled and
  with reduced motion.
- Nothing in `structkit/` or `model/` links to a deleted file (grep before deleting).
- After merge: Fırat opens the page on his iPhone.

## 8. Open points

1. Resolved: direction C (see Decisions).
2. Resolved: content from Fırat's CV; title line "İnşaat Yüksek Mühendisi"; no founding year.
3. Whether StructKit's own pages get the same visual system later (separate piece of work).
