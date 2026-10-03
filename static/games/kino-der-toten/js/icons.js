// Procedural icons for abilities, items, perks and power-ups (Canvas 2D).
// Every icon is a background gradient plus one or two simple glyphs.

const TAU = Math.PI * 2;
const cache = new Map();

function path(g, pts, close = true) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}

// Glyphs draw in a 100x100 box, centred at 50,50.
const GLYPHS = {
  dagger(g, c) {
    g.fillStyle = c;
    path(g, [[50, 8], [60, 52], [50, 60], [40, 52]]);
    g.fill();
    g.fillRect(34, 58, 32, 7);
    g.fillRect(46, 64, 8, 22);
    g.beginPath();
    g.arc(50, 90, 5, 0, TAU);
    g.fill();
  },
  daggers(g, c) {
    g.save();
    g.translate(50, 50);
    for (const r of [-0.55, 0.55]) {
      g.save();
      g.rotate(r);
      g.translate(-50, -50);
      GLYPHS.dagger(g, c);
      g.restore();
    }
    g.restore();
  },
  sword(g, c) {
    g.save();
    g.translate(50, 50);
    g.rotate(0.78);
    g.fillStyle = c;
    path(g, [[-5, -44], [0, -50], [5, -44], [5, 22], [-5, 22]]);
    g.fill();
    g.fillRect(-15, 20, 30, 6);
    g.fillRect(-3, 26, 6, 16);
    g.restore();
  },
  blink(g, c) {
    g.strokeStyle = c;
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = 0.35 + i * 0.3;
      g.beginPath();
      g.moveTo(14 + i * 14, 70 - i * 6);
      g.lineTo(46 + i * 14, 30 - i * 6);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = c;
    g.beginPath();
    g.arc(78, 24, 10, 0, TAU);
    g.fill();
  },
  lotus(g, c) {
    g.fillStyle = c;
    g.save();
    g.translate(50, 50);
    for (let i = 0; i < 8; i++) {
      g.rotate(TAU / 8);
      path(g, [[0, -46], [6, -18], [0, -12], [-6, -18]]);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, 10, 0, TAU);
    g.fill();
    g.restore();
  },
  toss(g, c) {
    g.strokeStyle = c;
    g.lineWidth = 5;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.arc(50, 70, 28, Math.PI, TAU);
    g.stroke();
    g.setLineDash([]);
    g.save();
    g.translate(50, 34);
    g.scale(0.5, 0.5);
    g.translate(-50, -50);
    GLYPHS.dagger(g, c);
    g.restore();
  },
  bandage(g, c) {
    g.strokeStyle = c;
    g.lineWidth = 11;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(14, 82);
    g.bezierCurveTo(38, 70, 30, 34, 58, 30);
    g.lineTo(84, 18);
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(22 + i * 13, 82 - i * 13);
      g.lineTo(30 + i * 13, 72 - i * 13);
      g.stroke();
    }
  },
  tear(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(50, 12);
    g.bezierCurveTo(70, 40, 80, 56, 80, 66);
    g.arc(50, 66, 30, 0, Math.PI);
    g.bezierCurveTo(20, 56, 30, 40, 50, 12);
    g.fill();
  },
  aura(g, c) {
    g.strokeStyle = c;
    for (let i = 0; i < 3; i++) {
      g.lineWidth = 6 - i * 1.5;
      g.globalAlpha = 1 - i * 0.28;
      g.beginPath();
      g.arc(50, 50, 16 + i * 14, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
  },
  burst(g, c) {
    g.fillStyle = c;
    g.save();
    g.translate(50, 50);
    const n = 12;
    g.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const r = i % 2 ? 18 : 44;
      const a = (i / (n * 2)) * TAU;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.fill();
    g.restore();
  },
  curse(g, c) {
    GLYPHS.aura(g, c);
    g.strokeStyle = c;
    g.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.beginPath();
      g.moveTo(50 + Math.cos(a) * 12, 50 + Math.sin(a) * 12);
      g.quadraticCurveTo(50 + Math.cos(a + 0.6) * 30, 50 + Math.sin(a + 0.6) * 30, 50 + Math.cos(a) * 46, 50 + Math.sin(a) * 46);
      g.stroke();
    }
  },
  eye(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(50, 50, 38, 22, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.beginPath();
    g.arc(50, 50, 13, 0, TAU);
    g.fill();
  },
  strike(g, c) {
    g.strokeStyle = c;
    g.lineCap = 'round';
    g.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.45;
      g.beginPath();
      g.moveTo(50 + Math.cos(a + Math.PI) * 40, 50 + Math.sin(a + Math.PI) * 40);
      g.lineTo(50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40);
      g.stroke();
    }
  },
  lotusPose(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(50, 26, 11, 0, TAU);
    g.fill();
    path(g, [[36, 40], [64, 40], [70, 66], [30, 66]]);
    g.fill();
    g.beginPath();
    g.ellipse(50, 74, 34, 10, 0, 0, TAU);
    g.fill();
  },
  doubleStrike(g, c) {
    g.save();
    g.translate(-10, 0);
    GLYPHS.sword(g, c);
    g.restore();
    g.save();
    g.translate(12, 0);
    g.globalAlpha = 0.6;
    GLYPHS.sword(g, c);
    g.restore();
  },
  wings(g, c) {
    g.fillStyle = c;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(50, 60);
      g.quadraticCurveTo(50 + s * 20, 20, 50 + s * 46, 18);
      g.quadraticCurveTo(50 + s * 30, 40, 50 + s * 40, 46);
      g.quadraticCurveTo(50 + s * 22, 52, 50, 70);
      g.fill();
    }
  },
  shield(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(50, 10);
    g.lineTo(84, 22);
    g.quadraticCurveTo(84, 70, 50, 92);
    g.quadraticCurveTo(16, 70, 16, 22);
    g.closePath();
    g.fill();
  },
  bolt(g, c) {
    g.fillStyle = c;
    path(g, [[58, 6], [24, 56], [46, 56], [38, 94], [76, 40], [54, 40], [64, 6]]);
    g.fill();
  },
  bullets(g, c) {
    g.fillStyle = c;
    for (const x of [34, 58]) {
      g.beginPath();
      g.moveTo(x, 30);
      g.quadraticCurveTo(x + 4, 12, x + 8, 30);
      g.lineTo(x + 8, 82);
      g.lineTo(x, 82);
      g.fill();
    }
  },
  cross(g, c) {
    g.fillStyle = c;
    g.fillRect(40, 16, 20, 68);
    g.fillRect(16, 40, 68, 20);
  },
  skull(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(50, 44, 30, Math.PI * 0.9, Math.PI * 2.1);
    g.lineTo(70, 74);
    g.lineTo(30, 74);
    g.closePath();
    g.fill();
    g.fillRect(36, 74, 28, 12);
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.beginPath();
    g.arc(39, 48, 8, 0, TAU);
    g.arc(61, 48, 8, 0, TAU);
    g.fill();
    path(g, [[50, 56], [45, 66], [55, 66]]);
    g.fill();
  },
  x2(g, c) {
    g.fillStyle = c;
    g.font = '900 54px Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('x2', 50, 54);
  },
  ammo(g, c) {
    g.fillStyle = c;
    g.fillRect(22, 30, 56, 46);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(22, 30, 56, 10);
    g.fillStyle = c;
    g.font = '900 20px Impact, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.8)';
    g.fillText('MAX', 50, 66);
  },
  hammer(g, c) {
    g.fillStyle = c;
    g.save();
    g.translate(50, 50);
    g.rotate(-0.7);
    g.fillRect(-5, -10, 10, 52);
    g.fillRect(-24, -26, 48, 18);
    g.restore();
  },
  nuke(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(50, 30, 30, 18, 0, 0, TAU);
    g.fill();
    g.fillRect(42, 40, 16, 34);
    g.beginPath();
    g.ellipse(50, 80, 28, 8, 0, 0, TAU);
    g.fill();
  },
  tag(g, c) {
    g.fillStyle = c;
    path(g, [[18, 30], [62, 20], [86, 50], [62, 80], [18, 70]]);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.beginPath();
    g.arc(66, 50, 6, 0, TAU);
    g.fill();
    g.font = '900 26px Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText('$', 40, 60);
  },
  flash(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(50, 50, 18, 0, TAU);
    g.fill();
    g.strokeStyle = c;
    g.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.beginPath();
      g.moveTo(50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26);
      g.lineTo(50 + Math.cos(a) * 42, 50 + Math.sin(a) * 42);
      g.stroke();
    }
  },
  gem(g, c) {
    g.fillStyle = c;
    path(g, [[50, 10], [82, 40], [50, 90], [18, 40]]);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    path(g, [[50, 10], [82, 40], [50, 40]]);
    g.fill();
  },
  staff(g, c) {
    g.save();
    g.translate(50, 50);
    g.rotate(0.6);
    g.fillStyle = c;
    g.fillRect(-4, -30, 8, 76);
    g.beginPath();
    g.arc(0, -36, 13, 0, TAU);
    g.fill();
    g.restore();
  },
  hat(g, c) {
    g.fillStyle = c;
    path(g, [[50, 8], [70, 60], [30, 60]]);
    g.fill();
    g.beginPath();
    g.ellipse(50, 66, 40, 12, 0, 0, TAU);
    g.fill();
  },
  hourglass(g, c) {
    g.fillStyle = c;
    g.fillRect(24, 12, 52, 8);
    g.fillRect(24, 80, 52, 8);
    path(g, [[30, 20], [70, 20], [52, 50], [70, 80], [30, 80], [48, 50]]);
    g.fill();
  },
  heart(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(50, 86);
    g.bezierCurveTo(10, 60, 10, 22, 34, 20);
    g.bezierCurveTo(44, 20, 50, 28, 50, 34);
    g.bezierCurveTo(50, 28, 56, 20, 66, 20);
    g.bezierCurveTo(90, 22, 90, 60, 50, 86);
    g.fill();
  },
  flame(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(50, 8);
    g.bezierCurveTo(76, 40, 84, 60, 70, 80);
    g.bezierCurveTo(60, 94, 40, 94, 30, 80);
    g.bezierCurveTo(18, 62, 30, 46, 40, 36);
    g.bezierCurveTo(40, 50, 48, 52, 50, 46);
    g.bezierCurveTo(54, 34, 46, 22, 50, 8);
    g.fill();
  },
  thorns(g, c) {
    GLYPHS.shield(g, c);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      path(g, [[50 + Math.cos(a) * 8, 48 + Math.sin(a) * 8], [50 + Math.cos(a + 0.25) * 26, 48 + Math.sin(a + 0.25) * 26], [50 + Math.cos(a + 0.4) * 8, 48 + Math.sin(a + 0.4) * 8]]);
      g.fill();
    }
  },
  axe(g, c) {
    g.save();
    g.translate(50, 50);
    g.rotate(0.5);
    g.fillStyle = c;
    g.fillRect(-4, -40, 8, 84);
    g.beginPath();
    g.moveTo(4, -36);
    g.quadraticCurveTo(40, -24, 34, 6);
    g.quadraticCurveTo(18, -6, 4, -2);
    g.fill();
    g.restore();
  },
  orb(g, c) {
    const gr = g.createRadialGradient(42, 40, 4, 50, 50, 36);
    gr.addColorStop(0, '#fff');
    gr.addColorStop(0.35, c);
    gr.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(50, 50, 34, 0, TAU);
    g.fill();
  },
  spatula(g, c) {
    g.save();
    g.translate(50, 50);
    g.rotate(-0.6);
    g.fillStyle = c;
    g.fillRect(-4, -4, 8, 50);
    g.beginPath();
    g.roundRect ? g.roundRect(-18, -46, 36, 40, 8) : g.rect(-18, -46, 36, 40);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (const x of [-9, 0, 9]) g.fillRect(x - 2, -40, 4, 26);
    g.restore();
  },
  poro(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(50, 56, 32, 0, TAU);
    g.fill();
    g.fillStyle = '#3a2a1e';
    g.beginPath();
    g.arc(40, 50, 5, 0, TAU);
    g.arc(60, 50, 5, 0, TAU);
    g.fill();
    g.fillStyle = '#ff8fa3';
    g.beginPath();
    g.ellipse(50, 66, 8, 6, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#c9b48a';
    path(g, [[28, 34], [22, 14], [40, 28]]);
    g.fill();
    path(g, [[72, 34], [78, 14], [60, 28]]);
    g.fill();
  },
  boot(g, c) {
    g.fillStyle = c;
    path(g, [[30, 12], [54, 12], [54, 58], [84, 70], [84, 86], [26, 86]]);
    g.fill();
  },
  claw(g, c) {
    g.strokeStyle = c;
    g.lineCap = 'round';
    g.lineWidth = 8;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(30 + i * 18, 16);
      g.quadraticCurveTo(22 + i * 18, 52, 34 + i * 16, 86);
      g.stroke();
    }
  },
  bear(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(50, 56, 30, 0, TAU);
    g.arc(26, 28, 12, 0, TAU);
    g.arc(74, 28, 12, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.beginPath();
    g.arc(40, 52, 5, 0, TAU);
    g.arc(60, 52, 5, 0, TAU);
    g.fill();
    g.fillRect(44, 66, 12, 4);
  },
  potion(g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(50, 62, 26, 0, TAU);
    g.fill();
    g.fillRect(42, 14, 16, 30);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(42, 56, 8, 0, TAU);
    g.fill();
  },
  letter(g, c, t) {
    g.fillStyle = c;
    g.font = '900 56px Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t || '?', 50, 54);
  },
};

