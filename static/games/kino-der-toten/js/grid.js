// The walkable grid: collision for circles, line-of-sight, and a flow field
// (Dijkstra distance map from the player) that every zombie follows.

export const CELL = 0.5;

/** Bucket-queue Dijkstra over 8-neighbour cells with integer costs (10 / 14). */
export class Grid {
  /**
   * @param {number} w cells wide
   * @param {number} h cells tall
   */
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.solid = new Uint8Array(n).fill(1); // 1 = blocked for everyone
    this.zone = new Int16Array(n).fill(-1); // room/zone index, -1 = none
    this.height = new Float32Array(n);
    this.door = new Int16Array(n).fill(-1); // door index (blocked while closed)
    this.win = new Int16Array(n).fill(-1); // window index
    this.extra = new Uint8Array(n); // extra path cost near walls
    this.dist = new Int32Array(n);
    this.distAlt = new Int32Array(n);
    this.buckets = [];
    this.flowStamp = 0;
  }

  idx(cx, cz) {
    return cz * this.w + cx;
  }
  cx(x) {
    return Math.floor(x / CELL);
  }
  inside(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h;
  }
  /** Blocked for movement? (outside the grid counts as blocked) */
  blocked(cx, cz) {
    if (!this.inside(cx, cz)) return true;
    return this.solid[cz * this.w + cx] === 1;
  }
  blockedAt(x, z) {
    return this.blocked(Math.floor(x / CELL), Math.floor(z / CELL));
  }
  zoneAt(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (!this.inside(cx, cz)) return -1;
    return this.zone[cz * this.w + cx];
  }
  heightAt(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (!this.inside(cx, cz)) return 0;
    return this.height[cz * this.w + cx];
  }

  /** After solids change: cells next to walls cost a little more, so paths keep off corners. */
  computeExtra() {
    const { w, h, solid, extra } = this;
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const i = z * w + x;
        if (solid[i]) {
          extra[i] = 0;
          continue;
        }
        let near = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.blocked(x + dx, z + dz)) near++;
        extra[i] = near ? 4 + near : 0;
      }
    }
  }

  /**
   * Distance field from (x, z). Unreached cells get a huge value.
   * `out` defaults to this.dist.
   */
  flow(x, z, out = this.dist) {
    const { w, h, solid, extra } = this;
    const INF = 0x3fffffff;
    out.fill(INF);
    let sx = Math.floor(x / CELL), sz = Math.floor(z / CELL);
    if (this.blocked(sx, sz)) {
      // start from the nearest open neighbour (the player can be pushed into a wall edge)
      let found = false;
      for (let r = 1; r <= 3 && !found; r++) {
        for (let dz = -r; dz <= r && !found; dz++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            if (!this.blocked(sx + dx, sz + dz)) {
              sx += dx;
              sz += dz;
              found = true;
            }
          }
        }
      }
      if (!found) return out;
    }
    const B = 32; // bucket ring size (> max edge cost)
    const buckets = this.buckets;
    for (let i = 0; i < B; i++) {
      if (!buckets[i]) buckets[i] = [];
      buckets[i].length = 0;
    }
    const s = sz * w + sx;
    out[s] = 0;
    buckets[0].push(s);
    let cur = 0, pending = 1, guard = 0;
    while (pending > 0 && guard++ < 1e7) {
      const b = buckets[cur % B];
      if (!b.length) {
        cur++;
        continue;
      }
      const i = b.pop();
      pending--;
      const d = out[i];
      if (d !== cur) continue; // stale entry
      const ix = i % w, iz = (i - ix) / w;
      for (let k = 0; k < 8; k++) {
        const dx = DX[k], dz = DZ[k];
        const nx = ix + dx, nz = iz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const j = nz * w + nx;
        if (solid[j]) continue;
        if (k >= 4) {
          // no corner cutting through diagonal gaps
          if (solid[iz * w + nx] || solid[nz * w + ix]) continue;
        }
        const nd = d + (k >= 4 ? 14 : 10) + extra[j];
        if (nd < out[j]) {
          out[j] = nd;
          buckets[nd % B].push(j);
          pending++;
        }
      }
    }
    this.flowStamp++;
    return out;
  }

  /** Distance-field value at a world point (INF if blocked/unreached). */
  distAt(x, z, field = this.dist) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (!this.inside(cx, cz)) return 0x3fffffff;
    return field[cz * this.w + cx];
  }

  /**
   * Direction to walk downhill on the field from (x, z). Returns {x, z} unit or null.
   * Samples the 8 neighbours and picks the lowest, then blends with the gradient.
   */
  downhill(x, z, field = this.dist) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (!this.inside(cx, cz)) return null;
    const here = field[cz * this.w + cx];
    let best = here, bx = 0, bz = 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + DX[k], nz = cz + DZ[k];
      if (!this.inside(nx, nz)) continue;
      const j = nz * this.w + nx;
      if (this.solid[j]) continue;
      if (k >= 4 && (this.solid[cz * this.w + nx] || this.solid[nz * this.w + cx])) continue;
      const v = field[j];
      if (v < best) {
        best = v;
        bx = DX[k];
        bz = DZ[k];
      }
    }
    if (bx === 0 && bz === 0) return null;
    // aim at the centre of the chosen cell, which also pulls us off walls
    const tx = (cx + bx + 0.5) * CELL, tz = (cz + bz + 0.5) * CELL;
    const dx = tx - x, dz = tz - z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }

  /** Grid ray march: true if no blocked cell between the points. `pad` widens the test. */
  los(x0, z0, x1, z1, pad = 0) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const steps = Math.ceil(len / (CELL * 0.45));
    const nx = -dz / len, nz = dx / len;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t, z = z0 + dz * t;
      if (this.blockedAt(x, z)) return false;
      if (pad > 0 && (this.blockedAt(x + nx * pad, z + nz * pad) || this.blockedAt(x - nx * pad, z - nz * pad))) return false;
    }
    return true;
  }

  /** Furthest open point along a ray from (x0, z0) up to len (for dashes and blinks). */
  castFree(x0, z0, dx, dz, len, r = 0.3) {
    const steps = Math.ceil(len / (CELL * 0.3));
    let lx = x0, lz = z0;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * len;
      const x = x0 + dx * t, z = z0 + dz * t;
      if (!this.circleFree(x, z, r)) break;
      lx = x;
      lz = z;
    }
    return { x: lx, z: lz };
  }

  /** Is a circle completely in open cells? */
  circleFree(x, z, r) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!this.blocked(cx, cz)) continue;
        // closest point of the cell box to the circle centre
        const bx = Math.max(cx * CELL, Math.min(x, (cx + 1) * CELL));
        const bz = Math.max(cz * CELL, Math.min(z, (cz + 1) * CELL));
        if ((x - bx) * (x - bx) + (z - bz) * (z - bz) < r * r - 1e-6) return false;
      }
    }
    return true;
  }

  /**
   * Push a circle out of blocked cells. Mutates and returns ent {x, z}.
   * Iterates a few times so corners resolve cleanly.
   */
  resolve(ent, r) {
    for (let it = 0; it < 4; it++) {
      let moved = false;
      const x0 = Math.floor((ent.x - r) / CELL), x1 = Math.floor((ent.x + r) / CELL);
      const z0 = Math.floor((ent.z - r) / CELL), z1 = Math.floor((ent.z + r) / CELL);
      for (let cz = z0; cz <= z1; cz++) {
        for (let cx = x0; cx <= x1; cx++) {
          if (!this.blocked(cx, cz)) continue;
          const minX = cx * CELL, maxX = minX + CELL, minZ = cz * CELL, maxZ = minZ + CELL;
          const bx = Math.max(minX, Math.min(ent.x, maxX));
          const bz = Math.max(minZ, Math.min(ent.z, maxZ));
          let dx = ent.x - bx, dz = ent.z - bz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-9) {
            const d = Math.sqrt(d2);
            const push = r - d;
            ent.x += (dx / d) * push;
            ent.z += (dz / d) * push;
          } else {
            // centre inside the cell: step to the nearest open cell (never through to the far side)
            const o = this.nearestOpen(ent.x, ent.z, 1.5);
            if (o) {
              ent.x = o.x;
              ent.z = o.z;
            }
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    return ent;
  }

  /**
   * Nearest spot to (x, z) within maxR where a circle of radius r fits and that the
   * distance field reaches (same connected area as whoever the field was built from).
   */
  nearestReachable(x, z, maxR, field, r = 0.4) {
    if (this.circleFree(x, z, r) && this.distAt(x, z, field) < 0x3fffffff) return { x, z };
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const R = Math.ceil(maxR / CELL);
    let best = null, bd = Infinity;
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const px = (cx + dx + 0.5) * CELL, pz = (cz + dz + 0.5) * CELL;
        const d = (px - x) * (px - x) + (pz - z) * (pz - z);
        if (d >= bd || d > maxR * maxR) continue;
        if (!this.circleFree(px, pz, r)) continue;
        if (this.distAt(px, pz, field) >= 0x3fffffff) continue;
        bd = d;
        best = { x: px, z: pz };
      }
    }
    return best;
  }

  /** Nearest open cell centre to (x, z) within maxR metres, or null. */
  nearestOpen(x, z, maxR = 3) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const R = Math.ceil(maxR / CELL);
    let best = null, bd = Infinity;
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (this.blocked(cx + dx, cz + dz)) continue;
        const px = (cx + dx + 0.5) * CELL, pz = (cz + dz + 0.5) * CELL;
        const d = (px - x) * (px - x) + (pz - z) * (pz - z);
        if (d < bd) {
          bd = d;
          best = { x: px, z: pz };
        }
      }
    }
    return best;
  }
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
