// Entry point: boot, menus, champion select, the loop, input -> intent, camera.

import * as THREE from 'three';
import { $, clamp, store, rand, dist, TAU } from './util.js';
import { createRenderer } from './render.js';
import { createInput, SCHEMES } from './input.js';
import { initAudio, setVolumes, setListener, startAmbience, stopAmbience, playMusic, stopMusic, suspendAudio, sfx, stopAllLoops, musicPlaying } from './audio.js';
import { makeTextures } from './textures.js';
import { buildMap, P, PERK_SPOTS } from './map.js';
import { createWorld } from './world.js';
import { createFx } from './fx.js';
import { ZombieCrowd, buildChampion, animateChampion, yawOf } from './models.js';
import { createGame, POWERUP_INFO } from './game.js';
import { createHud } from './hud.js';
import { createScreens } from './screens.js';
import * as props from './props.js';
import { icon } from './icons.js';
import { ITEMS, WALL_ITEMS, PORO } from './items.js';
import { CHAMPS } from './champdata.js';

const DEFAULTS = { scheme: 'wasd', master: 0.8, music: 0.55, sfx: 0.9, quality: 'high', shake: true, numbers: true, autoLevel: true };
const settings = { ...DEFAULTS, ...store.get('kino.settings', {}) };
if (!SCHEMES[settings.scheme]) settings.scheme = 'wasd';
const saveSettings = () => store.set('kino.settings', settings);
// touch layout when the main pointer is a finger (a touchscreen laptop with a mouse keeps the desktop HUD)
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && !matchMedia('(any-pointer: fine)').matches);
if (isTouch) document.body.classList.add('touch');
// the touch HUD has no ability bar to click ranks on, so ranks are always spent for you
if (isTouch) settings.autoLevel = true;
if (matchMedia('(max-width: 900px)').matches && settings.quality === 'high' && isTouch && !store.get('kino.settings', null)) settings.quality = 'low';

let R, fx, world, map, crowd, tex, game = null, hud, screens, input;
const hudHolder = { game: null };
let champModel = null;
let state = 'loading'; // loading | menu | select | playing | paused | over
let last = performance.now();
let menuT = 0;
let fovKick = 0;
const testMode = new URLSearchParams(location.search).has('test');

function fail(err) {
  console.error(err);
  $('loading').hidden = true;
  $('err').hidden = false;
  $('errMsg').textContent = String(err && err.message ? err.message : err);
}
window.addEventListener('error', (e) => {
  if (state === 'loading') fail(e.error || e.message);
});

