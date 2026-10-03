// Prop builders: everything in the theatre that isn't a wall or a floor.
// Each returns a THREE.Group; interactive props expose small setters for animation.

import * as THREE from 'three';
import { GEO } from './models.js';
import { posterTexture } from './textures.js';

const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...o });
const glowMat = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

function box(parent, mat, x, y, z, sx, sy, sz, ry = 0) {
  const m = new THREE.Mesh(GEO.box, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}
function cyl(parent, mat, x, y, z, r, h, rx = 0, rz = 0) {
  const m = new THREE.Mesh(GEO.cyl, mat);
  m.position.set(x, y, z);
  m.scale.set(r * 2, h, r * 2);
  m.rotation.set(rx, 0, rz);
  parent.add(m);
  return m;
}
function sph(parent, mat, x, y, z, r) {
  const m = new THREE.Mesh(GEO.sphere, mat);
  m.position.set(x, y, z);
  m.scale.setScalar(r * 2);
  parent.add(m);
  return m;
}

/** Canvas with text, for perk logos and signs. */
function labelTex(text, fg, bg, w = 256, h = 64, font = 'bold 34px Impact, sans-serif') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ theatre seats
const seatGeo = (() => {
  // one seat: base, back and armrests merged into a single geometry
  const parts = [];
  const add = (sx, sy, sz, x, y, z) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y, z);
    parts.push(g);
  };
  add(0.5, 0.12, 0.45, 0, 0.42, 0.02); // cushion
  add(0.5, 0.62, 0.1, 0, 0.72, -0.2); // back
  add(0.06, 0.32, 0.45, 0.27, 0.5, 0); // arm
  add(0.06, 0.32, 0.45, -0.27, 0.5, 0); // arm
  add(0.08, 0.38, 0.08, 0, 0.19, 0); // stem
  return mergeGeos(parts);
})();

function mergeGeos(list) {
  let count = 0;
  for (const g of list) count += g.index ? g.index.count : g.attributes.position.count;
  const pos = [], norm = [], idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      norm.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  out.setIndex(idx);
  return out;
}
export { mergeGeos };

/** seats: [{x, y, z, ry, broken}] */
export function seats(list) {
  const mat = lam('#7a1720');
  const m = new THREE.InstancedMesh(seatGeo, mat, list.length);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  list.forEach((s, i) => {
    o.position.set(s.x, s.y, s.z);
    o.rotation.set(s.broken ? 0.5 : 0, s.ry, s.broken ? 0.3 : 0);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    m.setColorAt(i, c.setHSL(0.99, 0.6, 0.18 + Math.random() * 0.08));
  });
  return m;
}

// ------------------------------------------------------------------ perk machines
const PERK_LOOK = {
  jugg: { body: '#7a0c12', trim: '#d4af37', glow: '#ff2a2a', name: 'JUGGER-NOG' },
  speed: { body: '#0f5a24', trim: '#c9c9c9', glow: '#3cff6a', name: 'SPEED COLA' },
  tap: { body: '#5a3410', trim: '#e0b040', glow: '#ffb030', name: 'DOUBLE TAP' },
  revive: { body: '#b9c6cf', trim: '#3a8ad0', glow: '#5ac8ff', name: 'QUICK REVIVE' },
};

export function perkMachine(kind) {
  const L = PERK_LOOK[kind];
  const g = new THREE.Group();
  const body = std(L.body, { roughness: 0.5, metalness: 0.3 });
  const trim = std(L.trim, { roughness: 0.3, metalness: 0.8 });
  const glow = new THREE.MeshStandardMaterial({ color: L.glow, emissive: L.glow, emissiveIntensity: 0.05, roughness: 0.4 });
  const sign = new THREE.MeshStandardMaterial({ map: labelTex(L.name, '#fff', null, 256, 64, 'bold 36px Impact, sans-serif'), transparent: true, emissive: '#ffffff', emissiveIntensity: 0.0, emissiveMap: null });
  box(g, body, 0, 1.05, 0, 1.15, 2.1, 0.85);
  box(g, trim, 0, 2.15, 0, 1.25, 0.12, 0.95);
  box(g, trim, 0, 0.05, 0, 1.25, 0.1, 0.95);
  const panel = box(g, glow, 0, 1.45, 0.43, 0.9, 0.9, 0.04);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.28), sign);
  s.position.set(0, 1.98, 0.44);
  g.add(s);
  // bottle in the slot
  cyl(g, trim, 0, 0.55, 0.36, 0.08, 0.3);
  const bottle = cyl(g, glow, 0, 0.6, 0.36, 0.06, 0.24);
  // top light
  const top = sph(g, glow, 0, 2.35, 0, 0.14);
  g.userData = {
    kind,
    setPower(on, t = 0) {
      const v = on ? 1.1 + Math.sin(t * 3) * 0.2 : 0.05;
      glow.emissiveIntensity = v;
      sign.emissiveIntensity = on ? 0.6 : 0;
      top.visible = on;
      bottle.visible = true;
    },
    color: L.glow,
  };
  g.userData.setPower(false);
  return g;
}

