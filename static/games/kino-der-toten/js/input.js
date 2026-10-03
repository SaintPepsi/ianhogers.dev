// Keyboard, mouse and touch, folded into one per-frame "intent" the game reads.
// Two keyboard schemes: WASD (move with keys, attack with left click) and Classic
// (League's right-click to move). Touch gets a stick and Wild Rift style buttons.

import { store } from './util.js';

export const SCHEMES = {
  wasd: {
    label: 'WASD',
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    Q: ['KeyQ'],
    W: ['KeyE'],
    E: ['Space'],
    R: ['KeyR'],
    flash: ['KeyF'],
    use: ['KeyG'],
  },
  classic: {
    label: 'Classic',
    up: [],
    down: [],
    left: [],
    right: [],
    Q: ['KeyQ'],
    W: ['KeyW'],
    E: ['KeyE'],
    R: ['KeyR'],
    flash: ['KeyD'],
    use: ['KeyF'],
    attackMove: ['KeyA'],
    stop: ['KeyS'],
  },
};

const ITEM_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
const RANK_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, inside: false, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
  const touch = { active: false, stick: { x: 0, y: 0, on: false }, attack: false, casts: [], use: false, useHeld: false, flash: false };
  let scheme = store.get('kino.scheme', 'wasd');
  if (!SCHEMES[scheme]) scheme = 'wasd';
  let enabled = true;
  const listeners = [];

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn, opts));
  };

  const isGameKey = (code) => {
    const s = SCHEMES[scheme];
    for (const k of Object.keys(s)) if (Array.isArray(s[k]) && s[k].includes(code)) return true;
    return ITEM_KEYS.includes(code) || code === 'Tab' || code === 'Space';
  };

  on(window, 'keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (enabled && isGameKey(e.code)) e.preventDefault();
    // Alt + Q/W/E/R ranks abilities (League's Ctrl + key would close or reload the tab here);
    // keep Alt from reaching the browser's menus while playing
    if (enabled && (e.code === 'AltLeft' || e.code === 'AltRight' || (e.altKey && RANK_KEYS.includes(e.code)))) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  on(window, 'keyup', (e) => {
    down.delete(e.code);
    released.add(e.code);
  });
  on(window, 'blur', () => {
    down.clear();
    mouse.left = mouse.right = false;
  });
  on(canvas, 'mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.inside = true;
  });
  on(canvas, 'mouseleave', () => (mouse.inside = false));
  on(canvas, 'mousedown', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (e.button === 0) {
      mouse.left = true;
      mouse.leftPressed = true;
    }
    if (e.button === 2) {
      mouse.right = true;
      mouse.rightPressed = true;
    }
  });
  on(window, 'mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  on(canvas, 'contextmenu', (e) => e.preventDefault());
  on(canvas, 'wheel', (e) => {
    e.preventDefault();
    mouse.wheel += Math.sign(e.deltaY);
  }, { passive: false });

  const has = (codes) => codes && codes.some((c) => down.has(c));
  const hit = (codes) => codes && codes.some((c) => pressed.has(c));

  return {
    mouse,
    touch,
    down,
    get scheme() {
      return scheme;
    },
    setScheme(s) {
      if (!SCHEMES[s]) return;
      scheme = s;
      store.set('kino.scheme', s);
    },
    setEnabled(v) {
      enabled = v;
    },
    key: (code) => down.has(code),
    keyPressed: (code) => pressed.has(code),
    action: (name) => has(SCHEMES[scheme][name]),
    actionPressed: (name) => hit(SCHEMES[scheme][name]),
    /** Held to rank up abilities with Q/W/E/R. */
    rankMod: () => down.has('AltLeft') || down.has('AltRight'),
    /** Movement vector from keys or the touch stick, in screen space (x right, y down). */
    moveVec() {
      if (touch.stick.on) return { x: touch.stick.x, y: touch.stick.y };
      const s = SCHEMES[scheme];
      let x = 0, y = 0;
      if (has(s.left)) x -= 1;
      if (has(s.right)) x += 1;
      if (has(s.up)) y -= 1;
      if (has(s.down)) y += 1;
      const l = Math.hypot(x, y);
      return l ? { x: x / l, y: y / l } : { x: 0, y: 0 };
    },
    itemPressed() {
      for (let i = 0; i < ITEM_KEYS.length; i++) if (pressed.has(ITEM_KEYS[i])) return i;
      return -1;
    },
    /** Call at the end of every frame. */
    endFrame() {
      pressed.clear();
      released.clear();
      mouse.leftPressed = false;
      mouse.rightPressed = false;
      mouse.wheel = 0;
      touch.casts.length = 0;
      touch.use = false;
      touch.flash = false;
    },
    destroy() {
      for (const off of listeners) off();
    },
  };
}
