// Characters, built from primitives at runtime. Zombies are drawn with one
// InstancedMesh per body-part type so a full horde costs a handful of draw calls;
// each zombie keeps an invisible joint skeleton that the instances copy from.

import * as THREE from 'three';
import { TAU, clamp, lerp, rand } from './util.js';

// ---------------------------------------------------------------- shared geometry
const GEO = {
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  lowSphere: new THREE.SphereGeometry(0.5, 8, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  torso: new THREE.CylinderGeometry(0.5, 0.36, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 10),
};
// Capsules are 2 units tall at scale 1; halve their Y so scale.y == length.
GEO.capsule.scale(1, 0.5, 1);

export { GEO };

/** facing angle (atan2(dz, dx)) -> Object3D rotation.y, given models face local +Z. */
export const yawOf = (ang) => Math.PI / 2 - ang;

function joint(parent, x = 0, y = 0, z = 0) {
  const j = new THREE.Object3D();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/** A part node: hangs `len` below its joint, scaled to (w, len, d). */
function part(parent, kind, w, len, d, y = -len / 2, x = 0, z = 0) {
  const p = new THREE.Object3D();
  p.position.set(x, y, z);
  p.scale.set(w, len, d);
  p.userData.kind = kind;
  parent.add(p);
  return p;
}

/**
 * Standard humanoid skeleton. All lengths in metres. Returns joints + part nodes.
 * s: { leg, torso, shoulder, arm, fore, head, hipW, limbW, chestW, chestD }
 */
export function skeleton(s) {
  const root = new THREE.Group();
  const hips = joint(root, 0, s.leg, 0);
  const spine = joint(hips);
  const neck = joint(spine, 0, s.torso, 0);
  const head = joint(neck, 0, s.head * 0.35, 0);
  const shL = joint(spine, s.shoulder, s.torso * 0.88, 0);
  const shR = joint(spine, -s.shoulder, s.torso * 0.88, 0);
  const elL = joint(shL, 0, -s.arm, 0);
  const elR = joint(shR, 0, -s.arm, 0);
  const hdL = joint(elL, 0, -s.fore, 0);
  const hdR = joint(elR, 0, -s.fore, 0);
  const hpL = joint(hips, s.hipW, -0.02, 0);
  const hpR = joint(hips, -s.hipW, -0.02, 0);
  const knL = joint(hpL, 0, -s.leg * 0.5, 0);
  const knR = joint(hpR, 0, -s.leg * 0.5, 0);
  const parts = {
    pelvis: part(hips, 'pelvis', s.hipW * 2 + s.limbW, 0.2, s.chestD * 0.85, 0.02),
    torso: part(spine, 'torso', s.chestW, s.torso * 0.9, s.chestD, s.torso * 0.5),
    head: part(head, 'head', s.head, s.head * 1.05, s.head, s.head * 0.5),
    uArmL: part(shL, 'uArm', s.limbW, s.arm, s.limbW),
    uArmR: part(shR, 'uArm', s.limbW, s.arm, s.limbW),
    fArmL: part(elL, 'fArm', s.limbW * 0.9, s.fore + 0.05, s.limbW * 0.9),
    fArmR: part(elR, 'fArm', s.limbW * 0.9, s.fore + 0.05, s.limbW * 0.9),
    thighL: part(hpL, 'thigh', s.limbW * 1.25, s.leg * 0.52, s.limbW * 1.25),
    thighR: part(hpR, 'thigh', s.limbW * 1.25, s.leg * 0.52, s.limbW * 1.25),
    shinL: part(knL, 'shin', s.limbW * 1.1, s.leg * 0.52, s.limbW * 1.1),
    shinR: part(knR, 'shin', s.limbW * 1.1, s.leg * 0.52, s.limbW * 1.1),
  };
  return { root, hips, spine, neck, head, shL, shR, elL, elR, hdL, hdR, hpL, hpR, knL, knR, parts, s };
}

/** Reset every joint rotation (poses are rebuilt from scratch each frame). */
function rest(k) {
  for (const j of [k.hips, k.spine, k.neck, k.head, k.shL, k.shR, k.elL, k.elR, k.hdL, k.hdR, k.hpL, k.hpR, k.knL, k.knR]) j.rotation.set(0, 0, 0);
  k.hips.position.y = k.s.leg;
  k.hips.position.x = 0;
  k.hips.position.z = 0;
}

/** Walk/run cycle. phase in radians, amt 0..1 (stride), run 0..1. */
function locomote(k, phase, amt, run) {
  const sw = Math.sin(phase);
  const legA = (0.55 + run * 0.35) * amt;
  k.hpL.rotation.x = -sw * legA;
  k.hpR.rotation.x = sw * legA;
  k.knL.rotation.x = Math.max(0, Math.sin(phase + 1.6)) * (0.6 + run * 0.7) * amt;
  k.knR.rotation.x = Math.max(0, Math.sin(phase + 1.6 + Math.PI)) * (0.6 + run * 0.7) * amt;
  k.hips.position.y = k.s.leg - Math.abs(Math.cos(phase)) * 0.05 * amt;
  k.spine.rotation.y = sw * 0.12 * amt;
  k.spine.rotation.x = 0.08 * amt + run * 0.18 * amt;
  return sw;
}

// ---------------------------------------------------------------- zombies (instanced)
const Z_SPEC = { leg: 0.92, torso: 0.62, shoulder: 0.25, arm: 0.3, fore: 0.29, head: 0.3, hipW: 0.1, limbW: 0.13, chestW: 0.44, chestD: 0.26 };
const Z_KINDS = ['pelvis', 'torso', 'head', 'uArm', 'fArm', 'thigh', 'shin', 'eye', 'gas'];
const SHIRTS = ['#4f5442', '#585c47', '#5d5848', '#4a4e44', '#6b6250', '#3f4238', '#71684f', '#4d4a3e'];
const PANTS = ['#2f3029', '#3a3a31', '#2b2a26', '#45412f', '#33352c'];
const SKINS = ['#8d9a7c', '#97a083', '#7f8c70', '#a1a089', '#889377'];

export class ZombieCrowd {
  constructor(scene, capacity = 48) {
    this.capacity = capacity;
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    this.meshes = {};
    const lambert = (opts) => new THREE.MeshLambertMaterial({ color: 0xffffff, ...opts });
    const mats = {
      pelvis: lambert(), torso: lambert(), head: lambert(), uArm: lambert(), fArm: lambert(), thigh: lambert(), shin: lambert(),
      eye: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      gas: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.85 }),
    };
    const geos = { pelvis: GEO.box, torso: GEO.torso, head: GEO.sphere, uArm: GEO.capsule, fArm: GEO.capsule, thigh: GEO.capsule, shin: GEO.capsule, eye: GEO.lowSphere, gas: GEO.lowSphere };
    const per = { pelvis: 1, torso: 1, head: 1, uArm: 2, fArm: 2, thigh: 2, shin: 2, eye: 2, gas: 3 };
    this.per = per;
    for (const k of Z_KINDS) {
      const m = new THREE.InstancedMesh(geos[k], mats[k], capacity * per[k]);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = capacity * per[k];
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < m.count; i++) {
        m.setMatrixAt(i, zero);
        m.setColorAt(i, new THREE.Color(1, 1, 1));
      }
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      this.meshes[k] = m;
    }
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._c = new THREE.Color();
    this._white = new THREE.Color(1, 1, 1);
  }

  /** Attach render data to a sim zombie. */
  add(z) {
    if (!this.free.length) return false;
    const slot = this.free.pop();
    const k = skeleton(Z_SPEC);
    const crawler = z.kind === 'nova';
    // eyes and gas sacs are extra part nodes on the skeleton
    const eyeL = part(k.head, 'eye', 0.07, 0.05, 0.05, 0.17, 0.065, 0.13);
    const eyeR = part(k.head, 'eye', 0.07, 0.05, 0.05, 0.17, -0.065, 0.13);
    const gas = [
      part(k.spine, 'gas', 0.2, 0.18, 0.2, 0.45, 0.1, -0.14),
      part(k.spine, 'gas', 0.16, 0.14, 0.16, 0.25, -0.12, -0.13),
      part(k.spine, 'gas', 0.14, 0.12, 0.14, 0.6, -0.05, -0.12),
    ];
    const pal = {
      shirt: crawler ? '#6f7a5a' : SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
      pants: crawler ? '#4a5038' : PANTS[Math.floor(Math.random() * PANTS.length)],
      skin: crawler ? '#a7b88a' : SKINS[Math.floor(Math.random() * SKINS.length)],
      eye: crawler ? '#9dff3a' : '#ffb21e',
    };
    z.r3 = {
      slot, k, eyes: [eyeL, eyeR], gas, pal,
      armReach: rand(-0.25, 0.15),
      headTilt: rand(-0.3, 0.3),
      limp: Math.random() < 0.3 ? rand(0.2, 0.5) : 0,
      seed: Math.random() * TAU,
      flashShown: false,
    };
    this.paint(z, false);
    return true;
  }

  paint(z, flash) {
    const r = z.r3;
    const c = this._c;
    const set = (kind, idx, hex) => {
      if (flash) c.setRGB(3, 3, 3);
      else c.set(hex);
      this.meshes[kind].setColorAt(idx, c);
      this.meshes[kind].instanceColor.needsUpdate = true;
    };
    const s = r.slot;
    set('pelvis', s, r.pal.pants);
    set('torso', s, r.pal.shirt);
    set('head', s, r.pal.skin);
    set('uArm', s * 2, r.pal.shirt);
    set('uArm', s * 2 + 1, r.pal.shirt);
    set('fArm', s * 2, r.pal.skin);
    set('fArm', s * 2 + 1, r.pal.skin);
    for (const kind of ['thigh', 'shin']) {
      set(kind, s * 2, r.pal.pants);
      set(kind, s * 2 + 1, r.pal.pants);
    }
    // eyes / gas keep their glow during a flash
    c.set(r.pal.eye);
    this.meshes.eye.setColorAt(s * 2, c);
    this.meshes.eye.setColorAt(s * 2 + 1, c);
    this.meshes.eye.instanceColor.needsUpdate = true;
    c.set('#a8ff3c');
    for (let i = 0; i < 3; i++) this.meshes.gas.setColorAt(s * 3 + i, c);
    this.meshes.gas.instanceColor.needsUpdate = true;
  }

  remove(z) {
    const r = z.r3;
    if (!r) return;
    const s = r.slot;
    for (const kind of Z_KINDS) {
      const n = this.per[kind];
      for (let i = 0; i < n; i++) this.meshes[kind].setMatrixAt(s * n + i, this._zero);
      this.meshes[kind].instanceMatrix.needsUpdate = true;
    }
    this.free.push(s);
    z.r3 = null;
  }

  /** Pose every zombie from its sim state and upload instance matrices. */
  sync(list, time) {
    for (const z of list) {
      const r = z.r3;
      if (!r) continue;
      const k = r.k;
      this.pose(z, k, r, time);
      k.root.position.set(z.x, z.y + (z.yOff || 0), z.z);
      k.root.rotation.y = yawOf(z.ang);
      k.root.updateMatrixWorld(true);
      const flash = z.flash > 0;
      if (flash !== r.flashShown) {
        r.flashShown = flash;
        this.paint(z, flash);
      }
      const s = r.slot;
      const P = k.parts;
      const put = (kind, idx, node, hidden) => this.meshes[kind].setMatrixAt(idx, hidden ? this._zero : node.matrixWorld);
      put('pelvis', s, P.pelvis);
      put('torso', s, P.torso);
      put('head', s, P.head, z.headless);
      put('uArm', s * 2, P.uArmL, z.noArmL);
      put('uArm', s * 2 + 1, P.uArmR, z.noArmR);
      put('fArm', s * 2, P.fArmL, z.noArmL);
      put('fArm', s * 2 + 1, P.fArmR, z.noArmR);
      put('thigh', s * 2, P.thighL, z.legless);
      put('thigh', s * 2 + 1, P.thighR, z.legless);
      put('shin', s * 2, P.shinL, z.legless);
      put('shin', s * 2 + 1, P.shinR, z.legless);
      const eyesOff = z.headless || (z.dead && z.deadT > 0.6);
      put('eye', s * 2, r.eyes[0], eyesOff);
      put('eye', s * 2 + 1, r.eyes[1], eyesOff);
      const novaGas = z.kind === 'nova' && !z.dead;
      for (let i = 0; i < 3; i++) put('gas', s * 3 + i, r.gas[i], !novaGas);
    }
    for (const kind of Z_KINDS) this.meshes[kind].instanceMatrix.needsUpdate = true;
  }

  pose(z, k, r, time) {
    rest(k);
    const sp = z.animSpeed || 0; // m/s actually moved
    const t = time + r.seed;
    if (z.kind === 'nova' || z.legless) return this.poseCrawl(z, k, r, t, sp);
    const run = clamp((sp - 1.4) / 2.2, 0, 1);
    const amt = clamp(sp / 1.2, 0, 1);
    const sw = locomote(k, z.walkPhase || 0, amt, run);
    if (r.limp) k.knL.rotation.x += r.limp * amt;
    // classic zombie reach: arms forward, swaying
    const reach = -1.25 - r.armReach + Math.sin(t * 1.7) * 0.08;
    k.shL.rotation.x = lerp(reach, -0.6 + sw * 0.9, run * 0.7);
    k.shR.rotation.x = lerp(reach + 0.1, -0.6 - sw * 0.9, run * 0.7);
    k.shL.rotation.z = 0.12;
    k.shR.rotation.z = -0.12;
    k.elL.rotation.x = -0.25 - run * 0.6;
    k.elR.rotation.x = -0.3 - run * 0.6;
    k.spine.rotation.x += 0.12 + run * 0.15;
    k.neck.rotation.z = r.headTilt + Math.sin(t * 0.9) * 0.1;
    k.neck.rotation.x = 0.15;
    if (z.state === 'attack' || z.state === 'tear') {
      const a = z.actT || 0; // 0..1 swing progress
      const swing = Math.sin(a * Math.PI);
      k.shL.rotation.x = -2.3 + swing * 1.7;
      k.shR.rotation.x = -2.1 + Math.sin(clamp(a * 1.2 - 0.15, 0, 1) * Math.PI) * 1.6;
      k.spine.rotation.x = 0.15 + swing * 0.3;
    }
    if (z.state === 'climb') {
      const a = z.actT || 0;
      k.spine.rotation.x = 0.6 * Math.sin(a * Math.PI);
      k.hpL.rotation.x = -1.2 * Math.sin(a * Math.PI);
      k.knL.rotation.x = 1.2 * Math.sin(a * Math.PI);
    }
    if (z.stun > 0) {
      k.spine.rotation.z = Math.sin(t * 9) * 0.12;
      k.neck.rotation.x = 0.5;
      k.shL.rotation.x = -0.4;
      k.shR.rotation.x = -0.3;
    }
    if (z.knockup > 0) k.spine.rotation.x = -0.4;
    if (z.state === 'rise') {
      k.shL.rotation.x = -2.8;
      k.shR.rotation.x = -2.6 + Math.sin(t * 6) * 0.3;
    }
    if (z.dead) this.poseDeath(z, k);
  }

  poseCrawl(z, k, r, t, sp) {
    const fast = z.kind === 'nova';
    const ph = z.walkPhase || 0;
    const amt = clamp(sp / 1.0, 0, 1);
    k.hips.position.y = fast ? 0.42 : 0.28;
    k.hips.rotation.x = fast ? 1.15 : 1.45; // body pitched forward, nearly flat
    k.neck.rotation.x = -1.0;
    const s = Math.sin(ph);
    k.shL.rotation.x = -1.5 - s * 0.7 * amt;
    k.shR.rotation.x = -1.5 + s * 0.7 * amt;
    k.elL.rotation.x = 0.4;
    k.elR.rotation.x = 0.4;
    k.hpL.rotation.x = 1.2 + s * 0.5 * amt;
    k.hpR.rotation.x = 1.2 - s * 0.5 * amt;
    k.knL.rotation.x = -1.6;
    k.knR.rotation.x = -1.6;
    k.spine.rotation.z = s * 0.1 * amt;
    if (z.state === 'attack') {
      const a = Math.sin((z.actT || 0) * Math.PI);
      k.shL.rotation.x = -2.4 + a;
      k.shR.rotation.x = -2.2 + a;
    }
    if (z.dead) this.poseDeath(z, k);
  }

  poseDeath(z, k) {
    const d = clamp(z.deadT / 0.55, 0, 1);
    const e = d * d;
    const dir = z.deathDir || 1; // 1 = falls backwards
    k.hips.rotation.x = (z.kind === 'nova' || z.legless ? k.hips.rotation.x : 0) + -dir * e * 1.45;
    k.hips.position.y = lerp(k.hips.position.y, 0.16, e);
    k.shL.rotation.x = lerp(k.shL.rotation.x, -2.6, e);
    k.shR.rotation.x = lerp(k.shR.rotation.x, -2.2, e);
    k.hpL.rotation.x = lerp(k.hpL.rotation.x, -0.3, e);
    k.hpR.rotation.x = lerp(k.hpR.rotation.x, 0.2, e);
    k.knL.rotation.x = lerp(k.knL.rotation.x, 0.2, e);
    k.knR.rotation.x = lerp(k.knR.rotation.x, 0.5, e);
  }

  dispose() {
    for (const m of Object.values(this.meshes)) {
      m.parent && m.parent.remove(m);
      m.material.dispose();
      m.dispose();
    }
  }
}