// ------------------------------------------------------------------ Mystery Box
export function mysteryBox() {
  const g = new THREE.Group();
  const wood = std('#5a3a1e', { roughness: 0.85 });
  const dark = std('#2a1a0e', { roughness: 0.9 });
  const metal = std('#8a7a5a', { roughness: 0.4, metalness: 0.7 });
  const qmark = new THREE.MeshStandardMaterial({ map: labelTex('?  ?  ?', '#f0e6c0', null, 256, 64, 'bold 46px Georgia, serif'), transparent: true, emissive: '#ffe08a', emissiveIntensity: 0.4 });
  // base rests on a little pile of rubble/planks
  box(g, dark, 0, 0.12, 0, 1.9, 0.24, 0.9);
  box(g, wood, 0, 0.5, 0, 1.75, 0.55, 0.75);
  for (const x of [-0.85, 0.85]) box(g, metal, x, 0.5, 0, 0.06, 0.58, 0.78);
  const lidPivot = new THREE.Object3D();
  lidPivot.position.set(0, 0.78, -0.38);
  g.add(lidPivot);
  const lid = box(lidPivot, wood, 0, 0.08, 0.38, 1.75, 0.16, 0.76);
  box(lidPivot, metal, 0, 0.17, 0.38, 1.77, 0.03, 0.2);
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), qmark);
  q.rotation.x = -Math.PI / 2;
  q.position.set(0, 0.165, 0.38);
  lidPivot.add(q);
  const qf = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), qmark);
  qf.position.set(0, 0.5, 0.38);
  g.add(qf);
  // light beam marking where the box is
  // fades out towards the top, so from above it reads as light rising, not a tube
  const beamMat = new THREE.MeshBasicMaterial({ color: '#9fd3ff', alphaMap: beamFade(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 9, 16, 1, true), beamMat);
  beam.position.y = 4.8;
  beam.renderOrder = 15;
  g.add(beam);
  // inner glow when open
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.79;
  g.add(inner);
  g.userData = {
    setLid(a) {
      lidPivot.rotation.x = -a * 1.9;
      inner.material.opacity = a * 0.8;
    },
    setBeam(v) {
      beam.visible = v > 0.01;
      beamMat.opacity = 0.2 * v;
    },
    lift: 0,
  };
  return g;
}

let beamFadeTex = null;
/** Vertical alpha ramp for light beams: solid at the bottom, gone at the top. */
function beamFade() {
  if (beamFadeTex) return beamFadeTex;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#000');
  gr.addColorStop(0.55, '#555');
  gr.addColorStop(1, '#fff');
  x.fillStyle = gr;
  x.fillRect(0, 0, 4, 64);
  beamFadeTex = new THREE.CanvasTexture(c);
  beamFadeTex.userData.shared = true;
  return beamFadeTex;
}

