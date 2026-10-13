# "Nasıl çalışıyoruz" story animation — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The six-step list on `deprem-performans/` becomes a six-picture story that plays by itself, pauses when the reader takes over, and still reads as a plain list with pictures when JavaScript is off.

**Architecture:** Six WebP pictures (ChatGPT ink drawings, converted by a Pillow script) sit in a `figure.surec-stage` before the existing `ol.steps`. A small plain-JS file (`assets/senkon/surec.js`, `defer`) adds `surec-live` to the figure and drives frame/step state; every slideshow style hangs off that class, so without it the page shows a static picture strip. `tools/versions.js` tags the new files like the skyline ones.

**Tech Stack:** Static HTML/CSS, vanilla JS (no build), Node `node:test`, Python 3 + Pillow for the pictures.

**Spec:** `docs/superpowers/specs/2026-10-13-surec-animasyon-design.md`

## Global Constraints

- No library, no build step; one script file, `defer`, like `assets/senkon/skyline.js`.
- Pictures: `assets/senkon/surec/01.webp … 06.webp`, 1200×900 greyscale WebP quality 80, 60–90 KB each; no text or colour in them.
- Step titles, in order: `Zemin etüdü`, `Karot testi`, `Röntgen ve donatı okuması`, `Üç boyutlu analiz`, `Deprem performansının belirlenmesi`, `Gerekirse, güçlendirme projesi`. Never "performans düzeyi" in a title.
- Markup shape `li.item > span.num + h3 + p` stays (styles and `tests/perf-page.test.js` depend on it).
- Timing: 5 s per frame, 0.6 s cross-fade, 6 % zoom per frame, 6 s resume delay after a touch.
- Script exits early (static strip stays) without `IntersectionObserver` or with `prefers-reduced-motion: reduce`.
- `.superpowers/` is gitignored; prompts live in `local/` (already gitignored).
- Every versioned file is linked with a `?v=` tag on every page that uses it; `node --test` passes.

## Review Focus

1. A picture file fails to load (404 or slow network): the slideshow must still advance and the step text still highlight; the broken frame shows the `alt`. → Task 5, test "advances past a frame whose image never loads".
2. Reader taps Önceki on frame 1: wraps to frame 6, does not go negative. → Task 5, test "Önceki on the first frame wraps to the last".
3. Section scrolls out while paused by a touch, scrolls back in later: it should resume from the paused frame, not restart at 1, and not resume while the pause is still active. → Task 5, test "leaving and re-entering the viewport keeps the current frame".
4. `versions.js` today insists that `index.html` links every registered file; the pictures and `surec.js` are only on the sub-page, so without the change in Task 4 the check fails (or the files go untagged and are cached stale for four hours after every edit). → Task 4, test "a file linked only by a sub-page is tagged and checked there".
5. Phone width with JS on: the picture must come before the steps and the buttons must not overflow a 375 px screen. → Task 6, preview check at 375×812.

---

### Task 0: Ignore the brainstorm folder

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` as a new line at the end of `.gitignore`**
- [ ] **Step 2: Verify**

Run: `git status --short`
Expected: no `.superpowers/` line.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "Ignore .superpowers/ (brainstorm mockups)"
```

### Task 1: Picture pipeline — prompts, converter, placeholders

