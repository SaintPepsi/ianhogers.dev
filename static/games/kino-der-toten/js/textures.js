// Procedural canvas textures: carpet, wood, tiles, brick, wallpaper, concrete, posters.
// Generated once at boot; no image files.

import * as THREE from 'three';
import { prng } from './util.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  return t;
}

function grain(g, w, h, amount, rnd, dark = true) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * (dark ? 1 : 0.8)));
  }
  g.putImageData(img, 0, 0);
}

function stains(g, w, h, rnd, n, color) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

export function makeTextures() {
  const T = {};
  const rnd = prng(1935);

  // theatre carpet: deep red with a gold diamond motif
  {
    const [c, g] = canvas(256);
    g.fillStyle = '#5a0f14';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(214,168,74,0.55)';
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = i * 64 + 32, y = j * 64 + 32;
        g.beginPath();
        g.moveTo(x, y - 22);
        g.lineTo(x + 22, y);
        g.lineTo(x, y + 22);
        g.lineTo(x - 22, y);
        g.closePath();
        g.stroke();
        g.fillStyle = 'rgba(214,168,74,0.35)';
        g.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    g.strokeStyle = 'rgba(30,0,4,0.6)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64, 256);
      g.moveTo(0, i * 64);
      g.lineTo(256, i * 64);
      g.stroke();
    }
    stains(g, 256, 256, rnd, 12, 'rgba(20,0,0,0.35)');
    grain(g, 256, 256, 26, rnd);
    T.carpet = tex(c);
  }
  // dark wooden boards (stage, backstage)
  {
    const [c, g] = canvas(256);
    for (let i = 0; i < 8; i++) {
      const base = 60 + rnd() * 25;
      g.fillStyle = `rgb(${base + 26},${base * 0.62 + 8},${base * 0.36})`;
      g.fillRect(0, i * 32, 256, 32);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, i * 32, 256, 2);
      const off = rnd() * 256;
      g.fillRect(off, i * 32, 2, 32);
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = 'rgba(30,15,5,0.25)';
        g.beginPath();
        const y = i * 32 + 4 + rnd() * 24;
        g.moveTo(0, y);
        g.bezierCurveTo(80, y + rnd() * 6 - 3, 170, y + rnd() * 6 - 3, 256, y);
        g.stroke();
      }
    }
    stains(g, 256, 256, rnd, 10, 'rgba(10,5,0,0.4)');
    grain(g, 256, 256, 22, rnd);
    T.wood = tex(c);
  }
  // black and white lobby tiles, grimy
  {
    const [c, g] = canvas(256);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const light = (i + j) % 2 === 0;
        const v = light ? 168 + rnd() * 20 : 34 + rnd() * 14;
        g.fillStyle = `rgb(${v},${v * 0.96},${v * 0.9})`;
        g.fillRect(i * 32, j * 32, 32, 32);
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(i * 32, 0);
      g.lineTo(i * 32, 256);
      g.moveTo(0, i * 32);
      g.lineTo(256, i * 32);
      g.stroke();
    }
    stains(g, 256, 256, rnd, 18, 'rgba(40,25,10,0.45)');
    grain(g, 256, 256, 30, rnd);
    T.tiles = tex(c);
  }
  // cobblestone for the alleyway
  {
    const [c, g] = canvas(256);
    g.fillStyle = '#1e1e22';
    g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 9; i++) {
        const x = i * 30 + (j % 2) * 15 + rnd() * 4, y = j * 26 + rnd() * 4;
        const v = 60 + rnd() * 40;
        g.fillStyle = `rgb(${v},${v},${v + 6})`;
        g.beginPath();
        g.ellipse(x, y, 13, 11, rnd(), 0, Math.PI * 2);
        g.fill();
      }
    }
    stains(g, 256, 256, rnd, 14, 'rgba(10,10,15,0.5)');
    grain(g, 256, 256, 24, rnd);
    T.cobble = tex(c);
  }
  // concrete
  {
    const [c, g] = canvas(256);
    g.fillStyle = '#4a4744';
    g.fillRect(0, 0, 256, 256);
    stains(g, 256, 256, rnd, 30, 'rgba(20,18,15,0.35)');
    stains(g, 256, 256, rnd, 12, 'rgba(120,110,95,0.2)');
    grain(g, 256, 256, 34, rnd);
    g.strokeStyle = 'rgba(15,12,10,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      let x = rnd() * 256, y = rnd() * 256;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rnd() * 30 - 15;
        y += rnd() * 30 - 15;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    T.concrete = tex(c);
  }
  // brick walls (alley, crematorium)
  {
    const [c, g] = canvas(256);
    g.fillStyle = '#2b1a14';
    g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < 5; i++) {
        const x = i * 56 + (j % 2) * 28 - 28, y = j * 16;
        const v = 70 + rnd() * 40;
        g.fillStyle = `rgb(${v + 30},${v * 0.55},${v * 0.42})`;
        g.fillRect(x + 2, y + 2, 52, 12);
      }
    }
    stains(g, 256, 256, rnd, 16, 'rgba(0,0,0,0.4)');
    grain(g, 256, 256, 20, rnd);
    T.brick = tex(c);
  }
  // faded damask wallpaper with wainscot
  {
    const [c, g] = canvas(256);
    g.fillStyle = '#3d2a24';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(160,120,70,0.18)';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = i * 64 + 32, y = j * 64 + 32;
        g.beginPath();
        g.ellipse(x, y, 10, 22, 0, 0, Math.PI * 2);
        g.ellipse(x, y, 22, 10, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 16; i++) g.fillRect(i * 16, 0, 2, 256);
    stains(g, 256, 256, rnd, 18, 'rgba(10,5,0,0.45)');
    grain(g, 256, 256, 18, rnd);
    T.wallpaper = tex(c);
  }
  // plaster for generic walls
  {
    const [c, g] = canvas(128);
    g.fillStyle = '#5a4d43';
    g.fillRect(0, 0, 128, 128);
    stains(g, 128, 128, rnd, 14, 'rgba(25,18,12,0.4)');
    grain(g, 128, 128, 26, rnd);
    T.plaster = tex(c);
  }
  // velvet curtain folds
  {
    const [c, g] = canvas(128, 256);
    const gr = g.createLinearGradient(0, 0, 128, 0);
    for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? '#3a0508' : '#8c0f18');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 256);
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(0,0,0,0.5)');
    v.addColorStop(0.2, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = v;
    g.fillRect(0, 0, 128, 256);
    grain(g, 128, 256, 16, rnd);
    T.curtain = tex(c);
  }
  // made once at boot and reused by every rebuilt world: never disposed with one
  for (const t of Object.values(T)) t.userData.shared = true;
  return T;
}