/** Rubble left where the box isn't. */
export function boxRubble() {
  const g = new THREE.Group();
  const m = std('#3a3028', { roughness: 0.95 });
  const w = std('#4a3220');
  for (let i = 0; i < 7; i++) {
    const b = box(g, i % 2 ? m : w, (Math.random() - 0.5) * 1.6, 0.1 + Math.random() * 0.1, (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.5, 0.15, 0.2 + Math.random() * 0.3);
    b.rotation.y = Math.random() * 3;
  }
  return g;
}

// ------------------------------------------------------------------ Pack-a-Punch
export function packAPunch() {
  const g = new THREE.Group();
  const body = std('#3a2f4a', { roughness: 0.4, metalness: 0.6 });
  const steel = std('#7c7f86', { roughness: 0.3, metalness: 0.9 });
  const glow = new THREE.MeshStandardMaterial({ color: '#b06cff', emissive: '#a050ff', emissiveIntensity: 0.1, roughness: 0.3 });
  box(g, body, 0, 0.65, 0, 2.0, 1.3, 1.1);
  box(g, steel, 0, 1.36, 0, 2.1, 0.12, 1.2);
  const rollers = [];
  for (const x of [-0.55, 0, 0.55]) {
    const r = cyl(g, steel, x, 1.6, 0, 0.18, 1.0, Math.PI / 2, 0);
    rollers.push(r);
  }
  const panel = box(g, glow, 0, 0.75, 0.56, 1.6, 0.5, 0.04);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshStandardMaterial({ map: labelTex('PACK-A-PUNCH', '#f0d0ff', null, 256, 64, 'bold 32px Impact, sans-serif'), transparent: true, emissive: '#ffffff', emissiveIntensity: 0.3 }));
  sign.position.set(0, 1.15, 0.57);
  g.add(sign);
  // the "ability" token that rides through the machine
  const token = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glowMat('#ffd0ff', 3));
  token.visible = false;
  g.add(token);
  g.userData = {
    setPower(on, t = 0) {
      glow.emissiveIntensity = on ? 1.4 + Math.sin(t * 4) * 0.4 : 0.08;
    },
    spin(dt) {
      for (const r of rollers) r.rotation.y += dt * 8;
    },
    token,
  };
  g.userData.setPower(false);
  return g;
}

// ------------------------------------------------------------------ power switch
export function powerSwitch() {
  const g = new THREE.Group();
  const panel = std('#4a4a40', { roughness: 0.6, metalness: 0.5 });
  const dark = std('#1a1a18');
  const red = glowMat('#ff3020', 0.8);
  box(g, panel, 0, 1.3, 0, 1.2, 1.6, 0.3);
  box(g, dark, 0, 1.3, 0.16, 1.0, 1.4, 0.04);
  const pivot = new THREE.Object3D();
  pivot.position.set(0, 1.3, 0.22);
  g.add(pivot);
  box(pivot, std('#c8c8c0', { metalness: 0.8, roughness: 0.3 }), 0, 0.35, 0.05, 0.08, 0.7, 0.08);
  sph(pivot, red, 0, 0.72, 0.05, 0.09);
  const lamp = sph(g, red, 0.42, 2.0, 0.17, 0.07);
  g.userData = {
    setOn(a) {
      pivot.rotation.x = -0.9 + a * 1.8;
      lamp.material = a > 0.5 ? glowMat('#40ff60', 2) : red;
    },
  };
  g.userData.setOn(0);
  return g;
}

// ------------------------------------------------------------------ teleporter pad & mainframe
export function teleporterPad() {
  const g = new THREE.Group();
  const metal = std('#6a6a70', { roughness: 0.35, metalness: 0.85 });
  const coilMat = std('#b87333', { roughness: 0.4, metalness: 0.8 });
  const glow = new THREE.MeshStandardMaterial({ color: '#7fdcff', emissive: '#5ac8ff', emissiveIntensity: 0.1, roughness: 0.3 });
  cyl(g, metal, 0, 0.12, 0, 1.6, 0.24);
  const disc = cyl(g, glow, 0, 0.25, 0, 1.25, 0.04);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 1.5, z = Math.sin(a) * 1.5;
    cyl(g, metal, x, 1.2, z, 0.1, 2.4);
    for (let k = 0; k < 5; k++) cyl(g, coilMat, x, 0.6 + k * 0.35, z, 0.17, 0.12);
    sph(g, glow, x, 2.5, z, 0.16);
  }
  const lightMat = glowMat('#ff2020', 2);
  const light = sph(g, lightMat, 0, 0.3, 1.65, 0.1);
  g.userData = {
    setState(state, t = 0) {
      // 'off' | 'idle' | 'linked' | 'charging' | 'cooldown'
      const lit = state === 'linked' ? 1.5 + Math.sin(t * 5) * 0.4 : state === 'charging' ? 3 + Math.sin(t * 30) : state === 'idle' ? 0.4 : 0.05;
      glow.emissiveIntensity = lit;
      disc.material = glow;
      light.material = state === 'linked' ? glowMat('#30ff50', 2.5) : lightMat;
    },
  };
  g.userData.setState('off');
  return g;
}

