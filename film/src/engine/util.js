// Small, dependency-free helpers shared by every shot.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const range = (t, a, b) => clamp((t - a) / (b - a));

export const ease = {
  inCubic: (t) => { t = clamp(t); return t * t * t; },
  outCubic: (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); },
  inOutCubic: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  inOutSine: (t) => { t = clamp(t); return -(Math.cos(Math.PI * t) - 1) / 2; },
  outExpo: (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  inExpo: (t) => { t = clamp(t); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); },
  inOutQuint: (t) => { t = clamp(t); return t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2; },
  outQuint: (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 5); },
  inOutExpo: (t) => {
    t = clamp(t);
    if (t === 0 || t === 1) return t;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  outBack: (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// Envelope that rises over [a, a+fin], holds, and falls over [b-fout, b].
export function envelope(t, a, b, fin = 0.5, fout = 0.5) {
  if (t <= a || t >= b) return 0;
  const up = fin > 0 ? smooth((t - a) / fin) : 1;
  const down = fout > 0 ? smooth((b - t) / fout) : 1;
  return Math.min(up, down);
}

// Deterministic PRNG so every render of every frame is identical.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Smooth 1D value noise for camera shake / flicker on the CPU side.
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}
export function fbm1(x, oct = 3) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise1(x * f + i * 17.3); f *= 2.03; a *= 0.5; }
  return v;
}

// Halton sequence for sub-pixel jitter in temporal supersampling.
export function halton(index, base) {
  let f = 1, r = 0, i = index;
  while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); }
  return r;
}

// Catmull-Rom path through THREE.Vector3-like points, with arc-length-ish parameterisation.
export class Path {
  constructor(points, THREE) {
    this.curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  }
  at(t, target) { return this.curve.getPointAt(clamp(t), target); }
}

// Angle (radians) of a spinning part whose rate ramps smoothly from r0 to r1 rev/s between times a and b.
// Closed-form, so any frame can be evaluated independently.
export function rampAngle(t, r0, r1, a, b) {
  const F = (u) => u * u * u - (u * u * u * u) / 2;
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  const rev = r0 * t + (r1 - r0) * ((b - a) * F(u) + Math.max(0, t - b));
  return rev * Math.PI * 2;
}

// Keyframed camera: smooth Catmull-Rom through positions/targets, index-uniform timing, per-key easing.
// keys: [{ t, pos:[x,y,z], look:[x,y,z], fov, ease }]
export function keyed(THREE, keys) {
  const P = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
  const L = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal');
  const n = keys.length;
  return (t, outPos, outLook) => {
    let i = 0;
    while (i < n - 2 && t >= keys[i + 1].t) i++;
    const u = clamp((t - keys[i].t) / (keys[i + 1].t - keys[i].t));
    const e = keys[i + 1].ease === false ? u : ease.inOutSine(u);
    const s = (i + e) / (n - 1);
    P.getPoint(Math.min(1, s), outPos); L.getPoint(Math.min(1, s), outLook);
    return lerp(keys[i].fov ?? 30, keys[i + 1].fov ?? 30, e);
  };
}