/**
 * spec: { bg: [top, bottom], glyph, fg, glyph2?, fg2?, round?, border?, text? }
 * Returns a canvas (cached by key).
 */
export function icon(spec, size = 64) {
  const key = JSON.stringify(spec) + size;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.save();
  if (spec.round) {
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 1, 0, TAU);
    g.clip();
  }
  const gr = g.createLinearGradient(0, 0, 0, size);
  gr.addColorStop(0, spec.bg[0]);
  gr.addColorStop(1, spec.bg[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  // vignette
  const rg = g.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.75);
  rg.addColorStop(0, 'rgba(255,255,255,0.08)');
  rg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  g.scale(size / 100, size / 100);
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 6;
  const draw = GLYPHS[spec.glyph] || GLYPHS.letter;
  draw(g, spec.fg || '#fff', spec.text);
  if (spec.glyph2) {
    g.save();
    g.translate(56, 56);
    g.scale(0.42, 0.42);
    (GLYPHS[spec.glyph2] || GLYPHS.letter)(g, spec.fg2 || '#fff', spec.text2);
    g.restore();
  }
  g.restore();
  if (spec.round) {
    g.lineWidth = Math.max(2, size / 20);
    g.strokeStyle = spec.border || 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - g.lineWidth / 2, 0, TAU);
    g.stroke();
  }
  cache.set(key, c);
  return c;
}

/** Copy a cached icon into a fresh canvas element (one node can't live in two places). */
export function iconEl(spec, size = 64, cls = '') {
  const src = icon(spec, size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  if (cls) c.className = cls;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