export function mainframe() {
  const g = new THREE.Group();
  const body = std('#3a4038', { roughness: 0.5, metalness: 0.5 });
  const screen = new THREE.MeshStandardMaterial({ color: '#103010', emissive: '#30ff60', emissiveIntensity: 0.05 });
  box(g, body, 0, 1.0, 0, 1.6, 2.0, 0.7);
  const scr = box(g, screen, 0, 1.35, 0.36, 1.1, 0.6, 0.03);
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const m = glowMat(i % 2 ? '#ffb020' : '#ff3020', 0.2);
    lamps.push(sph(g, m, -0.6 + i * 0.24, 0.7, 0.37, 0.05));
  }
  for (const x of [-0.5, 0.5]) cyl(g, std('#222'), x, 0.4, 0.36, 0.14, 0.04, Math.PI / 2);
  g.userData = {
    setState(on, linked, t = 0) {
      screen.emissiveIntensity = on ? (linked ? 1.6 : 0.6 + 0.4 * Math.sin(t * 6)) : 0.03;
      lamps.forEach((l, i) => (l.material.emissiveIntensity = on ? (Math.sin(t * 7 + i * 1.3) > 0 ? 2 : 0.2) : 0.1));
      scr.material = screen;
    },
  };
  g.userData.setState(false, false);
  return g;
}

// ------------------------------------------------------------------ barricades
const boardMat = std('#6b4a2a', { roughness: 0.9 });
/** Six planks across a window of width w. Returns group with setBoards(n). */
export function boards(w) {
  const g = new THREE.Group();
  const planks = [];
  for (let i = 0; i < 6; i++) {
    const p = box(g, boardMat, 0, 0.5 + i * 0.27, 0.08, w + 0.4, 0.2, 0.06);
    p.rotation.z = (i % 2 ? 1 : -1) * (0.08 + Math.random() * 0.12);
    p.userData.base = { y: p.position.y, rz: p.rotation.z };
    planks.push(p);
  }
  g.userData = {
    planks,
    setBoards(n) {
      planks.forEach((p, i) => (p.visible = i < n));
    },
  };
  return g;
}

/** A broken window frame (the hole the boards cover). */
export function windowFrame(w) {
  const g = new THREE.Group();
  const frame = std('#2a1c12', { roughness: 0.9 });
  box(g, frame, 0, 2.25, 0, w + 0.3, 0.15, 0.6);
  box(g, frame, 0, 0.3, 0, w + 0.3, 0.15, 0.6);
  for (const x of [-w / 2 - 0.08, w / 2 + 0.08]) box(g, frame, x, 1.25, 0, 0.15, 2.0, 0.6);
  return g;
}

// ------------------------------------------------------------------ doors & debris
export function door(w, h = 2.6, kind = 'wood') {
  const g = new THREE.Group();
  const mat = kind === 'metal' ? std('#5a5e62', { metalness: 0.6, roughness: 0.5 }) : std('#4a2e1a', { roughness: 0.8 });
  const trim = std('#2a1a10');
  const leafL = new THREE.Object3D();
  const leafR = new THREE.Object3D();
  leafL.position.x = -w / 2;
  leafR.position.x = w / 2;
  g.add(leafL, leafR);
  box(leafL, mat, w / 4, h / 2, 0, w / 2 - 0.04, h, 0.14);
  box(leafR, mat, -w / 4, h / 2, 0, w / 2 - 0.04, h, 0.14);
  for (const leaf of [leafL, leafR]) {
    const sgn = leaf === leafL ? 1 : -1;
    box(leaf, trim, sgn * (w / 4), h * 0.75, 0.08, w / 2 - 0.3, 0.6, 0.03);
    box(leaf, trim, sgn * (w / 4), h * 0.3, 0.08, w / 2 - 0.3, 0.6, 0.03);
    sph(leaf, std('#c8a050', { metalness: 0.8, roughness: 0.3 }), sgn * (w / 2 - 0.15), h / 2, 0.1, 0.05);
  }
  g.userData = {
    setOpen(a) {
      leafL.rotation.y = -a * 1.6;
      leafR.rotation.y = a * 1.6;
      leafL.position.y = leafR.position.y = 0;
    },
  };
  return g;
}

