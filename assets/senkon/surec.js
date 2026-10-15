/* The "Nasıl çalışıyoruz" story on deprem-performans/ and tasarim/: the six step pictures in figure.surec-stage play one
   after another (5 s each: the new one is drawn in stroke by stroke like a pen sketch over 2.5 s, with a slow
   zoom, and a cross-fade) while the matching step in ol.steps is lit. Clicking a
   step, Önceki or Sonraki jumps there and pauses; 6 s without a touch and it resumes. A mouse resting on the
   picture pauses too (a finger does not: phones send a mouseenter after a tap and never a mouseleave), and so
   does keyboard focus on a step, for as long as it stays. It only runs while the figure is on screen. Without JavaScript, with reduced motion
   or in an old browser the pictures simply stay as the plain strip the CSS draws by default: the script adds
   .surec-live to the figure and every slideshow rule hangs off that class.
   The pen effect: once a picture has loaded, label() reads its ink (dark pixels) and groups it into connected
   strokes, in top-left-first order, each stroke growing outward from its first pixel; a canvas over the picture
   then paints those pixels in that order while the picture itself stays hidden, and hands over when done.
   setup() and label() are exported for tests, which feed them a fake DOM, a hand-fed clock and tiny pictures. */
(function () {
  'use strict';

  const PER = 5000, IDLE = 6000, SKETCH = 2500, INK = 200;   // ms per frame; ms without a touch before play resumes; ms to draw a frame; grey below this is ink

  function setup(fig, list, opts) {
    const per = (opts && opts.per) || PER, idle = (opts && opts.idle) || IDLE;
    const imgs = fig.querySelectorAll('img'), lis = list.querySelectorAll('li'), n = imgs.length;
    const prev = fig.querySelector('.surec-prev'), next = fig.querySelector('.surec-next'), bar = fig.querySelector('.surec-bar i');
    const api = { cur: -1, playing: true };
    let inView = false, hover = false, focused = false, viaPointer = false, pausedUntil = 0, t0 = null, last = 0;

    fig.classList.add('surec-live');

    function show(i) {
      if (i === api.cur) return;
      api.cur = i;
      if (api.onshow) api.onshow(i);
      for (let k = 0; k < n; k++) {
        imgs[k].classList.remove('on');
        if (k === i) { void imgs[k].offsetHeight; imgs[k].classList.add('on'); }   // the reflow restarts the zoom
        lis[k].classList.toggle('on', k === i);
        if (k === i) lis[k].setAttribute('aria-current', 'step'); else lis[k].removeAttribute('aria-current');
      }
    }
    function touch(i) {                     // the reader took over: go there, hold, then play on
      show(i);
      pausedUntil = last + idle;
      api.playing = false;
      t0 = last;
      if (bar) bar.style.width = '0%';
    }
    function tick(now) {
      last = now;
      if (!inView) return;
      if (t0 === null) t0 = now;
      const paused = hover || focused || now < pausedUntil;
      if (paused) { api.playing = false; t0 = now; return; }
      if (!api.playing) t0 = now;             // just resumed: a fresh frame, however long the pause went unticked
      api.playing = true;
      if (now - t0 >= per) { t0 = now; show((api.cur + 1) % n); }
      if (bar) bar.style.width = Math.round((now - t0) / per * 100) + '%';
    }

    for (let k = 0; k < n; k++) {
      lis[k].setAttribute('tabindex', '0');
      lis[k].addEventListener('pointerdown', () => { viaPointer = true; });
      lis[k].addEventListener('focusin', () => { focused = !viaPointer; viaPointer = false; });   // Tab pauses; a click only touches
      lis[k].addEventListener('focusout', () => { focused = false; });
      lis[k].addEventListener('click', () => { viaPointer = false; touch(k); });
      lis[k].addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); touch(k); } });
    }
    if (prev) prev.addEventListener('click', () => touch((api.cur - 1 + n) % n));
    if (next) next.addEventListener('click', () => touch((api.cur + 1) % n));
    fig.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    fig.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hover = false; });

    api.show = show;
    api.tick = tick;
    api.enter = () => { inView = true; t0 = null; };
    api.leave = () => { inView = false; };
    show(0);
    return api;
  }

  /* Drawing order for a greyscale picture (gray: one byte per pixel, row by row): every ink pixel once, grouped
     into 8-connected strokes; strokes start in scan order (top-left first) and each is traversed breadth-first
     from its first pixel, so a line grows along its length. Returns { order, groups }. */
  function label(gray, w, h) {
    const n = w * h, seen = new Uint8Array(n), order = new Uint32Array(n), queue = new Int32Array(n);
    let count = 0, groups = 0;
    for (let start = 0; start < n; start++) {
      if (seen[start] || gray[start] >= INK) continue;
      groups++;
      let head = 0, tail = 0;
      queue[tail++] = start; seen[start] = 1;
      while (head < tail) {
        const p = queue[head++]; order[count++] = p;
        const x = p % w, y = (p - x) / w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (!seen[q] && gray[q] < INK) { seen[q] = 1; queue[tail++] = q; }
        }
      }
    }
    return { order: order.subarray(0, count), groups };
  }

  /* The pen over the pictures: one canvas in the figure; sketches is the per-picture { gray, order } once a
     picture has loaded and been labelled in idle time. tick(now) paints the next slice of the current drawing. */
  function sketcher(fig, imgs) {
    const pic = fig.querySelector('.surec-pic'), canvas = document.createElement('canvas');
    const w = imgs[0].naturalWidth || imgs[0].width, h = imgs[0].naturalHeight || imgs[0].height;
    canvas.width = w; canvas.height = h; canvas.setAttribute('aria-hidden', 'true');
    pic.appendChild(canvas);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const sketches = [];
    let cur = -1, t0 = 0, done = 0, out = null, endAt = 0;
    const later = window.requestIdleCallback || (f => setTimeout(f, 50));
    imgs.forEach((img, i) => {
      const prep = () => later(() => {
        try {
          ctx.drawImage(img, 0, 0, w, h);
          const d = ctx.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
          for (let p = 0; p < gray.length; p++) gray[p] = d[p * 4];       // the pictures are grey, so one channel is enough
          ctx.clearRect(0, 0, w, h);
          sketches[i] = { gray, order: label(gray, w, h).order };
        } catch (e) { sketches[i] = null; }                                // a tainted canvas or no image: that frame just appears
      });
      if (img.complete && img.naturalWidth) prep(); else img.addEventListener('load', prep, { once: true });
    });
    function start(i, now) {
      stop();
      if (!sketches[i]) return;
      cur = i; t0 = now; done = 0; endAt = 0;
      out = ctx.createImageData(w, h);
      fig.classList.add('sketching');
      canvas.classList.remove('on'); void canvas.offsetHeight; canvas.classList.add('on');   // the zoom restarts with the picture's
    }
    function stop() { cur = -1; fig.classList.remove('sketching'); canvas.classList.remove('on'); ctx.clearRect(0, 0, w, h); }
    function tick(now) {
      if (cur < 0) return;
      if (endAt) { if (now >= endAt) stop(); return; }                      // the picture has faded in over the drawing
      const { gray, order } = sketches[cur], d = out.data;
      const target = Math.min(order.length, Math.floor(Math.min(1, (now - t0) / SKETCH) * order.length));
      if (target > done) {
        let x0 = w, x1 = 0, y0 = h, y1 = 0;
        for (let k = done; k < target; k++) {
          const p = order[k], x = p % w, y = (p - x) / w;
          d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = gray[p]; d[p * 4 + 3] = 255;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        ctx.putImageData(out, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        done = target;
      }
      if (done >= order.length) { fig.classList.remove('sketching'); endAt = now + 700; }
    }
    return { start, tick };
  }

  if (typeof module !== 'undefined') module.exports = { setup, label };
  if (typeof document === 'undefined') return;
  if (!('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fig = document.querySelector('.surec-stage'), surec = fig && fig.closest('.surec'), list = surec && surec.querySelector('ol.steps');   // the figure sits in .surec-pin with the heading; the steps are the block's other column
  if (!fig || !list) return;
  const api = setup(fig, list);
  let pen = null, last = 0;
  try { pen = sketcher(fig, fig.querySelectorAll('img')); } catch (e) { pen = null; }
  if (pen) api.onshow = i => pen.start(i, last);
  new IntersectionObserver(es => { es[es.length - 1].isIntersecting ? api.enter() : api.leave(); }, { threshold: 0.2 }).observe(fig);
  requestAnimationFrame(function loop(now) { last = now; api.tick(now); if (pen) pen.tick(now); requestAnimationFrame(loop); });
})();