async function boot() {
  const msg = $('loadMsg');
  const canvas = $('gl');
  R = createRenderer(canvas, settings);
  msg.textContent = 'Painting the walls...';
  await frame();
  tex = makeTextures();
  msg.textContent = 'Boarding up the windows...';
  await frame();
  map = buildMap();
  world = createWorld(R.scene, map, tex);
  fx = createFx(R.scene, R.camera, R.renderer);
  crowd = new ZombieCrowd(R.scene, 40);
  input = createInput(canvas);
  input.setScheme(settings.scheme);
  hud = createHud(hudHolder, settings, {
    touch: isTouch,
    drawPortrait,
    setFog,
    fovPunch: () => (fovKick = 1),
  });
  screens = createScreens({ settings, saveSettings, start: startGame, drawCard, applySettings, isTouch, onResume: resume, onQuit: quitToMenu, onHelp: () => {} });
  setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
  // the menu shows the theatre with the lights on
  world.setPower(true);
  world.state = { curtain: 1, screenDown: true, screenMode: 'film', teleState: 'idle' };
  msg.textContent = 'Loading the projector...';
  await frame();
  R.render(); // compile shaders up front
  $('loading').hidden = true;
  state = 'menu';
  screens.show('menu');
  const unlock = () => {
    initAudio();
    if (state === 'menu' || state === 'select') {
      if (musicPlaying() !== 'menu') playMusic('menu');
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  setupTouch();
  window.addEventListener('blur', () => state === 'playing' && pause());
  // a run in progress asks before the tab closes or reloads (League hands reach for Ctrl+W)
  window.addEventListener('beforeunload', (e) => {
    if (testMode || !game || game.over || (state !== 'playing' && state !== 'paused')) return;
    e.preventDefault();
    e.returnValue = '';
  });
  document.addEventListener('visibilitychange', () => document.hidden && state === 'playing' && pause());
  requestAnimationFrame(loop);
  if (testMode) exposeTest();
}
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

function applySettings() {
  input.setScheme(settings.scheme);
  setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
  R.applyQuality();
  fx.numbers.enabled = settings.numbers;
  if (game && hud) hud.abilities();
  saveSettings();
}

// ------------------------------------------------------------------ portraits
const portraitCache = {};
function renderChampionImage(id, w, h, close) {
  const key = id + w + 'x' + h + (close ? 'c' : '');
  if (portraitCache[key]) return portraitCache[key];
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#cfd6ff', '#3a2a24', 1.4));
  const d = new THREE.DirectionalLight('#ffffff', 2.4);
  d.position.set(2, 4, 5);
  scene.add(d);
  const rim = new THREE.DirectionalLight(CHAMPS[id].accent, 2.5);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const c = buildChampion(id);
  animateChampion(c, { speed: 0, attackT: -1, attackSide: 1, castT: close ? -1 : 0.5, castKind: id === 'amumu' ? 'spread' : id === 'katarina' ? 'throw' : 'dash', channel: '', downed: false, time: 0.4, dt: 0.016 });
  c.root.rotation.y = close ? 0.35 : 0.5;
  scene.add(c.root);
  const cam = new THREE.PerspectiveCamera(close ? 26 : 32, w / h, 0.1, 50);
  const hgt = id === 'amumu' ? 1.15 : 1.9;
  if (close) {
    cam.position.set(0, hgt * 0.86, 2.0 + (id === 'amumu' ? -0.3 : 0));
    cam.lookAt(0, hgt * 0.82, 0);
  } else {
    cam.position.set(0.4, hgt * 0.65, 4.6 * (hgt / 1.9) + 0.8);
    cam.lookAt(0, hgt * 0.5, 0);
  }
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
  const r = R.renderer;
  const prevTarget = r.getRenderTarget();
  const prevTone = r.toneMapping;
  r.setRenderTarget(rt);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(scene, cam);
  const px = new Uint8Array(w * h * 4);
  r.readRenderTargetPixels(rt, 0, 0, w, h, px);
  r.setRenderTarget(prevTarget);
  r.toneMapping = prevTone;
  rt.dispose();
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g2 = cv.getContext('2d');
  const img = g2.createImageData(w, h);
  // flip vertically, and apply sRGB-ish gamma since we bypassed the output pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((h - 1 - y) * w + x) * 4, di = (y * w + x) * 4;
      img.data[di] = px[si];
      img.data[di + 1] = px[si + 1];
      img.data[di + 2] = px[si + 2];
      img.data[di + 3] = px[si + 3];
    }
  }
  g2.putImageData(img, 0, 0);
  portraitCache[key] = cv;
  c.root.traverse((o) => o.geometry && o.geometry !== undefined);
  return cv;
}
function drawPortrait(canvas, id) {
  const img = renderChampionImage(id, 128, 128, true);
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const gr = g.createRadialGradient(64, 54, 10, 64, 64, 70);
  gr.addColorStop(0, '#3a2f3a');
  gr.addColorStop(1, '#0b0f14');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
}
function drawCard(canvas, id) {
  const img = renderChampionImage(id, 320, 240, false);
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// ------------------------------------------------------------------ fog for dog rounds
let fogOn = false;
function setFog(on) {
  fogOn = on;
}

// ------------------------------------------------------------------ game lifecycle
function startGame(champId) {
  initAudio();
  stopMusic(0.6);
  if (game) teardown();
  hud.reset();
  fx.clear();
  // fresh world state: rebuild the map grid so doors, boards and props reset
  R.scene.remove(world.root);
  disposeTree(world.root);
  map = buildMap();
  world = createWorld(R.scene, map, tex);
  const env = {
    scene: R.scene,
    fx,
    world,
    map,
    settings,
    ui: hud,
    crowd,
    shake: (a) => R.shake(a),
    makePowerupMesh,
    makeItemFloat,
    spinItemFloat,
    landItemFloat,
    bobItemFloat,
    hideItemFloat,
    showBear,
    bearRise,
    hideBear,
    makeExtraBox: () => props.mysteryBox(),
    snapCamera: () => (snap = true),
    makeShroom,
    makePoro: () => props.poroModel(),
    makeReel,
    dispose: disposeTree,
    startSong: () => {
      playMusic('rock', { loopIt: true });
      songT = 240;
    },
  };
  env.ui = hud;
  game = createGame(env);
  hudHolder.game = game;
  game.start(champId);
  champModel = buildChampion(champId);
  R.scene.add(champModel.root);
  papGlow = null;
  snap = true;
  state = 'playing';
  screens.hideAll();
  $('hud').hidden = false;
  $('touch').hidden = !isTouch;
  fx.numbers.enabled = settings.numbers;
  startAmbience();
  game.events.on('over', (info) => onGameOver(info));
  input.setEnabled(true);
  $('gl').focus();
}
let songT = 0;
let snap = true;

function teardown() {
  if (!game) return;
  for (const z of game.zombies) crowd.remove(z);
  game.zombies.length = 0;
  const drop = (m) => {
    R.scene.remove(m);
    disposeTree(m);
  };
  for (const pu of game.powerups) drop(pu.mesh);
  for (const s of game.shrooms) drop(s.mesh);
  for (const p of game.poros) drop(p.mesh);
  for (const r of game.reels.spots) drop(r.mesh);
  if (game.box) {
    for (const f of game.box.fire) drop(f.mesh);
    for (const st of [game.box, ...game.box.fire]) if (st.bear) drop(st.bear);
  }
  for (const f of floats) drop(f);
  floats.length = 0;
  game.player.dispose();
  if (champModel) {
    R.scene.remove(champModel.root);
    disposeTree(champModel.root);
  }
  champModel = null;
  stopAllLoops();
  stopAmbience();
  stopMusic(0.2);
  setFog(false);
  game = null;
}
const TEX_SLOTS = ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'aoMap', 'lightMap'];
/** Free a dropped object tree's GPU resources, except the boot-time pieces marked shared. */
function disposeTree(o) {
  const seen = new Set();
  o.traverse((n) => {
    if (!n.isMesh && !n.isPoints && !n.isSprite && !n.isLine) return;
    if (n.geometry && !n.geometry.userData.shared && !n.isSprite) n.geometry.dispose(); // sprites share one quad
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      if (!m || seen.has(m) || m.userData.shared) continue;
      seen.add(m);
      for (const k of TEX_SLOTS) if (m[k] && !m[k].userData.shared) m[k].dispose();
      m.dispose();
    }
  });
}

