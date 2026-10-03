// Everything you hear is synthesised here with Web Audio: no samples, no recordings.
// The context starts suspended until the first key press or click (autoplay rules).

import { clamp, rand } from './util.js';

let ctx = null;
let master, sfxBus, musicBus, ambBus, reverbIn, comp;
let noiseBuf = null;
let listener = { x: 0, z: 0 };
const voices = new Map(); // name -> count of live voices, for throttling
const loops = new Set();

export const volumes = { master: 0.8, sfx: 0.9, music: 0.6 };

export function audioReady() {
  return !!ctx && ctx.state === 'running';
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
    return;
  }
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master = ctx.createGain();
  master.gain.value = volumes.master;
  comp.connect(master).connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = volumes.sfx;
  sfxBus.connect(comp);
  musicBus = ctx.createGain();
  musicBus.gain.value = volumes.music;
  musicBus.connect(comp);
  ambBus = ctx.createGain();
  ambBus.gain.value = 0.5;
  ambBus.connect(sfxBus);

  // A big hall: exponentially decaying stereo noise as the impulse response.
  const len = Math.floor(ctx.sampleRate * 2.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  reverbIn = ctx.createGain();
  reverbIn.gain.value = 0.35;
  const revOut = ctx.createGain();
  revOut.gain.value = 0.55;
  reverbIn.connect(conv).connect(revOut).connect(comp);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setVolumes(v) {
  Object.assign(volumes, v);
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(volumes.master, t, 0.05);
  sfxBus.gain.setTargetAtTime(volumes.sfx, t, 0.05);
  musicBus.gain.setTargetAtTime(volumes.music, t, 0.05);
}

export function suspendAudio(on) {
  if (!ctx) return;
  if (on) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
}

export function setListener(x, z) {
  listener.x = x;
  listener.z = z;
}

export function now() {
  return ctx ? ctx.currentTime : 0;
}

/** Gain and pan for a sound at world position (x, z). Null position = centred, full volume. */
function spatial(pos) {
  if (!pos) return { g: 1, pan: 0 };
  const dx = pos.x - listener.x, dz = pos.z - listener.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const g = clamp(1.15 - d / 26, 0, 1);
  return { g: g * g, pan: clamp(dx / 14, -0.85, 0.85) };
}

function claim(name, max) {
  if (!name) return true;
  const n = voices.get(name) || 0;
  if (n >= max) return false;
  voices.set(name, n + 1);
  return true;
}
function release(name, delayMs) {
  if (!name) return;
  setTimeout(() => voices.set(name, Math.max(0, (voices.get(name) || 1) - 1)), delayMs);
}

/** Output chain for one voice: gain -> pan -> bus (+ optional reverb send). */
function out(bus, gain, pan, rev) {
  const g = ctx.createGain();
  g.gain.value = 0;
  let node = g;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    node = p;
  }
  node.connect(bus);
  if (rev > 0) {
    const s = ctx.createGain();
    s.gain.value = rev;
    node.connect(s).connect(reverbIn);
  }
  return g;
}

/**
 * One enveloped oscillator.
 * o: { f, f2, type, dur, a, gain, at, pos, rev, bus, detune, curve }
 */
export function tone(o) {
  if (!ctx) return;
  const sp = spatial(o.pos);
  const vol = (o.gain ?? 0.2) * sp.g;
  if (vol < 0.002) return;
  const t0 = ctx.currentTime + (o.at || 0);
  const dur = o.dur ?? 0.2;
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + dur * (o.slide ?? 1));
  if (o.detune) osc.detune.value = o.detune;
  const g = out(o.bus || sfxBus, vol, sp.pan, o.rev ?? 0.15);
  const a = o.a ?? 0.005;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + a);
  if (o.hold) g.gain.setValueAtTime(vol, t0 + a + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let src = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    f.Q.value = o.q ?? 0.7;
    osc.connect(f);
    src = f;
  }
  src.connect(g);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/**
 * Filtered noise burst.
 * o: { dur, a, gain, type ('lowpass'|'highpass'|'bandpass'), f, f2, q, at, pos, rev, bus }
 */
export function noise(o) {
  if (!ctx) return;
  const sp = spatial(o.pos);
  const vol = (o.gain ?? 0.2) * sp.g;
  if (vol < 0.002) return;
  const t0 = ctx.currentTime + (o.at || 0);
  const dur = o.dur ?? 0.2;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const off = Math.random() * 1.5;
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'lowpass';
  f.frequency.setValueAtTime(o.f ?? 1200, t0);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
  f.Q.value = o.q ?? 0.8;
  const g = out(o.bus || sfxBus, vol, sp.pan, o.rev ?? 0.15);
  const a = o.a ?? 0.004;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + a);
  if (o.hold) g.gain.setValueAtTime(vol, t0 + a + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g);
  src.start(t0, off);
  src.stop(t0 + dur + 0.05);
}