// ---------------------------------------------------------------- champions
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

function meshOn(node, geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  node.add(m);
  return m;
}

/** Put real meshes on the part nodes of a skeleton. mats: kind -> material */
function dress(k, mats) {
  const geoFor = { pelvis: GEO.box, torso: GEO.torso, head: GEO.sphere, uArm: GEO.capsule, fArm: GEO.capsule, thigh: GEO.capsule, shin: GEO.capsule };
  for (const [name, node] of Object.entries(k.parts)) {
    const kind = node.userData.kind;
    const mat = mats[name] || mats[kind];
    if (!mat) continue;
    meshOn(node, geoFor[kind], mat);
  }
}

/** A mesh positioned/scaled under a joint, independent of part scaling. */
function add(parent, geo, mat, [x, y, z], [sx, sy, sz], rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function dagger(mat, hilt) {
  const g = new THREE.Group();
  add(g, GEO.box, hilt, [0, 0, 0], [0.05, 0.12, 0.05]);
  add(g, GEO.box, hilt, [0, -0.07, 0], [0.16, 0.025, 0.05]);
  const blade = add(g, GEO.cone, mat, [0, -0.3, 0], [0.07, 0.42, 0.02], [Math.PI, 0, 0]);
  blade.userData.blade = true;
  return g;
}

/**
 * Champion visuals. Returns { root, k, kind, mats, glow[], anim(state) }.
 * Palettes are drawn from each champion's default look but the models are original.
 */
export function buildChampion(kind) {
  if (kind === 'amumu') return buildAmumu();
  if (kind === 'katarina') return buildKatarina();
  return buildYi();
}

function buildKatarina() {
  const k = skeleton({ leg: 0.92, torso: 0.6, shoulder: 0.2, arm: 0.29, fore: 0.27, head: 0.32, hipW: 0.09, limbW: 0.105, chestW: 0.36, chestD: 0.22 });
  const skin = std('#f1c7a5');
  const leather = std('#1f1a20', { roughness: 0.55 });
  const red = std('#9e1c22', { roughness: 0.6 });
  const hair = std('#c22628', { roughness: 0.85 });
  const steel = std('#d6d9e0', { roughness: 0.25, metalness: 0.8, emissive: '#000000' });
  const grip = std('#3a2b25');
  dress(k, { pelvis: leather, torso: leather, head: skin, uArm: skin, fArm: leather, thigh: leather, shin: leather });
  // red accents: corset band, shoulder pad, boots
  add(k.spine, GEO.cyl, red, [0, 0.12, 0], [0.38, 0.1, 0.24]);
  add(k.shL, GEO.sphere, leather, [0, -0.02, 0], [0.16, 0.12, 0.16]);
  add(k.knL, GEO.capsule, red, [0, -0.32, 0.01], [0.13, 0.22, 0.14]);
  add(k.knR, GEO.capsule, red, [0, -0.32, 0.01], [0.13, 0.22, 0.14]);
  // hair: crown, fringe and a long mane down the back
  add(k.head, GEO.sphere, hair, [0, 0.2, -0.03], [0.35, 0.32, 0.36]);
  add(k.head, GEO.sphere, hair, [0, 0.07, -0.13], [0.34, 0.42, 0.22]);
  const mane = new THREE.Object3D();
  mane.position.set(0, 0.1, -0.16);
  k.head.add(mane);
  add(mane, GEO.capsule, hair, [0, -0.25, -0.02], [0.28, 0.55, 0.14], [0.15, 0, 0]);
  add(mane, GEO.capsule, hair, [0.08, -0.45, -0.05], [0.14, 0.4, 0.1], [0.25, 0, 0.15]);
  add(mane, GEO.capsule, hair, [-0.08, -0.45, -0.05], [0.14, 0.4, 0.1], [0.25, 0, -0.15]);
  // daggers in both hands
  const dL = dagger(steel, grip);
  dL.rotation.x = -Math.PI / 2;
  dL.position.set(0, -0.04, 0.02);
  k.hdL.add(dL);
  const dR = dagger(steel, grip);
  dR.rotation.x = -Math.PI / 2;
  dR.position.set(0, -0.04, 0.02);
  k.hdR.add(dR);
  return finish('katarina', k, { skin, leather, red, hair, steel }, { mane, dL, dR });
}

function buildYi() {
  const k = skeleton({ leg: 0.9, torso: 0.62, shoulder: 0.23, arm: 0.3, fore: 0.28, head: 0.31, hipW: 0.1, limbW: 0.12, chestW: 0.42, chestD: 0.25 });
  const robe = std('#9b8a5c');
  const dark = std('#3d3a2c');
  const gold = std('#c9a23a', { roughness: 0.4, metalness: 0.6 });
  const skin = std('#d9b08c');
  const lens = new THREE.MeshStandardMaterial({ color: '#7dff5a', emissive: '#55ff2e', emissiveIntensity: 2.2, roughness: 0.2 });
  const blade = std('#e8f0f2', { roughness: 0.2, metalness: 0.85, emissive: '#000000' });
  dress(k, { pelvis: dark, torso: robe, head: dark, uArm: robe, fArm: dark, thigh: dark, shin: dark });
  // robe skirt, sash and shoulder guard
  add(k.hips, GEO.cone, robe, [0, -0.2, 0], [0.5, 0.5, 0.36], [Math.PI, 0, 0]);
  add(k.spine, GEO.cyl, std('#7c2d24'), [0, 0.08, 0], [0.44, 0.09, 0.27]);
  add(k.shR, GEO.sphere, gold, [-0.03, 0, 0], [0.2, 0.14, 0.2]);
  add(k.shL, GEO.sphere, robe, [0.02, 0, 0], [0.17, 0.12, 0.17]);
  // the helmet: dark hood, gold rim and three green lenses
  add(k.head, GEO.sphere, dark, [0, 0.17, 0], [0.34, 0.34, 0.35]);
  add(k.head, GEO.cyl, gold, [0, 0.16, 0.02], [0.36, 0.05, 0.37]);
  add(k.head, GEO.cyl, lens, [0.075, 0.17, 0.17], [0.11, 0.05, 0.11], [Math.PI / 2, 0, 0]);
  add(k.head, GEO.cyl, lens, [-0.075, 0.17, 0.17], [0.11, 0.05, 0.11], [Math.PI / 2, 0, 0]);
  add(k.head, GEO.cyl, lens, [0.12, 0.27, 0.13], [0.075, 0.04, 0.075], [Math.PI / 2.4, 0, 0]);
  // topknot cloth
  add(k.head, GEO.capsule, std('#7c2d24'), [0, 0.3, -0.16], [0.07, 0.3, 0.07], [0.9, 0, 0]);
  // the sword: long straight blade
  const sword = new THREE.Group();
  add(sword, GEO.cyl, dark, [0, 0.02, 0], [0.04, 0.2, 0.04]);
  add(sword, GEO.box, gold, [0, -0.09, 0], [0.18, 0.03, 0.06]);
  const bl = add(sword, GEO.box, blade, [0, -0.62, 0], [0.05, 1.0, 0.012]);
  bl.userData.blade = true;
  add(sword, GEO.cone, blade, [0, -1.17, 0], [0.05, 0.1, 0.012], [Math.PI, 0, 0]);
  sword.rotation.x = -Math.PI / 2;
  sword.position.set(0, -0.04, 0.03);
  k.hdR.add(sword);
  return finish('yi', k, { robe, dark, gold, skin, lens, blade }, { sword });
}

function buildAmumu() {
  const k = skeleton({ leg: 0.42, torso: 0.36, shoulder: 0.2, arm: 0.2, fore: 0.18, head: 0.44, hipW: 0.09, limbW: 0.13, chestW: 0.42, chestD: 0.32 });
  const wrap = std('#b9a77e', { roughness: 0.95 });
  const wrapDark = std('#8f7d58', { roughness: 0.95 });
  const skin = std('#5f8f86', { roughness: 0.9 });
  const eye = new THREE.MeshStandardMaterial({ color: '#ffe36b', emissive: '#ffcf2e', emissiveIntensity: 2.4, roughness: 0.3 });
  dress(k, { pelvis: wrapDark, torso: wrap, head: wrap, uArm: wrap, fArm: wrap, thigh: wrapDark, shin: wrap });
  // bandage bands around the body
  for (let i = 0; i < 4; i++) add(k.spine, GEO.cyl, i % 2 ? wrapDark : wrap, [0, 0.05 + i * 0.08, 0], [0.44 - i * 0.03, 0.045, 0.34 - i * 0.02], [0.08 * (i % 2 ? 1 : -1), 0, 0.06]);
  // big round head, bands across it, one glowing eye peeking out, teal skin under the gap
  add(k.head, GEO.sphere, skin, [0.05, 0.22, 0.14], [0.26, 0.2, 0.2]);
  add(k.head, GEO.sphere, eye, [0.08, 0.24, 0.2], [0.11, 0.1, 0.07]);
  add(k.head, GEO.cyl, wrapDark, [0, 0.33, 0.01], [0.47, 0.06, 0.47], [0.18, 0, 0.1]);
  add(k.head, GEO.cyl, wrapDark, [0, 0.12, 0], [0.46, 0.06, 0.46], [-0.12, 0, -0.08]);
  add(k.head, GEO.cyl, wrap, [-0.05, 0.25, 0.07], [0.42, 0.08, 0.42], [0.05, 0, 0.3]);
  // loose bandage tails that trail behind (animated)
  const tails = [];
  for (const [jn, x] of [[k.elL, 0], [k.elR, 0], [k.spine, 0.1], [k.head, -0.15]]) {
    const pivot = new THREE.Object3D();
    pivot.position.set(x, jn === k.head ? 0.3 : jn === k.spine ? 0.3 : -0.1, -0.08);
    jn.add(pivot);
    const tail = add(pivot, GEO.box, wrap, [0, -0.18, -0.06], [0.06, 0.36, 0.015], [0.5, 0, 0]);
    tails.push(pivot);
    tail.userData.tail = true;
  }
  return finish('amumu', k, { wrap, wrapDark, skin, eye }, { tails });
}

function finish(kind, k, mats, extra) {
  const root = new THREE.Group();
  root.add(k.root);
  return { kind, root, k, mats, extra, anim: { phase: 0, atk: 0, atkSide: 1, cast: 0, castKind: '', spin: 0, down: 0 } };
}

/**
 * Pose a champion. st: { speed, attackT (0..1 or -1), attackSide, castT, castKind,
 * channel ('lotus' | 'meditate' | ''), downed, time, dt, run }
 */
export function animateChampion(c, st) {
  const k = c.k;
  rest(k);
  const a = c.anim;
  const sp = st.speed;
  const stride = c.kind === 'amumu' ? 1.25 : 2.1;
  a.phase += (sp / stride) * Math.PI * st.dt;
  const amt = clamp(sp / 2, 0, 1);
  const run = clamp((sp - 2.5) / 2.5, 0, 1);
  const sw = locomote(k, a.phase, amt, run);
  const t = st.time;
  // arms swing opposite to legs when moving, idle breathing otherwise
  k.shL.rotation.x = sw * 0.7 * amt;
  k.shR.rotation.x = -sw * 0.7 * amt;
  k.shL.rotation.z = 0.12;
  k.shR.rotation.z = -0.12;
  k.elL.rotation.x = -0.35 - run * 0.5;
  k.elR.rotation.x = -0.35 - run * 0.5;
  k.spine.rotation.x += Math.sin(t * 2) * 0.02 * (1 - amt);

  if (c.kind === 'amumu') {
    k.neck.rotation.x = 0.28; // always a little sad
    k.neck.rotation.z = Math.sin(t * 1.3) * 0.06;
    k.spine.rotation.z = sw * 0.12 * amt; // waddle
    for (let i = 0; i < c.extra.tails.length; i++) {
      const p = c.extra.tails[i];
      p.rotation.x = 0.4 + amt * 0.8 + Math.sin(t * 7 + i * 1.7) * (0.15 + amt * 0.25);
      p.rotation.z = Math.sin(t * 5 + i) * 0.2;
    }
  } else if (c.kind === 'katarina') {
    k.elL.rotation.x = -0.9;
    k.elR.rotation.x = -0.9;
    c.extra.mane.rotation.x = 0.15 + amt * 0.5 + Math.sin(t * 6) * 0.05 * amt;
  } else {
    // Yi holds the sword low and back while running
    k.shR.rotation.x = -0.3 + sw * 0.2 * amt;
    k.elR.rotation.x = -0.6;
    k.hdR.rotation.z = 0.25;
  }

  if (st.attackT >= 0) {
    const p = st.attackT;
    const swing = Math.sin(clamp(p, 0, 1) * Math.PI);
    const side = st.attackSide;
    const sh = side > 0 ? k.shR : k.shL;
    const el = side > 0 ? k.elR : k.elL;
    if (c.kind === 'yi') {
      // horizontal cut, wound up across the body
      k.shR.rotation.x = -1.4;
      k.shR.rotation.y = lerp(1.2, -1.1, easeIO(p)) * side;
      k.elR.rotation.x = -0.2;
      k.spine.rotation.y = lerp(0.5, -0.6, easeIO(p)) * side;
    } else if (c.kind === 'katarina') {
      sh.rotation.x = -1.9 + swing * 1.2;
      sh.rotation.y = lerp(0.8, -0.6, p) * side;
      el.rotation.x = -0.3;
      k.spine.rotation.y = lerp(0.35, -0.4, p) * side;
    } else {
      sh.rotation.x = -2.2 + swing * 1.8;
      el.rotation.x = -0.2;
      k.spine.rotation.x += swing * 0.25;
    }
  }

  if (st.castT >= 0) {
    const p = clamp(st.castT, 0, 1);
    const up = Math.sin(p * Math.PI);
    switch (st.castKind) {
      case 'throw':
        k.shR.rotation.x = lerp(-2.6, -1.0, p);
        k.spine.rotation.y = lerp(0.5, -0.4, p);
        break;
      case 'toss':
        k.shL.rotation.x = -2.8 * up;
        k.shR.rotation.x = -2.8 * up;
        break;
      case 'slam':
        k.shL.rotation.x = -2.9 * up;
        k.shR.rotation.x = -2.9 * up;
        k.hips.position.y -= 0.12 * up;
        break;
      case 'spread':
        k.shL.rotation.z = 1.4 * up;
        k.shR.rotation.z = -1.4 * up;
        k.neck.rotation.x = -0.3 * up;
        break;
      case 'dash':
        k.spine.rotation.x = 0.5 * up;
        k.shR.rotation.x = -1.6;
        k.shL.rotation.x = 0.8;
        break;
      default:
        k.shR.rotation.x = -1.8 * up;
    }
  }

  if (st.channel === 'lotus') {
    a.spin += st.dt * 18;
    k.root.rotation.y = a.spin;
    k.shL.rotation.z = 1.3;
    k.shR.rotation.z = -1.3;
  } else if (st.channel === 'meditate') {
    k.hips.position.y = 0.32;
    k.hpL.rotation.x = -1.5;
    k.hpR.rotation.x = -1.5;
    k.hpL.rotation.y = -0.9;
    k.hpR.rotation.y = 0.9;
    k.knL.rotation.x = 2.3;
    k.knR.rotation.x = 2.3;
    k.shL.rotation.x = -0.6;
    k.shR.rotation.x = -0.6;
    k.elL.rotation.x = -1.0;
    k.elR.rotation.x = -1.0;
    k.spine.rotation.x = 0;
  } else {
    k.root.rotation.y = 0;
  }

  if (st.downed) {
    k.hips.position.y = 0.2;
    k.hips.rotation.x = -1.35;
    k.shL.rotation.x = -2.6 + Math.sin(t * 3) * 0.3;
    k.shR.rotation.x = -2.4;
    k.neck.rotation.x = 0.8;
  }
}

const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
