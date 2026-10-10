/* Sketch animation for the inline logo (svg.logo-sketch): grey construction lines go down first in quick strokes, then one
   pen draws the ink outline at a steady speed in the order the paths appear, then the thin facet lines and the overshoots
   past the corners, the colour fills come up with their hatching, and last the letters are outlined and filled one by one.
   Runs once per page load. With reduced motion or without JavaScript the finished logo simply shows (a head script sets
   html.sketch only when motion is allowed; the svg is hidden by that class until the pen starts). */
(function () {
  'use strict';
  document.querySelectorAll('svg.logo-sketch').forEach(svg => {
    try { draw(svg); } catch (e) { svg.style.visibility = 'visible'; }   // whatever happens, the logo shows
  });

  function draw(svg) {
    const run = [];                                   // [element, keyframes, delay s, duration s]
    let t = 0.1;
    const len = el => el.getTotalLength();
    const stroke = (el, delay, dur) => {               // reveal a stroke from its start, like a pen
      const L = len(el); el.style.strokeDasharray = L; el.style.strokeDashoffset = L;
      run.push([el, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], delay, dur]);
      return L;
    };
    const pen = (sel, speed, overlap, gap) => {
      svg.querySelectorAll(sel).forEach(el => { const L = len(el); stroke(el, t, L / speed); t += L / speed * overlap + (gap || 0); });
    };
    pen('#cons > *', 6000, 0.3);                     // scaffolding, fast and overlapping
    t += 0.15;
    pen('#ink > *', 1500, 1, 0.01);                  // one continuous pen
    pen('#inner > *', 2000, 0.6);
    pen('#over > *', 3000, 0.25);                    // second pass past the corners
    const fills = svg.querySelector('#fills');
    if (fills) run.push([fills, [{ opacity: 0 }, { opacity: 0.9 }], t - 0.1, 0.5]);
    pen('#hatch line', 6000, 0.3);
    t += 0.15;
    svg.querySelectorAll('#word > *').forEach(el => {        // each letter: outline, then fill
      el.style.stroke = el.parentNode.getAttribute('fill'); el.style.strokeWidth = '1.2';
      stroke(el, t, 0.3);
      run.push([el, [{ fillOpacity: 0 }, { fillOpacity: 0 }, { fillOpacity: 1 }], t, 0.5]);
      t += 0.06;
    });
    svg.style.visibility = 'visible';
    run.forEach(([el, kf, delay, dur]) => el.animate(kf, { delay: delay * 1000, duration: Math.max(dur * 1000, 16), fill: 'both', easing: 'linear' }));
    svg.dataset.sketchTotal = (t + 0.5).toFixed(1);
  }
})();