export function debris(w, d = 1.2) {
  const g = new THREE.Group();
  const mats = [std('#4a3a2e', { roughness: 0.95 }), std('#5a4636'), std('#3a2a1e'), std('#6a5a48')];
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const sx = 0.3 + Math.random() * 0.9, sy = 0.2 + Math.random() * 0.5, sz = 0.3 + Math.random() * 0.6;
    const b = box(g, mats[i % 4], (Math.random() - 0.5) * w, sy / 2 + Math.random() * 1.4, (Math.random() - 0.5) * d, sx, sy, sz, Math.random() * 3);
    b.rotation.x = Math.random() * 0.6;
    parts.push({ m: b, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 3 });
  }
  // a couple of planks across
  for (let i = 0; i < 3; i++) {
    const b = box(g, mats[2], (Math.random() - 0.5) * 0.4, 0.8 + i * 0.5, 0, w * 0.9, 0.12, 0.25);
    b.rotation.z = (Math.random() - 0.5) * 0.8;
    parts.push({ m: b, vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 3, vz: (Math.random() - 0.5) * 3 });
  }
  g.userData = { parts };
  return g;
}

// ------------------------------------------------------------------ electric trap
export function trapFrame(w) {
  const g = new THREE.Group();
  const metal = std('#5a5a5e', { metalness: 0.8, roughness: 0.4 });
  const coil = std('#9a6a3a', { metalness: 0.7, roughness: 0.4 });
  for (const x of [-w / 2, w / 2]) {
    box(g, metal, x, 1.3, 0, 0.18, 2.6, 0.3);
    for (let i = 0; i < 4; i++) cyl(g, coil, x, 0.5 + i * 0.6, 0, 0.13, 0.15);
  }
  const arcMat = new THREE.MeshBasicMaterial({ color: '#bfe8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const arcs = [];
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Mesh(GEO.box, arcMat);
    a.scale.set(w, 0.04, 0.04);
    a.position.y = 0.5 + i * 0.6;
    g.add(a);
    arcs.push(a);
  }
  const lamp = sph(g, glowMat('#ff3020', 1.2), w / 2 + 0.2, 2.4, 0, 0.08);
  g.userData = {
    setActive(on, t = 0) {
      arcMat.opacity = on ? 0.6 + Math.random() * 0.4 : 0;
      arcs.forEach((a, i) => {
        a.position.y = 0.5 + i * 0.6 + (on ? (Math.random() - 0.5) * 0.2 : 0);
        a.rotation.z = on ? (Math.random() - 0.5) * 0.15 : 0;
      });
    },
    setLamp(color) {
      lamp.material = glowMat(color, 1.6);
    },
  };
  return g;
}

/** Wall panel with a handle that buys the trap. */
export function trapHandle() {
  const g = new THREE.Group();
  box(g, std('#4a4a40', { metalness: 0.5 }), 0, 1.3, 0, 0.6, 0.8, 0.15);
  const pivot = new THREE.Object3D();
  pivot.position.set(0, 1.3, 0.1);
  g.add(pivot);
  box(pivot, std('#c8c8c0', { metalness: 0.8 }), 0, 0.2, 0.04, 0.06, 0.4, 0.06);
  g.userData = {
    setPulled(a) {
      pivot.rotation.x = -0.6 + a * 1.2;
    },
  };
  return g;
}

// ------------------------------------------------------------------ set dressing
export function chandelier() {
  const g = new THREE.Group();
  const brass = std('#b8913a', { metalness: 0.85, roughness: 0.35 });
  const brassColor = brass.color.clone();
  const crystal = new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: '#ffd890', emissiveIntensity: 0.2, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 });
  cyl(g, brass, 0, 0, 0, 0.08, 1.2);
  for (const [r, y, n] of [[1.4, -0.6, 12], [0.9, -0.95, 8], [0.45, -1.25, 6]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 32), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), crystal);
      c.position.set(Math.cos(a) * r, y - 0.18, Math.sin(a) * r);
      c.scale.y = 1.8;
      g.add(c);
    }
  }
  let lit = 0;
  g.userData = {
    setLit(v) {
      lit = v;
      crystal.emissiveIntensity = 0.2 + v * 1.1;
    },
    /** 1 = solid, lower = see-through (it hangs right in front of the camera near the stage). */
    setFade(a) {
      const solid = a > 0.99;
      brass.transparent = !solid;
      brass.opacity = a;
      // dim the metal too: its own light sits inside the lowest ring and would still bloom
      brass.color.copy(brassColor).multiplyScalar(a);
      brass.depthWrite = solid;
      crystal.opacity = 0.85 * a;
      crystal.depthWrite = solid;
      crystal.emissiveIntensity = (0.2 + lit * 1.1) * a;
    },
  };
  return g;
}