**Files:**
- Create: `local/surec-prompts.md` (gitignored; not committed)
- Create: `tools/make-surec.py`
- Create: `assets/senkon/surec/01.webp … 06.webp` (placeholders now; Fırat's pictures replace them later with the same command)
- Test: `tests/surec-pictures.test.js`

**Interfaces:**
- Produces: `python tools/make-surec.py <in.png> <n>` → writes `assets/senkon/surec/0n.webp` (1200×900, mode `L`, WebP q80). `python tools/make-surec.py --placeholder <n>` → writes the same file as white with a thin black border and the number `0n` drawn large in the centre (Pillow default font is fine). `n` is 1–6.

- [ ] **Step 1: Write `local/surec-prompts.md`**

A shared preamble, then six prompts. Preamble (the implementer writes the exact English; these are the fixed points): black ink line drawing on plain white paper, technical sketch style, thin even lines, no shading, no colour, no text, no labels, no people's faces in detail, 4:3, the same plain five-storey reinforced-concrete apartment block in every picture (flat roof, three bays of windows, ground-floor entrance). Then one paragraph per frame from the spec's "The six pictures" list (1 zemin, 2 karot, 3 röntgen+donatı, 4 3B model with record, 5 hatched damaged elements with an empty label box, 6 heavier-line shear wall and jacketed column). Add at the end: "Generate at 1536×1152. Regenerate any frame whose technical detail is wrong; do not retouch."

- [ ] **Step 2: Write the failing test `tests/surec-pictures.test.js`**

```js
'use strict';
// assets/senkon/surec/: the six story pictures for the Deprem performans page, as tools/make-surec.py writes them
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'assets', 'senkon', 'surec');

test('six pictures 01–06, each a WebP under 120 KB', () => {
  for (let n = 1; n <= 6; n++) {
    const f = path.join(DIR, `0${n}.webp`);
    assert.ok(fs.existsSync(f), f);
    const b = fs.readFileSync(f);
    assert.equal(b.slice(0, 4).toString(), 'RIFF');
    assert.equal(b.slice(8, 12).toString(), 'WEBP');
    assert.ok(b.length < 120 * 1024, `${f} is ${b.length} bytes`);
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test tests/surec-pictures.test.js`
Expected: FAIL, `01.webp` does not exist.

- [ ] **Step 4: Write `tools/make-surec.py`**

Docstring in the house style (see `tools/make-og.py`): what it writes, the two usages, `pip install pillow`. `convert(src, n)`: open, `convert('L')`, `ImageOps.fit` to 1200×900, save `assets/senkon/surec/0n.webp` with `quality=80`. `placeholder(n)`: new `L` image 1200×900 white, 4 px black border, `0n` drawn centred with `ImageFont.load_default(size=240)` (Pillow ≥ 10; fall back to the un-sized default if the call raises). Argument parsing with `sys.argv`, no argparse needed.

- [ ] **Step 5: Write the six placeholders**

Run: `for n in 1 2 3 4 5 6; do python tools/make-surec.py --placeholder $n; done`
Expected: six files in `assets/senkon/surec/`, each a few KB.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/surec-pictures.test.js`
Expected: PASS.

- [ ] **Step 7: Commit (not `local/`)**

```bash
git add tools/make-surec.py tests/surec-pictures.test.js assets/senkon/surec/
git commit -m "Story pictures: converter and six placeholders for Nasıl çalışıyoruz"
```

- [ ] **Step 8: Hand the prompts to Fırat**

Send `local/surec-prompts.md`; ask him to generate the six PNGs in ChatGPT and drop them in `local/surec-src/` as `01.png … 06.png`. Later tasks keep using the placeholders; replacing them is Task 7.

### Task 2: The new step list

**Files:**
- Modify: `deprem-performans/index.html:56-63`
- Test: `tests/perf-page.test.js:20-23`

- [ ] **Step 1: Change the test's expected titles to the six in Global Constraints**

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/perf-page.test.js`
Expected: FAIL on "the six assessment steps, in order".

- [ ] **Step 3: Replace the six `li.item` in `deprem-performans/index.html` with the spec's table (titles and draft descriptions verbatim from the spec)**

Keep `<span class="num" aria-hidden="true">0n</span>`, `<h3>`, `<p>`. Update the comment above the section if it still says "six plain steps" in a way that no longer fits.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/perf-page.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deprem-performans/index.html tests/perf-page.test.js
git commit -m "Deprem performans steps: röntgen+donatı and analiz merged, performans and güçlendirme added"
```

### Task 3: Markup and the static (no-JS) layout

**Files:**
- Modify: `deprem-performans/index.html:54-63` (figure before the list)
- Modify: `site.css:109-112` (the `.list2` / `.item` block) and new `.surec*` rules beside it
- Test: `tests/perf-page.test.js`

**Interfaces:**
- Produces, used by Task 5's script:

```html
<section id="adimlar" class="wrap section perf rule">
  <h2 class="perf-sub">Nasıl çalışıyoruz</h2>
  <div class="surec">
    <figure class="surec-stage" aria-label="Değerlendirme adımlarının çizimleri">
      <img src="/assets/senkon/surec/01.webp?v=00000000" alt="Zemin etüdü: bina kesiti, zemin tabakaları ve dalga kaydı" width="1200" height="900" loading="lazy">
      … 02–06 …
      <div class="surec-ctrl"><button type="button" class="surec-prev">← Önceki</button><button type="button" class="surec-next">Sonraki →</button><span class="surec-bar"><i></i></span></div>
    </figure>
    <ol class="steps"> …six li.item… </ol>
  </div>
```

  Alt texts, one line each, the implementer writes in Turkish from the spec's picture list. The `?v=` tags are placeholders until Task 4 runs `versions.js`.

- [ ] **Step 1: Add to `tests/perf-page.test.js`**

```js
test('the story figure: six pictures with alt text, in order, before the steps, plus the two buttons', () => {
  const figAt = html.indexOf('<figure class="surec-stage"'), stepsAt = html.indexOf('<ol class="steps">');
  assert.ok(figAt > 0 && figAt < stepsAt);
  const srcs = [...html.matchAll(/<img src="\/assets\/senkon\/surec\/(\d\d)\.webp\?v=[0-9a-f]{8}" alt="[^"]{10,}" width="1200" height="900" loading="lazy">/g)].map(m => m[1]);
  assert.deepEqual(srcs, ['01', '02', '03', '04', '05', '06']);
  assert.match(html, /<button type="button" class="surec-prev">/);
  assert.match(html, /<button type="button" class="surec-next">/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/perf-page.test.js`
Expected: FAIL, figure not found.

- [ ] **Step 3: Write the markup from the Interfaces block; drop `list2` from the `<ol>` (it is now `class="steps"` only)**

- [ ] **Step 4: CSS in `site.css`, replacing the `.list2` grid rules for this page only**

Keep `.list2` if another page uses it (grep first; the home page has `list2` for Hizmetler). Add after the `.item` rules:

- `.surec{margin-top:20px}` ; `.surec-stage{margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}` ; `.surec-stage img{width:100%;height:auto;border:1px solid var(--rule);background:#fff}` ; `.surec-ctrl{display:none}` ; `ol.steps{border-bottom:1px solid var(--rule)}`.
- `@media (max-width:640px){ .surec-stage{grid-template-columns:repeat(2,minmax(0,1fr))} }`.

  (This is the no-JS strip: three per row, two on phone. The live layout comes in Task 6.)

- [ ] **Step 5: Run the tests**

Run: `node --test tests/perf-page.test.js`
Expected: PASS (the `?v=` placeholder `00000000` satisfies the regex; `versions.test.js` ignores links it does not know yet).

- [ ] **Step 6: Preview the static strip**

Open `deprem-performans/` with JavaScript disabled (or before Task 5 exists, which is the same thing): six numbered placeholders in a 3×2 strip above a single-column list. No horizontal scroll at 375 px.

- [ ] **Step 7: Commit**

```bash
git add deprem-performans/index.html site.css tests/perf-page.test.js
git commit -m "Nasıl çalışıyoruz: picture strip above the steps (static layout)"
```

### Task 4: Cache tags for files that live only on a sub-page

**Files:**
- Modify: `tools/versions.js:17-26` (`LINKS`) and `:46-59` (`stale`)
- Modify: `deprem-performans/index.html` (the `?v=` tags, via the tool)
- Test: `tests/versions.test.js`

**Interfaces:**
- `LINKS` gains `'assets/senkon/surec.js'` and `'assets/senkon/surec/01.webp' … '06.webp'`, each covering only itself.
- `stale(root)` changes its last rule: instead of "index.html must link every file", every key of `LINKS` must be linked (with a tag) by **at least one** page in `PAGES`; the message stays `${link} is not linked with a ?v= tag`.

- [ ] **Step 1: Add to `tests/versions.test.js`**

```js
test('a file linked only by a sub-page is tagged and checked there', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'senkon-v-'));
  for (const f of Object.keys(V.LINKS)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), f); }
  for (const p of V.PAGES) { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), ''); }
  const want = V.expected(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), Object.keys(V.LINKS).filter(l => !l.includes('surec')).map(l => `<a href="${l}?v=${want[l]}">`).join(''));
  fs.writeFileSync(path.join(dir, 'deprem-performans/index.html'), Object.keys(V.LINKS).filter(l => l.includes('surec')).map(l => `<a href="/${l}?v=${want[l]}">`).join(''));
  assert.deepEqual(V.stale(dir), []);
  fs.writeFileSync(path.join(dir, 'deprem-performans/index.html'), '');
  assert.ok(V.stale(dir).some(m => m.includes('surec.js is not linked')));
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/versions.test.js`
Expected: FAIL (`LINKS` has no surec entries; `index.html` rule complains).

- [ ] **Step 3: Edit `LINKS` and `stale()` per Interfaces; update the tool's header comment (it says index.html must link every file)**

- [ ] **Step 4: Add the script tag to `deprem-performans/index.html`, before the inline `<script>` near the end: `<script src="/assets/senkon/surec.js?v=00000000" defer></script>`; create an empty `assets/senkon/surec.js` containing only `'use strict';` so the tag can be computed (Task 5 fills it)**

- [ ] **Step 5: Run the tool, then all tests**

Run: `node tools/versions.js && node --test`
Expected: the six picture tags and the script tag rewritten in `deprem-performans/index.html`; all tests PASS. Also update the first test's name in `versions.test.js` if it still says only index.html and 404.html.

- [ ] **Step 6: Commit**

```bash
git add tools/versions.js tests/versions.test.js deprem-performans/index.html assets/senkon/surec.js
git commit -m "versions.js: a file may be linked by any page, not only index.html; surec files tagged"
```

### Task 5: The script

**Files:**
- Create: `assets/senkon/surec.js`
- Test: `tests/surec.test.js`

**Interfaces:**
- Consumes the markup of Task 3 (`.surec-stage`, its six `img`, `.surec-prev`, `.surec-next`, `.surec-bar i`, `ol.steps li.item`).
- Produces DOM state the CSS of Task 6 styles: `surec-live` on the figure; `on` on the current `img` and on the current `li`; `tabindex="0"` on every `li`; `aria-live="polite"` on the figure; `.surec-bar i` width `0–100%`.
- For tests, the file exports its factory when `module` exists: `module.exports = { setup }` where `setup(fig, list, opts)` returns `{ show(i), cur, playing, tick(now), enter(), leave() }`. `opts = { per: 5000, fade: 600, idle: 6000 }` by default. In the browser the IIFE calls `setup` on `document.querySelector('.surec-stage')` and the sibling `ol.steps` after the early exits.

- [ ] **Step 1: Write `tests/surec.test.js` with a tiny fake DOM**

The repo has no jsdom. Build a minimal fake: `el(tag)` returns `{ classList: Set-backed add/remove/toggle/contains, setAttribute, getAttribute, addEventListener(type, fn) storing handlers, style: {}, children: [], querySelector(sel) / querySelectorAll(sel) resolving only the class selectors the script uses, dispatch(type) calling stored handlers }`. Construct a figure with six img children, a `.surec-ctrl` with prev/next/bar, and a list with six `li`. Tests (names fixed, assertions as written):

```js
test('starts on frame 1 and advances after 5 s', () => { const s = setup(fig, list); s.enter(); s.tick(0); assert.equal(s.cur, 0); s.tick(5001); assert.equal(s.cur, 1); assert.ok(imgs[1].classList.contains('on') && !imgs[0].classList.contains('on')); assert.ok(lis[1].classList.contains('on')); });
test('after frame 6 it loops to 1', () => { … s.show(5); s.tick(t); s.tick(t + 5001); assert.equal(s.cur, 0); });
test('clicking a step jumps there and pauses for 6 s, then resumes', () => { … lis[3].dispatch('click'); assert.equal(s.cur, 3); assert.equal(s.playing, false); s.tick(t + 5999); assert.equal(s.cur, 3); s.tick(t + 6001); assert.equal(s.playing, true); s.tick(t + 6001 + 5001); assert.equal(s.cur, 4); });
test('Önceki on the first frame wraps to the last', () => { … prev.dispatch('click'); assert.equal(s.cur, 5); });
test('Enter on a focused step selects it', () => { … lis[2].dispatch('keydown', { key: 'Enter' }); assert.equal(s.cur, 2); });
test('mouse over the picture pauses, leaving resumes', () => { … fig.dispatch('mouseenter'); s.tick(t + 9000); assert.equal(s.cur, 0); fig.dispatch('mouseleave'); s.tick(t + 9000 + 5001); assert.equal(s.cur, 1); });
test('leaving and re-entering the viewport keeps the current frame', () => { … s.show(2); s.leave(); s.tick(t + 60000); assert.equal(s.cur, 2); s.enter(); s.tick(t + 60000 + 100); assert.equal(s.cur, 2); });
test('advances past a frame whose image never loads', () => { imgs[1].complete = false; … s.tick(5001); s.tick(10002); assert.equal(s.cur, 2); });
test('marks the figure live, the list items focusable, the figure polite', () => { … assert.ok(fig.classList.contains('surec-live')); lis.forEach(l => assert.equal(l.getAttribute('tabindex'), '0')); assert.equal(fig.getAttribute('aria-live'), 'polite'); });
```

  The `…` is the shared setup (fresh DOM per test, `s.enter()`, `s.tick(t)` with `t = 0`). `tick(now)` is the one time source: the script never reads `performance.now()` inside `setup`; the browser wrapper feeds it from `requestAnimationFrame`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/surec.test.js`
Expected: FAIL, `setup` is not a function.

- [ ] **Step 3: Write `assets/senkon/surec.js`**

Header comment in the house style (what it does, what happens without JS / with reduced motion). Structure:

- `function setup(fig, list, opts)`: collect `imgs = fig.querySelectorAll('img')`, `lis = list.querySelectorAll('li')`, `prev/next/bar`; add `surec-live`, `aria-live`, `tabindex`; state `{ cur: -1, playing: true, pausedUntil: 0, hover: false, inView: false, t0: null }`; `show(i)` toggles `on` on `imgs` and `lis` (and restarts the zoom by removing/re-adding `on` on the img; the CSS of Task 6 keys the animation to `.on`); `touch(i)` = `show(i)`, `pausedUntil = last + idle`, `playing = false`; `tick(now)`: record `last = now`; if `!inView` return; `paused = hover || now < pausedUntil`; `playing = !paused`; if paused `t0 = now`, else if `now - t0 >= per` → `t0 = now; show((cur+1) % n)`; bar width = `(now - t0) / per`. `enter()` sets `inView = true` and `t0 = null` (first tick after enter sets it); `leave()` sets `inView = false`. Handlers: `li click` and `keydown` (`Enter`/` `) → `touch(k)`; prev/next → `touch((cur ∓ 1 + n) % n)`; `mouseenter/mouseleave` on `fig`. Image load state is never consulted (that is the "never loads" guarantee).
- Browser wrapper (IIFE, after the early exits for `IntersectionObserver` and reduced motion): `const api = setup(fig, list)`; `new IntersectionObserver(e => e[0].isIntersecting ? api.enter() : api.leave(), { threshold: 0.2 }).observe(fig)`; `requestAnimationFrame(function loop(now) { api.tick(now); requestAnimationFrame(loop); })`.
- Last line: `if (typeof module !== 'undefined') module.exports = { setup };` and the IIFE guarded by `typeof document !== 'undefined'`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/surec.test.js`
Expected: PASS, nine tests.

- [ ] **Step 5: Retag and run everything**

Run: `node tools/versions.js && node --test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/senkon/surec.js tests/surec.test.js deprem-performans/index.html
git commit -m "surec.js: the six-picture story plays, pauses on touch, resumes after 6 s"
```

### Task 6: Live layout and motion, then preview

**Files:**
- Modify: `site.css` (the `.surec*` block from Task 3)

- [ ] **Step 1: Add the `surec-live` rules**

- `.surec-stage.surec-live{position:relative;display:block}` ; `.surec-live img{position:absolute;inset:0;opacity:0;transition:opacity .6s;transform-origin:50% 50%}` ; `.surec-live img.on{opacity:1;animation:surec-zoom 5s ease-out forwards}` ; `@keyframes surec-zoom{from{transform:scale(1)}to{transform:scale(1.06)}}` ; the figure gets `aspect-ratio:4/3;overflow:hidden;border:1px solid var(--rule)` only when live.
- `.surec-live .surec-ctrl{display:flex;align-items:center;gap:12px;position:absolute;left:0;right:0;bottom:-44px}` ; buttons in the `.btn-line` look but smaller (`padding:6px 12px;font-size:14px`); `.surec-bar{flex:1;height:3px;background:var(--rule)} .surec-bar i{display:block;height:100%;width:0;background:var(--ink)}`.
- `.surec:has(.surec-live){display:grid;grid-template-columns:45fr 55fr;gap:0 48px;align-items:start}` with `.surec-stage{position:sticky;top:24px}` and `margin-bottom:56px` to make room for the controls. (`:has` is fine: every browser that runs the script supports it; the fallback is the static strip anyway.)
- `.surec:has(.surec-live) .item{transition:opacity .3s;border-left:3px solid transparent;padding-left:44px;cursor:pointer}` ; `.item.on{border-left-color:var(--ink)}` ; `.surec:has(.surec-live) .item:not(.on){opacity:.4}` ; `.item:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`.
- `@media (max-width:640px){ .surec:has(.surec-live){grid-template-columns:1fr} .surec-live{position:static} }`.
- `@media (prefers-reduced-motion:reduce){ .surec-live img.on{animation:none} }` (belt and braces: the script already exits).

- [ ] **Step 2: Retag, test**

Run: `node tools/versions.js && node --test`
Expected: PASS.

- [ ] **Step 3: Preview at 1920×1080 and 375×812 (`preview_start` on a static server for the repo root, then `deprem-performans/`)**

Check: picture left and steps right on desktop; frame changes every 5 s with a slow zoom and a cross-fade; the active step is full-strength with a dark left bar; clicking step 4 jumps to picture 4 and the bar stops, resumes after 6 s; Önceki on 1 shows 6; Tab reaches the steps and Enter selects; on the phone preset the picture is above the list, buttons fit, no horizontal scroll. Fix and re-check until clean. Also confirm with JS blocked (DevTools or `?nojs` is not available; temporarily rename the script src) that the 3×2 strip shows.

- [ ] **Step 4: Screenshots to Fırat (desktop, phone) before committing**

- [ ] **Step 5: Commit**

```bash
git add site.css deprem-performans/index.html
git commit -m "Nasıl çalışıyoruz: live story layout, zoom and cross-fade"
```

### Task 7: Real pictures and docs

**Files:**
- Replace: `assets/senkon/surec/01.webp … 06.webp`
- Modify: `docs/senkon-site.md` (tools list and a line on the story)
- Modify: `deprem-performans/index.html` (tags, via the tool)

- [ ] **Step 1: Convert Fırat's six PNGs**

Run: `for n in 1 2 3 4 5 6; do python tools/make-surec.py local/surec-src/0$n.png $n; done`
Expected: six files 60–90 KB; `node --test tests/surec-pictures.test.js` PASS. If one is over 120 KB, lower the quality to 70 for that frame and note it in the docstring.

- [ ] **Step 2: Retag and test**

Run: `node tools/versions.js && node --test`
Expected: PASS.

- [ ] **Step 3: Preview again, both widths; screenshots to Fırat; a frame with a wrong technical detail goes back to ChatGPT, not into the repo**

- [ ] **Step 4: Document in `docs/senkon-site.md`**

Add `make-surec.py` to the tools list (line 9) with its two usages, and a short paragraph next to the skyline notes: where the prompts live (`local/surec-prompts.md`), that the sources are kept in `local/surec-src/`, and that the story is `assets/senkon/surec.js` driving `figure.surec-stage` on `deprem-performans/`.

- [ ] **Step 5: Commit**

```bash
git add assets/senkon/surec/ deprem-performans/index.html docs/senkon-site.md
git commit -m "Nasıl çalışıyoruz: the six ink drawings"
```
