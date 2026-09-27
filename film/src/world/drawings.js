// Procedural engineering drawings (2D polylines) for the lineage corridor.
// Each returns [{pts:[[x,y],...], w?:number}] in metres, roughly centred on the origin.

const circle = (cx, cy, r, n = 64, a0 = 0, a1 = Math.PI * 2) => {
  const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p;
};
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

// Barrel-type centrifugal compressor, longitudinal section (the Nuovo Pignone specialty).
export function centrifugalSection() {
  const L = [];
  const W = 5.2, H = 1.5;
  // casing with rounded heads
  L.push({ pts: [[-W / 2 + 0.4, H], [W / 2 - 0.4, H], ...circle(W / 2 - 0.4, 0, H, 24, Math.PI / 2, -Math.PI / 2).slice(1), [-W / 2 + 0.4, -H], ...circle(-W / 2 + 0.4, 0, H, 24, -Math.PI / 2, -Math.PI * 1.5).slice(1)] });
  L.push({ pts: [[-W / 2 + 0.55, H - 0.18], [W / 2 - 0.55, H - 0.18]] }, { pts: [[-W / 2 + 0.55, -H + 0.18], [W / 2 - 0.55, -H + 0.18]] });
  // shaft
  L.push({ pts: [[-W / 2 - 0.9, 0.16], [W / 2 + 0.9, 0.16]] }, { pts: [[-W / 2 - 0.9, -0.16], [W / 2 + 0.9, -0.16]] });
  L.push({ pts: [[-W / 2 - 1.1, 0], [W / 2 + 1.1, 0]] });
  // impellers: disk + cover + blade channel, both halves
  for (let i = 0; i < 6; i++) {
    const x = -1.9 + i * 0.72;
    for (const s of [1, -1]) {
      L.push({ pts: [[x - 0.12, s * 0.2], [x - 0.12, s * 0.55], [x + 0.02, s * 1.0], [x + 0.08, s * 1.12]] });
      L.push({ pts: [[x + 0.18, s * 0.22], [x + 0.18, s * 0.42], [x + 0.26, s * 0.75], [x + 0.28, s * 1.1]] });
      L.push({ pts: [[x - 0.12, s * 0.55], [x + 0.18, s * 0.42]] });
      // return channel / diaphragm
      L.push({ pts: [[x + 0.08, s * 1.12], [x + 0.08, s * 1.25], [x + 0.46, s * 1.25], [x + 0.46, s * 0.6], [x + 0.36, s * 0.45]] });
    }
  }
  // nozzles
  L.push({ pts: [[-2.2, H], [-2.2, H + 1.0], [-1.4, H + 1.0], [-1.4, H]] }, { pts: [[1.6, H], [1.6, H + 1.0], [2.4, H + 1.0], [2.4, H]] });
  L.push({ pts: [[-2.35, H + 1.0], [-1.25, H + 1.0]] }, { pts: [[1.45, H + 1.0], [2.55, H + 1.0]] });
  // bearings & seals
  for (const x of [-W / 2 - 0.5, W / 2 + 0.5]) L.push({ pts: rect(x - 0.25, -0.45, x + 0.25, 0.45) });
  // dimension line
  L.push({ pts: [[-W / 2 - 0.4, -H - 0.6], [W / 2 + 0.4, -H - 0.6]], dim: true });
  L.push({ pts: [[-W / 2 - 0.4, -H - 0.45], [-W / 2 - 0.4, -H - 0.75]], dim: true }, { pts: [[W / 2 + 0.4, -H - 0.45], [W / 2 + 0.4, -H - 0.75]], dim: true });
  return L;
}

// Impeller seen from the front: backswept blades.
export function impellerFront(R = 1.45, n = 15) {
  const L = [];
  L.push({ pts: circle(0, 0, R, 128) }, { pts: circle(0, 0, R * 0.34, 64) }, { pts: circle(0, 0, R * 0.12, 32) });
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; const r = R * (0.34 + 0.64 * t); const a = a0 + 0.9 * Math.pow(t, 1.3); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    L.push({ pts });
  }
  return L;
}

// Heavy-duty two-shaft gas turbine, side elevation with part section (the Frame 5/2 generation).
export function heavyDutyGT() {
  const L = [];
  // inlet plenum
  L.push({ pts: rect(-4.6, -1.6, -3.6, 2.2) });
  L.push({ pts: [[-3.6, 1.2], [-3.2, 1.05], [-3.2, -1.05], [-3.6, -1.2]] });
  // compressor casing (tapered) with 16 stage ticks
  L.push({ pts: [[-3.2, 1.05], [-0.8, 0.8], [-0.8, -0.8], [-3.2, -1.05]] });
  for (let i = 0; i < 16; i++) { const x = -3.05 + i * 0.145; const r = 1.0 - i * 0.015; L.push({ pts: [[x, r - 0.05], [x, r - 0.32]] }, { pts: [[x, -r + 0.05], [x, -r + 0.32]] }); }
  // combustion cans (can-annular), three visible, angled
  for (const [y, s] of [[0.95, 1], [0.0, 0], [-0.95, -1]]) {
    const cx = -0.1, len = 1.5, rr = 0.26;
    const ang = s * 0.25;
    const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    const nx = -Math.sin(ang) * rr, ny = Math.cos(ang) * rr;
    L.push({ pts: [[cx - dx + nx, y - dy + ny], [cx + dx + nx, y + dy + ny], [cx + dx - nx, y + dy - ny], [cx - dx - nx, y - dy - ny], [cx - dx + nx, y - dy + ny]] });
  }
  // turbine casing & exhaust
  L.push({ pts: [[0.7, 0.95], [2.0, 1.1], [2.0, -1.1], [0.7, -0.95]] });
  for (let i = 0; i < 2; i++) { const x = 0.95 + i * 0.35; L.push({ pts: [[x, 0.3], [x, 0.95]] }, { pts: [[x, -0.3], [x, -0.95]] }); }
  for (let i = 0; i < 2; i++) { const x = 1.55 + i * 0.3; L.push({ pts: [[x, 0.35], [x, 1.05]] }, { pts: [[x, -0.35], [x, -1.05]] }); }
  L.push({ pts: rect(2.0, -1.8, 3.4, 2.6) });
  L.push({ pts: [[2.0, 2.0], [3.4, 2.0]] });
  // shafts: gas generator and free power turbine
  L.push({ pts: [[-4.6, 0.12], [1.3, 0.12]] }, { pts: [[-4.6, -0.12], [1.3, -0.12]] });
  L.push({ pts: [[1.45, 0.09], [4.6, 0.09]] }, { pts: [[1.45, -0.09], [4.6, -0.09]] });
  L.push({ pts: [[-4.9, 0], [4.9, 0]] });
  // base
  L.push({ pts: [[-4.8, -2.0], [4.8, -2.0]] }, { pts: [[-4.8, -2.25], [4.8, -2.25]] });
  return L;
}

// A simple wordmark-free "company badge" frame for eras.
export function eraFrame(w = 3.2, h = 1.2) { return [{ pts: rect(-w / 2, -h / 2, w / 2, h / 2) }]; }