export function curtains(width, height) {
  const g = new THREE.Group();
  const tex = arguments[2];
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, roughness: 0.9, side: THREE.DoubleSide });
  const half = width / 2;
  const geo = new THREE.PlaneGeometry(half, height, 24, 1);
  // pleats
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.12);
  geo.computeVertexNormals();
  const L = new THREE.Mesh(geo, mat);
  const R = new THREE.Mesh(geo, mat);
  L.position.set(-half / 2, height / 2, 0);
  R.position.set(half / 2, height / 2, 0);
  g.add(L, R);
  const valance = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.7, 0.3), mat);
  valance.position.set(0, height + 0.2, 0);
  g.add(valance);
  g.userData = {
    setOpen(a) {
      const s = 1 - a * 0.82;
      L.scale.x = R.scale.x = s;
      L.position.x = -width / 2 + (half * s) / 2;
      R.position.x = width / 2 - (half * s) / 2;
    },
  };
  g.userData.setOpen(0);
  return g;
}

export function movieScreen(w, h) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 144;
  const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  screen.position.y = h / 2;
  g.add(screen);
  const frame = std('#1a1410');
  box(g, frame, 0, h + 0.1, -0.05, w + 0.4, 0.2, 0.1);
  box(g, frame, 0, -0.1, -0.05, w + 0.4, 0.2, 0.1);
  let last = -1;
  g.userData = {
    /** mode: 'off' | 'static' | 'film' */
    draw(mode, time) {
      const step = Math.floor(time * 12);
      if (step === last) return;
      last = step;
      if (mode === 'off') {
        ctx.fillStyle = '#0c0c0e';
        ctx.fillRect(0, 0, 256, 144);
      } else if (mode === 'static') {
        const img = ctx.createImageData(256, 144);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 120;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      } else {
        // a flickering countdown leader, like an old reel starting
        const n = 9 - (Math.floor(time) % 9);
        ctx.fillStyle = `rgb(${200 + Math.random() * 30},${190 + Math.random() * 30},${170})`;
        ctx.fillRect(0, 0, 256, 144);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(128, 72, 56, 0, Math.PI * 2);
        ctx.moveTo(128, 0);
        ctx.lineTo(128, 144);
        ctx.moveTo(0, 72);
        ctx.lineTo(256, 72);
        ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(128, 72);
        ctx.arc(128, 72, 56, -Math.PI / 2, -Math.PI / 2 + (time % 1) * Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n), 128, 76);
        for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * 256, Math.random() * 144, 1, 4 + Math.random() * 20);
      }
      t.needsUpdate = true;
    },
  };
  g.userData.draw('off', 0);
  return g;
}

export function poster(kind, seed) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshLambertMaterial({ map: posterTexture(kind, seed), transparent: true }));
  m.position.y = 1.6;
  return m;
}

export function table(round = true) {
  const g = new THREE.Group();
  const wood = lam('#4a3020');
  const cloth = lam('#d8d0c0');
  if (round) {
    cyl(g, cloth, 0, 0.78, 0, 0.6, 0.05);
    cyl(g, wood, 0, 0.4, 0, 0.06, 0.78);
    cyl(g, wood, 0, 0.03, 0, 0.3, 0.06);
  } else {
    box(g, wood, 0, 0.78, 0, 1.6, 0.06, 0.8);
    for (const [x, z] of [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]]) box(g, wood, x, 0.38, z, 0.07, 0.76, 0.07);
  }
  return g;
}

export function chair() {
  const g = new THREE.Group();
  const wood = lam('#3a2416');
  box(g, wood, 0, 0.45, 0, 0.45, 0.05, 0.45);
  box(g, wood, 0, 0.75, -0.2, 0.45, 0.6, 0.05);
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(g, wood, x, 0.22, z, 0.05, 0.45, 0.05);
  return g;
}

