// The round counter: red chalk tally marks for rounds 1-5, a brushed number after.
// Drawn as SVG paths with a little wobble so every mark looks hand made.

import { prng } from './util.js';

const NS = 'http://www.w3.org/2000/svg';

function stroke(rng, x0, y0, x1, y1, w) {
  // a slightly bent quad with ragged ends, like a chalk/brush stroke
  const mx = (x0 + x1) / 2 + (rng() - 0.5) * 6, my = (y0 + y1) / 2 + (rng() - 0.5) * 6;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w, ny = (dx / len) * w;
  const j = () => (rng() - 0.5) * w * 0.8;
  return `M${x0 + nx * 0.6 + j()},${y0 + ny * 0.6 + j()} Q${mx + nx},${my + ny} ${x1 + nx * 0.4 + j()},${y1 + ny * 0.4 + j()} L${x1 - nx * 0.5 + j()},${y1 - ny * 0.5 + j()} Q${mx - nx},${my - ny} ${x0 - nx * 0.7 + j()},${y0 - ny * 0.7 + j()} Z`;
}

export function drawRound(svg, round) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `
    <filter id="chalk" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3"/>
    </filter>
    <linearGradient id="bloodG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3242b"/>
      <stop offset="1" stop-color="#8f0b10"/>
    </linearGradient>`;
  svg.appendChild(defs);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('filter', 'url(#chalk)');
  g.setAttribute('fill', 'url(#bloodG)');
  svg.appendChild(g);
  if (round <= 0) return;
  if (round <= 5) {
    const rng = prng(round * 7919 + 13);
    const n = Math.min(round, 4);
    for (let i = 0; i < n; i++) {
      const x = 22 + i * 30 + (rng() - 0.5) * 4;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', stroke(rng, x + (rng() - 0.5) * 6, 16 + rng() * 6, x + (rng() - 0.5) * 8, 100 - rng() * 6, 6));
      g.appendChild(p);
    }
    if (round === 5) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', stroke(rng, 6, 90, 132, 22, 6.5));
      g.appendChild(p);
    }
    return;
  }
  const t = document.createElementNS(NS, 'text');
  t.textContent = String(round);
  t.setAttribute('x', '6');
  t.setAttribute('y', '104');
  t.setAttribute('font-family', 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif');
  t.setAttribute('font-size', '112');
  t.setAttribute('letter-spacing', '2');
  t.setAttribute('stroke', '#3a0204');
  t.setAttribute('stroke-width', '2');
  g.appendChild(t);
}
