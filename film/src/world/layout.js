// The Permian field: a deterministic layout shared by every shot set in West Texas.
// Units are metres. +x east, -z north, y up.
import { mulberry32 } from '../engine/util.js';

// --- CPU terrain height (the Delaware Basin is nearly flat: a few metres of swell)
function h2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y, o = 4) { let v = 0, a = 0.5; for (let i = 0; i < o; i++) { v += a * vn(x, y); x = x * 2.03 + 11.3; y = y * 2.03 + 7.1; a *= 0.5; } return v; }

export const PADS = [];      // {x, z, w, d, rot, kind}
export const ROADS = [];     // polylines [[x,z],...], width
export const WELLS = [];     // {x, z, pad, pump:boolean}
export const FLARES = [];    // {x, z, h, scale}
export const POLES = [];     // grid distribution line
export const GATHER = [];    // gas gathering lines (polylines)

export const CDP = { x: 0, z: 0, w: 170, d: 115, rot: 0, kind: 'cdp' };
export const ISLAND = { x: -560, z: 330, w: 210, d: 120, rot: 0, kind: 'island' };
export const FRAC = { x: 1480, z: -760, w: 150, d: 110, rot: 0, kind: 'frac' };
// A small well pad near the facility: foreground pumpjacks for the night cold open.
export const HEROPAD = { x: -205, z: 262, w: 70, d: 46, rot: 0, kind: 'well' };
// Regions where cameras get close: shrubs there are built with more detail.
export const FOCUS = [[-235, 300, 420], [-560, 330, 380], [40, -20, 260], [-420, 560, 300]];

export function padFlatten(x, z) {
  // 0 = natural ground, 1 = on a pad (flattened)
  let m = 0;
  for (const p of PADS) {
    const dx = Math.abs(x - p.x) - p.w / 2, dz = Math.abs(z - p.z) - p.d / 2;
    const d = Math.max(dx, dz);
    if (d < 25) m = Math.max(m, 1 - Math.max(0, d) / 25);
  }
  return m;
}

export function terrainHeight(x, z) {
  let h = (fbm(x / 1400, z / 1400, 3) - 0.5) * 5.0 + (fbm(x / 220 + 3, z / 220 + 1, 3) - 0.5) * 0.7 + (vn(x / 25, z / 25) - 0.5) * 0.12;
  // gentle bowl toward the far west for a sense of basin
  return h;
}

export function groundY(x, z) {
  const h = terrainHeight(x, z);
  return h;
}

// Build the layout once.
(function build() {
  const rnd = mulberry32(1842);
  PADS.push(CDP, ISLAND, FRAC, HEROPAD);
  for (let i = 0; i < 2; i++) WELLS.push({ x: HEROPAD.x - 14 + i * 28, z: HEROPAD.z + 4, pad: HEROPAD, pump: true, phase: 0.6 + i * 2.1, speed: 0.62 + i * 0.1, hero: true });
  ROADS.push({ pts: [[HEROPAD.x, HEROPAD.z], [HEROPAD.x, 0.5 * 1609.34]], w: 7, kind: 'lease' });
  const mile = 1609.34;
  // Section-line roads (straight, caliche) forming a mile grid
  const lines = [-1.5, -0.5, 0.5, 1.5];
  for (const k of lines) {
    ROADS.push({ pts: [[k * mile, -3.2 * mile], [k * mile, 3.2 * mile]], w: 9, kind: 'section' });
    ROADS.push({ pts: [[-3.2 * mile, k * mile], [3.2 * mile, k * mile]], w: 9, kind: 'section' });
  }
  // A paved county road far to the south, running east-west
  ROADS.push({ pts: [[-14000, 2.5 * mile], [14000, 2.5 * mile]], w: 11, kind: 'asphalt' });
  // Well pads scattered in each section, connected by spur roads to the nearest section road
  const cells = [];
  for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) cells.push([i, j]);
  for (const [i, j] of cells) {
    const cx = (i + 0.5) * mile, cz = (j + 0.5) * mile;
    const n = 1 + Math.floor(rnd() * 2.2);
    for (let k = 0; k < n; k++) {
      const x = cx + (rnd() - 0.5) * mile * 0.62, z = cz + (rnd() - 0.5) * mile * 0.62;
      // keep clear of the special pads
      if ([CDP, ISLAND, FRAC, HEROPAD].some((p) => Math.hypot(p.x - x, p.z - z) < 420)) continue;
      const pad = { x, z, w: 95 + rnd() * 35, d: 70 + rnd() * 25, rot: 0, kind: 'well' };
      PADS.push(pad);
      // spur road: go straight north/south to the nearest east-west section road, or east/west
      const nearZ = (Math.round(z / mile - 0.5) + 0.5) * mile;
      const nearX = (Math.round(x / mile - 0.5) + 0.5) * mile;
      if (Math.abs(nearZ - z) < Math.abs(nearX - x)) ROADS.push({ pts: [[x, z], [x, nearZ]], w: 7, kind: 'lease' });
      else ROADS.push({ pts: [[x, z], [nearX, z]], w: 7, kind: 'lease' });
      // wells on the pad, in a row
      const nw = 2 + Math.floor(rnd() * 3);
      for (let wi = 0; wi < nw; wi++) {
        const wx = x - pad.w * 0.3 + (wi / Math.max(1, nw - 1)) * pad.w * 0.6;
        WELLS.push({ x: wx, z: z - pad.d * 0.12, pad, pump: rnd() < 0.8, phase: rnd() * Math.PI * 2, speed: 0.55 + rnd() * 0.35 });
      }
      // gathering line from pad to the CDP (dog-leg along section lines)
      GATHER.push([[x, z], [x, nearZ], [0, nearZ], [0, 0]]);
    }
  }
  // Spur roads for special pads
  ROADS.push({ pts: [[CDP.x, CDP.z], [CDP.x, 0.5 * mile]], w: 9, kind: 'lease' });
  ROADS.push({ pts: [[ISLAND.x, ISLAND.z], [ISLAND.x, 0.5 * mile]], w: 9, kind: 'lease' });
  ROADS.push({ pts: [[FRAC.x, FRAC.z], [FRAC.x, -0.5 * mile]], w: 9, kind: 'lease' });
  // The CDP flare and a few other flares in the field
  FLARES.push({ x: CDP.x + 62, z: CDP.z - 42, h: 22, scale: 1.0, hero: true });
  // Grid distribution line: comes in from the far west along the section road at z = 0.5 mile, and stops short.
  const zLine = 0.5 * mile + 14;
  for (let x = -16000; x <= -1180; x += 95) POLES.push({ x, z: zLine });
})();

export const GRID_END = POLES[POLES.length - 1];
