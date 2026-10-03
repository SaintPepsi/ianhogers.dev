// Visual effects: two particle systems (additive glow, alpha-blended smoke/blood),
// short-lived meshes (rings, slashes, beams), floor decals, ability indicators and
// floating damage numbers.

import * as THREE from 'three';
import { TAU, clamp, rand } from './util.js';

const PVERT = `
  attribute float aSize;
  attribute vec4 aColor;
  uniform float uScale;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const PFRAG = `
  varying vec4 vColor;
  uniform float uSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(uSoft, 1.0, d);
    if (a <= 0.01) discard;
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }`;

class Particles {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.base = new Float32Array(max * 5); // r g b a size0
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize);
    g.setDrawRange(0, 0);
    this.uniforms = { uScale: { value: 500 }, uSoft: { value: additive ? 0.0 : 0.35 } };
    const m = new THREE.ShaderMaterial({
      vertexShader: PVERT,
      fragmentShader: PFRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
    scene.add(this.points);
    this.geo = g;
  }

  spawn(x, y, z, vx, vy, vz, life, size, r, gC, b, a, grav = 0, drag = 0, grow = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.age[i] = 0;
    this.base[i * 5] = r;
    this.base[i * 5 + 1] = gC;
    this.base[i * 5 + 2] = b;
    this.base[i * 5 + 3] = a;
    this.base[i * 5 + 4] = size;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.grow[i] = grow;
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        // swap-remove with the last particle
        const j = --this.n;
        if (i !== j) this.copy(j, i);
        continue;
      }
      const t = this.age[i] / this.life[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3] *= 0.6;
        this.vel[i * 3 + 1] = 0;
        this.vel[i * 3 + 2] *= 0.6;
      }
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      this.col[i * 4] = this.base[i * 5];
      this.col[i * 4 + 1] = this.base[i * 5 + 1];
      this.col[i * 4 + 2] = this.base[i * 5 + 2];
      this.col[i * 4 + 3] = this.base[i * 5 + 3] * fade;
      this.size[i] = this.base[i * 5 + 4] * (1 + this.grow[i] * t);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }

  copy(from, to) {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
    }
    for (let k = 0; k < 5; k++) this.base[to * 5 + k] = this.base[from * 5 + k];
    for (let k = 0; k < 4; k++) this.col[to * 4 + k] = this.col[from * 4 + k];
    this.life[to] = this.life[from];
    this.age[to] = this.age[from];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
    this.grow[to] = this.grow[from];
    this.size[to] = this.size[from];
  }

  clear() {
    this.n = 0;
    this.geo.setDrawRange(0, 0);
  }
}

const _c = new THREE.Color();
function rgb(hex) {
  _c.set(hex);
  return [_c.r, _c.g, _c.b];
}

export function createFx(scene, camera, renderer) {
  const glow = new Particles(scene, 3000, true);
  const smoke = new Particles(scene, 2000, false);
  const transients = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---- floor decals (blood, scorch), instanced quads
  const DEC = 160;
  const decGeo = new THREE.PlaneGeometry(1, 1);
  decGeo.rotateX(-Math.PI / 2);
  const decTex = makeSplatTexture();
  const decMat = new THREE.MeshBasicMaterial({ map: decTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: 0xffffff });
  const decals = new THREE.InstancedMesh(decGeo, decMat, DEC);
  decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  decals.frustumCulled = false;
  decals.renderOrder = 2;
  const decData = [];
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DEC; i++) {
    decals.setMatrixAt(i, zero);
    decals.setColorAt(i, new THREE.Color(0.35, 0.02, 0.02));
    decData.push({ life: 0, max: 1, s: 1, x: 0, y: 0, z: 0, rot: 0 });
  }
  scene.add(decals);
  let decNext = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function decal(x, y, z, size, color = '#5a0505', life = 30) {
    const i = decNext;
    decNext = (decNext + 1) % DEC;
    const d = decData[i];
    Object.assign(d, { life, max: life, s: size, x, y: y + 0.02 + (i % 7) * 0.002, z, rot: rand(0, TAU) });
    decals.setColorAt(i, _c.set(color));
    decals.instanceColor.needsUpdate = true;
  }

  // ---- shared materials for transient meshes
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 40);
  discGeo.rotateX(-Math.PI / 2);
  const arcGeo = new THREE.RingGeometry(0.55, 1, 24, 1, -Math.PI / 3, (Math.PI * 2) / 3);
  arcGeo.rotateX(-Math.PI / 2);
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  function addMesh(geo, color, opacity, additive = true) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false }));
    m.renderOrder = 18;
    group.add(m);
    return m;
  }

  function track(mesh, life, fn) {
    transients.push({ mesh, life, age: 0, fn });
  }

  // ---- public effects
  const api = {
    glow,
    smoke,
    /** Expanding ground ring. */
    ring(x, y, z, r0, r1, color, life = 0.5, opacity = 0.8) {
      const m = addMesh(ringGeo, color, opacity);
      m.position.set(x, y + 0.06, z);
      track(m, life, (t) => {
        const r = r0 + (r1 - r0) * Math.sqrt(t);
        m.scale.set(r, 1, r);
        m.material.opacity = opacity * (1 - t);
      });
    },
    /** Filled ground disc that fades. */
    disc(x, y, z, r, color, life = 0.4, opacity = 0.35) {
      const m = addMesh(discGeo, color, opacity);
      m.position.set(x, y + 0.05, z);
      m.scale.set(r, 1, r);
      track(m, life, (t) => (m.material.opacity = opacity * (1 - t) * (1 - t)));
    },
    /** A curved slash facing `ang` (atan2 convention). */
    slash(x, y, z, ang, radius, color, life = 0.18, flip = false) {
      const m = addMesh(arcGeo, color, 0.9);
      m.position.set(x, y, z);
      m.rotation.y = -ang + (flip ? Math.PI : 0);
      if (flip) m.scale.z = -1;
      track(m, life, (t) => {
        const s = radius * (0.8 + 0.3 * t);
        m.scale.set(s, 1, flip ? -s : s);
        m.material.opacity = 0.9 * (1 - t);
      });
    },
    /** Vertical light column. */
    beam(x, y, z, r, h, color, life = 0.6, opacity = 0.6) {
      const m = addMesh(beamGeo, color, opacity);
      m.position.set(x, y, z);
      m.scale.set(r, h, r);
      track(m, life, (t) => {
        m.material.opacity = opacity * (1 - t);
        m.scale.x = m.scale.z = r * (1 - t * 0.6);
      });
      return m;
    },
    /** Straight streak between two points (e.g. a blink trail). */
    streak(x0, y0, z0, x1, y1, z1, color, width = 0.25, life = 0.3) {
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz) || 0.01;
      const m = addMesh(boxGeo, color, 0.8);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.6, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      m.scale.set(len, width, width);
      track(m, life, (t) => {
        m.material.opacity = 0.8 * (1 - t);
        m.scale.y = m.scale.z = width * (1 - t);
      });
    },
    burst(x, y, z, n, o = {}) {
      const [r, g, b] = rgb(o.color || '#ffffff');
      const sp = o.speed ?? 4;
      const sys = o.smoke ? smoke : glow;
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU);
        const up = o.up ?? 0.6;
        const s = sp * rand(0.3, 1);
        sys.spawn(
          x + rand(-0.1, 0.1) * (o.jitter ?? 1), y + rand(-0.1, 0.1), z + rand(-0.1, 0.1) * (o.jitter ?? 1),
          Math.cos(a) * s, rand(0.2, 1) * sp * up + (o.lift || 0), Math.sin(a) * s,
          rand(0.6, 1) * (o.life ?? 0.6), rand(0.7, 1.2) * (o.size ?? 0.25),
          r, g, b, o.alpha ?? 1, o.grav ?? 0, o.drag ?? 2, o.grow ?? 0
        );
      }
    },
    blood(x, y, z, n = 10, dirX = 0, dirZ = 0) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU);
        const s = rand(0.5, 3);
        smoke.spawn(x, y + rand(0.8, 1.4), z, Math.cos(a) * s + dirX * 2, rand(1, 4), Math.sin(a) * s + dirZ * 2, rand(0.4, 0.8), rand(0.12, 0.22), 0.45, 0.02, 0.02, 0.95, 12, 0.5);
      }
    },
    gas(x, y, z, radius, life) {
      for (let i = 0; i < 26; i++) {
        const a = rand(0, TAU), d = rand(0, radius);
        smoke.spawn(x + Math.cos(a) * d, y + rand(0.2, 1.2), z + Math.sin(a) * d, rand(-0.3, 0.3), rand(0.05, 0.3), rand(-0.3, 0.3), life * rand(0.6, 1), rand(1.4, 2.4), 0.55, 0.75, 0.18, 0.28, 0, 0.3, 0.6);
      }
    },
    sparks(x, y, z, n = 12, color = '#ffd36b') {
      api.burst(x, y, z, n, { color, speed: 6, life: 0.35, size: 0.12, grav: 9, drag: 1 });
    },
    decal,
    /** Floating number in world space. */
    number(x, y, z, text, color = '#fff', big = false) {
      numbers.show(x, y, z, text, color, big);
    },
    clear() {
      glow.clear();
      smoke.clear();
      for (const t of transients) {
        group.remove(t.mesh);
        t.mesh.material.dispose();
      }
      transients.length = 0;
      for (let i = 0; i < DEC; i++) {
        decData[i].life = 0;
        decals.setMatrixAt(i, zero);
      }
      decals.instanceMatrix.needsUpdate = true;
      numbers.clear();
    },
    update(dt) {
      const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
      const s = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
      glow.uniforms.uScale.value = s;
      smoke.uniforms.uScale.value = s;
      glow.update(dt);
      smoke.update(dt);
      for (let i = transients.length - 1; i >= 0; i--) {
        const t = transients[i];
        t.age += dt;
        const p = clamp(t.age / t.life, 0, 1);
        t.fn(p);
        if (t.age >= t.life) {
          group.remove(t.mesh);
          t.mesh.material.dispose();
          transients.splice(i, 1);
        }
      }
      let dirty = false;
      for (let i = 0; i < DEC; i++) {
        const d = decData[i];
        if (d.life <= 0) continue;
        d.life -= dt;
        const fadeS = d.life <= 0 ? 0 : d.s * Math.min(1, d.life / 4) * Math.min(1, (d.max - d.life) * 8 + 0.3);
        q.setFromAxisAngle(up, d.rot);
        m4.compose(v.set(d.x, d.y, d.z), q, sc.set(fadeS, 1, fadeS));
        decals.setMatrixAt(i, d.life <= 0 ? zero : m4);
        dirty = true;
      }
      if (dirty) decals.instanceMatrix.needsUpdate = true;
      numbers.update(dt);
    },
  };

  // ---- floating numbers (pooled DOM)
  const numbers = (() => {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;overflow:hidden';
    document.body.appendChild(layer);
    const pool = [];
    const live = [];
    const vec = new THREE.Vector3();
    function el() {
      const e = pool.pop() || document.createElement('div');
      e.style.cssText = 'position:absolute;left:0;top:0;font:800 15px system-ui,sans-serif;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap;will-change:transform,opacity';
      layer.appendChild(e);
      return e;
    }
    return {
      enabled: true,
      show(x, y, z, text, color, big) {
        if (!this.enabled) return;
        if (live.length > 40) {
          const old = live.shift();
          old.e.remove();
          pool.push(old.e);
        }
        const e = el();
        e.textContent = text;
        e.style.color = color;
        if (big) e.style.fontSize = '20px';
        live.push({ e, x: x + rand(-0.3, 0.3), y: y + 2.1, z: z + rand(-0.2, 0.2), t: 0, vx: rand(-14, 14) });
      },
      update(dt) {
        const w = window.innerWidth, h = window.innerHeight;
        for (let i = live.length - 1; i >= 0; i--) {
          const n = live[i];
          n.t += dt;
          if (n.t > 0.8) {
            n.e.remove();
            pool.push(n.e);
            live.splice(i, 1);
            continue;
          }
          vec.set(n.x, n.y, n.z).project(camera);
          const sx = (vec.x * 0.5 + 0.5) * w + n.vx * n.t;
          const sy = (-vec.y * 0.5 + 0.5) * h - 40 * n.t;
          const a = n.t < 0.5 ? 1 : 1 - (n.t - 0.5) / 0.3;
          n.e.style.transform = `translate(${sx | 0}px, ${sy | 0}px) translate(-50%, -50%) scale(${n.t < 0.08 ? 1.3 : 1})`;
          n.e.style.opacity = a.toFixed(2);
        }
      },
      clear() {
        for (const n of live) {
          n.e.remove();
          pool.push(n.e);
        }
        live.length = 0;
      },
    };
  })();
  api.numbers = numbers;

  // ---- ability indicators (one reusable set)
  const ind = (() => {
    const g = new THREE.Group();
    g.visible = false;
    scene.add(g);
    const mat = (o) => new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: o, depthWrite: false, toneMapped: false });
    const range = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), mat(0.45));
    const rect = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0), mat(0.22));
    const circle = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), mat(0.22));
    const circleEdge = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2), mat(0.6));
    for (const m of [range, rect, circle, circleEdge]) {
      m.renderOrder = 17;
      g.add(m);
    }
    return {
      hide() {
        g.visible = false;
      },
      /** spec: { range, kind: 'line'|'circle'|'self', width, radius } */
      show(px, py, pz, spec, ax, az) {
        g.visible = true;
        range.visible = !!spec.range;
        range.position.set(px, py + 0.04, pz);
        range.scale.set(spec.range || 1, 1, spec.range || 1);
        rect.visible = spec.kind === 'line';
        circle.visible = circleEdge.visible = spec.kind === 'circle' || spec.kind === 'self';
        if (spec.kind === 'line') {
          const ang = Math.atan2(az - pz, ax - px);
          rect.position.set(px, py + 0.05, pz);
          rect.rotation.y = -ang;
          rect.scale.set(spec.range, 1, spec.width || 1);
        } else if (spec.kind === 'circle' || spec.kind === 'self') {
          let cx = ax, cz = az;
          if (spec.kind === 'self') {
            cx = px;
            cz = pz;
          } else {
            const dx = ax - px, dz = az - pz;
            const d = Math.hypot(dx, dz);
            if (d > spec.range) {
              cx = px + (dx / d) * spec.range;
              cz = pz + (dz / d) * spec.range;
            }
          }
          circle.position.set(cx, py + 0.05, cz);
          circleEdge.position.copy(circle.position);
          circle.scale.set(spec.radius, 1, spec.radius);
          circleEdge.scale.copy(circle.scale);
        }
      },
    };
  })();
  api.indicator = ind;

  return api;
}

function makeSplatTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  const blob = (x, y, r) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  blob(32, 32, 14);
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * TAU, d = 10 + Math.random() * 16;
    blob(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 2 + Math.random() * 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