function onGameOver(info) {
  const best = store.get('kino.best', {});
  const prev = best[info.champ] || 0;
  if (info.round > prev) {
    best[info.champ] = info.round;
    store.set('kino.best', best);
  }
  setTimeout(() => {
    if (!game || !game.over) return;
    state = 'over';
    screens.over(info, prev);
    $('touch').hidden = true;
  }, 2600);
}
function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  suspendAudio(true);
  screens.pause(game);
}
function resume() {
  if (state !== 'paused') return;
  state = 'playing';
  suspendAudio(false);
  last = performance.now();
  $('gl').focus();
}
function quitToMenu() {
  suspendAudio(false);
  if (game && !game.over) {
    // ending from the pause menu counts as a finished game
    state = 'playing';
    game.endGame();
    return;
  }
  teardown();
  $('hud').hidden = true;
  $('touch').hidden = true;
  state = 'menu';
  world.setPower(true);
  world.state = { curtain: 1, screenDown: true, screenMode: 'film', teleState: 'idle' };
  screens.show('menu');
  playMusic('menu');
}
window.__kinoQuit = quitToMenu;

// ------------------------------------------------------------------ box floats, bear, misc meshes
const floats = [];
function itemTexture(id) {
  const spec = id === 'poro' ? PORO.icon : (ITEMS[id] || WALL_ITEMS[id]).icon;
  const c = icon(spec, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true; // cached below for the whole session
  return t;
}
const texCache = {};
const itemTex = (id) => (texCache[id] ||= itemTexture(id));
function makeItemFloat(id) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: itemTex(id || 'spatula'), transparent: true, depthWrite: false, toneMapped: false }));
  m.scale.set(0.9, 0.9, 1);
  m.renderOrder = 22;
  m.visible = false;
  R.scene.add(m);
  floats.push(m);
  return m;
}
const allItemIds = Object.keys(ITEMS);
function spinItemFloat(st, b, t) {
  const m = st.icon;
  if (!m) return;
  m.visible = true;
  m.position.set(b.x, b.y + 0.9 + Math.min(1, t / 3.9) * 1.0, b.z);
  const k = Math.floor(t * (6 + t * 2)) % allItemIds.length;
  m.material.map = itemTex(allItemIds[(k * 7) % allItemIds.length]);
  m.material.needsUpdate = true;
}
function landItemFloat(st, b, id) {
  const m = st.icon;
  if (!m) return;
  m.material.map = itemTex(id);
  m.material.needsUpdate = true;
  m.scale.set(1.1, 1.1, 1);
  fx.burst(b.x, b.y + 1.9, b.z, 18, { color: '#ffe8a8', speed: 2.5, life: 0.6, size: 0.18 });
}
function bobItemFloat(st, b, t) {
  const m = st.icon;
  if (!m) return;
  // sinks back into the box over the last seconds, like the guns do
  const sink = t > 9 ? (t - 9) / 3 : 0;
  m.position.set(b.x, b.y + 1.9 - sink * 1.0 + Math.sin(t * 2.5) * 0.06, b.z);
}
function hideItemFloat(st) {
  if (st.icon) {
    R.scene.remove(st.icon);
    disposeTree(st.icon);
    const i = floats.indexOf(st.icon);
    if (i >= 0) floats.splice(i, 1);
    st.icon = null;
  }
}
function tibbers() {
  // an original scorched teddy with ember eyes: a nod, not a copy
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#4a2a1a', roughness: 1 });
  const patch = new THREE.MeshStandardMaterial({ color: '#2a1610', roughness: 1 });
  const ember = new THREE.MeshStandardMaterial({ color: '#ff6a20', emissive: '#ff5010', emissiveIntensity: 3 });
  const s = (geo, mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };
  const sph = new THREE.SphereGeometry(0.5, 14, 10);
  s(sph, fur, 0, 0.45, 0, 0.75, 0.85, 0.65);
  s(sph, fur, 0, 1.05, 0, 0.6, 0.55, 0.55);
  s(sph, fur, -0.22, 1.32, 0, 0.2, 0.2, 0.12);
  s(sph, fur, 0.22, 1.32, 0, 0.2, 0.2, 0.12);
  s(sph, patch, 0, 0.98, 0.24, 0.22, 0.16, 0.12);
  s(sph, ember, -0.11, 1.1, 0.25, 0.08, 0.08, 0.05);
  s(sph, ember, 0.11, 1.1, 0.25, 0.08, 0.08, 0.05);
  s(sph, fur, -0.42, 0.6, 0.05, 0.22, 0.45, 0.22);
  s(sph, fur, 0.42, 0.6, 0.05, 0.22, 0.45, 0.22);
  s(sph, patch, 0, 0.45, 0.28, 0.35, 0.4, 0.12);
  return g;
}
function showBear(st, b) {
  hideItemFloat(st);
  const t = tibbers();
  t.position.set(b.x, b.y + 0.4, b.z);
  t.rotation.y = b.yaw;
  t.scale.setScalar(0.8);
  R.scene.add(t);
  st.bear = t;
}
function bearRise(st, b, t) {
  if (!st.bear) return;
  st.bear.position.y = b.y + 0.4 + Math.min(1, t / 2.5) * 1.3;
  st.bear.rotation.z = Math.sin(t * 6) * 0.08;
  if (Math.random() < 0.3) fx.glow.spawn(b.x + rand(-0.4, 0.4), st.bear.position.y + 0.6, b.z + rand(-0.4, 0.4), 0, 1, 0, 0.6, 0.2, 1, 0.45, 0.1, 0.9);
}
function hideBear(st) {
  if (st.bear) {
    R.scene.remove(st.bear);
    disposeTree(st.bear);
    st.bear = null;
  }
}
function makePowerupMesh(kind, color) {
  const g = new THREE.Group();
  const m = props.powerupModel(kind, color);
  g.add(m);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  g.add(glow);
  return g;
}
function makeShroom() {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7a3a8a', emissive: '#4aff6a', emissiveIntensity: 0.25 }));
  cap.position.y = 0.12;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8), new THREE.MeshLambertMaterial({ color: '#e8e0c8' }));
  stem.position.y = 0.07;
  g.add(cap, stem);
  return g;
}
function makeReel() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18), new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8, roughness: 0.3, emissive: '#ffd890', emissiveIntensity: 0.3 }));
  return m;
}

