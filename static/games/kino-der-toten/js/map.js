// Kino der Toten, laid flat for a top-down camera.
//
// Coordinates below are the original map's units (1 u = 1 inch; +X east, +Y north
// towards the stage) taken from the map's entity data: door, perk, box, wall-buy,
// window and trap positions are where they are in the 2010 map. Kino stacks floors
// (the Lobby balcony over the theatre doors, the Back Room over the yard, the Foyer
// gallery over the bar), so those few places are unfolded side by side; every room,
// connection, price and fixture is kept. Heights are cosmetic ramps and ledges.

import { Grid, CELL } from './grid.js';

export const UNIT = 0.018; // metres per map unit: matches Black Ops traversal times at League move speed
const OX = -2100, OY = 2250; // world origin in map units (north-west corner)
export const toX = (X) => (X - OX) * UNIT;
export const toZ = (Y) => (OY - Y) * UNIT;
export const P = (X, Y) => ({ x: toX(X), z: toZ(Y) });
const W_U = 4400, H_U = 5100; // map units covered by the grid

// Rooms: rects are [X0, Y0, X1, Y1] in map units. Later rooms overwrite earlier ones.
// ramp: height interpolated along an axis; h: flat height in metres.
export const ROOMS = [
  { id: 'lobby', name: 'Lobby', zone: 'lobby', rects: [[-402, -1501, 554, -816]], floor: 'tiles', h: 0 },
  { id: 'mezz', name: 'Lobby Balcony', zone: 'lobby', rects: [[-578, -816, 580, -512]], floor: 'carpet', h: 0.6 },
  { id: 'theater', name: 'Theater', zone: 'theater', rects: [[-768, -512, -192, -188], [192, -512, 768, -188], [-768, -188, 768, 930]], floor: 'carpet', ramp: { axis: 'Y', a: -512, b: 930, h0: 0.05, h1: -0.85 } },
  { id: 'vest', name: 'Theater Entrance', zone: 'theater', rects: [[-192, -512, 192, -188]], floor: 'carpet', ramp: { axis: 'Y', a: -512, b: -188, h0: 0.6, h1: 0.05 } },
  { id: 'stage', name: 'Stage', zone: 'theater', rects: [[-517, 930, 747, 1225]], floor: 'wood', h: 0 },
  { id: 'backstage', name: 'Backstage', zone: 'stage', rects: [[-517, 1225, 747, 1907], [-1154, 1220, -517, 1648]], floor: 'wood', h: 0 },
  { id: 'backroom', name: 'Back Room', zone: 'westBalcony', rects: [[-1763, 1159, -1160, 1640]], floor: 'concrete', h: 1.2 },
  { id: 'yard', name: 'Yard', zone: 'westBalcony', rects: [[-1648, 813, -1327, 1159]], floor: 'cobble', h: 0 },
  { id: 'alley', name: 'Alley', zone: 'alley', rects: [[-1764, -593, -1352, 813], [-1352, -317, -1126, 511]], floor: 'cobble', h: 0, outdoor: true },
  { id: 'lowerHall', name: 'Lower Hall', zone: 'crematorium', rects: [[-1352, -963, -578, -317], [-760, -1016, -600, -963]], floor: 'concrete', h: 0 },
  { id: 'upperW', name: 'Upper Hall', zone: 'upper', rects: [[580, -1099, 964, -319], [600, -1145, 720, -1099]], floor: 'carpet', h: 0.6 },
  { id: 'upperE', name: 'Upper Hall', zone: 'upper', rects: [[964, -1099, 1680, -319]], floor: 'carpet', h: 0.6 },
  { id: 'stairwell', name: 'Stairwell', zone: 'dining', rects: [[1325, -319, 1698, -32]], floor: 'wood', ramp: { axis: 'Y', a: -319, b: -32, h0: 0.6, h1: 0 } },
  { id: 'foyer', name: 'Foyer', zone: 'dining', rects: [[1000, -32, 1893, 905]], floor: 'tiles', h: 0 },
  { id: 'gallery', name: 'Foyer Gallery', zone: 'dining', rects: [[776, -32, 1000, 620]], floor: 'wood', h: 1.0 },
  { id: 'dressing', name: 'Dressing Room', zone: 'dressing', rects: [[1016, 905, 1540, 1664]], floor: 'wood', h: 0 },
  { id: 'dressHall', name: 'Dressing Room', zone: 'dressing', rects: [[800, 855, 1016, 1300]], floor: 'wood', h: 0 },
  { id: 'dressPass', name: 'Dressing Room', zone: 'dressing', rects: [[760, 1439, 1016, 1664]], floor: 'wood', h: 0 },
  // stairs and steps (walled on the sides, open at both ends)
  { id: 'stairL', name: 'Lobby', zone: 'lobby', rects: [[-340, -1010, -220, -816]], floor: 'stairs', ramp: { axis: 'Y', a: -1010, b: -816, h0: 0, h1: 0.6 }, stairs: 'Y' },
  { id: 'stairR', name: 'Lobby', zone: 'lobby', rects: [[220, -1010, 360, -816]], floor: 'stairs', ramp: { axis: 'Y', a: -1010, b: -816, h0: 0, h1: 0.6 }, stairs: 'Y' },
  { id: 'stepL', name: 'Theater', zone: 'theater', rects: [[-430, 850, -290, 930]], floor: 'stairs', ramp: { axis: 'Y', a: 850, b: 930, h0: -0.82, h1: 0 }, stairs: 'Y' },
  { id: 'stepR', name: 'Theater', zone: 'theater', rects: [[290, 850, 420, 930]], floor: 'stairs', ramp: { axis: 'Y', a: 850, b: 930, h0: -0.82, h1: 0 }, stairs: 'Y' },
  { id: 'wingStairs', name: 'Backstage', zone: 'stage', rects: [[-1154, 1380, -880, 1480]], floor: 'stairs', ramp: { axis: 'X', a: -1154, b: -880, h0: 1.2, h1: 0 }, stairs: 'X' },
  { id: 'yardStairs', name: 'Yard', zone: 'westBalcony', rects: [[-1763, 813, -1648, 1159]], floor: 'stairs', ramp: { axis: 'Y', a: 880, b: 1159, h0: 0, h1: 1.2 }, stairs: 'Y' },
  { id: 'galleryStairs', name: 'Foyer', zone: 'dining', rects: [[1000, 470, 1240, 620]], floor: 'stairs', ramp: { axis: 'X', a: 1000, b: 1240, h0: 1.0, h1: 0 }, stairs: 'X' },
  // teleport-only rooms, far from everything
  { id: 'pap', name: 'Projector Room', zone: 'pap', rects: [[-184, -2250, 184, -1950]], floor: 'wood', h: 0, isolated: true },
  { id: 'eeBed', name: "Samantha's Room", zone: 'ee', rects: [[-1400, -2750, -1080, -2480]], floor: 'wood', h: 0, isolated: true },
  { id: 'eeRuin', name: "Samantha's Room?", zone: 'ee', rects: [[-900, -2750, -580, -2480]], floor: 'wood', h: 0, isolated: true },
  { id: 'eeDentist', name: 'The Dentist', zone: 'ee', rects: [[580, -2750, 900, -2480]], floor: 'tiles', h: 0, isolated: true },
  { id: 'eePentagon', name: 'Conference Room', zone: 'ee', rects: [[1080, -2750, 1400, -2480]], floor: 'carpet', h: 0, isolated: true },
];