/** A looping sound whose gain can be faded; returns a handle with set(gain) and stop(). */
export function loop(make) {
  if (!ctx) return { set() {}, stop() {}, pos() {} };
  const g = ctx.createGain();
  g.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) g.connect(pan).connect(sfxBus);
  else g.connect(sfxBus);
  const nodes = make(ctx, g, noiseBuf);
  let base = 0;
  let where = null;
  const h = {
    set(v, tc = 0.08) {
      base = v;
      const sp = spatial(where);
      g.gain.setTargetAtTime(base * sp.g, ctx.currentTime, tc);
      if (pan) pan.pan.setTargetAtTime(sp.pan, ctx.currentTime, 0.05);
    },
    pos(p) {
      where = p;
      h.set(base, 0.1);
    },
    stop(fade = 0.2) {
      g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
      setTimeout(() => {
        for (const n of nodes) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
        g.disconnect();
      }, fade * 1000 + 100);
      loops.delete(h);
    },
  };
  loops.add(h);
  return h;
}

export function stopAllLoops() {
  for (const h of [...loops]) h.stop(0.1);
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Play a list of [time, midiNote, dur, gain?] on a simple instrument. */
function seq(notes, inst, opts = {}) {
  if (!ctx) return 0;
  let end = 0;
  for (const [t, n, d, gn] of notes) {
    inst(midi(n), t + (opts.at || 0), d, gn ?? 1, opts);
    end = Math.max(end, t + d);
  }
  return end;
}

// ---------------------------------------------------------------- instruments
const inst = {
  bell(f, at, d, gn, o) {
    tone({ f, type: 'sine', dur: d + 0.8, a: 0.003, gain: 0.12 * gn, at, rev: 0.45, bus: o.bus });
    tone({ f: f * 2.01, type: 'sine', dur: d + 0.3, a: 0.003, gain: 0.05 * gn, at, rev: 0.45, bus: o.bus });
    tone({ f: f * 3.98, type: 'sine', dur: 0.25, a: 0.002, gain: 0.025 * gn, at, rev: 0.4, bus: o.bus });
  },
  musicbox(f, at, d, gn, o) {
    tone({ f: f * 2, type: 'triangle', dur: 0.9, a: 0.002, gain: 0.1 * gn, at, rev: 0.5, bus: o.bus });
    tone({ f: f * 4.02, type: 'sine', dur: 0.35, a: 0.002, gain: 0.04 * gn, at, rev: 0.5, bus: o.bus });
  },
  organ(f, at, d, gn, o) {
    for (const [m, g] of [[1, 0.07], [2, 0.04], [3, 0.02], [0.5, 0.04]])
      tone({ f: f * m, type: 'sine', dur: d + 0.15, a: 0.03, hold: d * 0.8, gain: g * gn, at, rev: 0.5, bus: o.bus });
  },
  brass(f, at, d, gn, o) {
    tone({ f, type: 'sawtooth', dur: d + 0.1, a: 0.04, hold: d * 0.7, gain: 0.06 * gn, at, lp: 1400, rev: 0.35, bus: o.bus });
    tone({ f: f * 1.005, type: 'square', dur: d + 0.1, a: 0.05, hold: d * 0.6, gain: 0.025 * gn, at, lp: 1100, rev: 0.35, bus: o.bus });
  },
  pluck(f, at, d, gn, o) {
    tone({ f, type: 'triangle', dur: Math.max(0.25, d), a: 0.002, gain: 0.12 * gn, at, rev: 0.25, bus: o.bus });
    tone({ f: f * 2, type: 'square', dur: 0.08, a: 0.001, gain: 0.02 * gn, at, lp: 2500, rev: 0.2, bus: o.bus });
  },
  piano(f, at, d, gn, o) {
    tone({ f, type: 'triangle', dur: d + 0.6, a: 0.002, gain: 0.11 * gn, at, rev: 0.35, bus: o.bus });
    tone({ f: f * 2, type: 'sine', dur: d + 0.2, a: 0.002, gain: 0.04 * gn, at, rev: 0.35, bus: o.bus });
  },
  bass(f, at, d, gn, o) {
    tone({ f, type: 'sawtooth', dur: d + 0.05, a: 0.005, hold: d * 0.7, gain: 0.09 * gn, at, lp: 420, rev: 0.05, bus: o.bus });
  },
  lead(f, at, d, gn, o) {
    tone({ f, type: 'square', dur: d + 0.08, a: 0.01, hold: d * 0.75, gain: 0.05 * gn, at, lp: 2600, rev: 0.3, bus: o.bus });
    tone({ f: f * 1.007, type: 'sawtooth', dur: d + 0.08, a: 0.01, hold: d * 0.75, gain: 0.03 * gn, at, lp: 2200, rev: 0.3, bus: o.bus });
  },
  pad(f, at, d, gn, o) {
    for (const det of [-7, 0, 7])
      tone({ f, type: 'sawtooth', dur: d + 0.6, a: 0.4, hold: d * 0.6, gain: 0.02 * gn, at, lp: 900, detune: det, rev: 0.6, bus: o.bus });
  },
};

function kick(at, gn = 1, bus) {
  tone({ f: 150, f2: 42, type: 'sine', dur: 0.32, a: 0.001, gain: 0.5 * gn, at, rev: 0.05, slide: 0.4, bus });
}
function snare(at, gn = 1, bus) {
  noise({ type: 'bandpass', f: 1800, q: 0.7, dur: 0.18, gain: 0.28 * gn, at, rev: 0.15, bus });
  tone({ f: 190, f2: 140, type: 'triangle', dur: 0.1, gain: 0.12 * gn, at, bus });
}
function hat(at, gn = 1, bus, open = false) {
  noise({ type: 'highpass', f: 7000, dur: open ? 0.22 : 0.05, gain: 0.09 * gn, at, rev: 0.05, bus });
}

// ---------------------------------------------------------------- sound library
// Each entry is fn(pos?, ...args). pos is {x, z} in world space or null for UI sounds.
export const sfx = {
  click() {
    tone({ f: 900, f2: 600, type: 'square', dur: 0.05, gain: 0.05, lp: 3000 });
  },
  hover() {
    tone({ f: 1200, type: 'sine', dur: 0.04, gain: 0.025 });
  },
  deny() {
    tone({ f: 140, type: 'square', dur: 0.18, gain: 0.07, lp: 900 });
    tone({ f: 104, type: 'square', dur: 0.22, gain: 0.07, lp: 900, at: 0.08 });
  },
  buy() {
    noise({ type: 'bandpass', f: 4000, q: 2, dur: 0.06, gain: 0.08 });
    tone({ f: 1318, type: 'triangle', dur: 0.12, gain: 0.09, at: 0.02 });
    tone({ f: 1976, type: 'triangle', dur: 0.25, gain: 0.08, at: 0.08 });
  },
  levelUp() {
    seq([[0, 72, 0.12], [0.08, 76, 0.12], [0.16, 79, 0.12], [0.24, 84, 0.4]], inst.bell);
    noise({ type: 'highpass', f: 5000, f2: 9000, dur: 0.5, gain: 0.04, rev: 0.4 });
  },
  skillUp() {
    tone({ f: 880, f2: 1320, type: 'triangle', dur: 0.18, gain: 0.07 });
  },
  door(pos) {
    noise({ pos, type: 'lowpass', f: 500, f2: 180, dur: 1.1, a: 0.05, gain: 0.35, rev: 0.4 });
    tone({ pos, f: 95, f2: 60, type: 'sawtooth', dur: 0.9, a: 0.1, gain: 0.08, lp: 300, rev: 0.4 });
    noise({ pos, type: 'lowpass', f: 300, dur: 0.35, gain: 0.4, at: 0.9, rev: 0.5 });
  },
  debris(pos) {
    for (let i = 0; i < 9; i++) noise({ pos, type: 'bandpass', f: rand(300, 1500), q: 1.5, dur: rand(0.08, 0.25), gain: 0.25, at: i * 0.07 + rand(0, 0.04), rev: 0.35 });
    noise({ pos, type: 'lowpass', f: 220, dur: 0.8, gain: 0.35, rev: 0.4 });
  },
  powerOn(pos) {
    noise({ pos: null, type: 'lowpass', f: 160, dur: 0.6, gain: 0.6, rev: 0.6 });
    tone({ f: 40, f2: 120, type: 'sawtooth', dur: 3.2, a: 0.4, gain: 0.12, lp: 500, rev: 0.6 });
    tone({ f: 60, f2: 180, type: 'square', dur: 3.2, a: 0.6, gain: 0.05, lp: 700, rev: 0.6 });
    for (let i = 0; i < 6; i++) noise({ type: 'bandpass', f: 120, q: 3, dur: 0.25, gain: 0.35, at: 1.2 + i * 0.35, rev: 0.7 });
    if (pos) noise({ pos, type: 'highpass', f: 3000, dur: 0.4, gain: 0.3, at: 0.05 });
  },
  denied() {
    tone({ f: 220, type: 'sine', dur: 0.15, gain: 0.08 });
    tone({ f: 175, type: 'sine', dur: 0.25, gain: 0.08, at: 0.12 });
  },
  perkDrink() {
    noise({ type: 'bandpass', f: 2600, q: 4, dur: 0.12, gain: 0.12 });
    for (let i = 0; i < 4; i++) noise({ type: 'lowpass', f: 600, dur: 0.12, gain: 0.18, at: 0.3 + i * 0.22 });
    tone({ f: 110, f2: 70, type: 'sawtooth', dur: 0.45, gain: 0.08, lp: 600, at: 1.35, rev: 0.2 });
    noise({ type: 'bandpass', f: 4200, q: 6, dur: 0.15, gain: 0.08, at: 1.7, rev: 0.3 });
  },
  /** Original short jingle per perk, played near a machine and on purchase. */
  jingle(kind, pos) {
    const tunes = {
      jugg: [[0, 48, 0.3], [0.3, 55, 0.3], [0.6, 53, 0.15], [0.75, 51, 0.15], [0.9, 48, 0.6]],
      speed: [[0, 67, 0.1], [0.1, 71, 0.1], [0.2, 74, 0.1], [0.3, 79, 0.1], [0.45, 78, 0.1], [0.55, 74, 0.1], [0.65, 79, 0.35]],
      tap: [[0, 60, 0.15], [0.2, 60, 0.15], [0.4, 63, 0.15], [0.6, 67, 0.15], [0.8, 65, 0.15], [1.0, 60, 0.4]],
      revive: [[0, 72, 0.2], [0.2, 76, 0.2], [0.4, 79, 0.2], [0.6, 77, 0.2], [0.8, 74, 0.2], [1.0, 72, 0.5]],
    };
    const instr = { jugg: inst.brass, speed: inst.pluck, tap: inst.piano, revive: inst.musicbox }[kind] || inst.bell;
    const notes = tunes[kind] || tunes.revive;
    const sp = spatial(pos);
    if (sp.g < 0.05) return;
    seq(notes.map(([t, n, d]) => [t, n, d, sp.g]), instr);
  },
  boxOpen(pos) {
    noise({ pos, type: 'lowpass', f: 900, f2: 300, dur: 0.6, gain: 0.25, rev: 0.4 });
    tone({ pos, f: 180, f2: 120, type: 'sawtooth', dur: 0.5, gain: 0.05, lp: 500 });
  },
  /** Music-box lullaby while the box shuffles (original melody). */
  boxSpin(pos) {
    const sp = spatial(pos);
    const m = [79, 76, 72, 76, 79, 84, 83, 79, 77, 74, 71, 74, 77, 83, 81, 79];
    seq(m.map((n, i) => [i * 0.26, n, 0.25, sp.g]), inst.musicbox);
  },
  boxLand(pos) {
    tone({ pos, f: 1568, type: 'sine', dur: 0.8, gain: 0.12, rev: 0.5 });
    tone({ pos, f: 2093, type: 'sine', dur: 0.8, gain: 0.08, rev: 0.5, at: 0.05 });
  },
  bear(pos) {
    // Tibbers: a deep growl and a cheeky laugh
    noise({ pos, type: 'lowpass', f: 380, q: 6, dur: 1.2, a: 0.1, gain: 0.5, rev: 0.4 });
    tone({ pos, f: 70, f2: 45, type: 'sawtooth', dur: 1.2, a: 0.1, gain: 0.15, lp: 400, rev: 0.4 });
    for (let i = 0; i < 4; i++) tone({ pos, f: 520 - i * 40, type: 'triangle', dur: 0.12, gain: 0.08, at: 1.3 + i * 0.14, rev: 0.4 });
  },
  boxFly(pos) {
    noise({ pos, type: 'bandpass', f: 400, f2: 3000, q: 1, dur: 2.5, a: 0.3, gain: 0.3, rev: 0.6 });
  },
  boxGone(pos) {
    tone({ pos, f: 600, f2: 3000, type: 'sine', dur: 0.6, gain: 0.08, rev: 0.6 });
  },
  pap(pos) {
    for (let i = 0; i < 6; i++) noise({ pos, type: 'bandpass', f: 300 + i * 120, q: 2, dur: 0.18, gain: 0.25, at: i * 0.35, rev: 0.3 });
    tone({ pos, f: 70, f2: 140, type: 'sawtooth', dur: 2.4, a: 0.2, gain: 0.08, lp: 600, rev: 0.4 });
    seq([[2.6, 84, 0.2], [2.75, 88, 0.2], [2.9, 91, 0.6]], inst.bell);
  },
  tpCharge(pos) {
    tone({ pos, f: 80, f2: 900, type: 'sawtooth', dur: 2.2, a: 0.2, gain: 0.08, lp: 1800, rev: 0.5 });
    noise({ pos, type: 'bandpass', f: 600, f2: 5000, q: 2, dur: 2.2, a: 0.3, gain: 0.12, rev: 0.5 });
  },
  tpZap() {
    noise({ type: 'highpass', f: 1500, dur: 0.6, gain: 0.35, rev: 0.6 });
    tone({ f: 1200, f2: 80, type: 'square', dur: 0.7, gain: 0.08, lp: 3000, rev: 0.6 });
    noise({ type: 'lowpass', f: 400, dur: 1.2, gain: 0.3, rev: 0.7, at: 0.1 });
  },
  link() {
    seq([[0, 76, 0.08], [0.09, 81, 0.08], [0.18, 88, 0.25]], inst.pluck);
  },
  trap(pos) {
    for (let i = 0; i < 10; i++) noise({ pos, type: 'bandpass', f: rand(2000, 5000), q: 3, dur: 0.06, gain: 0.25, at: i * 0.05, rev: 0.2 });
  },
  boardTear(pos) {
    if (!claim('board', 3)) return;
    release('board', 300);
    noise({ pos, type: 'bandpass', f: rand(500, 900), q: 2, dur: 0.22, gain: 0.35, rev: 0.25 });
    tone({ pos, f: rand(160, 220), f2: 90, type: 'square', dur: 0.12, gain: 0.05, lp: 900 });
  },
  boardPlace(pos) {
    noise({ pos, type: 'bandpass', f: 700, q: 3, dur: 0.08, gain: 0.3, rev: 0.2 });
    noise({ pos, type: 'bandpass', f: 900, q: 3, dur: 0.08, gain: 0.25, at: 0.12, rev: 0.2 });
  },
  groan(pos, pitch = 1) {
    if (!claim('groan', 5)) return;
    release('groan', 1100);
    const f = rand(70, 120) * pitch;
    tone({ pos, f, f2: f * rand(0.7, 1.25), type: 'sawtooth', dur: rand(0.6, 1.1), a: 0.12, gain: 0.07, lp: rand(500, 900), q: 4, rev: 0.35 });
    noise({ pos, type: 'bandpass', f: rand(400, 800), q: 5, dur: 0.9, a: 0.15, gain: 0.08, rev: 0.35 });
  },
  snarl(pos) {
    if (!claim('snarl', 3)) return;
    release('snarl', 400);
    noise({ pos, type: 'bandpass', f: rand(700, 1200), f2: 400, q: 3, dur: 0.35, gain: 0.22, rev: 0.25 });
    tone({ pos, f: rand(110, 150), f2: 80, type: 'sawtooth', dur: 0.3, gain: 0.08, lp: 900 });
  },
  zHit(pos) {
    if (!claim('zhit', 6)) return;
    release('zhit', 90);
    noise({ pos, type: 'lowpass', f: 900, dur: 0.09, gain: 0.25, rev: 0.1 });
  },
  zDie(pos) {
    if (!claim('zdie', 5)) return;
    release('zdie', 300);
    noise({ pos, type: 'lowpass', f: 600, f2: 150, dur: 0.4, gain: 0.3, rev: 0.25 });
    tone({ pos, f: rand(90, 120), f2: 50, type: 'sawtooth', dur: 0.45, gain: 0.06, lp: 500, rev: 0.3 });
  },
  gib(pos) {
    if (!claim('gib', 3)) return;
    release('gib', 250);
    noise({ pos, type: 'bandpass', f: 500, q: 1, dur: 0.25, gain: 0.35, rev: 0.2 });
    noise({ pos, type: 'lowpass', f: 300, dur: 0.3, gain: 0.3, at: 0.05 });
  },
  windowCrash(pos) {
    noise({ pos, type: 'bandpass', f: 1200, q: 0.8, dur: 0.4, gain: 0.25, rev: 0.3 });
  },
  crawlerScreech(pos) {
    if (!claim('screech', 3)) return;
    release('screech', 800);
    tone({ pos, f: rand(500, 700), f2: rand(250, 350), type: 'sawtooth', dur: 0.7, a: 0.05, gain: 0.06, lp: 2500, q: 6, rev: 0.4 });
  },
  gasPop(pos) {
    noise({ pos, type: 'lowpass', f: 1800, f2: 200, dur: 1.4, a: 0.01, gain: 0.45, rev: 0.4 });
    noise({ pos, type: 'highpass', f: 3000, dur: 1.6, a: 0.2, gain: 0.08, rev: 0.4 });
  },
  hurt() {
    noise({ type: 'lowpass', f: 700, dur: 0.18, gain: 0.35, rev: 0.1 });
    tone({ f: 160, f2: 90, type: 'sawtooth', dur: 0.25, gain: 0.08, lp: 700 });
  },
  heartbeat() {
    tone({ f: 60, f2: 40, type: 'sine', dur: 0.16, gain: 0.35, rev: 0.05 });
    tone({ f: 55, f2: 38, type: 'sine', dur: 0.18, gain: 0.25, at: 0.2, rev: 0.05 });
  },
  downed() {
    tone({ f: 220, f2: 55, type: 'sawtooth', dur: 1.6, gain: 0.1, lp: 800, rev: 0.6 });
    tone({ f: 2400, type: 'sine', dur: 2.5, a: 0.3, gain: 0.03, rev: 0.4 });
  },
  revived() {
    seq([[0, 67, 0.15], [0.12, 71, 0.15], [0.24, 74, 0.15], [0.36, 79, 0.5]], inst.bell);
  },
  // ---- power-ups
  powerupSpawn(pos) {
    tone({ pos, f: 1046, type: 'sine', dur: 0.4, gain: 0.08, rev: 0.5 });
    tone({ pos, f: 1568, type: 'sine', dur: 0.5, gain: 0.06, rev: 0.5, at: 0.1 });
  },
  powerupGrab(kind) {
    const base = { maxammo: 60, instakill: 50, double: 64, nuke: 45, carpenter: 57, firesale: 62 }[kind] ?? 60;
    seq([[0, base, 0.4], [0, base + 7, 0.4], [0.35, base + 12, 0.8], [0.35, base + 7, 0.8]], inst.brass);
    noise({ type: 'highpass', f: 4000, f2: 9000, dur: 0.8, gain: 0.05, rev: 0.5 });
  },
  nuke() {
    noise({ type: 'lowpass', f: 1200, f2: 60, dur: 2.5, a: 0.02, gain: 0.7, rev: 0.6 });
    tone({ f: 70, f2: 25, type: 'sine', dur: 2.2, gain: 0.4, rev: 0.4 });
  },
  hammer() {
    for (let i = 0; i < 6; i++) noise({ type: 'bandpass', f: 1500, q: 4, dur: 0.06, gain: 0.25, at: i * 0.18, rev: 0.3 });
  },
  tick() {
    tone({ f: 1800, type: 'square', dur: 0.03, gain: 0.03, lp: 4000 });
  },
  fireSale() {
    // honky-tonk sale jingle (original)
    seq([[0, 72, 0.12], [0.15, 74, 0.12], [0.3, 76, 0.12], [0.45, 72, 0.12], [0.6, 79, 0.3], [0.95, 77, 0.12], [1.1, 76, 0.12], [1.25, 74, 0.12], [1.4, 72, 0.4]], inst.piano);
  },
  // ---- rounds
  roundStart(special) {
    if (special) {
      noise({ type: 'lowpass', f: 300, f2: 1200, dur: 3, a: 1, gain: 0.25, rev: 0.6 });
      seq([[0, 45, 1.2], [0, 52, 1.2], [1.2, 44, 1.6], [1.2, 51, 1.6]], inst.organ);
      return;
    }
    seq([[0, 38, 0.9], [0, 45, 0.9], [0.9, 41, 0.9], [0.9, 48, 0.9], [1.8, 37, 1.8], [1.8, 44, 1.8]], inst.organ);
    kick(0, 0.7);
    kick(0.9, 0.6);
    kick(1.8, 0.8);
  },
  roundEnd() {
    seq([[0, 57, 0.6], [0.5, 60, 0.6], [1.0, 64, 0.6], [1.5, 62, 1.6]], inst.pad);
    seq([[0, 69, 0.5], [0.5, 72, 0.5], [1.0, 76, 0.5], [1.5, 74, 1.5]], inst.bell);
  },
  gameOver() {
    seq([[0, 50, 1.2], [0, 57, 1.2], [1.2, 48, 1.2], [1.2, 55, 1.2], [2.4, 46, 2.4], [2.4, 53, 2.4], [2.4, 41, 2.4]], inst.organ);
  },
  meteorHum(pos) {
    tone({ pos, f: 110, type: 'sine', dur: 1.6, a: 0.3, gain: 0.25, rev: 0.6 });
    tone({ pos, f: 165, type: 'sine', dur: 1.6, a: 0.4, gain: 0.12, rev: 0.6 });
  },
  // ---- champions (generic + specific)
  swing(pos, pitch = 1) {
    noise({ pos, type: 'bandpass', f: 1400 * pitch, f2: 500 * pitch, q: 1.2, dur: 0.14, gain: 0.16, rev: 0.1 });
  },
  slap(pos) {
    noise({ pos, type: 'lowpass', f: 1200, dur: 0.07, gain: 0.3, rev: 0.1 });
  },
  blade(pos, pitch = 1) {
    tone({ pos, f: 2400 * pitch, f2: 1800 * pitch, type: 'triangle', dur: 0.18, gain: 0.05, rev: 0.25 });
    noise({ pos, type: 'highpass', f: 4000, dur: 0.12, gain: 0.08 });
  },
  dagger(pos) {
    noise({ pos, type: 'bandpass', f: 2200, f2: 900, q: 2, dur: 0.25, gain: 0.14, rev: 0.15 });
    tone({ pos, f: 1800, type: 'triangle', dur: 0.08, gain: 0.04 });
  },
  clink(pos) {
    tone({ pos, f: 3200, type: 'sine', dur: 0.12, gain: 0.06, rev: 0.3 });
    tone({ pos, f: 4700, type: 'sine', dur: 0.1, gain: 0.03, rev: 0.3 });
  },
  blink(pos) {
    noise({ pos, type: 'bandpass', f: 3000, f2: 600, q: 2, dur: 0.22, gain: 0.2, rev: 0.25 });
    tone({ pos, f: 900, f2: 1800, type: 'sine', dur: 0.12, gain: 0.05 });
  },
  lotus(pos) {
    for (let i = 0; i < 4; i++) noise({ pos, type: 'bandpass', f: 2600, f2: 1200, q: 2, dur: 0.1, gain: 0.08, at: i * 0.06 });
  },
  whip(pos) {
    noise({ pos, type: 'bandpass', f: 600, f2: 2400, q: 1.5, dur: 0.3, gain: 0.18, rev: 0.2 });
  },
  thud(pos) {
    noise({ pos, type: 'lowpass', f: 400, dur: 0.25, gain: 0.35, rev: 0.25 });
    tone({ pos, f: 90, f2: 45, type: 'sine', dur: 0.25, gain: 0.2 });
  },
  sob(pos) {
    tone({ pos, f: 520, f2: 380, type: 'triangle', dur: 0.5, a: 0.04, gain: 0.05, rev: 0.5 });
    tone({ pos, f: 470, f2: 330, type: 'triangle', dur: 0.6, a: 0.04, gain: 0.04, rev: 0.5, at: 0.45 });
  },
  tantrum(pos) {
    noise({ pos, type: 'lowpass', f: 900, f2: 200, dur: 0.45, gain: 0.45, rev: 0.35 });
    tone({ pos, f: 120, f2: 55, type: 'sawtooth', dur: 0.35, gain: 0.1, lp: 700 });
  },
  curse(pos) {
    noise({ pos, type: 'lowpass', f: 2000, f2: 120, dur: 1.4, gain: 0.5, rev: 0.6 });
    tone({ pos, f: 220, f2: 55, type: 'sawtooth', dur: 1.2, gain: 0.12, lp: 900, rev: 0.6 });
    seq([[0.1, 57, 0.6], [0.1, 60, 0.6], [0.1, 64, 0.6]], inst.pad);
  },
  meditate(pos) {
    seq([[0, 69, 0.8], [0.1, 76, 0.8]], inst.bell);
  },
  wuju(pos) {
    tone({ pos, f: 1320, type: 'sine', dur: 0.8, gain: 0.07, rev: 0.4 });
    tone({ pos, f: 1980, type: 'sine', dur: 0.6, gain: 0.04, rev: 0.4 });
  },
  highlander(pos) {
    noise({ pos, type: 'bandpass', f: 300, f2: 2500, q: 1.2, dur: 0.8, gain: 0.3, rev: 0.4 });
    seq([[0.1, 64, 0.2], [0.25, 71, 0.2], [0.4, 76, 0.5]], inst.brass);
  },
  alpha(pos) {
    for (let i = 0; i < 4; i++) {
      noise({ pos, type: 'bandpass', f: 3500, f2: 1200, q: 2, dur: 0.12, gain: 0.14, at: i * 0.07 });
      tone({ pos, f: 2600 + i * 200, type: 'triangle', dur: 0.08, gain: 0.03, at: i * 0.07 });
    }
  },
  flash(pos) {
    tone({ pos, f: 500, f2: 2400, type: 'sine', dur: 0.18, gain: 0.08, rev: 0.3 });
    noise({ pos, type: 'highpass', f: 2500, dur: 0.2, gain: 0.12, rev: 0.3 });
  },
  shield(pos) {
    tone({ pos, f: 660, f2: 990, type: 'triangle', dur: 0.4, gain: 0.06, rev: 0.4 });
  },
  zap(pos) {
    if (!claim('zap', 4)) return;
    release('zap', 120);
    noise({ pos, type: 'bandpass', f: 4000, q: 2, dur: 0.1, gain: 0.15, rev: 0.15 });
  },
  burn(pos) {
    if (!claim('burn', 2)) return;
    release('burn', 200);
    noise({ pos, type: 'lowpass', f: 700, dur: 0.25, gain: 0.06 });
  },
  item(pos) {
    tone({ pos, f: 880, f2: 1320, type: 'triangle', dur: 0.25, gain: 0.08, rev: 0.4 });
  },
  pickup() {
    tone({ f: 1320, type: 'sine', dur: 0.15, gain: 0.07, rev: 0.3 });
    tone({ f: 1760, type: 'sine', dur: 0.2, gain: 0.06, rev: 0.3, at: 0.06 });
  },
};

// ---------------------------------------------------------------- ambience
let amb = null;
export function startAmbience() {
  if (!ctx || amb) return;
  amb = loop((c, g, nb) => {
    const nodes = [];
    // low hall drone
    for (const [f, gv] of [[55, 0.05], [82.4, 0.025], [110.3, 0.012]]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = gv;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lg = c.createGain();
      lg.gain.value = gv * 0.6;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(g);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    }
    // wind through the broken windows
    const n = c.createBufferSource();
    n.buffer = nb;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.8;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = c.createGain();
    lg.gain.value = 250;
    lfo.connect(lg).connect(bp.frequency);
    const ng = c.createGain();
    ng.gain.value = 0.05;
    n.connect(bp).connect(ng).connect(g);
    n.start();
    lfo.start();
    nodes.push(n, lfo);
    return nodes;
  });
  amb.set(0.6, 1.5);
}
export function stopAmbience() {
  if (amb) amb.stop(1);
  amb = null;
}

// ---------------------------------------------------------------- music
// A tiny step sequencer. Tracks are original compositions.
let musicTimer = null;
let musicState = null;

export function stopMusic(fade = 0.5) {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  musicState = null;
  if (ctx) {
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
    setTimeout(() => {
      if (!musicState && ctx) musicBus.gain.setTargetAtTime(volumes.music, ctx.currentTime, 0.05);
    }, fade * 1000 + 300);
  }
}

/** Menu theme: slow music box over a pad, in D minor. */
const menuTrack = {
  bpm: 70,
  bars: 8,
  play(bar, at, beat) {
    const prog = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]];
    const ch = prog[bar % 4];
    inst.pad(midi(ch[0]), at, beat * 3.6, 1, { bus: musicBus });
    inst.pad(midi(ch[2]), at, beat * 3.6, 0.8, { bus: musicBus });
    const mel = [
      [74, 77, 76, 74], [74, 70, 69, 70], [72, 76, 79, 76], [73, 76, 69, 73],
      [74, 77, 81, 79], [77, 74, 70, 74], [76, 72, 67, 72], [73, 69, 64, 61],
    ][bar % 8];
    mel.forEach((n, i) => inst.musicbox(midi(n - 12), at + i * beat, beat, 0.8, { bus: musicBus }));
  },
};

