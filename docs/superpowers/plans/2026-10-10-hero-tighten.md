# Hero Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the empty band under the header, put the Esenboğa build animation beside the headline, and lift the skyline onto the first desktop screen.

**Architecture:** Markup moves inside `index.html` (the existing Esenboğa `figure[data-skyline]` moves from `#deneyim` into a new `.hero-media` column); layout changes are CSS in `site.css`. `skyline.js` already animates every `figure[data-skyline]`, so no script changes.

**Tech Stack:** Static HTML/CSS on GitHub Pages; `node --test` for structure checks.

**Spec:** `docs/superpowers/specs/2026-10-10-hero-tighten-design.md`

## Global Constraints

- Home page only: `index.html`, `site.css`, plus a new `tests/hero.test.js`.
- Light only; existing tokens (`--tint`, `--muted`, …) — no new colours.
- After any change to a linked file run `node tools/versions.js`; the test gate is bare `node --test`.
- Phone breakpoint for the hero is 860 px (same as the existing hero rule).
- Each section stays a self-contained block (future split into pages).

## Review Focus

- Mid widths (861–1040 px): the two hero columns must not squeeze the headline into 6+ lines or overflow horizontally.
- Phone: the hidden `.hero-media` must not leave a gap or still download/animate visibly.
- The tower and the skyline both animate on load; neither may show the static picture and the animation at once (`data-live`).
- `404.html` still renders (it shares `site.css`; the removed eyebrow rule must not be one it uses).
- Placeholder in Deneyim keeps the two-column `.featured` layout and does not look broken.

---

### Task 1: Hero markup and Deneyim placeholder

**Files:**
- Create: `tests/hero.test.js`
- Modify: `index.html` (hero section ~line 380, `#deneyim` featured figure ~line 449)

**Interfaces:**
- Produces: `.hero` contains `.hero-text` and `.hero-media`; `.hero-media` holds the Esenboğa `figure.skyline` (keeps `data-skyline="assets/senkon/esenboga.json"`, `data-tallest-m="280"`, its `skyline-stage`/`skyline-static` children, gets class `hero-figure` instead of `featured-figure`). Deneyim's figure becomes `<div class="ph featured-ph">Havalimanı</div>`.

- [ ] **Step 1: Write `tests/hero.test.js`** (same style as `tests/logo.test.js`), with tests:
  - `hero has no eyebrow`: the `<section class="wrap hero">…</section>` block contains no `class="eyebrow"`.
  - `Esenboğa animation sits in the hero media slot`: that block contains `class="hero-media"` and `data-skyline="assets/senkon/esenboga.json"`.
  - `Esenboğa is animated only once on the page`: `esenboga.json` occurs exactly once in `index.html`.
  - `Deneyim keeps the project text with a placeholder`: the `#deneyim` section contains `Esenboğa Havalimanı Kontrol Kulesi` and `class="ph featured-ph"`.
- [ ] **Step 2:** `node --test tests/hero.test.js` → FAIL (no hero-media).
- [ ] **Step 3:** Edit `index.html` as in Interfaces; drop the hero eyebrow `<p>`.
- [ ] **Step 4:** `node --test` → all pass (run `node tools/versions.js` first if versions test complains).
- [ ] **Step 5:** Commit `index.html tests/hero.test.js`.

### Task 2: Hero, skyline and placeholder layout

**Files:**
- Modify: `site.css` (hero block ~line 43, skyline ~line 48, featured ~line 75); `index.html` `?v=` tags via `node tools/versions.js`.

- [ ] **Step 1:** `.hero`: two-column grid `minmax(0,1.5fr) minmax(0,1fr)`, `gap:40px`, `align-items:center`, `padding-top:24px; padding-bottom:8px`. `.hero h1` (or `h1` inside `.hero`) `font-size:clamp(34px,4.6vw,52px)`. `.hero-figure{padding:0;max-width:380px;justify-self:end;margin:0}` and its caption hidden (`.hero-figure .skyline-caption{display:none}`) so the tower sits clean.
- [ ] **Step 2:** `@media (max-width:860px)`: `.hero{grid-template-columns:1fr}` and `.hero-media{display:none}`.
- [ ] **Step 3:** Skyline: `.skyline{padding-bottom:40px}`; no extra top gap between hero and skyline.
- [ ] **Step 4:** `.featured-ph{height:auto;aspect-ratio:1150/1360;max-width:420px;justify-self:end;width:100%}` (reuses `.card .ph`-style look: give `.ph` rule a shared selector so `.featured-ph` gets the tint, radius, label placement). Phone: `max-width:340px;justify-self:start` like the old figure.
- [ ] **Step 5:** `node tools/versions.js` then `node --test` → all pass.
- [ ] **Step 6:** Preview at 1920×1080: no band under header, tower beside headline animates, skyline top visible above the fold (`getBoundingClientRect().top < innerHeight` for `#skyline`). At 1000×800: headline ≤ 5 lines, no horizontal scroll. At 375×812: no tower, skyline right after buttons, no horizontal scroll. Check `404.html` still looks right. Screenshot desktop + phone for Fırat.
- [ ] **Step 7:** Commit `site.css index.html 404.html` (whatever versions.js touched).