export function mannequin() {
  const g = new THREE.Group();
  const m = lam('#c8b8a0');
  cyl(g, std('#222'), 0, 0.02, 0, 0.25, 0.04);
  cyl(g, std('#222'), 0, 0.6, 0, 0.03, 1.1);
  const t = new THREE.Mesh(GEO.torso, m);
  t.position.y = 1.35;
  t.scale.set(0.42, 0.6, 0.26);
  g.add(t);
  sph(g, m, 0, 1.82, 0, 0.13);
  return g;
}

export function vanityMirror() {
  const g = new THREE.Group();
  box(g, lam('#3a2a1e'), 0, 0.4, 0, 1.4, 0.8, 0.5);
  box(g, std('#9aa8b0', { metalness: 0.9, roughness: 0.15 }), 0, 1.4, -0.2, 1.1, 0.9, 0.03);
  const bulbs = [];
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#ffd880', emissiveIntensity: 0.1 });
  for (let i = 0; i < 6; i++) bulbs.push(sph(g, bulbMat, -0.6 + i * 0.24, 1.95, -0.15, 0.05));
  for (let i = 0; i < 3; i++) {
    bulbs.push(sph(g, bulbMat, -0.62, 1.0 + i * 0.3, -0.15, 0.05));
    bulbs.push(sph(g, bulbMat, 0.62, 1.0 + i * 0.3, -0.15, 0.05));
  }
  g.userData = {
    setLit(v) {
      bulbMat.emissiveIntensity = 0.1 + v * 2.2;
    },
  };
  return g;
}

export function crate(s = 1) {
  const g = new THREE.Group();
  const w = lam('#5a4028');
  box(g, w, 0, 0.45 * s, 0, 0.9 * s, 0.9 * s, 0.9 * s, Math.random() * 0.4);
  return g;
}

export function barrel() {
  const g = new THREE.Group();
  cyl(g, std('#3a4a3a', { metalness: 0.5 }), 0, 0.5, 0, 0.32, 1.0);
  cyl(g, std('#222'), 0, 1.0, 0, 0.33, 0.04);
  return g;
}

export function lampPost(on = false) {
  const g = new THREE.Group();
  const iron = std('#1a1a1c', { metalness: 0.6 });
  cyl(g, iron, 0, 1.8, 0, 0.07, 3.6);
  box(g, iron, 0, 3.6, 0, 0.5, 0.08, 0.5);
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffcc66', emissiveIntensity: on ? 2 : 0.1 });
  sph(g, bulb, 0, 3.4, 0, 0.16);
  g.userData = {
    setLit(v) {
      bulb.emissiveIntensity = 0.1 + v * 2.5;
    },
  };
  return g;
}

export function oven() {
  const g = new THREE.Group();
  const brick = lam('#5a3a2a');
  const iron = std('#2a2a2c', { metalness: 0.7, roughness: 0.5 });
  box(g, brick, 0, 1.4, 0, 2.6, 2.8, 1.8);
  box(g, iron, 0, 1.0, 0.92, 1.2, 1.0, 0.06);
  const fire = new THREE.MeshStandardMaterial({ color: '#ff6a20', emissive: '#ff4a10', emissiveIntensity: 1.5 });
  box(g, fire, 0, 0.9, 0.93, 0.9, 0.5, 0.02);
  cyl(g, iron, 0.8, 3.4, -0.4, 0.25, 1.4);
  g.userData = {
    setFire(t) {
      fire.emissiveIntensity = 1.2 + Math.sin(t * 9) * 0.3 + Math.random() * 0.3;
    },
  };
  return g;
}

export function projector() {
  const g = new THREE.Group();
  const body = std('#2a2a2e', { metalness: 0.6, roughness: 0.4 });
  box(g, body, 0, 1.2, 0, 0.8, 0.6, 1.2);
  cyl(g, body, 0, 1.2, 0.75, 0.15, 0.4, Math.PI / 2);
  for (const z of [-0.3, 0.3]) {
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 20), std('#555', { metalness: 0.8 }));
    reel.rotation.z = Math.PI / 2;
    reel.position.set(0, 1.85, z);
    g.add(reel);
  }
  box(g, std('#1a1a1a'), 0, 0.45, 0, 0.5, 0.9, 0.5);
  return g;
}

