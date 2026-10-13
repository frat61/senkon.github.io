/* The "Nasıl çalışıyoruz" story on deprem-performans/: the six step pictures in figure.surec-stage play one
   after another (5 s each, a slow zoom, a cross-fade) while the matching step in ol.steps is lit. Clicking a
   step, Önceki or Sonraki jumps there and pauses; 6 s without a touch and it resumes. A mouse resting on the
   picture pauses too (a finger does not: phones send a mouseenter after a tap and never a mouseleave), and so
   does keyboard focus on a step, for as long as it stays. It only runs while the figure is on screen. Without JavaScript, with reduced motion
   or in an old browser the pictures simply stay as the plain strip the CSS draws by default: the script adds
   .surec-live to the figure and every slideshow rule hangs off that class.
   setup() is exported for tests, which feed it a fake DOM and a hand-fed clock. */
(function () {
  'use strict';

  const PER = 5000, IDLE = 6000;      // ms per frame; ms without a touch before play resumes

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

  if (typeof module !== 'undefined') module.exports = { setup };
  if (typeof document === 'undefined') return;
  if (!('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fig = document.querySelector('.surec-stage'), list = fig && fig.parentNode.querySelector('ol.steps');
  if (!fig || !list) return;
  const api = setup(fig, list);
  new IntersectionObserver(es => { es[0].isIntersecting ? api.enter() : api.leave(); }, { threshold: 0.2 }).observe(fig);
  requestAnimationFrame(function loop(now) { api.tick(now); requestAnimationFrame(loop); });
})();