// ------------------------------------------------------------------ intent
let rmbHoldT = 0;
let touchState = null;
function buildIntent(dt) {
  const p = game.player;
  const it = {
    move: null, moveTo: null, aim: null, attack: false, attackStart: false, attackTarget: null,
    cast: null, flash: false, use: false, useHeld: false, item: -1, trinket: false, shroom: false, levelUp: null, stop: false,
  };
  const m = input.mouse;
  const aimW = R.screenToWorld(m.x, m.y, p.y + 0.5);
  if (aimW && !isTouch) it.aim = aimW;
  const hoverZ = aimW ? zombieNear(aimW.x, aimW.z, 1.1) : null;
  const rank = input.rankMod();
  if (settings.scheme === 'wasd') {
    const v = rank && !isTouch ? { x: 0, y: 0 } : input.moveVec(); // Alt+W ranks W, it doesn't walk
    it.move = { x: v.x, z: v.y };
    it.attack = m.left;
    it.attackStart = m.leftPressed;
    if (m.left && hoverZ) it.attackTarget = hoverZ;
    if (!rank) {
      if (m.rightPressed) it.cast = 'Q';
      else if (input.keyPressed('ShiftLeft') || input.keyPressed('ShiftRight')) it.cast = 'W';
      else if (input.keyPressed('KeyE')) it.cast = 'E';
      else if (input.keyPressed('KeyR')) it.cast = 'R';
      if (input.keyPressed('KeyQ')) it.flash = true;
    }
  } else {
    // Classic: right-click to move or attack, A for attack-move, S to stop
    if (m.rightPressed) {
      if (hoverZ) p.attackOrder = hoverZ;
      else if (aimW) it.moveTo = aimW;
      rmbHoldT = 0;
      if (aimW && !hoverZ) fx.ring(aimW.x, p.y, aimW.z, 0.1, 0.5, '#7dff9a', 0.3, 0.8);
    } else if (m.right && aimW && !p.attackOrder) {
      rmbHoldT += dt;
      if (rmbHoldT > 0.15) {
        rmbHoldT = 0;
        it.moveTo = aimW;
      }
    }
    if (input.keyPressed('KeyA') && aimW) {
      const z = zombieNear(aimW.x, aimW.z, 6) || zombieNear(p.x, p.z, 6);
      if (z) p.attackOrder = z;
      else it.moveTo = aimW;
    }
    if (m.left && hoverZ) {
      it.attack = true;
      it.attackTarget = hoverZ;
    }
    if (input.keyPressed('KeyS')) it.stop = true;
    if (!rank) {
      for (const k of ['Q', 'W', 'E', 'R']) if (input.keyPressed('Key' + k)) it.cast = k;
      if (input.keyPressed('KeyD')) it.flash = true;
    }
    if (p.attackOrder && (p.attackOrder.dead || !p.attackOrder.targetable)) p.attackOrder = null;
  }
  if (rank) for (const k of ['Q', 'W', 'E', 'R']) if (input.keyPressed('Key' + k)) it.levelUp = k;
  it.use = input.keyPressed('KeyF');
  it.useHeld = input.key('KeyF');
  const ik = ['Digit1', 'Digit2', 'Digit3', 'Digit5', 'Digit6', 'Digit7'];
  for (let i = 0; i < 6; i++) if (input.keyPressed(ik[i])) it.item = i;
  it.trinket = input.keyPressed('Digit4');
  it.shroom = input.keyPressed('KeyG');
  if (isTouch) applyTouch(it, p);
  return it;
}
function zombieNear(x, z, r) {
  let best = null, bd = r;
  for (const zz of game.zombies) {
    if (zz.dead || !zz.targetable) continue;
    const d = dist(x, z, zz.x, zz.z);
    if (d < bd) {
      bd = d;
      best = zz;
    }
  }
  return best;
}