export function bar(w) {
  const g = new THREE.Group();
  box(g, lam('#3a2014'), 0, 0.55, 0, w, 1.1, 0.7);
  box(g, std('#6a4a2a', { roughness: 0.3 }), 0, 1.12, 0, w + 0.1, 0.06, 0.8);
  for (let i = 0; i < Math.floor(w / 0.6); i++) {
    const b = cyl(g, new THREE.MeshStandardMaterial({ color: ['#2a5a2a', '#5a2a1a', '#c8b060'][i % 3], roughness: 0.2, transparent: true, opacity: 0.85 }), -w / 2 + 0.3 + i * 0.6, 1.3, -0.15, 0.05, 0.3);
    b.position.y += Math.random() * 0.05;
  }
  return g;
}

export function rubblePile(r = 1) {
  const g = new THREE.Group();
  const m = lam('#4a4038');
  for (let i = 0; i < 10; i++) {
    const s = 0.2 + Math.random() * 0.4;
    const b = box(g, m, (Math.random() - 0.5) * r * 2, s / 2, (Math.random() - 0.5) * r * 2, s * 1.4, s, s);
    b.rotation.set(Math.random(), Math.random() * 3, Math.random());
  }
  return g;
}

export function meteorRock() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: '#3a3240', emissive: '#4a8aff', emissiveIntensity: 0.25, roughness: 0.6, flatShading: true }));
  rock.position.y = 0.95;
  rock.scale.set(1, 0.8, 1.1);
  g.add(rock);
  g.userData = {
    rock,
    setGlow(v) {
      rock.material.emissiveIntensity = 0.25 + v * 2.5;
    },
  };
  return g;
}

export function stairs(width, depth, rise, steps = 8) {
  const g = new THREE.Group();
  const mat = lam('#5a1018');
  const edge = std('#8a6a30', { metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < steps; i++) {
    const y = ((i + 1) / steps) * rise;
    const z = depth / 2 - (i + 0.5) * (depth / steps);
    box(g, mat, 0, y / 2, z, width, y, depth / steps);
    box(g, edge, 0, y + 0.01, z + depth / steps / 2 - 0.03, width, 0.03, 0.05);
  }
  return g;
}

export function railing(len) {
  const g = new THREE.Group();
  const brass = std('#8a6a30', { metalness: 0.7, roughness: 0.4 });
  box(g, brass, 0, 1.0, 0, len, 0.07, 0.07);
  for (let i = 0; i <= Math.floor(len / 0.5); i++) cyl(g, brass, -len / 2 + i * 0.5, 0.5, 0, 0.025, 1.0);
  return g;
}

export function poroModel() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#f4f4f8', roughness: 1 });
  const horn = std('#c9b48a');
  sph(g, fur, 0, 0.32, 0, 0.32);
  for (const x of [-0.12, 0.12]) {
    sph(g, std('#2a1a12'), x, 0.42, 0.27, 0.05);
    const h = new THREE.Mesh(GEO.cone, horn);
    h.position.set(x * 1.6, 0.6, 0);
    h.scale.set(0.08, 0.2, 0.08);
    h.rotation.z = -x * 2;
    g.add(h);
  }
  const tongue = sph(g, std('#ff8fa3'), 0, 0.25, 0.3, 0.06);
  tongue.scale.set(0.12, 0.05, 0.1);
  return g;
}

export function powerupModel(kind, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.2 });
  const dark = std('#1a1a1a', { metalness: 0.6, roughness: 0.4 });
  if (kind === 'maxammo') {
    box(g, dark, 0, 0, 0, 0.6, 0.4, 0.4);
    box(g, mat, 0, 0.24, 0, 0.62, 0.08, 0.42);
  } else if (kind === 'instakill') {
    sph(g, mat, 0, 0.05, 0, 0.3);
    for (const x of [-0.1, 0.1]) sph(g, dark, x, 0.1, 0.24, 0.08);
  } else if (kind === 'double') {
    box(g, mat, 0, 0, 0, 0.6, 0.6, 0.12);
  } else if (kind === 'nuke') {
    cyl(g, dark, 0, 0, 0, 0.18, 0.6, 0, Math.PI / 2);
    for (const x of [-0.3, 0.3]) cyl(g, mat, x, 0, 0, 0.2, 0.08, 0, Math.PI / 2);
  } else if (kind === 'carpenter') {
    box(g, dark, 0, 0, 0, 0.1, 0.6, 0.1);
    box(g, mat, 0, 0.3, 0, 0.45, 0.16, 0.16);
  } else {
    box(g, mat, 0, 0, 0, 0.5, 0.35, 0.05);
  }
  return g;
}
