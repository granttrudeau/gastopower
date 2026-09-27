// NovaLT16 gas turbine, built procedurally as a technical cutaway.
// Architecture per Baker Hughes literature: two-shaft; 12-stage axial compressor (IGV + first two stator rows variable),
// 19:1 pressure ratio; single annular DLN combustor with 39 premixers; 2-stage HP turbine; free 2-stage power turbine
// with a variable first-stage nozzle; power turbine output 7,800 rpm -> gearbox -> generator.
// Blade counts and exact radii are not published: the values below are plausible illustration, never labelled.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, BLACKBODY } from '../engine/glsl.js';
import { GlowLines } from '../world/lines.js';

// Kept angular range for cut solids (lathe phi). The removed wedge is the top-front quadrant (y>0, z>0).
export const PHI0 = 0, PHI_LEN = Math.PI * 1.5;

// Shared uniforms for all engine materials: uSweep reveals the solids by angle (the drawing revolving into metal),
// uGhost turns housings into x-ray outlines.
export const ENG = { uSweep: { value: 10.0 }, uGhost: { value: 0.0 }, uGhostColor: { value: new THREE.Color(0.1, 0.9, 0.7) } };
function engineMat(m, key, { ghostable = false } = {}) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    Object.assign(sh.uniforms, ENG);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEng;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 engP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          engP = instanceMatrix * engP;
        #endif
        vEng = (modelMatrix * engP).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEng; uniform float uSweep; uniform float uGhost; uniform vec3 uGhostColor;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float ph = atan(-vEng.y, vEng.z); if (ph < 0.0) ph += 6.2831853;
          // reveal grows from the phi = 3pi/2 plane (the drawing plane) back toward phi = 0
          float rev = 4.712389 - ph; if (rev < -0.05) rev += 6.2831853;
          if (rev > uSweep) discard;
        }`);
    if (ghostable) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          vec3 vdir = normalize(cameraPosition - vEng);
          float fr = pow(max(0.0, 1.0 - abs(dot(normalize(vNormal), normalize((viewMatrix * vec4(vdir, 0.0)).xyz)))), 2.5);
          float g2 = fr * fr;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uGhostColor * (0.03 + 0.9 * g2), uGhost);
          gl_FragColor.a = mix(gl_FragColor.a, 0.02 + 0.45 * g2, uGhost);
        }`);
    }
  };
  m.customProgramCacheKey = () => 'eng|' + key + (ghostable ? '|g' : '');
  if (ghostable) { m.userData.ghostable = true; }
  return m;
}

// --- gas-path radii as functions of axial position x (metres, inlet at -2.1, exhaust collector ~2.2)
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
export const X = { cIn: -2.1, cOut: -0.46, combIn: -0.3, combOut: 0.5, hpt0: 0.52, hpt1: 0.9, pt0: 1.05, pt1: 1.55, ex1: 2.2 };
export function hubR(x) {
  if (x < X.cIn) return 0.2 * sm((x + 2.62) / 0.52);
  if (x < X.cOut) return lerp(0.205, 0.305, Math.pow((x - X.cIn) / (X.cOut - X.cIn), 0.8));
  if (x < X.combIn) return lerp(0.305, 0.33, (x - X.cOut) / (X.combIn - X.cOut));
  if (x < X.combOut) return lerp(0.36, 0.44, sm((x - X.combIn) / (X.combOut - X.combIn)));
  if (x < X.hpt1) return 0.44;
  if (x < X.pt0) return lerp(0.44, 0.46, (x - X.hpt1) / (X.pt0 - X.hpt1));
  if (x < X.pt1) return lerp(0.46, 0.47, (x - X.pt0) / (X.pt1 - X.pt0));
  return lerp(0.47, 0.3, sm((x - X.pt1) / (X.ex1 - X.pt1)));
}
export function tipR(x) {
  if (x < X.cIn) return lerp(0.62, 0.43, sm((x + 2.62) / 0.52));
  if (x < X.cOut) return lerp(0.425, 0.345, Math.pow((x - X.cIn) / (X.cOut - X.cIn), 0.9));
  if (x < X.combIn) return lerp(0.345, 0.42, (x - X.cOut) / (X.combIn - X.cOut));
  if (x < X.combOut) return lerp(0.62, 0.56, sm((x - X.combIn) / (X.combOut - X.combIn)));
  if (x < X.hpt1) return lerp(0.56, 0.585, (x - X.hpt0) / (X.hpt1 - X.hpt0));
  if (x < X.pt0) return lerp(0.585, 0.65, (x - X.hpt1) / (X.pt0 - X.hpt1));
  if (x < X.pt1) return lerp(0.65, 0.75, (x - X.pt0) / (X.pt1 - X.pt0));
  return lerp(0.75, 0.98, sm((x - X.pt1) / (X.ex1 - X.pt1)));
}
// Gas temperature along the path, degrees C (inlet ISO 15 C; compressor exit estimated from PR 19; exhaust 495 C per datasheet).
export function gasT(x) {
  if (x < X.cIn) return 15;
  if (x < X.cOut) return lerp(15, 450, Math.pow((x - X.cIn) / (X.cOut - X.cIn), 1.15));
  if (x < X.combIn + 0.08) return 450;
  if (x < X.combOut) return lerp(450, 1350, sm((x - X.combIn - 0.08) / 0.3));
  if (x < X.hpt1) return lerp(1350, 900, (x - X.combOut) / (X.hpt1 - X.combOut));
  if (x < X.pt1) return lerp(900, 510, (x - X.hpt1) / (X.pt1 - X.hpt1));
  return lerp(510, 495, (x - X.pt1) / (X.ex1 - X.pt1));
}