// ------------------------------------------------------------------ touch controls
function setupTouch() {
  if (!isTouch) return;
  touchState = { stick: null, attack: false, aim: null, casts: [], use: false, useHeld: false, flash: null };
  const stick = $('stick'), nub = $('stickNub');
  stick.addEventListener('pointerdown', (e) => {
    stick.setPointerCapture(e.pointerId);
    touchState.stick = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: 0, y: 0 };
    initAudio();
  });
  stick.addEventListener('pointermove', (e) => {
    const s = touchState.stick;
    if (!s || s.id !== e.pointerId) return;
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const l = Math.hypot(dx, dy), max = r.width / 2 - 10;
    if (l > max) {
      dx = (dx / l) * max;
      dy = (dy / l) * max;
    }
    s.x = dx / max;
    s.y = dy / max;
    nub.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endStick = (e) => {
    const s = touchState.stick;
    if (!s || s.id !== e.pointerId) return;
    touchState.stick = null;
    nub.style.transform = '';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  for (const b of document.querySelectorAll('#tbtns .tb')) {
    const act = b.dataset.act;
    let start = null;
    b.addEventListener('pointerdown', (e) => {
      b.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0 };
      initAudio();
      if (act === 'attack') touchState.attack = true;
      if (act === 'use') {
        touchState.use = true;
        touchState.useHeld = true;
      }
      b.classList.add('aiming');
    });
    b.addEventListener('pointermove', (e) => {
      if (!start) return;
      start.dx = e.clientX - start.x;
      start.dy = e.clientY - start.y;
      if ('QWER'.includes(act) || act === 'flash') touchState.aim = Math.hypot(start.dx, start.dy) > 18 ? { dx: start.dx, dy: start.dy } : null;
    });
    const end = (e) => {
      b.classList.remove('aiming');
      if (!start) return;
      const drag = Math.hypot(start.dx, start.dy) > 18 ? { dx: start.dx, dy: start.dy } : null;
      if (act === 'attack') touchState.attack = false;
      else if (act === 'use') touchState.useHeld = false;
      else if (act === 'flash') touchState.flash = drag || { auto: true };
      else touchState.casts.push({ key: act, drag });
      touchState.aim = null;
      start = null;
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
  }
  $('pauseBtn').addEventListener('click', () => pause());
}
function applyTouch(it, p) {
  const t = touchState;
  if (!t) return;
  if (t.stick) it.move = { x: t.stick.x, z: t.stick.y };
  it.attack = it.attack || t.attack;
  const autoAim = (range) => {
    const z = zombieNear(p.x, p.z, range);
    return z ? { x: z.x, z: z.z } : { x: p.x + Math.cos(p.ang) * 3, z: p.z + Math.sin(p.ang) * 3 };
  };
  const fromDrag = (d, range) => {
    const l = Math.hypot(d.dx, d.dy) || 1;
    const k = Math.min(1, l / 80) * range;
    return { x: p.x + (d.dx / l) * k, z: p.z + (d.dy / l) * k };
  };
  if (t.casts.length) {
    const c = t.casts.shift();
    it.cast = c.key;
    const range = { Q: 7, W: 4, E: 7, R: 5 }[c.key] || 6;
    it.aim = c.drag ? fromDrag(c.drag, range) : autoAim(range + 1);
  }
  if (t.flash) {
    it.flash = true;
    it.aim = t.flash.auto ? { x: p.x + Math.cos(p.ang) * 4, z: p.z + Math.sin(p.ang) * 4 } : fromDrag(t.flash, 4);
    t.flash = null;
  }
  if (!it.aim) it.aim = autoAim(8);
  if (t.use) {
    it.use = true;
    t.use = false;
  }
  it.useHeld = it.useHeld || t.useHeld;
}

// ------------------------------------------------------------------ main loop
let papGlow = null;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 0.016;
  watchPerf(dt);
  dt = Math.min(dt, 0.05);
  try {
    tick(dt);
  } catch (err) {
    console.error(err);
    if (!tick.failed) {
      tick.failed = true;
      fail(err);
    }
  }
}
// A slow machine steps the graphics down once instead of stuttering through a run: first
// render at 1x pixel ratio, then switch bloom off for the session. Never undoes your own choice.
const perf = { slow: 0, step: 0 };
function watchPerf(rawDt) {
  if (testMode || state !== 'playing' || perf.step >= 2 || settings.quality !== 'high') return;
  if (rawDt > 2) return; // coming back from another tab
  // each frame counts for at most 0.25 s, so it takes a dozen slow frames, not one hitch
  perf.slow = rawDt > 1 / 32 ? perf.slow + Math.min(rawDt, 0.25) : Math.max(0, perf.slow - rawDt * 0.5);
  if (perf.slow < 3) return;
  perf.slow = 0;
  if (perf.step === 0 && (window.devicePixelRatio || 1) > 1) {
    perf.step = 1;
    R.setDprCap(1);
  } else {
    perf.step = 2;
    settings.quality = 'low';
    R.applyQuality();
    hud.toast('Graphics set to Low to keep things smooth. You can change it in Settings.');
  }
}
function tick(dt) {
  if (testMode && window.__kinoFreeze) return; // tests drive the simulation and rendering themselves
  if (state === 'playing') stepGame(dt, true);
  else if (state === 'menu' || state === 'select') menuView(dt);
  else if (state === 'paused' || state === 'over') renderGameFrame(0);
  input.endFrame();
}

function stepGame(dt, render) {
  if (input.keyPressed('Escape') || input.keyPressed('KeyP')) {
    if (game.swap) game.chooseSwap(-1);
    else if (game.papMenu) game.papChoose(null);
    else {
      pause();
      return;
    }
  }
  if (input.mouse.wheel) R.zoom(input.mouse.wheel);
  const it = testMode && window.__kinoBot ? window.__kinoBot(game) : buildIntent(dt);
  game.update(dt, it);
  if (songT > 0) {
    songT -= dt;
    if (songT <= 0) stopMusic(2);
  }
  if (render) renderGameFrame(dt, it);
}

function renderGameFrame(dt, it) {
  const g = game;
  if (!g) return;
  const p = g.player;
  // champion model
  if (champModel) {
    const c = champModel;
    c.root.visible = !p.vanished;
    c.root.position.set(p.x, p.y, p.z);
    c.root.rotation.y = yawOf(p.ang);
    const castT = p.cast ? p.cast.t / Math.max(0.05, p.cast.dur) : -1;
    animateChampion(c, {
      speed: p.speedNow,
      attackT: p.atk.anim,
      attackSide: p.atk.side,
      castT,
      castKind: p.cast ? p.cast.kind : '',
      channel: p.channel ? p.channel.kind : '',
      downed: p.downed,
      time: g.time,
      dt: Math.max(dt, 0.0001),
    });
    // Pack-a-Punched shimmer on the weapon-ish parts
    const papped = Object.values(p.pap).some(Boolean);
    const glow = papped ? 0.6 + 0.4 * Math.sin(g.time * 4) : 0;
    for (const m of Object.values(c.mats)) {
      if (m.emissive && !m.userData.baseEmissive) m.userData.baseEmissive = { c: m.emissive.clone(), i: m.emissiveIntensity };
    }
    if (c.mats.steel) setPapGlow(c.mats.steel, glow);
    if (c.mats.blade) setPapGlow(c.mats.blade, glow);
    if (c.mats.wrap) setPapGlow(c.mats.wrap, glow * 0.4);
    // Yi's blade glows during Wuju Style
    if (c.mats.blade && p.buffs.wuju > 0) {
      c.mats.blade.emissive.set('#9fff6a');
      c.mats.blade.emissiveIntensity = 1.6;
    }
    // Zhonya's stasis turns you gold
    if (p.buffs.stasis > 0) {
      for (const m of Object.values(c.mats)) {
        if (!m.emissive) continue;
        m.emissive.set('#ffc640');
        m.emissiveIntensity = 0.9;
      }
      c.gilded = true;
    } else if (c.gilded) {
      c.gilded = false;
      for (const m of Object.values(c.mats)) {
        const b = m.userData.baseEmissive;
        if (m.emissive && b) {
          m.emissive.copy(b.c);
          m.emissiveIntensity = b.i;
        }
      }
    }
  }
  crowd.sync(g.zombies, g.time);
  world.update(dt, g.time, world.state || {});
  fx.update(dt);
  // camera
  const lead = it && it.aim && settings.scheme === 'wasd' && !isTouch ? { x: clamp((it.aim.x - p.x) * 0.15, -2, 2), z: clamp((it.aim.z - p.z) * 0.15, -1.6, 1.6) } : { x: 0, z: 0 };
  R.follow(p.x, p.y, p.z, dt || 0.016, { snap, leadX: lead.x, leadZ: lead.z });
  snap = false;
  fadeChandelier(p, dt || 0.016);
  fadeStage(p, dt || 0.016);
  if (fovKick > 0) {
    fovKick = Math.max(0, fovKick - (dt || 0.016) * 2);
    R.camera.fov += 30 * fovKick * 0.5;
    R.camera.updateProjectionMatrix();
  }
  // fog thickens on dog rounds
  const fogNear = fogOn ? 4 : R.rig.dist + 6, fogFar = fogOn ? 22 : R.rig.dist + 38;
  R.scene.fog.near = fogNear;
  R.scene.fog.far = fogFar;
  R.scene.fog.color.set(fogOn ? '#2a2e38' : '#050304');
  R.setXray(p.x, p.y, p.z, !p.vanished);
  // lighting: a warm lantern on the champion, the room lights around
  // hung high so it lights the floor around you without blowing out the champion
  R.playerLight.position.set(p.x, p.y + 5.5, p.z + 0.4);
  R.playerLight.intensity = g.power ? 55 : 80;
  R.hemi.intensity = g.power ? 0.72 : 0.42;
  R.updateLights(world.lights, p.x, p.z);
  setListener(p.x, p.z);
  // ability indicators while hovering an ability key? keep it simple: show the aim ring for Amumu Q
  fx.indicator.hide();
  if (it && !isTouch && settings.showRanges !== false) {
    const k = settings.scheme === 'wasd' ? (input.mouse.right ? 'Q' : input.key('ShiftLeft') ? 'W' : null) : ['Q', 'W', 'E', 'R'].find((q) => input.key('Key' + q)) || null;
    if (k && it.aim) {
      const spec = CHAMPS[p.id][k].ind;
      if (spec && spec.kind === 'line') fx.indicator.show(p.x, p.y, p.z, spec, it.aim.x, it.aim.z);
    }
  }
  R.render();
  if (fovKick > 0) {
    R.camera.fov -= 30 * fovKick * 0.5;
    R.camera.updateProjectionMatrix();
  }
  hud.frame(dt || 0);
}
// The theatre chandelier hangs between the camera and the floor near the stage. Whenever its
// picture covers the space around the champion, it turns see-through.
let chandelierFade = 1;
function fadeChandelier(p, dt) {
  const ch = world.chandelier && world.chandelier.mesh;
  if (!ch) return;
  R.camera.updateMatrixWorld();
  const c = R.worldToScreen(ch.position.x, ch.position.y - 0.6, ch.position.z);
  const me = R.worldToScreen(p.x, p.y + 1, p.z);
  // its on-screen radius: 1.5 m at its depth
  const edge = R.worldToScreen(ch.position.x + 1.5, ch.position.y - 0.6, ch.position.z);
  const rad = Math.hypot(edge.x - c.x, edge.y - c.y);
  const zone = Math.min(window.innerWidth, window.innerHeight) * 0.3;
  const over = !c.behind && Math.hypot(c.x - me.x, c.y - me.y) < zone + rad;
  const want = over ? 0.07 : 1;
  chandelierFade += (want - chandelierFade) * Math.min(1, dt * 6);
  if (Math.abs(chandelierFade - want) < 0.01) chandelierFade = want;
  ch.userData.setFade(chandelierFade);
}
// Backstage (where the power switch is) sits behind the cinema screen and the stage curtain, and
// the camera looks over them from the front. While you're back there they turn see-through.
let stageFade = 1;
function fadeStage(p, dt) {
  const scr = world.screen && world.screen.mesh;
  if (!scr) return;
  const box = (scr.userData.box ||= new THREE.Box3().setFromObject(scr));
  const halfW = (box.max.x - box.min.x) / 2;
  const behind = p.z < scr.position.z - 0.1 && Math.abs(p.x - scr.position.x) < halfW + 4;
  const want = behind ? 0 : 1;
  stageFade += (want - stageFade) * Math.min(1, dt * 6);
  if (Math.abs(stageFade - want) < 0.01) stageFade = want;
  fadeGroup(scr, stageFade);
  // the curtain stays a ghost: before the power it's a closed wall you can bump into
  if (world.curtain) fadeGroup(world.curtain, 0.3 + 0.7 * stageFade);
}
/** Make every material under a group see-through (a < 1) or restore it (a = 1). */
function fadeGroup(group, a) {
  if (group.userData.fade === a) return;
  group.userData.fade = a;
  group.visible = a > 0.02;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    const base = (m.userData.fadeBase ||= { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite });
    const solid = a >= 1;
    m.transparent = solid ? base.transparent : true;
    m.opacity = base.opacity * a;
    m.depthWrite = solid ? base.depthWrite : false;
  });
}
function setPapGlow(m, v) {
  const b = m.userData.baseEmissive;
  if (!b) return;
  if (v > 0) {
    m.emissive.set('#b06cff');
    m.emissiveIntensity = v * 1.6;
  } else {
    m.emissive.copy(b.c);
    m.emissiveIntensity = b.i;
  }
}

