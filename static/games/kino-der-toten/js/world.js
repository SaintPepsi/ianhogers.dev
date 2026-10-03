// Builds the theatre in 3D from the map grid and keeps its moving parts animated:
// doors, boards, the box, perk machines, traps, the curtain, the screen, lights.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from './grid.js';
import {
  ROOMS, OPENINGS, P, toX, toZ, UNIT, PERK_SPOTS, BOX_SPOTS, WALL_BUYS, TRAPS, TURRETS, POWER_SWITCH, TELEPORTER, MAINFRAME,
  PAP, PROJECTOR, METEORS, CHANDELIER, SCREEN, SEAT_BLOCKS, RISERS, faceYaw, faceVec,
} from './map.js';
import * as props from './props.js';
import { xrayMaterial } from './render.js';
import { chalkTexture } from './textures.js';
import { rand, prng, clamp } from './util.js';

const WALL_H = 2.7;
const LOW_H = 0.95;

export function createWorld(scene, map, tex, opts = {}) {
  const { grid, room, wall, low, w, h } = map;
  const root = new THREE.Group();
  scene.add(root);
  const staticGroup = new THREE.Group();
  root.add(staticGroup);
  const dyn = new THREE.Group();
  root.add(dyn);
  const lights = [];
  const rng = prng(77);
  let world_mirrors = [], world_posts = [];

  // ------------------------------------------------------------------ materials
  const worldUv = (map, color, scale = 0.5, extra = {}) => {
    const m = new THREE.MeshLambertMaterial({ map, color, ...extra });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\nvarying vec3 vWorldN;').replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        vWorldP = wp.xyz;
        vWorldN = normalize(mat3(modelMatrix) * objectNormal);`
      );
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWorldP;\nvarying vec3 vWorldN;\nuniform float uUvScale;`).replace(
        '#include <map_fragment>',
        `vec2 wuv = abs(vWorldN.y) > 0.5 ? vWorldP.xz : (abs(vWorldN.x) > 0.5 ? vWorldP.zy : vWorldP.xy);
        vec4 sampledDiffuseColor = texture2D(map, wuv * uUvScale);
        diffuseColor *= sampledDiffuseColor;`
      );
      sh.uniforms.uUvScale = { value: scale };
    };
    m.customProgramCacheKey = () => 'worlduv' + scale;
    return m;
  };
  const floorMats = {
    carpet: worldUv(tex.carpet, 0xffffff, 0.45),
    wood: worldUv(tex.wood, 0xffffff, 0.4),
    tiles: worldUv(tex.tiles, 0xffffff, 0.5),
    cobble: worldUv(tex.cobble, 0xffffff, 0.45),
    concrete: worldUv(tex.concrete, 0xffffff, 0.3),
    stairs: worldUv(tex.wood, 0xd8b090, 0.6),
    outside: worldUv(tex.cobble, 0x5a5a64, 0.4),
  };
  // walls: the x-ray patch is applied on top of the world-uv patch
  const wallMat = (t, color, scale) => {
    const m = worldUv(t, color, scale);
    const inner = m.onBeforeCompile;
    const xr = xrayMaterial(new THREE.MeshLambertMaterial());
    const xrHook = xr.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      inner(sh, r);
      xrHook(sh, r);
    };
    m.customProgramCacheKey = () => 'wall' + scale + (t ? t.uuid : '');
    return m;
  };
  const wallMats = {
    wallpaper: wallMat(tex.wallpaper, 0xffffff, 0.5),
    brick: wallMat(tex.brick, 0xffffff, 0.6),
    plaster: wallMat(tex.plaster, 0xffffff, 0.5),
    concrete: wallMat(tex.concrete, 0xbbbbbb, 0.35),
  };
  const capMat = new THREE.MeshBasicMaterial({ color: '#0a0708' });
  const massMat = new THREE.MeshBasicMaterial({ color: '#060405' });
  const lowMat = wallMat(tex.wood, 0xc89a70, 0.8);
  const brassMat = new THREE.MeshStandardMaterial({ color: '#8a6a30', metalness: 0.7, roughness: 0.4 });

  const roomWallStyle = (ri) => {
    const id = ROOMS[ri].id;
    if (id === 'alley' || id === 'yard' || id === 'lowerHall') return 'brick';
    if (id === 'backroom' || id === 'backstage' || id === 'wingStairs' || id === 'yardStairs' || id === 'stairwell') return 'concrete';
    if (id === 'pap' || id.startsWith('ee')) return 'plaster';
    return 'wallpaper';
  };

  // ------------------------------------------------------------------ floors
  const vertH = (cx, cz) => {
    // average height of the up-to-4 floor cells sharing this vertex
    let s = 0, n = 0;
    for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= w || z >= h) continue;
      const i = z * w + x;
      if (room[i] < 0) continue;
      s += grid.height[i];
      n++;
    }
    return n ? s / n : 0;
  };
  {
    const buckets = {};
    for (let cz = 0; cz < h; cz++) {
      for (let cx = 0; cx < w; cx++) {
        const i = cz * w + cx;
        const ri = room[i];
        let kind;
        if (ri >= 0) {
          if (wall[i]) continue;
          kind = ROOMS[ri].floor;
          if (kind === 'stairs') continue; // drawn as steps
        } else if (grid.win[i] >= 0 || nearWindow(cx, cz)) kind = 'outside';
        else continue;
        const b = (buckets[kind] ||= { pos: [], idx: [] });
        const x0 = cx * CELL, z0 = cz * CELL;
        const flat = ri < 0 || !ROOMS[ri].ramp;
        const hh = ri >= 0 ? grid.height[i] : -0.02;
        const y00 = flat ? hh : vertH(cx, cz), y10 = flat ? hh : vertH(cx + 1, cz), y01 = flat ? hh : vertH(cx, cz + 1), y11 = flat ? hh : vertH(cx + 1, cz + 1);
        const base = b.pos.length / 3;
        b.pos.push(x0, y00, z0, x0 + CELL, y10, z0, x0, y01, z0 + CELL, x0 + CELL, y11, z0 + CELL);
        b.idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    for (const [kind, b] of Object.entries(buckets)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setIndex(b.idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, floorMats[kind]);
      m.receiveShadow = false;
      root.add(m);
    }
  }
  function nearWindow(cx, cz) {
    // exterior pocket outside each window, where zombies walk up
    const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
    for (const wd of map.windows) {
      const dx = x - wd.x, dz = z - wd.z;
      const along = dx * wd.tx + dz * wd.tz;
      const out = -(dx * wd.nx + dz * wd.nz);
      if (out > -0.1 && out < wd.outDist + 0.8 && Math.abs(along) < 1.6) return true;
    }
    return false;
  }

  // stairs: real steps
  ROOMS.forEach((r, ri) => {
    if (r.floor !== 'stairs') return;
    const [X0, Y0, X1, Y1] = r.rects[0];
    const ramp = r.ramp;
    const lenU = Math.abs(ramp.b - ramp.a);
    const steps = Math.max(3, Math.round((lenU * UNIT) / 0.32));
    const g = new THREE.Group();
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const hh = ramp.h0 + (ramp.h1 - ramp.h0) * (ramp.h1 > ramp.h0 ? t1 : t0);
      let a0 = ramp.a + (ramp.b - ramp.a) * t0, a1 = ramp.a + (ramp.b - ramp.a) * t1;
      if (a0 > a1) [a0, a1] = [a1, a0];
      let x0, x1, z0, z1;
      if (ramp.axis === 'Y') {
        x0 = toX(X0);
        x1 = toX(X1);
        z0 = toZ(a1);
        z1 = toZ(a0);
      } else {
        x0 = toX(a0);
        x1 = toX(a1);
        z0 = toZ(Y1);
        z1 = toZ(Y0);
      }
      const bottom = Math.min(ramp.h0, ramp.h1) - 0.9;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, hh - bottom, z1 - z0), floorMats.stairs);
      m.position.set((x0 + x1) / 2, (hh + bottom) / 2, (z0 + z1) / 2);
      g.add(m);
    }
    // the flat run before the ramp starts (yard stairs have one)
    const flatA = ramp.axis === 'Y' ? [Y0, Math.min(ramp.a, ramp.b)] : [X0, Math.min(ramp.a, ramp.b)];
    if (flatA[1] - flatA[0] > 5) {
      const lowH = Math.min(ramp.h0, ramp.h1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(toX(X1) - toX(X0), 0.9, (flatA[1] - flatA[0]) * UNIT), floorMats.stairs);
      m.position.set((toX(X0) + toX(X1)) / 2, lowH - 0.45, toZ((flatA[0] + flatA[1]) / 2));
      g.add(m);
    }
    staticGroup.add(g);
  });

  // ------------------------------------------------------------------ walls and mass
  // A wall cell is any solid cell (wall or void) next to walkable floor. Deeper void is "mass".
  const isFloor = (cx, cz) => {
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return false;
    const i = cz * w + cx;
    return room[i] >= 0 && !wall[i];
  };
  const kindAt = new Int8Array(w * h).fill(-1); // 0 wall, 1 low, 2 mass, -1 none
  const topAt = new Float32Array(w * h);
  const botAt = new Float32Array(w * h);
  const styleAt = new Int8Array(w * h);
  const styles = Object.keys(wallMats);
  for (let cz = 0; cz < h; cz++) {
    for (let cx = 0; cx < w; cx++) {
      const i = cz * w + cx;
      if (isFloor(cx, cz)) continue;
      if (grid.win[i] >= 0) continue; // window opening: drawn as frame + boards
      if (grid.door[i] >= 0) continue; // doors are props
      if (room[i] < 0 && nearWindow(cx, cz)) continue;
      let hi = -99, lo = 99, n = 0, styleVote = {};
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!isFloor(cx + dx, cz + dz)) continue;
          const j = (cz + dz) * w + cx + dx;
          hi = Math.max(hi, grid.height[j]);
          lo = Math.min(lo, grid.height[j]);
          const st = roomWallStyle(room[j]);
          styleVote[st] = (styleVote[st] || 0) + 1;
          n++;
        }
      }
      if (n === 0) {
        kindAt[i] = 2;
        topAt[i] = WALL_H;
        botAt[i] = -1;
        continue;
      }
      const isLow = low[i] === 1;
      kindAt[i] = isLow ? 1 : 0;
      topAt[i] = Math.round((hi + (isLow ? LOW_H : WALL_H)) * 10) / 10;
      botAt[i] = Math.round((lo - 1.0) * 10) / 10;
      let best = 'wallpaper', bv = -1;
      for (const [k, v] of Object.entries(styleVote)) if (v > bv) {
        bv = v;
        best = k;
      }
      styleAt[i] = styles.indexOf(best);
    }
  }
  // greedy merge per row
  const boxesBy = new Map(); // key -> list of [x0, x1, z0, z1, y0, y1]
  for (let cz = 0; cz < h; cz++) {
    let cx = 0;
    while (cx < w) {
      const i = cz * w + cx;
      const k = kindAt[i];
      if (k < 0) {
        cx++;
        continue;
      }
      const key = k + ':' + topAt[i] + ':' + botAt[i] + ':' + styleAt[i];
      let run = 1;
      while (cx + run < w) {
        const j = cz * w + cx + run;
        if (kindAt[j] !== k || topAt[j] !== topAt[i] || botAt[j] !== botAt[i] || styleAt[j] !== styleAt[i]) break;
        run++;
      }
      if (!boxesBy.has(key)) boxesBy.set(key, []);
      boxesBy.get(key).push([cx * CELL, (cx + run) * CELL, cz * CELL, (cz + 1) * CELL, botAt[i], topAt[i]]);
      cx += run;
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const byMat = new Map();
  for (const [key, list] of boxesBy) {
    const [k, , , st] = key.split(':');
    const kind = +k;
    const matKey = kind === 2 ? 'mass' : kind === 1 ? 'low' : styles[+st];
    if (!byMat.has(matKey)) byMat.set(matKey, []);
    byMat.get(matKey).push(...list);
  }
  for (const [matKey, list] of byMat) {
    const side = matKey === 'mass' ? massMat : matKey === 'low' ? lowMat : wallMats[matKey];
    const top = matKey === 'low' ? brassMat : matKey === 'mass' ? massMat : capMat;
    const mats = [side, side, top, side, side, side];
    const m = new THREE.InstancedMesh(unit, mats, list.length);
    const o = new THREE.Object3D();
    list.forEach((b, idx) => {
      o.position.set((b[0] + b[1]) / 2, (b[4] + b[5]) / 2, (b[2] + b[3]) / 2);
      o.scale.set(b[1] - b[0], b[5] - b[4], b[3] - b[2]);
      o.updateMatrix();
      m.setMatrixAt(idx, o.matrix);
    });
    m.frustumCulled = false;
    root.add(m);
  }

  // ------------------------------------------------------------------ placing helpers
  const at = (X, Y, yOff = 0) => {
    const p = P(X, Y);
    return new THREE.Vector3(p.x, grid.heightAt(p.x, p.z) + yOff, p.z);
  };
  /** Push a point off the wall it was specified on, so a prop sits on the floor in front of it. */
  const onFloor = (X, Y, face, inset = 0.45) => {
    const p = P(X, Y);
    const v = faceVec(face);
    let x = p.x, z = p.z;
    for (let i = 0; i < 12 && grid.blockedAt(x, z); i++) {
      x += v.x * 0.15;
      z += v.z * 0.15;
    }
    // back up to touch the wall, then step out by inset
    let bx = x, bz = z;
    for (let i = 0; i < 12 && !grid.blockedAt(bx - v.x * 0.1, bz - v.z * 0.1); i++) {
      bx -= v.x * 0.1;
      bz -= v.z * 0.1;
    }
    return { x: bx + v.x * inset, z: bz + v.z * inset, wx: bx, wz: bz };
  };
  const place = (obj, x, z, face, yOff = 0, parent = dyn) => {
    obj.position.set(x, grid.heightAt(x, z) + yOff, z);
    obj.rotation.y = faceYaw(face);
    parent.add(obj);
    return obj;
  };
  /** Mark a rectangle (metres, centred) solid so props block movement. */
  const blockRect = (x, z, sx, sz) => {
    const x0 = Math.floor((x - sx / 2) / CELL), x1 = Math.floor((x + sx / 2 - 0.01) / CELL);
    const z0 = Math.floor((z - sz / 2) / CELL), z1 = Math.floor((z + sz / 2 - 0.01) / CELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) if (grid.inside(cx, cz)) grid.solid[cz * w + cx] = 1;
  };
  const light = (x, y, z, color, intensity, range, opts2 = {}) => {
    const l = { x, y, z, color, intensity, range, on: !opts2.power, power: !!opts2.power, flicker: !!opts2.flicker, base: intensity };
    lights.push(l);
    return l;
  };

  // ------------------------------------------------------------------ perks
  const perks = {};
  for (const [kind, s] of Object.entries(PERK_SPOTS)) {
    const p = onFloor(s.X, s.Y, s.face, 0.5);
    const m = place(props.perkMachine(kind), p.x, p.z, s.face);
    const v = faceVec(s.face);
    blockRect(p.x, p.z, Math.abs(v.x) ? 0.9 : 1.2, Math.abs(v.x) ? 1.2 : 0.9);
    perks[kind] = { mesh: m, x: p.x, z: p.z, ix: p.x + v.x * 1.1, iz: p.z + v.z * 1.1, light: light(p.x + v.x * 0.8, 1.8, p.z + v.z * 0.8, m.userData.color, 5, 6, { power: kind !== 'revive' }), gone: false };
  }

  // ------------------------------------------------------------------ box spots
  const boxes = BOX_SPOTS.map((s, idx) => {
    const p = onFloor(s.X, s.Y, s.face, 0.5);
    const v = faceVec(s.face);
    const yaw = faceYaw(s.face);
    const rubble = place(props.boxRubble(), p.x, p.z, s.face);
    const bear = new THREE.Group();
    // a little pile of teddy bears where the box isn't (scorched, original design)
    for (let i = 0; i < 3; i++) {
      const b = teddy(0.5 + rand(-0.1, 0.1));
      b.position.set(rand(-0.6, 0.6), 0.15, rand(-0.2, 0.2));
      b.rotation.set(rand(-0.4, 0.4), rand(0, 6), rand(-0.6, 0.6));
      bear.add(b);
    }
    rubble.add(bear);
    blockRect(p.x, p.z, Math.abs(v.x) ? 1.0 : 1.9, Math.abs(v.x) ? 1.9 : 1.0);
    // location board with the nine lights
    const board = boxBoard();
    const bp = onFloor(s.X, s.Y, s.face, 0.02);
    board.position.set(bp.x + (Math.abs(v.x) ? 0 : 1.3), grid.heightAt(p.x, p.z) + 1.6, bp.z + (Math.abs(v.x) ? 1.3 : 0));
    board.rotation.y = yaw;
    dyn.add(board);
    return { ...s, index: idx, x: p.x, z: p.z, ix: p.x + v.x * 1.15, iz: p.z + v.z * 1.15, yaw, rubble, box: null, y: grid.heightAt(p.x, p.z), board };
  });
  const boxMesh = props.mysteryBox();
  boxMesh.visible = false;
  dyn.add(boxMesh);

  // ------------------------------------------------------------------ wall-buys (chalk)
  const chalk = WALL_BUYS.map((wb, idx) => {
    const p = onFloor(wb.X, wb.Y, wb.face, 0.03);
    const v = faceVec(wb.face);
    const t = chalkTexture(wb.gun.toUpperCase(), wb.cost, (g) => drawChalkGlyph(g, wb.item));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 }));
    m.position.set(p.wx + v.x * 0.03, grid.heightAt(p.x, p.z) + 1.45, p.wz + v.z * 0.03);
    m.rotation.y = faceYaw(wb.face);
    staticGroup.add(m);
    return { ...wb, index: idx, x: p.x, z: p.z, ix: p.wx + v.x * 1.0, iz: p.wz + v.z * 1.0, mesh: m };
  });

  // ------------------------------------------------------------------ doors
  const doorObjs = {};
  for (const d of map.doors) {
    const [X0, Y0, X1, Y1] = d.rect;
    const wU = d.axis === 'X' ? Y1 - Y0 : X1 - X0;
    const width = wU * UNIT;
    const cx = toX((X0 + X1) / 2), cz = toZ((Y0 + Y1) / 2);
    if (d.kind === 'door') {
      const style = d.style === 'metal' ? 'metal' : 'wood';
      const parts = [];
      const rects = [d.rect].concat(d.also ? [d.also] : []);
      for (const r of rects) {
        const mx = toX((r[0] + r[2]) / 2), mz = toZ((r[1] + r[3]) / 2);
        const obj = d.style === 'gate' ? gate(width) : props.door(width, 2.6, style);
        obj.position.set(mx, grid.heightAt(mx, mz), mz);
        obj.rotation.y = d.axis === 'X' ? Math.PI / 2 : 0;
        dyn.add(obj);
        parts.push(obj);
        // the price sign over the door
      }
      doorObjs[d.id] = { parts, d, anim: 0 };
    } else if (d.kind === 'power') {
      const obj = props.door(width, 2.8, 'wood');
      obj.position.set(cx, grid.heightAt(cx, cz), cz);
      dyn.add(obj);
      doorObjs[d.id] = { parts: [obj], d, anim: 0 };
    }
  }

  // ------------------------------------------------------------------ windows
  const windowObjs = map.windows.map((wd) => {
    const g = new THREE.Group();
    const frame = props.windowFrame(1.6);
    g.add(frame);
    const b = props.boards(1.6);
    g.add(b);
    g.position.set(wd.x, wd.y, wd.z);
    g.rotation.y = Math.atan2(wd.nx, wd.nz);
    dyn.add(g);
    // a weak cold light spilling in from outside
    light(wd.x + wd.nx * 0.6, 1.6, wd.z + wd.nz * 0.6, '#8fa8d8', 1.2, 4);
    return { wd, group: g, boards: b };
  });

  // ------------------------------------------------------------------ traps
  const traps = TRAPS.map((t) => {
    const [X0, Y0, X1, Y1] = t.band;
    const x0 = toX(X0), x1 = toX(X1), z0 = toZ(Y1), z1 = toZ(Y0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const vertical = x1 - x0 < z1 - z0; // band runs north-south
    const len = vertical ? z1 - z0 : x1 - x0;
    const g = t.kind === 'fire' ? firePit(len, Math.min(x1 - x0, z1 - z0)) : props.trapFrame(len);
    g.position.set(cx, grid.heightAt(cx, cz), cz);
    g.rotation.y = vertical ? Math.PI / 2 : 0;
    dyn.add(g);
    const handles = t.switches.map(([X, Y, face]) => {
      const p = onFloor(X, Y, face, 0.05);
      const hnd = props.trapHandle();
      hnd.position.set(p.wx, grid.heightAt(p.x, p.z), p.wz);
      hnd.rotation.y = faceYaw(face);
      dyn.add(hnd);
      const v = faceVec(face);
      return { mesh: hnd, x: p.wx + v.x * 0.9, z: p.wz + v.z * 0.9 };
    });
    const l = light(cx, 1.5, cz, t.kind === 'fire' ? '#ff7a20' : '#9fd8ff', 0, 7);
    return { ...t, x0, x1, z0, z1, cx, cz, mesh: g, handles, light: l };
  });

  // ------------------------------------------------------------------ turrets
  const turrets = TURRETS.map((tt) => {
    const p = P(tt.X, tt.Y);
    const m = turretModel();
    m.position.set(p.x, grid.heightAt(p.x, p.z), p.z);
    dyn.add(m);
    blockRect(p.x, p.z, 0.8, 0.8);
    return { x: p.x, z: p.z, mesh: m, ix: p.x, iz: p.z + 1.0 };
  });

  // ------------------------------------------------------------------ power, teleporter, mainframe, PaP
  const sw = onFloor(POWER_SWITCH.X, POWER_SWITCH.Y, POWER_SWITCH.face, 0.05);
  const switchMesh = props.powerSwitch();
  switchMesh.position.set(sw.wx, grid.heightAt(sw.x, sw.z), sw.wz);
  switchMesh.rotation.y = faceYaw(POWER_SWITCH.face);
  dyn.add(switchMesh);
  const power = { x: sw.wx, z: sw.wz + 0.9, mesh: switchMesh };
  light(sw.wx, 2.2, sw.wz + 0.6, '#ff5030', 2, 4, { flicker: true });

  const tp = P(TELEPORTER.X, TELEPORTER.Y);
  const tpMesh = props.teleporterPad();
  tpMesh.position.set(tp.x, grid.heightAt(tp.x, tp.z), tp.z);
  dyn.add(tpMesh);
  const teleporter = { x: tp.x, z: tp.z, mesh: tpMesh, light: light(tp.x, 2.5, tp.z, '#5ac8ff', 0, 8) };

  const mf = P(MAINFRAME.X, MAINFRAME.Y);
  const mfMesh = mainframePad();
  mfMesh.position.set(mf.x, grid.heightAt(mf.x, mf.z), mf.z);
  dyn.add(mfMesh);
  const mainframe = { x: mf.x, z: mf.z, mesh: mfMesh };

  // the link cable from the stage pad down the aisle to the lobby
  const cablePts = [P(-304, 1114), P(-200, 930), P(-60, 700), P(-60, -150), P(-60, -560), P(-30, -1000), P(2, -1180)].map((p) => new THREE.Vector3(p.x, grid.heightAt(p.x, p.z) + 0.04, p.z));
  const cableMat = new THREE.MeshStandardMaterial({ color: '#222', emissive: '#30ff60', emissiveIntensity: 0, roughness: 0.6 });
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 80, 0.05, 6), cableMat);
  dyn.add(cable);

  const pp = onFloor(PAP.X, PAP.Y, PAP.face, 0.6);
  const papMesh = props.packAPunch();
  papMesh.position.set(pp.x, grid.heightAt(pp.x, pp.z), pp.z);
  papMesh.rotation.y = faceYaw(PAP.face);
  dyn.add(papMesh);
  blockRect(pp.x, pp.z, 2.1, 1.2);
  const pap = { x: pp.x, z: pp.z, ix: pp.x, iz: pp.z - 1.3, mesh: papMesh, light: light(pp.x, 2.2, pp.z - 1, '#b070ff', 4, 8, { power: true }) };
  // projector and the wall clock in the projector room
  const prj = P(PROJECTOR.X, PROJECTOR.Y);
  const projMesh = props.projector();
  projMesh.position.set(prj.x, 0, prj.z + 0.8);
  projMesh.rotation.y = Math.PI;
  dyn.add(projMesh);
  blockRect(prj.x, prj.z + 0.8, 1.0, 1.4);
  const clock = wallClock();
  clock.position.set(pp.x, 3.0, pp.z + 0.62);
  clock.rotation.y = Math.PI;
  dyn.add(clock);
  light(prj.x, 2.4, prj.z + 2, '#ffe0b0', 3, 9);

  // ------------------------------------------------------------------ theatre dressing
  // seats in the four blocks
  {
    const list = [];
    for (const [X0, Y0, X1, Y1] of SEAT_BLOCKS) {
      const x0 = toX(X0), x1 = toX(X1), z0 = toZ(Y1), z1 = toZ(Y0);
      for (let z = z0 + 0.35; z < z1 - 0.2; z += 0.9) {
        for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.58) {
          if (rng() < 0.06) continue; // missing seats
          list.push({ x, y: grid.heightAt(x, z) + 0.02, z, ry: Math.PI, broken: rng() < 0.12 });
        }
      }
    }
    root.add(props.seats(list));
  }
  // stage curtain and screen
  const curtainOpening = OPENINGS.find((o) => o.kind === 'curtain');
  const cX0 = toX(curtainOpening.rect[0]), cX1 = toX(curtainOpening.rect[2]);
  const curtainZ = toZ(1225);
  const curtainObj = props.curtains(cX1 - cX0, 4.2, tex.curtain);
  curtainObj.position.set((cX0 + cX1) / 2, 0, curtainZ);
  dyn.add(curtainObj);
  const scr = props.movieScreen(SCREEN.width * UNIT, (SCREEN.width * UNIT) / 1.78);
  const scrP = P(SCREEN.X, SCREEN.Y + 20);
  scr.position.set(scrP.x, 9, scrP.z);
  dyn.add(scr);
  const screen = { mesh: scr, lowered: 0, mode: 'off' };
  // proscenium valance
  {
    const v = new THREE.Mesh(new THREE.BoxGeometry(toX(747) - toX(-517), 1.0, 0.4), new THREE.MeshLambertMaterial({ color: '#4a0a10' }));
    v.position.set((toX(747) + toX(-517)) / 2, 4.6, curtainZ - 0.25);
    staticGroup.add(v);
  }
  // chandelier
  const ch = props.chandelier();
  const chp = P(CHANDELIER.X, CHANDELIER.Y);
  ch.position.set(chp.x, 6.2, chp.z);
  dyn.add(ch);
  const chandelier = { mesh: ch, light: light(chp.x, 5, chp.z, '#ffd890', 9, 22, { power: true }) };
  // small fires burning in the wreckage (7)
  const fires = [];
  for (const [X, Y] of [[-700, 100], [700, 380], [-90, 860], [610, -440], [-660, 640], [690, 860], [-380, -300]]) {
    const p = P(X, Y);
    if (grid.blockedAt(p.x, p.z)) continue;
    const f = smallFire();
    f.position.set(p.x, grid.heightAt(p.x, p.z), p.z);
    dyn.add(f);
    fires.push({ mesh: f, light: light(p.x, 0.8, p.z, '#ff8a30', 4, 6, { flicker: true }) });
    staticGroup.add(place(props.rubblePile(0.6), p.x + 0.4, p.z + 0.3, 'S', 0, staticGroup));
  }
  // rubble around the auditorium and stage
  for (let i = 0; i < 14; i++) {
    const X = rand(-740, 740), Y = rand(-480, 900);
    const p = P(X, Y);
    if (grid.blockedAt(p.x, p.z) || map.seatCells[Math.floor(p.z / CELL) * w + Math.floor(p.x / CELL)]) continue;
    staticGroup.add(place(props.rubblePile(0.35), p.x, p.z, 'S', 0, staticGroup));
  }
  // posters in the lobby and halls
  const posterSpots = [[-402, -1100, 'E', 'kino'], [-402, -1450, 'E', 'toten'], [554, -1100, 'W', 'rift'], [554, -1350, 'W', 'mummy'], [580, -900, 'E', 'blade'], [1680, -900, 'W', 'wuju'], [-1352, -800, 'E', 'toten'], [1893, 200, 'W', 'kino']];
  posterSpots.forEach(([X, Y, f, k], i) => {
    const p = onFloor(X, Y, f, 0.02);
    const m = props.poster(k, i + 1);
    m.position.set(p.wx + faceVec(f).x * 0.02, grid.heightAt(p.x, p.z) + 1.7, p.wz + faceVec(f).z * 0.02);
    m.rotation.y = faceYaw(f);
    staticGroup.add(m);
  });
  // lobby: hanging lamps, a ticket counter
  for (const [X, Y] of [[-200, -1400], [300, -1400], [-200, -950], [300, -950]]) {
    const p = P(X, Y);
    lights.push({ x: p.x, y: 2.6, z: p.z, color: '#ffcc88', intensity: 6, range: 9, on: false, power: true, base: 6 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffcc66', emissiveIntensity: 0.1 }));
    lamp.position.set(p.x, 3.0, p.z);
    lamp.userData.powerGlow = true;
    dyn.add(lamp);
  }
  // emergency light in the lobby before power (dim red)
  { const p = P(2, -1266); light(p.x, 3, p.z, '#ff4a3a', 2.5, 12, { flicker: true }); }
  // foyer bar, tables, chairs
  {
    const b = props.bar(4.5);
    const p = P(1400, 240);
    staticGroup.add(place(b, p.x, p.z, 'S', 0, staticGroup));
    blockRect(p.x, p.z, 4.6, 0.8);
    for (const [X, Y] of [[1700, 450], [1250, 600], [1700, 120]]) {
      const q = P(X, Y);
      staticGroup.add(place(props.table(true), q.x, q.z, 'S', 0, staticGroup));
      blockRect(q.x, q.z, 1.0, 1.0);
      for (let k = 0; k < 2; k++) staticGroup.add(place(props.chair(), q.x + (k ? 0.9 : -0.9), q.z + 0.1, k ? 'W' : 'E', 0, staticGroup));
    }
    const tq = P(1520, 424);
    staticGroup.add(place(props.table(false), tq.x, tq.z + 0.05, 'S', 0, staticGroup));
    lights.push({ ...P(1500, 400), y: 2.6, color: '#ffc070', intensity: 6, range: 10, on: false, power: true, base: 6 });
  }
  // dressing room: mannequins, vanity mirrors
  {
    const mirrors = [];
    for (const [X, Y, f] of [[1540, 1100, 'W'], [1540, 1560, 'W'], [1016, 1000, 'E']]) {
      const p = onFloor(X, Y, f, 0.3);
      const v = props.vanityMirror();
      staticGroup.add(place(v, p.x, p.z, f, 0, staticGroup));
      mirrors.push(v);
      blockRect(p.x, p.z, faceVec(f).x ? 0.6 : 1.4, faceVec(f).x ? 1.4 : 0.6);
    }
    for (const [X, Y] of [[1250, 1063], [1350, 1063], [870, 1180]]) {
      const p = P(X, Y);
      staticGroup.add(place(props.mannequin(), p.x, p.z, 'S', 0, staticGroup));
      blockRect(p.x, p.z, 0.5, 0.5);
    }
    lights.push({ ...P(1280, 1300), y: 2.4, color: '#ffe0a0', intensity: 5, range: 9, on: false, power: true, base: 5 });
    world_mirrors = mirrors;
  }
  // lower hall: crematorium ovens
  for (const X of [-1200, -700]) {
    const p = P(X, -930);
    const o = props.oven();
    o.scale.setScalar(0.8);
    staticGroup.add(place(o, p.x, p.z, 'N', 0, staticGroup));
    blockRect(p.x, p.z, 2.2, 1.6);
    fires.push({ oven: o, light: light(p.x, 1.0, p.z - 1.2, '#ff6a20', 4, 7, { flicker: true }) });
  }
  // alley: lamp posts, crates, barrels
  {
    const posts = [];
    for (const [X, Y] of [[-1400, -450], [-1700, 100], [-1400, 650]]) {
      const p = P(X, Y);
      const lp = props.lampPost();
      staticGroup.add(place(lp, p.x, p.z, 'S', 0, staticGroup));
      posts.push(lp);
      blockRect(p.x, p.z, 0.3, 0.3);
      lights.push({ x: p.x, y: 3.2, z: p.z, color: '#ffd28a', intensity: 7, range: 11, on: false, power: true, base: 7 });
    }
    world_posts = posts;
    for (const [X, Y] of [[-1720, -100], [-1720, -50], [-1180, -250], [-1700, 700]]) {
      const p = P(X, Y);
      staticGroup.add(place(props.crate(0.9), p.x, p.z, 'S', 0, staticGroup));
      blockRect(p.x, p.z, 0.9, 0.9);
    }
    for (const [X, Y] of [[-1400, 760], [-1200, 450]]) {
      const p = P(X, Y);
      staticGroup.add(place(props.barrel(), p.x, p.z, 'S', 0, staticGroup));
      blockRect(p.x, p.z, 0.6, 0.6);
    }
  }
  // back room: shelves of marquee letters, machinery
  {
    const p = P(-1700, 1560);
    const shelf = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: '#4a3020' });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.5), wood);
      s.position.y = 0.4 + i * 0.6;
      shelf.add(s);
    }
    staticGroup.add(place(shelf, p.x + 0.6, p.z + 0.1, 'E', 0, staticGroup));
    lights.push({ ...P(-1460, 1450), y: 2.4 + 1.2, color: '#ffb070', intensity: 5, range: 9, on: false, power: true, base: 5 });
  }
  // upper hall portraits (five frames on the south wall)
  for (let i = 0; i < 5; i++) {
    const X = 1080 + i * 120;
    const p = onFloor(X, -1099, 'N', 0.02);
    const f = new THREE.Group();
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.06), new THREE.MeshStandardMaterial({ color: '#8a6a30', metalness: 0.6, roughness: 0.4 }));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.95), new THREE.MeshLambertMaterial({ color: i === 0 ? '#111' : ['#3a2a20', '#2a3a30', '#30283a', '#3a3020'][i - 1] }));
    pic.position.z = 0.035;
    f.add(fr, pic);
    f.position.set(p.wx, grid.heightAt(p.x, p.z) + 1.8, p.wz - 0.02);
    f.rotation.y = faceYaw('N');
    staticGroup.add(f);
  }
  lights.push({ ...P(1100, -700), y: 3.0 + 0.6, color: '#ffcc88', intensity: 6, range: 10, on: false, power: true, base: 6 });
  lights.push({ ...P(750, -650), y: 3.0 + 0.6, color: '#ffcc88', intensity: 5, range: 9, on: false, power: true, base: 5 });
  // stage and backstage work lights
  lights.push({ ...P(100, 1550), y: 3.2, color: '#ffe6c0', intensity: 7, range: 12, on: false, power: true, base: 7 });
  lights.push({ ...P(-800, 1450), y: 3.2, color: '#ffe6c0', intensity: 5, range: 9, on: false, power: true, base: 5 });
  lights.push({ ...P(115, 1080), y: 4.0, color: '#ffffff', intensity: 8, range: 12, on: false, power: true, base: 8 });
  lights.push({ ...P(-1300, -640), y: 2.6, color: '#ffb070', intensity: 5, range: 10, on: false, power: true, base: 5 });
  lights.push({ ...P(-640, -664), y: 2.8, color: '#ffcc88', intensity: 5, range: 9, on: false, power: true, base: 5 });
  lights.push({ ...P(0, -350), y: 2.8, color: '#ffcc88', intensity: 4, range: 7, on: false, power: true, base: 4 });
  // dim always-on moonlight pools in the alley
  lights.push({ ...P(-1550, 0), y: 6, color: '#7a8ac8', intensity: 3, range: 14, on: true, base: 3 });

  // meteors on little pedestals
  const meteors = METEORS.map((mt) => {
    const p = P(mt.X, mt.Y);
    const g = props.meteorRock();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 10), new THREE.MeshLambertMaterial({ color: '#2a2622' }));
    ped.position.y = 0.4;
    g.add(ped);
    g.position.set(p.x, grid.heightAt(p.x, p.z), p.z);
    dyn.add(g);
    blockRect(p.x, p.z, 0.5, 0.5);
    return { ...mt, x: p.x, z: p.z, mesh: g, done: false };
  });

  // easter-egg rooms: simple furniture
  furnishSecretRooms();

  // merge static meshes by material to save draw calls
  mergeStatic(staticGroup);
  grid.computeExtra();

  // ------------------------------------------------------------------ dynamic state
  const doorAnims = [];
  const api = {
    root, lights, perks, boxes, boxMesh, chalk, doors: doorObjs, windows: windowObjs, traps, turrets, power, teleporter, mainframe, pap, screen, chandelier, meteors, cable,
    powered: false,
    setPower(on) {
      api.powered = on;
      for (const l of lights) if (l.power) l.on = on;
      switchMesh.userData.setOn(on ? 1 : 0);
      for (const k of Object.keys(perks)) perks[k].mesh.userData.setPower(on || k === 'revive');
      papMesh.userData.setPower(on);
      ch.userData.setLit(on ? 1 : 0);
      for (const m of world_mirrors) m.userData.setLit(on ? 1 : 0);
      for (const p of world_posts) p.userData.setLit(on ? 1 : 0);
      dyn.traverse((o) => {
        if (o.userData.powerGlow) o.material.emissiveIntensity = on ? 2.2 : 0.1;
      });
    },
    openDoor(id) {
      const d = doorObjs[id];
      if (!d) return;
      doorAnims.push({ d, t: 0 });
    },
    setBoards(wi, n) {
      windowObjs[wi].boards.userData.setBoards(n);
    },
    /** A board comes off: fling a copy of the plank into the room. */
    flingBoard(wi, fx) {
      const wo = windowObjs[wi];
      const wd = wo.wd;
      fx.burst(wd.x, wd.y + 1.2, wd.z, 8, { color: '#6b4a2a', speed: 3, life: 0.6, size: 0.12, grav: 9, smoke: true });
    },
    update(dt, t, st) {
      for (let i = doorAnims.length - 1; i >= 0; i--) {
        const a = doorAnims[i];
        a.t += dt;
        const p = clamp(a.t / 0.9, 0, 1);
        for (const part of a.d.parts) {
          if (part.userData.setOpen) part.userData.setOpen(p);
          if (a.d.d.style === 'gate' || a.d.d.kind === 'door') part.position.y = grid.heightAt(part.position.x, part.position.z) - Math.max(0, a.t - 0.6) * 4;
        }
        if (a.t > 1.6) {
          for (const part of a.d.parts) part.visible = false;
          doorAnims.splice(i, 1);
        }
      }
      for (const k of Object.keys(perks)) perks[k].mesh.userData.setPower(api.powered || (k === 'revive' && !perks[k].gone), t);
      papMesh.userData.setPower(api.powered, t);
      if (st.papSpin) papMesh.userData.spin(dt);
      tpMesh.userData.setState(st.teleState || 'off', t);
      mfMesh.userData.setState(api.powered, st.teleState === 'linked' || st.coreLinked, t);
      cableMat.emissiveIntensity = st.teleState === 'linked' ? 1.2 + Math.sin(t * 4) * 0.4 : st.coreLinked ? 0.4 : 0;
      teleporter.light.intensity = st.teleState === 'linked' ? 5 : st.teleState === 'charging' ? 14 : 0;
      teleporter.light.on = teleporter.light.intensity > 0;
      for (const f of fires) {
        if (f.oven) f.oven.userData.setFire(t);
        if (f.mesh) f.mesh.userData.flick(t);
      }
      // curtain and screen
      curtainObj.userData.setOpen(st.curtain || 0);
      const targetY = st.screenDown ? 2.6 : 9;
      scr.position.y += (targetY - scr.position.y) * Math.min(1, dt * 0.6);
      scr.userData.draw(st.screenMode || 'off', t);
      clock.userData.set(st.clock ?? -1, t);
      for (const m of meteors) m.mesh.userData.setGlow(m.done ? 1 : 0.15 + 0.1 * Math.sin(t * 2 + m.X));
      for (const tr of traps) {
        const on = st.trapOn && st.trapOn[tr.id];
        tr.mesh.userData.setActive && tr.mesh.userData.setActive(on, t);
        tr.light.intensity = on ? 6 + Math.random() * 4 : 0;
        tr.light.on = !!on;
      }
    },
  };
  return api;

  // ------------------------------------------------------------------ local builders
  function teddy(s) {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: '#5a3a24' });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 10, 8), fur);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 10, 8), fur);
    hd.position.y = 0.3 * s;
    g.add(b, hd);
    for (const x of [-0.11, 0.11]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 8, 6), fur);
      e.position.set(x * s, 0.44 * s, 0);
      g.add(e);
    }
    return g;
  }
  function boxBoard() {
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.05), new THREE.MeshLambertMaterial({ color: '#4a3220' }));
    g.add(back);
    const lights9 = [];
    const mat = () => new THREE.MeshStandardMaterial({ color: '#331', emissive: '#30ff40', emissiveIntensity: 0 });
    // nine lights placed like the box spots on a tiny map of Kino
    BOX_SPOTS.forEach((s) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat());
      m.position.set((s.X / 3700) * 0.8, (s.Y / 3600) * 0.6, 0.04);
      g.add(m);
      lights9.push(m);
    });
    g.userData.lights9 = lights9;
    return g;
  }
  function gate(width) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#5a5a5e', metalness: 0.7, roughness: 0.5 });
    for (let i = 0; i <= 8; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.4, 0.04), mat);
      bar.position.set(-width / 2 + (i / 8) * width, 1.2, 0);
      g.add(bar);
    }
    for (const y of [0.3, 1.2, 2.3]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.06), mat);
      r.position.y = y;
      g.add(r);
    }
    g.userData.setOpen = () => {};
    return g;
  }
  function firePit(len, depth) {
    const g = new THREE.Group();
    const grate = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, Math.max(0.8, depth)), new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.6, roughness: 0.6 }));
    grate.position.y = 0.03;
    g.add(grate);
    const flames = [];
    const fm = new THREE.MeshBasicMaterial({ color: '#ff7a20', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (let i = 0; i < Math.ceil(len / 0.6); i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8), fm);
      f.position.set(-len / 2 + 0.3 + i * 0.6, 0.6, 0);
      g.add(f);
      flames.push(f);
    }
    g.userData.setActive = (on, t) => {
      fm.opacity = on ? 0.75 : 0;
      flames.forEach((f, i) => (f.scale.y = on ? 0.8 + 0.5 * Math.sin(t * 13 + i * 1.7) : 0.01));
    };
    return g;
  }
  function turretModel() {
    // a small League-style outer turret: stone base, blue crystal on top
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#6a6a74', roughness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: '#b8913a', metalness: 0.7, roughness: 0.4 });
    const crystal = new THREE.MeshStandardMaterial({ color: '#60c0ff', emissive: '#3aa0ff', emissiveIntensity: 0.2, roughness: 0.2 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 8), stone);
    base.position.y = 0.25;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.0, 8), stone);
    col.position.y = 1.0;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.5;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), crystal);
    gem.position.y = 1.85;
    g.add(base, col, ring, gem);
    g.userData = {
      gem,
      setActive(on, t) {
        crystal.emissiveIntensity = on ? 2 + Math.sin(t * 6) * 0.6 : 0.2;
        gem.rotation.y = t * (on ? 3 : 0.3);
      },
    };
    return g;
  }
  function mainframePad() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#4a4a50', metalness: 0.8, roughness: 0.4 });
    const ring = new THREE.MeshStandardMaterial({ color: '#30ff60', emissive: '#30ff60', emissiveIntensity: 0.05 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.6, 0.08, 32), metal);
    base.position.y = 0.04;
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 6, 40), ring);
    r.rotation.x = Math.PI / 2;
    r.position.y = 0.09;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.5, 12), metal);
    core.position.y = 0.25;
    const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), ring);
    coreGlow.position.y = 0.6;
    g.add(base, r, core, coreGlow);
    g.userData.setState = (on, linked, t) => {
      ring.emissiveIntensity = !on ? 0.05 : linked ? 2 + Math.sin(t * 5) * 0.5 : 0.5 + 0.3 * Math.sin(t * 3);
    };
    return g;
  }
  function smallFire() {
    const g = new THREE.Group();
    const fm = new THREE.MeshBasicMaterial({ color: '#ff8a30', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const flames = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 7), fm);
      f.position.set(rand(-0.2, 0.2), 0.3, rand(-0.2, 0.2));
      g.add(f);
      flames.push(f);
    }
    g.userData.flick = (t) => flames.forEach((f, i) => (f.scale.y = 0.7 + 0.4 * Math.sin(t * 11 + i * 2.1)));
    return g;
  }
  function wallClock() {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), new THREE.MeshLambertMaterial({ color: '#e8e0c8' }));
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 6, 32), new THREE.MeshStandardMaterial({ color: '#3a2a1a' }));
    g.add(rim);
    const handMat = new THREE.MeshBasicMaterial({ color: '#111' });
    const sec = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: '#b01010' }));
    sec.geometry.translate(0, 0.25, 0);
    sec.position.z = 0.05;
    const hr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.02), handMat);
    hr.geometry.translate(0, 0.15, 0);
    hr.position.z = 0.04;
    const mn = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.02), handMat);
    mn.geometry.translate(0, 0.22, 0);
    mn.position.z = 0.045;
    g.add(sec, hr, mn);
    g.userData.set = (secAngleSeconds) => {
      // second hand starts at 6 and ticks 6 degrees a second while you're in the room
      const s = secAngleSeconds < 0 ? 0 : secAngleSeconds;
      sec.rotation.z = -Math.PI - (Math.floor(s) * Math.PI) / 30;
      const now = new Date();
      mn.rotation.z = -(now.getMinutes() / 60) * Math.PI * 2;
      hr.rotation.z = -(((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2;
    };
    return g;
  }
  function furnishSecretRooms() {
    const R = (id) => ROOMS.find((r) => r.id === id).rects[0];
    const mid = (id) => {
      const r = R(id);
      return P((r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
    };
    const wood = new THREE.MeshLambertMaterial({ color: '#6a4a30' });
    const add = (id, mesh, dx, dz, sx = 0, sz = 0) => {
      const c = mid(id);
      mesh.position.x += c.x + dx;
      mesh.position.z += c.z + dz;
      staticGroup.add(mesh);
      if (sx) blockRect(c.x + dx, c.z + dz, sx, sz);
    };
    // Samantha's room (clean): a bed, a rocking chair, toys
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.0), new THREE.MeshLambertMaterial({ color: '#d8c8d8' }));
    bed.position.y = 0.25;
    add('eeBed', bed, -1.5, -0.8, 1.2, 2.0);
    const chairR = props.chair();
    add('eeBed', chairR, 1.6, 0.4);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.4), new THREE.MeshLambertMaterial({ color: '#fff' }));
    pillow.position.y = 0.58;
    add('eeBed', pillow, -1.5, -1.5);
    const tb = teddy(1.2);
    tb.position.y = 0.6;
    add('eeBed', tb, -1.4, -0.6);
    // the same room, ruined
    const bed2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 2.0), new THREE.MeshLambertMaterial({ color: '#4a3a3a' }));
    bed2.position.y = 0.18;
    bed2.rotation.z = 0.25;
    add('eeRuin', bed2, -1.5, -0.8, 1.2, 2.0);
    const tbl = props.table(false);
    tbl.rotation.z = Math.PI / 2;
    tbl.position.y = 0.4;
    add('eeRuin', tbl, 1.0, 0.6);
    add('eeRuin', props.rubblePile(0.8), 0.6, -1.0);
    // dentist / interrogation room: two chairs and a cart
    for (const dx of [-1.2, 1.2]) {
      const c = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 1.6), new THREE.MeshLambertMaterial({ color: '#2a5a5a' }));
      seat.position.y = 0.6;
      seat.rotation.x = -0.25;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8 }));
      post.position.y = 0.3;
      c.add(seat, post);
      add('eeDentist', c, dx, -0.3, 0.7, 1.6);
    }
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: '#aaa', metalness: 0.6 }));
    cart.position.y = 0.4;
    add('eeDentist', cart, 0, -1.6);
    // conference room: long table, a TV, a little model rocket
    const ct = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.2), wood);
    ct.position.y = 0.78;
    add('eePentagon', ct, 0, 0.2, 3.4, 1.2);
    const tv = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.5), new THREE.MeshLambertMaterial({ color: '#222' }));
    tv.position.y = 1.1;
    add('eePentagon', tv, 0, -1.8);
    const rocket = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.5 }));
    rocket.position.y = 1.12;
    add('eePentagon', rocket, 1.2, 0.2);
    // each room gets a warm lamp
    for (const id of ['eeBed', 'eeRuin', 'eeDentist', 'eePentagon']) {
      const c = mid(id);
      lights.push({ x: c.x, y: 2.6, z: c.z, color: id === 'eeRuin' ? '#ff9060' : '#ffe0b0', intensity: 5, range: 8, on: true, base: 5 });
    }
  }
}