// Rooms whose shared edge is a ledge or balustrade (blocks, but drawn low).
export const LOW_EDGES = [
  ['theater', 'stage'], ['theater', 'stepL'], ['theater', 'stepR'], ['stage', 'stepL'], ['stage', 'stepR'],
  ['lobby', 'mezz'], ['lobby', 'stairL'], ['lobby', 'stairR'],
  ['foyer', 'gallery'], ['foyer', 'galleryStairs'], ['gallery', 'galleryStairs'],
  ['backstage', 'wingStairs'], ['yard', 'yardStairs'],
];

// Openings carve through the wall between two rooms. kind: open | door | power | curtain
export const OPENINGS = [
  // stairs (always open)
  { kind: 'open', rect: [-340, -1040, -220, -990] }, // stairL bottom
  { kind: 'open', rect: [-340, -840, -220, -790] }, // stairL top
  { kind: 'open', rect: [220, -1040, 360, -990] },
  { kind: 'open', rect: [220, -840, 360, -790] },
  { kind: 'open', rect: [-430, 820, -290, 870] }, // stepL bottom
  { kind: 'open', rect: [-430, 910, -290, 960] }, // stepL top
  { kind: 'open', rect: [290, 820, 420, 870] },
  { kind: 'open', rect: [290, 910, 420, 960] },
  { kind: 'open', rect: [-910, 1380, -850, 1480] }, // wing stairs bottom (east end)
  { kind: 'open', rect: [-1680, 813, -1620, 900] }, // yard -> yard stairs (bottom)
  { kind: 'open', rect: [-1763, 1130, -1648, 1190] }, // yard stairs top -> back room
  { kind: 'open', rect: [970, 470, 1030, 620] }, // gallery -> gallery stairs
  { kind: 'open', rect: [1210, 470, 1270, 620] }, // gallery stairs -> foyer
  { kind: 'open', rect: [990, 1150, 1045, 1300] }, // dressing hallway -> dressing room
  // trap doorways (always open, the traps sit in them)
  { kind: 'open', rect: [935, -825, 995, -712] }, // Upper Hall split (trap e2)
  { kind: 'open', rect: [990, 1439, 1045, 1619] }, // dressing passage (trap e4)
  // power doors and the curtain
  { kind: 'power', id: 'pdS', rect: [-90, -545, 90, -480], label: 'Theater doors' },
  { kind: 'power', id: 'pdN', rect: [-90, -220, 90, -155], label: 'Theater doors' },
  { kind: 'curtain', id: 'curtain', rect: [-400, 1195, 640, 1255] },
  // bought doors: cost from the map's zombie_cost values
  { kind: 'door', id: 'd1', cost: 750, rect: [-610, -700, -545, -582], to: 'Lower Hall', style: 'double', axis: 'X' },
  { kind: 'door', id: 'd2', cost: 750, rect: [548, -700, 612, -582], to: 'Upper Hall', style: 'double', axis: 'X' },
  { kind: 'door', id: 'd3', cost: 1000, rect: [-1384, -444, -1320, -324], to: 'Alley', style: 'metal', axis: 'X' },
  { kind: 'door', id: 'd4', cost: 1000, rect: [1349, -351, 1469, -287], to: 'Foyer', style: 'double', axis: 'Y', also: [1349, -64, 1469, 0] },
  { kind: 'door', id: 'd5', cost: 1250, rect: [-1607, 781, -1487, 845], to: 'Back Room', style: 'gate', axis: 'Y' },
  { kind: 'door', id: 'd6', cost: 1250, rect: [-1192, 1380, -1122, 1480], to: 'Stage', style: 'metal', axis: 'X' },
  { kind: 'door', id: 'd7', cost: 1250, rect: [1384, 873, 1504, 937], to: 'Dressing Room', style: 'double', axis: 'Y' },
  { kind: 'door', id: 'd8', cost: 1250, rect: [728, 1479, 792, 1599], to: 'Stage', style: 'double', axis: 'X' },
];

