// Renderer, camera rig, light pool, bloom, and the "x-ray" cut that dithers away
// wall pixels standing between the camera and your champion.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, damp, rand } from './util.js';

export const xray = {
  center: new THREE.Vector2(-9999, -9999),
  radius: { value: 0 },
  z: { value: 0 },
  y: { value: 0 },
  on: { value: 0 },
};

/** Patch a material so fragments near the champion on screen, and in front of them, dither out. */
export function xrayMaterial(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uXrayC = { value: xray.center };
    sh.uniforms.uXrayR = xray.radius;
    sh.uniforms.uXrayZ = xray.z;
    sh.uniforms.uXrayY = xray.y;
    sh.uniforms.uXrayOn = xray.on;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vXrayW;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 xw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          xw = instanceMatrix * xw;
        #endif
        vXrayW = (modelMatrix * xw).xyz;`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vXrayW;
        uniform vec2 uXrayC; uniform float uXrayR; uniform float uXrayZ; uniform float uXrayY; uniform float uXrayOn;
        float xrayBayer(vec2 p) {
          vec2 q = mod(floor(p), 4.0);
          float i = q.x + q.y * 4.0;
          // 4x4 Bayer thresholds
          if (i < 0.5) return 0.0; if (i < 1.5) return 8.0; if (i < 2.5) return 2.0; if (i < 3.5) return 10.0;
          if (i < 4.5) return 12.0; if (i < 5.5) return 4.0; if (i < 6.5) return 14.0; if (i < 7.5) return 6.0;
          if (i < 8.5) return 3.0; if (i < 9.5) return 11.0; if (i < 10.5) return 1.0; if (i < 11.5) return 9.0;
          if (i < 12.5) return 15.0; if (i < 13.5) return 7.0; if (i < 14.5) return 13.0; return 5.0;
        }`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if (uXrayOn > 0.5 && vXrayW.z > uXrayZ + 0.35 && vXrayW.y > uXrayY + 0.25) {
          float d = length(gl_FragCoord.xy - uXrayC) / uXrayR;
          if (d < 1.0) {
            float keep = smoothstep(0.45, 1.0, d);
            if ((xrayBayer(gl_FragCoord.xy) + 0.5) / 16.0 > keep * 0.92) discard;
          }
        }`
      );
  };
  mat.customProgramCacheKey = () => 'xray';
  return mat;
}

export function createRenderer(canvas, settings) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050304');
  scene.fog = new THREE.Fog('#050304', 30, 60);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 220);

  // ---- lights
  const hemi = new THREE.HemisphereLight('#6d6f8c', '#2a1c16', 0.55);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight('#9aa6d8', 0.35);
  moon.position.set(-20, 40, 18);
  scene.add(moon);
  const playerLight = new THREE.PointLight('#ffd9a8', 26, 15, 1.6);
  scene.add(playerLight);
  const POOL = 6;
  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const l = new THREE.PointLight('#ffffff', 0, 12, 1.8);
    scene.add(l);
    pool.push(l);
  }

  // ---- post
  let composer = null, bloom = null;
  function buildComposer() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: settings.quality === 'high' ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.62, 0.42, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let dprCap = 2;
  function applyQuality() {
    const high = settings.quality === 'high';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? dprCap : 1));
    if (composer) {
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
      composer = null;
    }
    if (high) buildComposer();
    resize();
  }

  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep roughly the same world width visible on tall phone screens
    camera.fov = w / h < 1 ? 52 : w / h < 1.4 ? 42 : 36;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
  }
  window.addEventListener('resize', resize);

  // ---- camera rig
  const rig = {
    tx: 0, ty: 0, tz: 0, // smoothed focus
    dist: 19,
    want: 19,
    pitch: (56 * Math.PI) / 180,
    shake: 0,
    lead: new THREE.Vector2(),
  };

  function follow(x, y, z, dt, opts = {}) {
    const k = opts.snap ? 1 : damp(9, dt);
    const lx = opts.leadX || 0, lz = opts.leadZ || 0;
    rig.lead.x += (lx - rig.lead.x) * damp(4, dt);
    rig.lead.y += (lz - rig.lead.y) * damp(4, dt);
    rig.tx += (x + rig.lead.x - rig.tx) * k;
    rig.ty += (y - rig.ty) * (opts.snap ? 1 : damp(6, dt));
    rig.tz += (z + rig.lead.y - rig.tz) * k;
    rig.dist += (rig.want - rig.dist) * damp(8, dt);
    const sx = rig.shake > 0 ? rand(-1, 1) * rig.shake : 0;
    const sz = rig.shake > 0 ? rand(-1, 1) * rig.shake : 0;
    rig.shake = Math.max(0, rig.shake - dt * 2.8);
    camera.position.set(rig.tx + sx, rig.ty + Math.sin(rig.pitch) * rig.dist, rig.tz + Math.cos(rig.pitch) * rig.dist + sz);
    camera.lookAt(rig.tx + sx * 0.5, rig.ty + 0.6, rig.tz + sz * 0.5);
    scene.fog.near = rig.dist + 6;
    scene.fog.far = rig.dist + 38;
  }

  function zoom(steps) {
    rig.want = clamp(rig.want + steps * 1.6, 12, 27);
  }

  function shake(amount) {
    if (!settings.shake) return;
    rig.shake = Math.min(0.6, Math.max(rig.shake, amount));
  }

  // ---- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  /** Screen pixel -> world point on the horizontal plane at height y. */
  function screenToWorld(px, py, y = 0) {
    ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -y;
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }
  const tmp = new THREE.Vector3();
  /** World -> screen pixels (CSS). */
  function worldToScreen(x, y, z) {
    tmp.set(x, y, z).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight, behind: tmp.z > 1 };
  }

  /** Point the x-ray cut at the champion. */
  function setXray(x, y, z, on) {
    if (!on) {
      xray.on.value = 0;
      return;
    }
    const s = worldToScreen(x, y + 0.9, z);
    const pr = renderer.getPixelRatio();
    const h = window.innerHeight;
    xray.center.set(s.x * pr, (h - s.y) * pr);
    xray.radius.value = (140 * pr * 19) / rig.dist;
    xray.z.value = z;
    xray.y.value = y;
    xray.on.value = 1;
  }

  /** Assign the pooled point lights to the brightest/closest sources. sources: [{x,y,z,color,intensity,range,on}] */
  function updateLights(sources, fx, fz) {
    const ranked = [];
    for (const s of sources) {
      if (!s.on || s.intensity <= 0) continue;
      const d = (s.x - fx) * (s.x - fx) + (s.z - fz) * (s.z - fz);
      if (d > 900) continue;
      ranked.push([d / (s.intensity + 1), s]);
    }
    ranked.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < pool.length; i++) {
      const l = pool[i];
      const s = ranked[i] && ranked[i][1];
      if (!s) {
        l.intensity = 0;
        continue;
      }
      l.position.set(s.x, s.y, s.z);
      l.color.set(s.color);
      l.intensity = s.intensity * (s.flicker ? 0.85 + Math.random() * 0.3 : 1);
      l.distance = s.range || 12;
    }
  }

  function render() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  applyQuality();

  /** Lower the high-quality pixel ratio ceiling (slow machines). */
  function setDprCap(v) {
    dprCap = v;
    applyQuality();
  }

  return { renderer, scene, camera, hemi, moon, playerLight, rig, follow, zoom, shake, screenToWorld, worldToScreen, setXray, updateLights, render, resize, applyQuality, setDprCap, get bloom() { return bloom; } };
}