/** Merge every static mesh under `group` into one mesh per material. */
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  const toRemove = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (Array.isArray(o.material)) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    // normalise attributes so geometries can merge
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const ng = g.index ? g.toNonIndexed() : g;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(ng);
    toRemove.push(o);
  });
  for (const o of toRemove) o.parent.remove(o);
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    group.add(m);
  }
}

/** Little chalk drawings for the wall-buys. */
function drawChalkGlyph(g, item) {
  const id = typeof item === 'string' ? item : item.yi;
  g.beginPath();
  if (id === 'boots') {
    g.moveTo(90, 20); g.lineTo(130, 20); g.lineTo(130, 60); g.lineTo(170, 72); g.lineTo(170, 86); g.lineTo(88, 86); g.closePath();
  } else if (id === 'bowie') {
    g.moveTo(60, 50); g.lineTo(170, 40); g.lineTo(196, 50); g.lineTo(170, 60); g.closePath();
    g.moveTo(60, 50); g.lineTo(30, 50);
  } else if (id === 'shrooms') {
    g.arc(128, 50, 30, Math.PI, 0); g.lineTo(140, 50); g.lineTo(140, 80); g.lineTo(116, 80); g.lineTo(116, 50); g.closePath();
  } else if (id.startsWith('elixir')) {
    g.arc(128, 60, 22, 0, Math.PI * 2); g.moveTo(120, 38); g.lineTo(120, 16); g.lineTo(136, 16); g.lineTo(136, 38);
  } else {
    // a sword silhouette for weapons and a rough shape for everything else
    g.moveTo(40, 52); g.lineTo(180, 46); g.lineTo(200, 52); g.lineTo(180, 58); g.closePath();
    g.moveTo(40, 40); g.lineTo(40, 64);
  }
  g.stroke();
}