// The curtain spans the middle of the curtain line; proscenium walls stay either side.

// Barrier windows: 22, as on the map (a few nudged onto a wall that still faces outside).
// side: which wall of the room the window is in.
export const WINDOWS = [
  { room: 'lobby', X: -402, Y: -1402, side: 'W' },
  { room: 'lobby', X: 160, Y: -1501, side: 'S' },
  { room: 'lobby', X: -402, Y: -900, side: 'W' },
  { room: 'lobby', X: 554, Y: -1420, side: 'E' },
  { room: 'upperW', X: 660, Y: -1145, side: 'S' },
  { room: 'upperE', X: 1680, Y: -645, side: 'E' },
  { room: 'gallery', X: 885, Y: 620, side: 'N' },
  { room: 'foyer', X: 1893, Y: 576, side: 'E' },
  { room: 'foyer', X: 1085, Y: -32, side: 'S' },
  { room: 'dressHall', X: 905, Y: 855, side: 'S' },
  { room: 'dressing', X: 1540, Y: 1296, side: 'E' },
  { room: 'backstage', X: 418, Y: 1907, side: 'N' },
  { room: 'backstage', X: -772, Y: 1648, side: 'N' },
  { room: 'theater', X: -768, Y: 831, side: 'W' },
  { room: 'theater', X: 768, Y: 760, side: 'E' },
  { room: 'backroom', X: -1300, Y: 1640, side: 'N' },
  { room: 'backroom', X: -1763, Y: 1400, side: 'W' },
  { room: 'yard', X: -1327, Y: 1000, side: 'E' },
  { room: 'alley', X: -1658, Y: -593, side: 'S' },
  { room: 'alley', X: -1764, Y: 547, side: 'W' },
  { room: 'lowerHall', X: -680, Y: -1016, side: 'S' },
  { room: 'lowerHall', X: -961, Y: -317, side: 'N' },
];