/** The meteor easter egg song: an original synth-rock tune (not the real one). */
const rockTrack = {
  bpm: 132,
  bars: 16,
  play(bar, at, beat) {
    const roots = [40, 40, 43, 38, 40, 40, 45, 47, 36, 38, 40, 40, 36, 38, 47, 47];
    const r = roots[bar % 16];
    for (let i = 0; i < 8; i++) {
      const t = at + (i * beat) / 2;
      inst.bass(midi(r + (i % 4 === 3 ? 12 : 0)), t, beat * 0.45, 1, { bus: musicBus });
      hat(t, i % 2 ? 0.6 : 1, musicBus, i === 7);
    }
    for (let i = 0; i < 4; i++) {
      if (i % 2 === 0) kick(at + i * beat, 1, musicBus);
      else snare(at + i * beat, 1, musicBus);
    }
    kick(at + 2.5 * beat, 0.7, musicBus);
    const section = Math.floor(bar / 4) % 4;
    if (section === 1 || section === 3) {
      const riffs = [[64, 67, 69, 67, 64, 62, 64, 0], [67, 69, 71, 74, 71, 69, 67, 64]];
      const riff = riffs[(bar >> 1) % 2];
      riff.forEach((n, i) => n && inst.lead(midi(n), at + (i * beat) / 2, beat * 0.45, 1, { bus: musicBus }));
    } else if (section === 2) {
      inst.lead(midi(r + 24), at, beat * 1.8, 1, { bus: musicBus });
      inst.lead(midi(r + 31), at + beat * 2, beat * 1.8, 1, { bus: musicBus });
    }
  },
};

const tracks = { menu: menuTrack, rock: rockTrack };

export function playMusic(name, { loopIt = true, onEnd } = {}) {
  if (!ctx) return;
  stopMusic(0.05);
  const tr = tracks[name];
  if (!tr) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(volumes.music, ctx.currentTime, 0.05);
  const beat = 60 / tr.bpm;
  const barLen = beat * 4;
  const state = { name, bar: 0, next: ctx.currentTime + 0.1 };
  musicState = state;
  const tick = () => {
    if (musicState !== state || !ctx) return;
    while (state.next < ctx.currentTime + 0.6) {
      if (!loopIt && state.bar >= tr.bars) {
        const left = Math.max(0, state.next - ctx.currentTime);
        clearInterval(musicTimer);
        musicTimer = null;
        setTimeout(() => {
          if (musicState === state) {
            musicState = null;
            if (onEnd) onEnd();
          }
        }, left * 1000);
        return;
      }
      tr.play(state.bar, state.next - ctx.currentTime, beat);
      state.bar++;
      state.next += barLen;
    }
  };
  tick();
  musicTimer = setInterval(tick, 150);
}

export function musicPlaying() {
  return musicState ? musicState.name : null;
}

