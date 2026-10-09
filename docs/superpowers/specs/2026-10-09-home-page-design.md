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
| Sections | Giriş (hero), Hizmetler, Seçilmiş projeler, StructKit, İletişim. One page. |
| Look | From the logo: light paper background with a faint drafting grid and a few construction lines, slate-teal text and headings, terracotta for actions, sage for secondary marks, the mammoth as the hero mark. Dark mode follows the system. |
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

**Seçilmiş projeler.** Cards: project type (bold), one line with size, location and year, an
optional photo. Order and wording from Fırat. No client names, no model links.

**StructKit.** One block: "Tarayıcıda çalışan mühendislik araçları", four named tools
(Kiriş tasarımı, Zımbalama, Temel donatısı, Rüzgar yükleri ASCE/Eurocode) and a link to
`/structkit/`.

**İletişim.** Phone (tel link), WhatsApp button, e-mail (mailto). Footer: "Senkon Mühendislik ·
İstanbul" and the year. Optional founding year if Fırat wants it.

## 4. Visual system

- Colours from the logo: slate teal `#2f5f6f` (text, headings), ink `#1d2b33`, paper `#f6f4ef`,
  grid lines `#d9d3c7`, terracotta `#c47a5a` (buttons, highlights), sage `#9bb89a` (secondary).
  Dark mode: paper `#15191c`, text `#e6e2da`, grid `#2a3136`, accents unchanged. Exact values are
  tuned in the mockups.
- Type: one family with a condensed heavy weight for headings and a regular weight for text
  (candidates: Barlow Condensed + Barlow, or Archivo Narrow + Archivo, from Google Fonts, or
  self-hosted). Decided in the mockups.
- Grid and construction lines are CSS backgrounds (no images), faint enough to pass contrast.
- Layout: 16 px gutters on phones, a 1100 px content width on desktop, sections separated by
  generous space rather than boxes. Cards have a thin slate border, no shadows.
- Accessibility: contrast at least 4.5:1 for text, focus rings visible, images with alt text,
  reduced-motion preference respected (the frame does not rotate).

## 5. The hero frame

- Data: a generic parametric model (for example 4 bays × 2 rows, gable roof, panels off) in
  `assets/senkon/hero-model.json`, drawn with `model/builder.js` into a line-only scene:
  columns, rafters, ties and purlins as thin lines, no cladding, no labels, no dimensions.
- Rendering: three.js r128 from `model/vendor/`, loaded only after the page's first paint and
  only when the hero is visible; `LineSegments` in slate teal on the paper background, an
  orthographic or long-lens perspective view, one rotation about every 40 s.
- Fallback: a static SVG or PNG of the same frame shown until three.js is ready and kept when
  WebGL is missing or `prefers-reduced-motion` is set. Rotation pauses when the hero leaves
  the viewport or the tab is hidden.
- Budget: three.js (600 KB) is deferred, so the page's first paint depends only on HTML, CSS
  and the fonts.

## 6. Files

```
index.html              the new home page
assets/senkon/
  logo.png              the mammoth mark, web size (about 600 px wide), from senkonlogo.png
  hero-model.json       generic frame data sheet for the hero
  hero.svg              static fallback drawing of the frame
  hero.js               loads three.js lazily, builds the line scene, rotates, pauses
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

1. Visual direction: two or three mockups (hero layout, card style, type) for Fırat to pick.
2. Content from Fırat: project list, title line, founding year, wording corrections.
3. Whether StructKit's own pages get the same visual system later (separate piece of work).