// menu: a slow drift around the auditorium
function menuView(dt) {
  menuT += dt;
  const c = P(0, 300);
  const a = menuT * 0.05;
  const r = 9;
  const tx = c.x + Math.cos(a) * r, tz = c.z + Math.sin(a) * r * 0.6;
  R.follow(tx, 0, tz, dt, { snap: menuT < 0.1 });
  R.rig.want = 22;
  R.setXray(0, 0, 0, false);
  if (chandelierFade !== 1 && world.chandelier) {
    chandelierFade = 1;
    world.chandelier.mesh.userData.setFade(1);
  }
  if (stageFade !== 1 && world.screen) {
    stageFade = 1;
    fadeGroup(world.screen.mesh, 1);
    if (world.curtain) fadeGroup(world.curtain, 1);
  }
  R.playerLight.position.set(tx, 3, tz);
  R.playerLight.intensity = 10;
  R.hemi.intensity = 0.7;
  R.scene.fog.color.set('#050304');
  R.updateLights(world.lights, tx, tz);
  world.update(dt, menuT, world.state || {});
  fx.update(dt);
  R.render();
}

// ------------------------------------------------------------------ test hooks
function exposeTest() {
  window.__kino = {
    get game() {
      return game;
    },
    get state() {
      return state;
    },
    start: (id) => startGame(id),
    /** Advance the simulation without rendering (fast-forward). */
    step(seconds, h = 1 / 30, intentFn) {
      let t = 0;
      while (t < seconds && game && !game.over) {
        const it = intentFn ? intentFn(game) : { move: null, aim: null, attack: false, cast: null, item: -1 };
        it.move ||= null;
        it.item ??= -1;
        game.update(h, it);
        fx.update(h);
        t += h;
      }
      return game ? summary() : null;
    },
    summary,
    /** Teleport the champion to map units (X east, Y north). */
    tp(X, Y) {
      const q = P(X, Y);
      const p = game.player;
      const o = map.grid.nearestOpen(q.x, q.z, 3) || q;
      p.x = o.x;
      p.z = o.z;
      p.y = map.grid.heightAt(o.x, o.z);
      p.safeX = p.x;
      p.safeZ = p.z;
      snap = true;
      game.debug.refreshFields(true);
      return { x: p.x, z: p.z };
    },
    tpWorld(x, z) {
      const p = game.player;
      p.x = x;
      p.z = z;
      p.y = map.grid.heightAt(x, z);
      p.safeX = x;
      p.safeZ = z;
      snap = true;
      game.debug.refreshFields(true);
    },
    /** One frame with F pressed. */
    use() {
      game.update(1 / 30, { move: null, aim: null, attack: false, cast: null, item: -1, use: true, useHeld: true });
      return game.interact ? game.interact.text : null;
    },
    prompt() {
      const it = game.debug.interactables();
      return it ? (it.bare ? it.text : it.text + (it.cost ? ' [' + it.cost + ']' : '')) : null;
    },
    render: () => renderGameFrame(0.016),
    /** One real frame (input, simulation, render) while the loop is frozen with __kinoFreeze. */
    frame(dt = 1 / 30) {
      const f = window.__kinoFreeze;
      window.__kinoFreeze = false;
      tick(dt);
      window.__kinoFreeze = f;
    },
    map: () => map,
    world: () => world,
    R: () => R,
  };
  function summary() {
    const g = game;
    const p = g.player;
    return {
      phase: g.phase, round: g.round, points: g.points, hp: Math.round(p.hp), maxHp: Math.round(p.maxHp), level: p.level, kills: g.stats.kills,
      alive: g.zombies.filter((z) => !z.dead).length, toSpawn: g.toSpawn, power: g.power, over: g.over, downed: p.downed, x: +p.x.toFixed(2), z: +p.z.toFixed(2),
    };
  }
}

boot().catch(fail);
