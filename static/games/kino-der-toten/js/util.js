// Small shared helpers. Everything in the game works on the XZ plane: x grows east
// (screen right), z grows south (towards the camera). Angles are atan2(dz, dx).

export const TAU = Math.PI * 2;
export const $ = (id) => document.getElementById(id);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeIn = (t) => t * t * t;

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/** Signed smallest difference a - b, in (-PI, PI]. */
export function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Rotate angle `a` towards `b` by at most `step` radians. */
export function turnTowards(a, b, step) {
  const d = angDiff(b, a);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

export const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));

/** Exponential smoothing factor that is frame-rate independent. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Distance from point p to segment ab, all on the XZ plane. */
export function segDist2(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t, cz = az + abz * t;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
}

/** Is point p inside the cone at (ox, oz) facing `ang` with half-angle `half` and range `r`? */
export function inCone(px, pz, ox, oz, ang, half, r) {
  const dx = px - ox, dz = pz - oz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return false;
  if (d2 < 1e-6) return true;
  return Math.abs(angDiff(Math.atan2(dz, dx), ang)) <= half;
}

export function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

/** Tiny event bus so systems can talk without importing each other. */
export function bus() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name).delete(fn);
    },
    emit(name, a, b, c) {
      const set = map.get(name);
      if (set) for (const fn of set) fn(a, b, c);
    },
  };
}

/** Spatial hash for circles on the XZ plane, rebuilt every frame. */
export class SpatialHash {
  constructor(cell = 2) {
    this.cell = cell;
    this.map = new Map();
  }
  clear() {
    this.map.clear();
  }
  key(cx, cz) {
    return (cx + 512) * 4096 + (cz + 512);
  }
  insert(obj) {
    const c = this.cell;
    const k = this.key(Math.floor(obj.x / c), Math.floor(obj.z / c));
    let list = this.map.get(k);
    if (!list) this.map.set(k, (list = []));
    list.push(obj);
  }
  /** Calls fn(obj) for every object whose cell overlaps the circle (x, z, r). */
  query(x, z, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.map.get(this.key(cx, cz));
        if (list) for (let i = 0; i < list.length; i++) fn(list[i]);
      }
    }
  }
}

/** Seeded PRNG (mulberry32) for anything that must look the same every run. */
export function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Safe localStorage access: private windows and sandboxed frames can throw. */
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: settings just won't persist */
    }
  },
};