// Fixtures. face: direction the front of the object points (N/S/E/W).
export const PERK_SPOTS = {
  revive: { X: 530, Y: -1261, face: 'W' },
  jugg: { X: -328, Y: -488, face: 'N' },
  speed: { X: 1240, Y: -8, face: 'N' },
  tap: { X: -1740, Y: -375, face: 'E' },
};

// Mystery Box spots, clockwise from the start chest as the map lists them.
export const BOX_SPOTS = [
  { id: 'start_chest', X: 915, Y: -600, face: 'W', name: 'Upper Hall' },
  { id: 'foyer_chest', X: -1, Y: -790, face: 'N', name: 'Lobby Balcony', noStart: true },
  { id: 'crematorium_chest', X: -1325, Y: -635, face: 'E', name: 'Lower Hall' },
  { id: 'alleyway_chest', X: -1737, Y: 226, face: 'E', name: 'Alley' },
  { id: 'control_chest', X: -1500, Y: 1612, face: 'S', name: 'Back Room' },
  { id: 'stage_chest', X: 1, Y: 1880, face: 'S', name: 'Backstage' },
  { id: 'dressing_chest', X: 1512, Y: 1450, face: 'W', name: 'Dressing Room' },
  { id: 'dining_chest', X: 1657, Y: 878, face: 'S', name: 'Foyer' },
  { id: 'theater_chest', X: 49, Y: 136, face: 'S', name: 'Theater' },
];

// Wall chalk: Kino's wall guns at their prices, sold as League items here.
// item: per-champion item id (or one id for everyone).
export const WALL_BUYS = [
  { gun: 'Olympia', X: -402, Y: -1265, face: 'E', cost: 500, item: { yi: 'doransBlade', katarina: 'doransRing', amumu: 'doransShield' } },
  { gun: 'M14', X: 301, Y: -512, face: 'S', cost: 500, item: 'boots' },
  { gun: 'PM63', X: 813, Y: -319, face: 'S', cost: 1000, item: 'kindlegem' },
  { gun: 'MPL', X: -842, Y: -317, face: 'S', cost: 1000, item: 'recurve' },
  { gun: 'MP40', X: 1893, Y: 423, face: 'W', cost: 1000, item: 'bami' },
  { gun: 'MP5K', X: 1016, Y: 1104, face: 'W', cost: 1000, item: 'sheen' },
  { gun: 'AK-74u', X: -1126, Y: 303, face: 'W', cost: 1200, item: 'tiamat' },
  { gun: 'M16', X: -630, Y: 1220, face: 'N', cost: 1200, item: 'phage' },
  { gun: 'Stakeout', X: 776, Y: 83, face: 'E', cost: 1500, item: { yi: 'bfsword', katarina: 'rod', amumu: 'rod' } },
  { gun: 'Claymores', X: -573, Y: 1648, face: 'S', cost: 1000, item: 'shrooms' },
  { gun: 'Bowie Knife', X: -192, Y: -361, face: 'W', cost: 3000, item: 'bowie' },
  { gun: 'Frag Grenades', X: -184, Y: -2100, face: 'E', cost: 250, item: { yi: 'elixirWrath', katarina: 'elixirSorcery', amumu: 'elixirIron' } },
];