/** A poster for the walls: original "Kino" bills in faded inks. */
export function posterTexture(kind, seed = 1) {
  const rnd = prng(seed * 977);
  const [c, g] = canvas(128, 192);
  const palettes = [['#d9c7a0', '#7a1c1c', '#1e1a16'], ['#c9d0b0', '#1f3a5a', '#1a1a1a'], ['#e0c080', '#5a2a6a', '#201510'], ['#b8c4c8', '#6a1010', '#121212']];
  const [paper, ink, dark] = palettes[seed % palettes.length];
  g.fillStyle = paper;
  g.fillRect(0, 0, 128, 192);
  g.fillStyle = ink;
  g.font = 'bold 22px Georgia, serif';
  g.textAlign = 'center';
  const titles = { kino: 'KINO', toten: 'DER TOTEN', rift: 'RIFT', mummy: 'DIE MUMIE', blade: 'DIE KLINGE', wuju: 'WUJU' };
  g.fillText(titles[kind] || 'KINO', 64, 34);
  g.fillStyle = dark;
  g.beginPath();
  if (kind === 'mummy') {
    g.arc(64, 104, 34, 0, Math.PI * 2);
  } else if (kind === 'blade') {
    g.moveTo(64, 60);
    g.lineTo(80, 140);
    g.lineTo(64, 150);
    g.lineTo(48, 140);
  } else {
    g.moveTo(24, 150);
    g.lineTo(64, 56);
    g.lineTo(104, 150);
  }
  g.fill();
  g.fillStyle = ink;
  g.font = '11px Georgia, serif';
  g.fillText('HEUTE ABEND', 64, 172);
  g.fillText('8 UHR', 64, 185);
  stains(g, 128, 192, rnd, 10, 'rgba(60,40,10,0.35)');
  grain(g, 128, 192, 30, rnd);
  // torn corner
  g.fillStyle = 'rgba(0,0,0,1)';
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128 - 10 - rnd() * 20, 0);
  g.lineTo(128, 10 + rnd() * 26);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  return tex(c, false);
}

/** Chalk outline of a wall-buy, like the gun outlines on Kino's walls. */
export function chalkTexture(label, price, glyphDraw) {
  const [c, g] = canvas(256, 128);
  g.clearRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(235,235,225,0.9)';
  g.fillStyle = 'rgba(235,235,225,0.9)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  if (glyphDraw) glyphDraw(g);
  g.font = 'bold 20px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText(label, 128, 108);
  g.font = 'bold 16px "Courier New", monospace';
  g.fillText(String(price), 128, 124);
  return tex(c, false);
}
