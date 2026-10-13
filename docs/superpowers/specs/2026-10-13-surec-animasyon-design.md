# "Nasıl çalışıyoruz" story animation — design

Date: 2026-10-13 · Branch: `surec-animasyon` (off `main`) · Page: `deprem-performans/`

## Why

The six-step list on the Deprem performans page is plain text. Fırat wants the process told as a
story: six pictures, one per step, playing beside the steps. The pictures are generated in ChatGPT
from prompts written here; the animation is plain JavaScript in the repo (no AI video, no React: the
site has no build step, and a six-frame slideshow does not earn one).

## The steps (the list changes too)

Fırat merged the old 3+4 and 5+6, which happen together in practice, and added two closing steps.
Titles are his; descriptions reuse the current sentences where they fit and are his to edit.

| # | Title | Description (draft) |
|---|---|---|
| 01 | Zemin etüdü | Binanın oturduğu zemin incelenir; zeminin deprem dalgalarını nasıl büyüttüğü belirlenir. |
| 02 | Karot testi | Kolon ve perdelerden silindir beton numuneler alınır; betonun gerçek dayanımı laboratuvarda ölçülür. |
| 03 | Röntgen ve donatı okuması | Betonu kırmadan, tarama cihazıyla donatının yeri ve aralığı belirlenir; seçilen noktalarda pas payı açılır, donatının çapı, adedi ve korozyon durumu yerinde görülür. |
| 04 | Üç boyutlu analiz | Toplanan verilerle binanın 3B modeli kurulur; TBDY 2018 ve ASCE 41'e göre doğrusal olmayan analiz yapılır. Gerektiğinde 6 Şubat 2023 Kahramanmaraş depremleri gibi gerçek deprem kayıtları, sahanın deprem tehlikesine göre ölçeklenerek uygulanır. |
| 05 | Deprem performansının belirlenmesi | Hangi kolon, kiriş ve perdelerin ne ölçüde hasar gördüğü eleman eleman belirlenir; binanın bütün olarak hedeflenen performansı sağlayıp sağlamadığı ortaya konur. |
| 06 | Gerekirse, güçlendirme projesi | Hedefe ulaşmayan binalar için en az müdahaleyle performansı sağlayan güçlendirme projesi hazırlanır. |

"Performans düzeyi" is avoided in titles: owners do not know the term.

## The six pictures

Black pen line on paper-white, same family as the Esenboğa drawing and the logo sketch; no colour, no
shading, no text in the picture. One building in every frame: a plain five-storey reinforced-concrete
apartment block, so the frames read as one inspection of one building.

1. **Zemin etüdü:** building in section on layered soil; geophone line on the ground, wave trace below.
2. **Karot:** close-up of a column with a core drill clamped to it; one cylinder sample beside it.
3. **Röntgen ve donatı:** engineer holding a rebar scanner flat on a column, bars dashed inside the
   concrete; a small opened square of cover lower down with calipers on a bar.
4. **3B analiz:** the same building as a wire-frame model (beams, columns, nodes), slightly rotated,
   an acceleration record drawn along its base.
5. **Performans:** the wire-frame with a few elements hatched (damaged), the rest plain; a small
   whole-building label box beside it (empty, the page text explains it).
6. **Güçlendirme:** the wire-frame with the added strengthening in heavier line: a new shear wall
   and a jacketed column.

Files: `assets/senkon/surec/01.webp … 06.webp`, 4:3, generated at 1536×1152, converted to WebP
of about 60–90 KB each by a new `tools/make-surec.py` (Pillow, like `compose-skyline.py`: open the
PNG, convert to greyscale, resize to 1200×900, save WebP quality 80).
Prompts live in `local/surec-prompts.md` (gitignored) with a shared style preamble; a frame with a
wrong technical detail is regenerated, not retouched.

## Layout (`deprem-performans/index.html`, `site.css`)

- Desktop: picture left (about 45 % width, 4:3), the six steps stacked in one column on the right
  (the current two-column `list2` grid goes). The active step is full strength with a 3 px dark bar on
  its left edge; the other five are dimmed to 40 %. Under the picture: Önceki / Sonraki buttons and a
  thin progress line.
- Phone (≤ 640 px): picture on top, full width, steps below in one column, same controls.
- "Çalışmanın sonunda" stays below, unchanged.
- Markup: the `<ol class="steps">` keeps its `li.item > span.num + h3 + p` shape (the test and the
  styles depend on it). The pictures are six `<img>` in a `figure.surec-stage` before the list, each
  with `alt` and `width`/`height`, `loading="lazy"`.
- Without JavaScript, or with `prefers-reduced-motion: reduce`: no slideshow; the six pictures show
  as a static strip above the list (CSS grid, three per row on desktop, two on phone), each with its
  number. The script adds a `surec-live` class to the figure only when it runs; all slideshow styles
  hang off that class.

## Behaviour (`assets/senkon/surec.js`, plain JS, `defer`, about 80 lines)

- Starts on frame 1 when the section enters the viewport (IntersectionObserver) and stops its timer
  when it leaves.
- 5 s per frame. Each frame gets a slow 6 % zoom while shown, then a 0.6 s cross-fade to the next.
  After frame 6, back to 1.
- Clicking a step, or Önceki / Sonraki, jumps there and pauses; resumes after 6 s without a touch.
  Mouse over the picture pauses; leaving resumes.
- Keyboard: steps are `<button>`s inside the `li` (or the `li` gets `tabindex="0"` and Enter/Space),
  so Tab + Enter works. `aria-live="polite"` on the figure so the frame change is announced once.
- Exits early (static strip stays) if `IntersectionObserver` is missing or reduced motion is on,
  like `skyline.js`.

## Checks

- `tests/perf-page.test.js`: the step list is updated to the six new titles; a new test checks the
  six `img` tags with `alt`, in order, and that the slideshow markup is present without needing JS.
- `node tools/versions.js` to tag `surec.js` and the new pictures, then `node --test` passes.
- Preview at 1920×1080 and 375×812: slideshow plays, click pauses, resumes after 6 s, no horizontal
  scroll, static strip shows with JS disabled.
- Screenshots to Fırat before committing the code change.

## Not now

- Home page: a single still (frame 1 or 4) could replace the Esenboğa placeholder later; not here.
- Captions inside the pictures: none; the step text is the caption.