// Traps: band = the cells zombies die in; switches = where you pull them.
export const TRAPS = [
  { id: 'e1', kind: 'electric', band: [-192, -380, 192, -330], switches: [[110, -512, 'S'], [-110, -188, 'N']] },
  { id: 'e2', kind: 'electric', band: [935, -825, 995, -712], switches: [[920, -887, 'N'], [1010, -707, 'S']] },
  { id: 'e3', kind: 'electric', band: [-1763, 1290, -1160, 1340], switches: [[-1763, 1250, 'E'], [-1763, 1420, 'E']] },
  { id: 'e4', kind: 'electric', band: [990, 1439, 1045, 1619], switches: [[1290, 1664, 'S'], [940, 1664, 'S']] },
  { id: 'f1', kind: 'fire', band: [-1010, -963, -900, -317], switches: [[-834, -963, 'N'], [-1077, -317, 'S']] },
];

export const TURRETS = [
  { X: 0, Y: 975, face: 'S' },
  { X: 1520, Y: 424, face: 'S' },
];

export const POWER_SWITCH = { X: -460, Y: 1225, face: 'N' };
export const TELEPORTER = { X: -304, Y: 1114 };
export const MAINFRAME = { X: 2, Y: -1266 };
export const SPAWNS = [[-80, -1200], [80, -1200], [-80, -1330], [80, -1330]];
export const PAP = { X: 0, Y: -2232, face: 'N' };
export const PAP_ARRIVE = [[-110, -2180], [-40, -2180], [40, -2180], [110, -2180]];
export const PROJECTOR = { X: 0, Y: -1968 };
export const EE_ROOMS = ['eeBed', 'eeRuin', 'eeDentist', 'eePentagon'];
// Zombies wait here while you're away (theatre rear-centre and front-centre).
export const POIS = [[-1, -107], [3, 659]];
export const METEORS = [
  { X: 430, Y: -1030, room: 'lobby' },
  { X: 829, Y: 1132, room: 'dressHall' },
  { X: -1700, Y: 1560, room: 'backroom' },
];
export const CHANDELIER = { X: 10, Y: 449 };
export const SCREEN = { X: 60, Y: 1240, width: 650 };

// Zombie spawners beyond the windows.
export const RISERS = [[-606, -239], [-574, -447], [390, -395], [670, -339], [-640, 197], [-640, 532], [444, 360]];
export const DROPS = [
  { zone: 'upper', X: 1300, Y: -760 },
  { zone: 'upper', X: 1450, Y: -520 },
  { zone: 'alley', X: -1560, Y: -150 },
  { zone: 'alley', X: -1560, Y: 420 },
  { zone: 'alley', X: -1240, Y: 100 },
  { zone: 'dressing', X: 1300, Y: 1480 },
];
// Nova 6 crawler ceiling holes (Lobby 4, Theater 5, Stage 1, Foyer 2)
export const QUAD_HOLES = [
  { zone: 'lobby', X: -250, Y: -1350 }, { zone: 'lobby', X: 300, Y: -1350 }, { zone: 'lobby', X: -250, Y: -1080 }, { zone: 'lobby', X: 300, Y: -1080 },
  { zone: 'theater', X: -620, Y: 0 }, { zone: 'theater', X: 620, Y: 0 }, { zone: 'theater', X: -620, Y: 650 }, { zone: 'theater', X: 620, Y: 650 }, { zone: 'theater', X: 0, Y: 760 },
  { zone: 'stage', X: 100, Y: 1500 },
  { zone: 'dining', X: 1550, Y: 500 }, { zone: 'dining', X: 1750, Y: 250 },
];
export const FOYER_ROOF_TRIGGER = [1392, 368, 1888, 760];

// Seat blocks in the auditorium (solid, with a cross aisle).
export const SEAT_BLOCKS = [
  [-540, -100, -150, 290], [150, -100, 540, 290],
  [-540, 420, -150, 780], [150, 420, 540, 780],
];

// Zone adjacency (which zone each door joins), for spawning.
export const ZONE_DOORS = [
  ['lobby', 'crematorium', 'd1'], ['lobby', 'upper', 'd2'], ['crematorium', 'alley', 'd3'], ['upper', 'dining', 'd4'],
  ['alley', 'westBalcony', 'd5'], ['westBalcony', 'stage', 'd6'], ['dining', 'dressing', 'd7'], ['dressing', 'stage', 'd8'],
  ['theater', 'lobby', 'power'], ['theater', 'stage', 'power'],
];