// --- blade rows
function compressorRows() {
  const rows = [];
  const n = 12, L = X.cOut - X.cIn - 0.06;
  // IGV (variable)
  rows.push({ x: X.cIn + 0.012, type: 'stator', variable: true, count: 36, chord: 0.07, stagger: 0.12, camber: 0.2, mat: 'comp' });
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const pitch = L / n;
    const x = X.cIn + 0.055 + i * pitch;
    const chord = lerp(0.085, 0.04, f);
    rows.push({ x, type: 'rotor', spool: 'gg', count: Math.round(lerp(24, 58, f)), chord, stagger: lerp(0.95, 0.7, f), camber: lerp(0.32, 0.22, f), mat: 'comp', stage: i + 1 });
    rows.push({ x: x + pitch * 0.5, type: 'stator', variable: i < 2, count: Math.round(lerp(40, 84, f)), chord: chord * 0.85, stagger: lerp(0.35, 0.25, f), camber: 0.35, mat: 'comp' });
  }
  return rows;
}
function turbineRows() {
  return [
    { x: 0.555, type: 'stator', count: 24, chord: 0.075, stagger: -0.75, camber: -0.55, mat: 'hot' },
    { x: 0.655, type: 'rotor', spool: 'gg', count: 52, chord: 0.06, stagger: 0.55, camber: 0.6, mat: 'hot' },
    { x: 0.755, type: 'stator', count: 30, chord: 0.07, stagger: -0.7, camber: -0.5, mat: 'hot' },
    { x: 0.845, type: 'rotor', spool: 'gg', count: 58, chord: 0.056, stagger: 0.5, camber: 0.55, mat: 'hot' },
    { x: 1.09, type: 'stator', variable: true, count: 32, chord: 0.09, stagger: -0.65, camber: -0.45, mat: 'hot', vng: true },
    { x: 1.22, type: 'rotor', spool: 'pt', count: 56, chord: 0.075, stagger: 0.5, camber: 0.5, mat: 'hot' },
    { x: 1.35, type: 'stator', count: 40, chord: 0.085, stagger: -0.6, camber: -0.45, mat: 'hot' },
    { x: 1.47, type: 'rotor', spool: 'pt', count: 62, chord: 0.08, stagger: 0.45, camber: 0.45, mat: 'hot' },
  ];
}

