# Hero tightening — design

Date: 2026-10-10 · Branch: `hero-tighten` (off `logo-sketch`, so it carries the pen-sketch header)

## Why

Fırat marked up a screenshot of the live home page:

- **Red:** too much empty space between the header and the headline.
- **Blue:** the right half beside the headline is empty.
- **Green:** the skyline animation sits too low; it should be visible without scrolling.

## What changes (home page only: `index.html`, `site.css`)

1. **Top gap.** Remove the hero eyebrow ("Senkon Mühendislik · İstanbul"); it repeats the logo. Hero top padding 72 px → about 24 px on desktop.
2. **Hero picture.** The hero becomes two columns: text left (~60%), a `hero-media` slot right (~40%). For now the slot holds the Esenboğa build animation (the existing `figure[data-skyline]` with `esenboga.json`, `data-tallest-m="280"`; `skyline.js` already animates every such figure). The headline shrinks a little so it fits the narrower column in 3–4 lines. The slot is generic: a photo carousel (like sdsproje.com) replaces its contents later, once Fırat has publishable photos, without changing the layout around it.
3. **Skyline higher.** Less space above and below the skyline band. Target: at 1920×1080 the top of the skyline animation is on the first screen.
4. **Deneyim.** The Esenboğa drawing there is replaced by a grey placeholder box in the existing `.card .ph` style, labelled "Havalimanı". The project text stays. A real image (structural model screenshot or render, rights to be confirmed) comes later.
5. **Phone (≤ 860 px).** The `hero-media` slot is hidden; text, buttons, then the skyline directly after. Putting the tower under the buttons would push the skyline off the first screen.

## Not now, but kept in mind

Fırat plans to split the long page into separate pages (like sdsproje.com). Sections stay self-contained (own markup block, own CSS rules) so each can move to its own page later. No other prep work now.

## Checks

- `node tools/versions.js` to refresh the `?v=` tags, then bare `node --test` passes.
- Preview at 1920×1080 and iPhone width (375×812): no empty band under the header, tower animates beside the headline, skyline top visible on the first desktop screen, no tower in the phone hero, no horizontal scroll.
- Screenshots to Fırat before committing the code change.