/** Build the walkable grid. Returns { grid, rooms, roomAt(x,z), doorCells, windows, ... } */
export function buildMap() {
  const w = Math.ceil((W_U * UNIT) / CELL);
  const h = Math.ceil((H_U * UNIT) / CELL);
  const grid = new Grid(w, h);
  const n = w * h;
  const room = new Int16Array(n).fill(-1);
  const wall = new Uint8Array(n); // 1 = wall cell inside a room's footprint
  const low = new Uint8Array(n); // 1 = wall drawn low (ledge / balustrade)
  const kindCell = new Int8Array(n).fill(-1); // opening index
  const zones = [];
  const zoneIdx = (z) => {
    let i = zones.indexOf(z);
    if (i < 0) {
      zones.push(z);
      i = zones.length - 1;
    }
    return i;
  };
  const cellOf = (X, Y) => [Math.floor(toX(X) / CELL), Math.floor(toZ(Y) / CELL)];
  const forRect = (r, fn) => {
    const [X0, Y0, X1, Y1] = r;
    const cx0 = Math.max(0, Math.round(toX(X0) / CELL)), cx1 = Math.min(w, Math.round(toX(X1) / CELL));
    const cz0 = Math.max(0, Math.round(toZ(Y1) / CELL)), cz1 = Math.min(h, Math.round(toZ(Y0) / CELL));
    for (let cz = cz0; cz < cz1; cz++) for (let cx = cx0; cx < cx1; cx++) fn(cz * w + cx, cx, cz);
  };
  const area = ROOMS.map((r) => r.rects.reduce((s, q) => s + (q[2] - q[0]) * (q[3] - q[1]), 0));
  const heightOf = (ri, cx, cz) => {
    const r = ROOMS[ri];
    if (!r.ramp) return r.h || 0;
    const X = (cx + 0.5) * CELL / UNIT + OX, Y = OY - (cz + 0.5) * CELL / UNIT;
    const v = r.ramp.axis === 'Y' ? Y : X;
    const t = Math.max(0, Math.min(1, (v - r.ramp.a) / (r.ramp.b - r.ramp.a)));
    return r.ramp.h0 + (r.ramp.h1 - r.ramp.h0) * t;
  };
  ROOMS.forEach((r, ri) => {
    const zi = zoneIdx(r.zone);
    for (const rect of r.rects) {
      forRect(rect, (i, cx, cz) => {
        room[i] = ri;
        grid.zone[i] = zi;
        grid.height[i] = heightOf(ri, cx, cz);
      });
    }
  });
  // walls where two rooms meet: the larger room gives up the cell
  const isLow = (a, b) => LOW_EDGES.some(([p, q]) => (ROOMS[a].id === p && ROOMS[b].id === q) || (ROOMS[a].id === q && ROOMS[b].id === p));
  for (let cz = 0; cz < h; cz++) {
    for (let cx = 0; cx < w; cx++) {
      const i = cz * w + cx;
      const a = room[i];
      if (a < 0) continue;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
          const b = room[nz * w + nx];
          if (b < 0 || b === a) continue;
          if (area[a] > area[b] || (area[a] === area[b] && a < b)) {
            wall[i] = 1;
            if (isLow(a, b)) low[i] = 1;
          }
        }
      }
    }
  }
  // openings
  const doors = [];
  OPENINGS.forEach((o, oi) => {
    const rects = [o.rect].concat(o.also ? [o.also] : []);
    for (const r of rects) {
      forRect(r, (i) => {
        if (room[i] < 0) return;
        if (wall[i]) {
          wall[i] = 0;
          low[i] = 0;
          kindCell[i] = oi;
          if (o.kind !== 'open') grid.door[i] = oi;
        }
      });
    }
    if (o.kind !== 'open') {
      const [X0, Y0, X1, Y1] = o.rect;
      doors.push({ ...o, index: oi, open: false, X: (X0 + X1) / 2, Y: (Y0 + Y1) / 2, x: toX((X0 + X1) / 2), z: toZ((Y0 + Y1) / 2), anim: 0 });
    }
  });
  // seat blocks are solid
  const seatCells = new Uint8Array(n);
  for (const r of SEAT_BLOCKS) forRect(r, (i) => (seatCells[i] = 1));
  // solid = void, walls, closed doors, seats
  for (let i = 0; i < n; i++) {
    grid.solid[i] = room[i] < 0 || wall[i] || seatCells[i] || grid.door[i] >= 0 ? 1 : 0;
  }
  // windows: mark the void/wall cells across the window opening
  const windows = WINDOWS.map((wd, wi) => {
    const r = ROOMS.find((q) => q.id === wd.room);
    const nrm = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[wd.side]; // outward in map units
    // inward normal in world space (z is flipped)
    const nx = -nrm[0], nz = nrm[1];
    const half = 46; // half width in map units (about 1.65 m wide)
    const p = P(wd.X, wd.Y);
    const tx = Math.abs(nz), tz = Math.abs(nx); // tangent along the wall
    const cells = [];
    for (let s = -half; s <= half; s += 10) {
      for (let d = -18; d <= 18; d += 6) {
        const X = wd.X + (nrm[1] !== 0 ? s : nrm[0] * d), Y = wd.Y + (nrm[0] !== 0 ? s : nrm[1] * d);
        const [cx, cz] = cellOf(X, Y);
        if (cx < 0 || cz < 0 || cx >= w || cz >= h) continue;
        const i = cz * w + cx;
        if (room[i] >= 0 && !wall[i]) continue; // keep the room floor
        if (!cells.includes(i)) cells.push(i);
      }
    }
    for (const i of cells) grid.win[i] = wi;
    const y = grid.heightAt(p.x + nx * 0.8, p.z + nz * 0.8);
    return {
      index: wi, room: r.id, zone: r.zone, X: wd.X, Y: wd.Y,
      x: p.x, z: p.z, y, nx, nz, tx, tz, // window centre, inward normal, tangent
      ix: p.x + nx * 0.85, iz: p.z + nz * 0.85, // inside landing point
      rx: p.x + nx * 1.1, rz: p.z + nz * 1.1, // where you stand to repair
      ox: 0, oz: 0, // outside spawn point (set below)
      boards: 6, queue: [], climbFree: 0, cells, repairT: 0,
    };
  });
  // outside spawn points: walk outward through empty cells, up to 3.2 m
  for (const wd of windows) {
    let d = 0.6;
    for (let t = 0.6; t <= 3.2; t += 0.1) {
      const x = wd.x - wd.nx * t, z = wd.z - wd.nz * t;
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      if (cx < 1 || cz < 1 || cx >= w - 1 || cz >= h - 1) break;
      if (room[cz * w + cx] >= 0) break;
      d = t;
    }
    d = Math.max(0.9, d - 0.35);
    wd.ox = wd.x - wd.nx * d;
    wd.oz = wd.z - wd.nz * d;
    wd.outDist = d;
  }
  grid.computeExtra();
  const roomAt = (x, z) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return null;
    let ri = room[cz * w + cx];
    return ri >= 0 ? ROOMS[ri] : null;
  };
  return { grid, room, wall, low, seatCells, kindCell, zones, zoneIdx, doors, windows, roomAt, w, h, heightOf, forRect, cellOf };
}

/** Open or close a door/power door/curtain in the grid. */
export function setDoor(map, door, open) {
  const { grid } = map;
  door.open = open;
  for (let i = 0; i < grid.door.length; i++) {
    if (grid.door[i] === door.index) grid.solid[i] = open ? 0 : 1;
  }
  grid.computeExtra();
}

/** Inward-facing yaw for a face letter (models face +Z locally). */
export function faceYaw(face) {
  // world directions: N = -z, S = +z, E = +x, W = -x
  return { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[face] ?? 0;
}
/** Unit vector in world space for a face letter. */
export function faceVec(face) {
  return { S: { x: 0, z: 1 }, N: { x: 0, z: -1 }, E: { x: 1, z: 0 }, W: { x: -1, z: 0 } }[face];
}