// Airfoil-ish blade: cambered, twisted thin plate from hub to tip. Built along +y (radial), chord along x.
function bladeGeo(row, hub, tip) {
  const ns = 7, nc = 8;
  const pos = [], idx = [];
  const span = tip - hub;
  const thick = row.chord * (row.mat === 'hot' ? 0.22 : 0.09);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= ns; i++) {
      const s = i / ns, r = hub + span * s;
      const stg = row.stagger + (row.type === 'rotor' ? 0.35 * (s - 0.5) : 0.12 * (s - 0.5));
      for (let j = 0; j <= nc; j++) {
        const c = j / nc;
        const cx = (c - 0.5) * row.chord;
        const camber = row.camber * row.chord * 0.18 * Math.sin(Math.PI * c);
        const th = thick * Math.sin(Math.PI * Math.pow(c, 0.7)) * (side ? -1 : 1) * 0.5;
        // rotate chord line by stagger around radial axis
        const u = cx, v = camber + th;
        const ax = u * Math.cos(stg) - v * Math.sin(stg);
        const tz = u * Math.sin(stg) + v * Math.cos(stg);
        pos.push(ax, r, tz);
      }
    }
  }
  const W = nc + 1, S = (ns + 1) * W;
  for (let side = 0; side < 2; side++) {
    const o = side * S;
    for (let i = 0; i < ns; i++) for (let j = 0; j < nc; j++) {
      const a = o + i * W + j, b = a + 1, c = a + W, d = c + 1;
      if (side === 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  // tip cap
  for (let j = 0; j < nc; j++) { const a = ns * W + j, b = a + 1, c = S + ns * W + j, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A closed meridional section polygon [[x, r], ...] revolved over the kept range, plus hatched caps on the cut planes.
function latheSolid(poly, mat, capMat, { segs = 96, full = false, caps = true } = {}) {
  const pts = poly.map(([x, r]) => new THREE.Vector2(Math.max(r, 0.0005), x));
  const closed = [...pts, pts[0]];
  const g = new THREE.LatheGeometry(closed, segs, full ? 0 : PHI0, full ? Math.PI * 2 : PHI_LEN);
  g.rotateZ(-Math.PI / 2);   // lathe axis +y -> +x ; phi=0 -> +z, phi=3pi/2 -> +y
  g.computeVertexNormals();
  const group = new THREE.Group();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  group.add(m);
  if (!full && caps && capMat) {
    const shape = poly.map(([x, r]) => new THREE.Vector2(x, r));
    const tris = THREE.ShapeUtils.triangulateShape(shape, []);
    const mk = (map) => {
      const pos = [], uv = [];
      for (const [x, r] of poly) { const p = map(x, r); pos.push(p.x, p.y, p.z); uv.push(x, r); }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      cg.setIndex(tris.flat());
      cg.computeVertexNormals();
      return cg;
    };
    // phi = 0 plane: (x, 0, r), solid below => cap faces +y
    const c1 = mk((x, r) => new THREE.Vector3(x, 0, r));
    // phi = 3pi/2 plane: (x, r, 0), solid behind => cap faces +z
    const c2 = mk((x, r) => new THREE.Vector3(x, r, 0));
    fixNormal(c1, new THREE.Vector3(0, 1, 0)); fixNormal(c2, new THREE.Vector3(0, 0, 1));
    const m1 = new THREE.Mesh(c1, capMat), m2 = new THREE.Mesh(c2, capMat);
    m1.receiveShadow = m2.receiveShadow = true;
    group.add(m1, m2);
  }
  return group;
}
function fixNormal(g, want) {
  const n = g.attributes.normal;
  if (n.getX(0) * want.x + n.getY(0) * want.y + n.getZ(0) * want.z < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.computeVertexNormals();
  }
}

// Section-cap material: pale metal with engineering hatch lines and a luminous section outline.
function capMaterial(env) {
  const m = new THREE.MeshStandardMaterial({ color: 0xcfc9bf, roughness: 0.5, metalness: 0.2, envMap: env, envMapIntensity: 0.55, side: THREE.DoubleSide });
  m.userData.uniforms = { uHatch: { value: 1 }, uHatchColor: { value: new THREE.Color(0.28, 0.25, 0.22) }, uGlow: { value: new THREE.Color(0.0, 0.0, 0.0) }, uCapReveal: { value: 100 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSec;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvSec = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSec; uniform float uHatch; uniform vec3 uHatchColor; uniform vec3 uGlow; uniform float uCapReveal;')
      .replace('#include <map_fragment>', `
        float hs = 0.012;
        float d = (vSec.x + vSec.y) / hs;
        float line = 1.0 - smoothstep(0.0, 0.18, abs(fract(d) - 0.5) - 0.32);
        float fw = fwidth(d);
        line = mix(line, 0.3, smoothstep(0.3, 0.9, fw));
        diffuseColor.rgb = mix(diffuseColor.rgb, uHatchColor, line * 0.75 * uHatch);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow;');
  };
  return m;
}

// Premixed flame cones (blue lean-premixed core, warm tail) for the annular combustor.
const PFLAME_VERT = /* glsl */ `
attribute float aSeed; attribute float aIdx; uniform float uIgnite; varying vec3 vP; varying float vSeed; varying vec3 vN; varying vec3 vV; varying float vOn;
void main(){
  vP = position; vSeed = aSeed;
  vOn = smoothstep(aIdx * 0.75, aIdx * 0.75 + 0.25, uIgnite);
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const PFLAME_FRAG = /* glsl */ `
uniform float uTime; uniform float uI; uniform float uH2; varying vec3 vP; varying float vSeed; varying vec3 vN; varying vec3 vV; varying float vOn;
${NOISE}
${BLACKBODY}
void main(){
  if (vOn < 0.001) discard;
  float h = clamp(vP.y, 0.0, 1.0);
  float fres = pow(max(0.0, 1.0 - abs(dot(normalize(vN), vV))), 1.5);
  float n = gnoise3(vec3(vP.x * 6.0, vP.y * 5.0 - uTime * 9.0, vP.z * 6.0 + vSeed * 17.0));
  float a = (0.15 + 0.85 * (1.0 - fres)) * pow(1.0 - h, 1.6) * (0.7 + 0.4 * n);
  vec3 blue = vec3(0.25, 0.45, 1.8);
  vec3 warm = blackbody(1900.0 + 500.0 * (1.0 - h)) * 1.4;
  vec3 col = mix(blue * 2.2, warm, smoothstep(0.15, 0.85, h + n * 0.15));
  col = mix(col, vec3(0.55, 0.75, 2.6) * (1.2 - h * 0.6), uH2 * 0.8);
  gl_FragColor = vec4(col * a * uI * vOn * (1.0 + 2.5 * (1.0 - vOn) * vOn), 1.0);
}`;

// Flow particles: analytic motion along the gas path using baked lookup textures.
const FLOW_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform sampler2D tPath;   // r: hub, g: tip, b: temperature (C), a: unused   (indexed by x-normalised)
uniform sampler2D tInv;    // r: x-normalised as a function of flight-time fraction
uniform float uTime; uniform float uSpeed; uniform float uX0; uniform float uX1; uniform float uSize; uniform float uSwirl;
uniform float uRevealX; uniform float uPx;
varying float vT; varying float vA; varying float vB;
void main(){
  float tau = fract(aSeed.x + uTime * uSpeed * (0.9 + 0.2 * aSeed.w));
  float xn = texture2D(tInv, vec2(tau, 0.5)).r;
  vec4 P = texture2D(tPath, vec2(xn, 0.5));
  float x = mix(uX0, uX1, xn);
  float r = mix(P.r + 0.012, P.g - 0.012, aSeed.y);
  float th = aSeed.z * 6.2831853 + uSwirl * xn * 6.2831853;
  vec3 pos = vec3(x, -r * sin(th), r * cos(th));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vT = P.b; vB = P.a;
  vA = smoothstep(0.0, 0.02, tau) * (1.0 - smoothstep(0.96, 1.0, tau)) * step(x, uRevealX);
  gl_PointSize = max(1.0, uSize * uPx / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FLOW_FRAG = /* glsl */ `
uniform float uI; varying float vT; varying float vA; varying float vB;
${BLACKBODY}
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
  float g = exp(-r * r * 5.0);
  // air warms from pale blue as it is compressed; after the flame it glows like hot metal and cools to the exhaust
  vec3 cold = mix(vec3(0.4, 0.7, 1.25), vec3(0.95, 0.85, 0.8), smoothstep(150.0, 450.0, vT));
  vec3 burned = blackbody(vT + 700.0) * (0.5 + 2.0 * smoothstep(500.0, 1350.0, vT));
  vec3 col = mix(cold * 0.8, burned, vB);
  gl_FragColor = vec4(col * g * vA * uI, 1.0);
}`;

export function buildNovaLT(renderer, env, opts = {}) {
  const root = new THREE.Group();
  const gg = new THREE.Group(), pt = new THREE.Group();   // rotating spools
  const statics = new THREE.Group();
  root.add(statics, gg, pt);
  const profiles = [];    // meridional drawing (for the blueprint), polylines in (x, r)

  const M = {
    casing: new THREE.MeshPhysicalMaterial({ color: 0xa9afb4, metalness: 0.9, roughness: 0.32, envMap: env, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    casingOuter: new THREE.MeshPhysicalMaterial({ color: 0x8c9398, metalness: 0.85, roughness: 0.42, envMap: env, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    disk: new THREE.MeshPhysicalMaterial({ color: 0xb7bcc0, metalness: 0.95, roughness: 0.25, envMap: env, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    comp: new THREE.MeshPhysicalMaterial({ color: 0xd2d9df, metalness: 1.0, roughness: 0.2, envMap: env, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    hot: new THREE.MeshPhysicalMaterial({ color: 0xc49a6c, metalness: 0.95, roughness: 0.3, envMap: env, envMapIntensity: 1.1, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0) }),
    liner: new THREE.MeshPhysicalMaterial({ color: 0x9b8a78, metalness: 0.85, roughness: 0.35, envMap: env, envMapIntensity: 1.0, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0) }),
    pipe: new THREE.MeshPhysicalMaterial({ color: 0xb9bec2, metalness: 1.0, roughness: 0.18, envMap: env, envMapIntensity: 1.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.6, roughness: 0.5, envMap: env }),
    green: new THREE.MeshStandardMaterial({ color: 0x02bc94, metalness: 0.2, roughness: 0.4, envMap: env, envMapIntensity: 0.5 }),
    cap: capMaterial(env),
  };
  for (const [k, m] of Object.entries(M)) if (k !== 'cap') engineMat(m, k);
  engineMat(M.cap, 'cap');
  // Clip boxy (non-revolved) parts with the same top-front quadrant
  const clip = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  const ghostMats = [];
  const clipMat = (m) => {
    const c = m.clone(); c.clippingPlanes = clip; c.clipIntersection = true; c.side = THREE.DoubleSide;
    engineMat(c, 'clip' + ghostMats.length, { ghostable: true });
    c.transparent = true; ghostMats.push(c); return c;
  };

  const addProfile = (name, pts, closed = true) => profiles.push({ name, pts, closed });

  // ---------- compressor casing (with stage flanges), inner surface follows the blade tips
  {
    const xs = [], poly = [];
    for (let x = X.cIn - 0.04; x <= X.cOut + 0.02; x += 0.02) xs.push(x);
    for (const x of xs) poly.push([x, tipR(x) + 0.006]);
    const out = xs.slice().reverse().map((x) => {
      const fl = [0.0, 0.33, 0.66, 1.0].some((f) => Math.abs(x - (X.cIn + f * (X.cOut - X.cIn))) < 0.025) ? 0.045 : 0;
      return [x, tipR(x) + 0.055 + fl];
    });
    const P = [...poly, ...out];
    statics.add(latheSolid(P, M.casing, M.cap));
    addProfile('compressor casing', P);
  }
  // ---------- inlet bellmouth + spinner
  {
    const bell = [];
    for (let a = 0; a <= 12; a++) { const t = a / 12; bell.push([-2.62 + 0.5 * t, 0.62 - 0.19 * sm(t) + 0.0 * t]); }
    const P = [...bell, [X.cIn - 0.04, tipR(X.cIn - 0.04) + 0.055], [-2.45, 0.78], [-2.62, 0.72]];
    statics.add(latheSolid(P, M.casing, M.cap));
    addProfile('bellmouth', P);
    const spin = [];
    for (let a = 0; a <= 14; a++) { const t = a / 14; spin.push([-2.62 + 0.52 * t, 0.2 * Math.sin(t * Math.PI / 2)]); }
    const S = [[-2.62, 0.001], ...spin, [X.cIn, 0.12], [-2.2, 0.001]];
    statics.add(latheSolid(S, M.disk, M.cap));
    addProfile('spinner', S);
  }
  // ---------- compressor rotor drum: one disk per stage
  const cRows = compressorRows();
  for (const row of cRows.filter((r) => r.type === 'rotor')) {
    const x = row.x, hw = row.chord * 0.55, rh = hubR(x);
    const D = [[x - hw, rh], [x + hw, rh], [x + hw, rh - 0.035], [x + 0.012, rh - 0.05], [x + 0.012, 0.14], [x + 0.03, 0.1], [x - 0.03, 0.1], [x - 0.012, 0.14], [x - 0.012, rh - 0.05], [x - hw, rh - 0.035]];
    statics.add(latheSolid(D, M.disk, M.cap));
    addProfile('disk', D);
  }
  // drum spacer / tie between disks
  {
    const xs = []; for (let x = X.cIn + 0.02; x <= X.cOut; x += 0.02) xs.push(x);
    const P = [...xs.map((x) => [x, hubR(x) - 0.002]), ...xs.slice().reverse().map((x) => [x, hubR(x) - 0.022])];
    statics.add(latheSolid(P, M.disk, M.cap));
  }
  // ---------- compressor discharge diffuser & combustor casing (outer), inner casing
  {
    const P = [[X.cOut - 0.02, tipR(X.cOut) + 0.055], [X.cOut + 0.02, 0.4], [X.combIn - 0.08, 0.66], [X.combIn + 0.05, 0.78], [X.combOut, 0.78], [X.combOut + 0.08, 0.72], [X.hpt0 + 0.04, 0.66],
      [X.hpt0 + 0.04, 0.62], [X.combOut + 0.06, 0.68], [X.combOut - 0.02, 0.73], [X.combIn + 0.07, 0.73], [X.combIn - 0.08, 0.62], [X.cOut + 0.03, 0.37], [X.cOut - 0.02, tipR(X.cOut) + 0.008]];
    statics.add(latheSolid(P, M.casingOuter, M.cap));
    addProfile('combustor casing', P);
    const I = [[X.cOut, hubR(X.cOut) - 0.005], [X.combIn, 0.33], [X.combOut - 0.1, 0.33], [X.hpt0, 0.4], [X.hpt0, 0.38], [X.combOut - 0.12, 0.3], [X.combIn, 0.3], [X.cOut, hubR(X.cOut) - 0.03]];
    statics.add(latheSolid(I, M.casing, M.cap));
    addProfile('inner casing', I);
  }
  // ---------- annular combustor liner (outer + inner walls with dome)
  const linerGroup = new THREE.Group(); statics.add(linerGroup);
  {
    const x0 = X.combIn - 0.02, x1 = X.combOut;
    const outerW = [], innerW = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, x = lerp(x0 + 0.06, x1, t); outerW.push([x, lerp(0.64, 0.565, sm(t))]); innerW.push([x, lerp(0.37, 0.44, sm(t))]); }
    const O = [...outerW, ...outerW.slice().reverse().map(([x, r]) => [x, r + 0.012])];
    const I = [...innerW, ...innerW.slice().reverse().map(([x, r]) => [x, r - 0.012])];
    linerGroup.add(latheSolid(O, M.liner, M.cap), latheSolid(I, M.liner, M.cap));
    const dome = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); dome.push([x0 + 0.06 - Math.sin(a) * 0.07, 0.505 + Math.cos(a) * 0.135]); }
    const Dm = [...dome, ...dome.slice().reverse().map(([x, r]) => [x - 0.012, r + (r - 0.505) * 0.09])];
    linerGroup.add(latheSolid(Dm, M.liner, M.cap));
    addProfile('liner outer', O); addProfile('liner inner', I); addProfile('dome', Dm);
  }
  // 39 premixers through the dome, fed from the casing (count per Baker Hughes)
  const premix = new THREE.Group(); statics.add(premix);
  const NPM = 39;
  {
    const body = new THREE.CylinderGeometry(0.032, 0.036, 0.3, 14); body.rotateZ(Math.PI / 2);
    const swirl = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16); swirl.rotateZ(Math.PI / 2); swirl.translate(0.14, 0, 0);
    const stem = new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8); stem.translate(-0.1, 0.16, 0);
    const pm = mergeGeometries([body, swirl, stem]);
    const inst = new THREE.InstancedMesh(pm, M.pipe, NPM);
    const d = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < NPM; i++) {
      const th = (i / NPM) * Math.PI * 2;
      const inCut = th > Math.PI * 1.5 + 0.03;   // skip ones inside the removed wedge
      d.position.set(X.combIn - 0.22, -0.505 * Math.sin(th), 0.505 * Math.cos(th));
      d.rotation.set(th, 0, 0);
      d.updateMatrix();
      inst.setMatrixAt(k++, inCut ? new THREE.Matrix4().makeScale(0, 0, 0) : d.matrix);
    }
    inst.castShadow = true;
    premix.add(inst);
  }
  // premixed flames inside the liner (all 39)
  const flameGeo = new THREE.ConeGeometry(0.075, 0.34, 18, 6, true); flameGeo.rotateZ(-Math.PI / 2); flameGeo.translate(0.17, 0, 0);
  // reorient so local y runs along the flame (for the shader): encode height in position.y via a copy
  {
    const p = flameGeo.attributes.position;
    const hy = new Float32Array(p.count);
  }
  const fu = { uTime: { value: 0 }, uI: { value: 0 }, uIgnite: { value: 1 }, uH2: { value: 0 } };
  const flameMat = new THREE.ShaderMaterial({ vertexShader: PFLAME_VERT.replace('vP = position;', 'vP = vec3(position.z * 8.0, position.x / 0.34, position.y * 8.0);'), fragmentShader: PFLAME_FRAG, uniforms: fu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const flames = new THREE.InstancedMesh(flameGeo, flameMat, NPM);
  {
    const seeds = new Float32Array(NPM); const idxs = new Float32Array(NPM);
    const d = new THREE.Object3D();
    for (let i = 0; i < NPM; i++) {
      const th = (i / NPM) * Math.PI * 2;
      d.position.set(X.combIn + 0.04, -0.505 * Math.sin(th), 0.505 * Math.cos(th));
      d.rotation.set(th, 0, 0); d.updateMatrix();
      flames.setMatrixAt(i, d.matrix); seeds[i] = i * 0.618;
      // ignition travels around the ring starting from the viewer's side of the cut
      idxs[i] = ((th - Math.PI * 1.5 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    }
    flames.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    flames.geometry.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idxs, 1));
    flames.renderOrder = 15; flames.frustumCulled = false;
  }
  statics.add(flames);
  // combustion glow inside the liner (a soft emissive ring)
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  {
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(lerp(0.5, 0.5, t) + 0.0, lerp(X.combIn + 0.1, X.combOut - 0.02, t))); }
    const g = new THREE.LatheGeometry(pts, 96, 0, Math.PI * 2); g.rotateZ(-Math.PI / 2);
    const glow = new THREE.Mesh(g, glowMat); glow.renderOrder = 14; statics.add(glow);
  }
  // ---------- turbine casing, disks, exhaust diffuser
  {
    const xs = []; for (let x = X.hpt0 - 0.02; x <= X.pt1 + 0.06; x += 0.02) xs.push(x);
    const P = [...xs.map((x) => [x, tipR(x) + 0.006]), ...xs.slice().reverse().map((x) => [x, tipR(x) + 0.075 + (Math.abs(x - 0.98) < 0.05 ? 0.05 : 0)])];
    statics.add(latheSolid(P, M.casingOuter, M.cap));
    addProfile('turbine casing', P);
    const xe = []; for (let x = X.pt1 + 0.04; x <= X.ex1; x += 0.03) xe.push(x);
    const E = [...xe.map((x) => [x, tipR(x) + 0.004]), ...xe.slice().reverse().map((x) => [x, tipR(x) + 0.03])];
    statics.add(latheSolid(E, M.casing, M.cap));
    addProfile('diffuser outer', E);
    const C = [...xe.map((x) => [x, hubR(x) - 0.004]), [X.ex1 + 0.1, 0.12], ...xe.slice().reverse().map((x) => [x, Math.max(0.12, hubR(x) - 0.03)])];
    statics.add(latheSolid(C, M.casing, M.cap));
    addProfile('centre body', C);
  }
  for (const row of turbineRows().filter((r) => r.type === 'rotor')) {
    const x = row.x, hw = row.chord * 0.55, rh = hubR(x);
    const D = [[x - hw, rh], [x + hw, rh], [x + hw, rh - 0.05], [x + 0.02, rh - 0.08], [x + 0.02, 0.16], [x + 0.045, 0.11], [x - 0.045, 0.11], [x - 0.02, 0.16], [x - 0.02, rh - 0.08], [x - hw, rh - 0.05]];
    statics.add(latheSolid(D, M.disk, M.cap));
    addProfile('turbine disk', D);
  }
  // shafts: GG shaft (compressor to HPT), PT shaft out through the exhaust to the coupling
  statics.add(latheSolid([[X.cIn, 0.001], [X.cIn, 0.09], [X.hpt1, 0.09], [X.hpt1, 0.001]], M.disk, M.cap));
  statics.add(latheSolid([[1.1, 0.001], [1.1, 0.075], [3.55, 0.075], [3.55, 0.001]], M.disk, M.cap));
  statics.add(latheSolid([[3.55, 0.001], [3.55, 0.22], [3.65, 0.22], [3.65, 0.001]], M.disk, M.cap)); // coupling flange
  addProfile('gg shaft', [[X.cIn, 0.09], [X.hpt1, 0.09]], false);
  addProfile('pt shaft', [[1.1, 0.075], [3.55, 0.075]], false);

  // ---------- blades (instanced rings)
  const bladeRows = [...cRows, ...turbineRows()];
  const bladeMeshes = [];
  const vngLevers = [];
  for (const row of bladeRows) {
    const hub = hubR(row.x), tip = tipR(row.x);
    const geo = bladeGeo(row, hub, tip);
    const mat = M[row.mat];
    const n = row.count;
    const im = new THREE.InstancedMesh(geo, mat, n);
    const d = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      // stators in the removed wedge are cut away with their casing
      const inCut = row.type === 'stator' && th > Math.PI * 1.5 + 0.02;
      d.position.set(row.x, 0, 0);
      d.rotation.set(th, 0, 0);
      d.scale.setScalar(inCut ? 0 : 1);
      d.updateMatrix();
      im.setMatrixAt(k++, d.matrix);
    }
    im.castShadow = true; im.receiveShadow = true;
    im.userData.row = row;
    (row.type === 'rotor' ? (row.spool === 'pt' ? pt : gg) : statics).add(im);
    bladeMeshes.push(im);
  }
  // ---------- externals: variable-vane actuation (IGV, S1, S2) and the power-turbine nozzle actuators
  const levers = new THREE.Group(); statics.add(levers);
  {
    const vRows = cRows.filter((r) => r.variable);
    for (const row of vRows) {
      const r0 = tipR(row.x) + 0.06;
      const ring = new THREE.TorusGeometry(r0 + 0.035, 0.011, 8, 120, PHI_LEN); ring.rotateY(Math.PI / 2); ring.rotateX(Math.PI / 2);
      const rm = new THREE.Mesh(ring, M.pipe); rm.position.x = row.x + 0.03; levers.add(rm);
      const arm = new THREE.BoxGeometry(0.06, 0.012, 0.012); arm.translate(0.03, 0, 0);
      const nArm = Math.round(row.count * 0.75);
      const im = new THREE.InstancedMesh(arm, M.pipe, nArm);
      const d = new THREE.Object3D();
      for (let i = 0; i < nArm; i++) {
        const th = (i / nArm) * PHI_LEN;
        d.position.set(row.x, -(r0 + 0.02) * Math.sin(th), (r0 + 0.02) * Math.cos(th));
        d.rotation.set(th, 0, 0.0); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      }
      levers.add(im);
    }
    // actuator rod along the casing
    const rod = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 10); rod.rotateZ(Math.PI / 2);
    const rodM = new THREE.Mesh(rod, M.dark); rodM.position.set(X.cIn + 0.2, -0.52, 0.0); levers.add(rodM);
    // PT variable nozzle actuators: a ring of short levers around the turbine casing (the image in the Baker Hughes film)
    const r1 = tipR(1.09) + 0.1;
    const ring = new THREE.TorusGeometry(r1 + 0.05, 0.014, 8, 140, PHI_LEN); ring.rotateY(Math.PI / 2); ring.rotateX(Math.PI / 2);
    const rm = new THREE.Mesh(ring, M.pipe); rm.position.x = 1.12; levers.add(rm);
    const arm = new THREE.BoxGeometry(0.014, 0.08, 0.014); arm.translate(0, 0.04, 0);
    const im = new THREE.InstancedMesh(arm, M.pipe, 30);
    const d = new THREE.Object3D();
    for (let i = 0; i < 30; i++) {
      const th = (i / 30) * PHI_LEN;
      d.position.set(1.09, -r1 * Math.sin(th), r1 * Math.cos(th));
      d.rotation.set(th + Math.PI / 2 * 0, 0, 0); d.lookAt(1.09, 0, 0); d.rotateX(Math.PI / 2); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    }
    levers.add(im);
  }
  // ---------- fuel manifold "crown" around the combustor casing
  const fuel = new THREE.Group(); statics.add(fuel);
  {
    const R = 0.84;
    for (const [dx, rr] of [[-0.05, R], [0.08, R + 0.02]]) {
      const ring = new THREE.TorusGeometry(rr, 0.028, 10, 160, PHI_LEN); ring.rotateY(Math.PI / 2); ring.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(ring, M.pipe); m.position.x = X.combIn + dx; fuel.add(m);
    }
    const pig = [];
    const nP = 29;
    for (let i = 0; i < nP; i++) {
      const th = (i / nP) * PHI_LEN + 0.03;
      const a = new THREE.Vector3(X.combIn - 0.05, -R * Math.sin(th), R * Math.cos(th));
      const b = new THREE.Vector3(X.combIn + 0.02, -0.8 * Math.sin(th), 0.8 * Math.cos(th));
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(-0.08, 0, 0));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      pig.push(new THREE.TubeGeometry(curve, 8, 0.011, 6, false));
    }
    const mm = new THREE.Mesh(mergeGeometries(pig), M.pipe); fuel.add(mm);
  }
  // ---------- inlet plenum and exhaust collector (boxy, clipped by the same quadrant)
  const plenum = new THREE.Group(); statics.add(plenum);
  {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.3, 2.3), clipMat(M.casingOuter)); box.position.set(-2.95, 0.1, 0); plenum.add(box);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 2.5), clipMat(M.casingOuter)); lip.position.set(-2.62, 0.1, 0); plenum.add(lip);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 2.1), clipMat(M.casingOuter)); col.position.set(2.62, 0.15, 0); plenum.add(col);
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.8), clipMat(M.casingOuter)); up.position.set(2.62, 1.7, 0); plenum.add(up);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.9), clipMat(M.dark)); flange.position.set(2.62, 2.15, 0); plenum.add(flange);
    addProfile('inlet plenum', [[-3.26, 1.25], [-2.64, 1.25], [-2.64, 0.72]], false);
    addProfile('exhaust collector', [[2.17, 0.98], [2.17, 1.3], [3.07, 1.3], [3.07, 0.12]], false);
  }
  // ---------- gearbox and generator (BRUSH generators are Baker Hughes; 4-pole, 1,800 rpm at 60 Hz)
  const drive = new THREE.Group(); root.add(drive);
  const gearGroup = new THREE.Group(), genRotor = new THREE.Group();
  {
    const gb = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.4), clipMat(M.casingOuter)); gb.position.set(4.35, 0.2, 0); drive.add(gb);
    const gear = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 64); gear.rotateZ(Math.PI / 2);
    const g1 = new THREE.Mesh(gear, M.disk); g1.position.set(4.35, 0.5, 0); gearGroup.add(g1);
    const pin = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 32); pin.rotateZ(Math.PI / 2);
    const g2 = new THREE.Mesh(pin, M.disk); g2.position.set(4.35, -0.34, 0); gearGroup.add(g2);
    drive.add(gearGroup);
    const out = latheSolid([[4.9, 0.001], [4.9, 0.12], [5.75, 0.12], [5.75, 0.001]], M.disk, M.cap, { full: true });
    out.position.y = 0.5; drive.add(out);
    const stator = latheSolid([[5.8, 0.55], [5.8, 1.05], [8.9, 1.05], [8.9, 0.55]], M.casingOuter, M.cap);
    stator.position.y = 0.5; drive.add(stator);
    const wind = latheSolid([[5.95, 0.47], [5.95, 0.54], [8.75, 0.54], [8.75, 0.47]], new THREE.MeshPhysicalMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.35, envMap: env, side: THREE.DoubleSide }), M.cap);
    wind.position.y = 0.5; drive.add(wind);
    const rotor = latheSolid([[6.0, 0.001], [6.0, 0.42], [8.7, 0.42], [8.7, 0.001]], M.disk, M.cap, { full: true });
    genRotor.add(rotor); genRotor.position.y = 0.5; drive.add(genRotor);
    const base = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.25, 2.4), M.dark); base.position.set(4.3, -1.2, 0); drive.add(base);
    const base2 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 2.5), M.dark); base2.position.set(-0.3, -1.25, 0); root.add(base2);
    for (const x of [-2.2, 0.0, 2.3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 1.2), M.dark); s.position.set(x, -0.75, 0); root.add(s); }
  }

  // ---------- flow particles through the gas path
  const NP = 26000;
  const X0 = X.cIn - 0.12, X1 = X.ex1;
  const pathData = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const x = lerp(X0, X1, i / 255);
    pathData[i * 4] = hubR(x); pathData[i * 4 + 1] = tipR(x); pathData[i * 4 + 2] = gasT(x); pathData[i * 4 + 3] = x > X.combIn + 0.05 ? 1 : 0;
  }
  const tPath = new THREE.DataTexture(pathData, 256, 1, THREE.RGBAFormat, THREE.FloatType); tPath.needsUpdate = true;
  tPath.minFilter = tPath.magFilter = THREE.LinearFilter;
  // flight time ~ area / (density-weighted) -> slow through the big inlet, fast & dense in the core
  const invData = new Float32Array(512 * 4);
  {
    const N = 2048; const cdf = [0];
    for (let i = 1; i <= N; i++) {
      const x = lerp(X0, X1, i / N);
      const A = Math.max(1e-3, tipR(x) ** 2 - hubR(x) ** 2);
      const T = gasT(x) + 273;
      const rho = x < X.combIn ? Math.pow(1 + 18 * Math.max(0, Math.min(1, (x - X.cIn) / (X.cOut - X.cIn))), 0.85) : 19 * 700 / T;
      cdf.push(cdf[i - 1] + (A * rho) / (T / 288) * 0.0 + A * Math.sqrt(rho));
    }
    const tot = cdf[N];
    let j = 0;
    for (let k = 0; k < 512; k++) {
      const target = (k / 511) * tot;
      while (j < N && cdf[j] < target) j++;
      invData[k * 4] = j / N;
    }
  }
  const tInv = new THREE.DataTexture(invData, 512, 1, THREE.RGBAFormat, THREE.FloatType); tInv.needsUpdate = true;
  tInv.minFilter = tInv.magFilter = THREE.LinearFilter;
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const seeds = new Float32Array(NP * 4);
  let s = 12345; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < NP * 4; i++) seeds[i] = rnd();
  fg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const flowU = { tPath: { value: tPath }, tInv: { value: tInv }, uTime: { value: 0 }, uSpeed: { value: 0.12 }, uX0: { value: X0 }, uX1: { value: X1 }, uSize: { value: 9 }, uSwirl: { value: 0.35 }, uRevealX: { value: 10 }, uI: { value: 1 }, uPx: { value: 1 } };
  const flowMat = new THREE.ShaderMaterial({ vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG, uniforms: flowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flow = new THREE.Points(fg, flowMat); flow.frustumCulled = false; flow.renderOrder = 16;
  root.add(flow);

  // glowing section outlines on the cut planes: the blueprint, embedded in the metal
  let outlines = null;
  if (opts.outlines !== false) {
    outlines = new GlowLines({ width: 1.3, core: 1.6, headLen: 0.4, headBoost: 1.0 });
    const TEAL = [0.15, 1.6, 1.15];
    let k = 0;
    for (const pr of profiles) {
      const pts = pr.closed ? [...pr.pts, pr.pts[0]] : pr.pts;
      outlines.add(pts.map(([x, r]) => [x, 0.0015, r]), { color: TEAL, delay: 0, speed: 1e6, step: 0.03 });
      outlines.add(pts.map(([x, r]) => [x, r, 0.0015]), { color: TEAL, delay: 0, speed: 1e6, step: 0.03 });
      k++;
    }
    root.add(outlines.build());
  }

  const anchors = {
    compressor: new THREE.Vector3(-1.3, 0.5, 0.0), igv: new THREE.Vector3(X.cIn, 0.55, 0.0), combustor: new THREE.Vector3(X.combIn + 0.12, 0.5, 0.1),
    premixer: new THREE.Vector3(X.combIn - 0.2, 0.0, 0.5), hpt: new THREE.Vector3(0.7, 0.6, 0.0), vng: new THREE.Vector3(1.09, 0.72, 0.0),
    pt: new THREE.Vector3(1.35, 0.8, 0.0), exhaust: new THREE.Vector3(2.62, 1.3, 0.0), shaft: new THREE.Vector3(3.2, 0.0, 0.1),
    gearbox: new THREE.Vector3(4.35, 1.0, 0.0), generator: new THREE.Vector3(7.3, 1.6, 0.0),
  };

  let ggAngle = 0, ptAngle = 0, lastT = null;
  function update(t, st = {}) {
    // spool speeds in rev/s (visual; integrate for smooth ramps)
    const ggRate = st.ggRate ?? 0.2, ptRate = st.ptRate ?? 0.15;
    ggAngle = (st.ggAngle !== undefined) ? st.ggAngle : ggRate * t * Math.PI * 2;
    ptAngle = (st.ptAngle !== undefined) ? st.ptAngle : ptRate * t * Math.PI * 2;
    gg.rotation.x = ggAngle; pt.rotation.x = ptAngle;
    gearGroup.children[0].rotation.x = -ptAngle * 0.23;
    gearGroup.children[1].rotation.x = ptAngle * 0.65;
    genRotor.rotation.x = ptAngle * 0.23;
    fu.uTime.value = t; fu.uI.value = st.flame ?? 0; fu.uIgnite.value = st.ignite ?? 1; fu.uH2.value = st.h2 ?? 0;
    glowMat.color.setRGB(1.0, 0.45, 0.15).multiplyScalar((st.flame ?? 0) * 0.06);
    M.liner.emissive.setRGB(0.55, 0.22, 0.06).multiplyScalar((st.flame ?? 0) * 0.35);
    M.hot.emissive.setRGB(0.5, 0.18, 0.04).multiplyScalar((st.heat ?? 0) * 0.25);
    flowU.uTime.value = t; flowU.uI.value = st.flow ?? 0; flowU.uSpeed.value = st.flowSpeed ?? 0.12;
    flowU.uRevealX.value = st.flowReveal ?? 10;
    M.cap.userData.uniforms.uGlow.value.setRGB(0.0, 0.0, 0.0);
    ENG.uSweep.value = st.sweep ?? 10;
    M.cap.userData.uniforms.uCapReveal.value = st.capReveal ?? 100;
    ENG.uGhost.value = st.ghost ?? 0;
    for (const m of ghostMats) m.depthWrite = ENG.uGhost.value < 0.5;
    if (outlines) outlines.set({ time: t, progress: st.outlineProgress ?? 1000, intensity: st.outline ?? 0, res: st.res });
  }
  return { root, gg, pt, statics, drive, levers, fuel, plenum, premix, flames, flow, profiles, anchors, update, M, bladeMeshes, clip, ghostMats, ENG, get outlines() { return outlines; } };
}
