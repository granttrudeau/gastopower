// S03 — Florence, 1842. The city as a copperplate etching at dawn; the only colour is the foundry's fire.
import * as THREE from 'three';
import { buildFlorence } from '../world/florence.js';
import { createEmbers } from '../world/embers.js';
import { FSQuad, fsMaterial } from '../engine/engine.js';
import { NOISE } from '../engine/glsl.js';
import { setAtmos } from '../engine/atmos.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, F, C } from '../engine/type.js';

const CATS = { sky: 0, stone: 1, roof: 2, dome: 3, water: 4, hill: 5, tree: 6, foundry: 7, glow: 8, dark: 9 };

const GB_VERT = /* glsl */ `
varying vec3 vN; varying float vD;
void main(){
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  #endif
  vec4 mv = modelViewMatrix * p;
  vN = normalize(normalMatrix * n);
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const GB_FRAG = /* glsl */ `
uniform float uCat; varying vec3 vN; varying float vD;
vec2 octEnc(vec3 n){ n /= (abs(n.x) + abs(n.y) + abs(n.z)); vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * sign(n.xy); return e * 0.5 + 0.5; }
void main(){
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  gl_FragColor = vec4(uCat / 10.0, vD / 1000.0, octEnc(n));
}`;

const ETCH_FRAG = /* glsl */ `
uniform sampler2D tLight; uniform sampler2D tG; uniform vec2 uRes; uniform float uTime; uniform float uReveal; uniform vec2 uRC;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uGlow; uniform float uExposure; uniform float uGlowI;
varying vec2 vUv;
${NOISE}
vec3 octDec(vec2 e){ e = e * 2.0 - 1.0; vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y)); float t = max(-n.z, 0.0); n.xy += vec2(n.x >= 0.0 ? -t : t, n.y >= 0.0 ? -t : t); return normalize(n); }
float hatch(vec2 p, float ang, float spacing, float width, float wob){
  vec2 d = vec2(cos(ang), sin(ang));
  float s = dot(p, d) / spacing + wob * (vnoise2(p * 0.02) - 0.5) * 2.0;
  float f = abs(fract(s) - 0.5);
  float aa = fwidth(s) * 0.9;
  return 1.0 - smoothstep(0.5 - width - aa, 0.5 - width + aa, 0.5 - f + 0.0 * aa);
}
float lineMask(vec2 p, float ang, float spacing, float w){
  vec2 d = vec2(cos(ang), sin(ang));
  float s = dot(p, d) / spacing;
  float f = abs(fract(s) - 0.5) * 2.0;          // 0 at line centre
  float aa = fwidth(s) * 2.0;
  return 1.0 - smoothstep(w - aa, w + aa, f);
}
void main(){
  vec2 uv = vUv;
  vec2 P = uv * vec2(1920.0, 804.0);             // hatch space fixed to the output frame
  vec4 g = texture2D(tG, uv);
  float cat = floor(g.r * 10.0 + 0.5);
  float depth = g.g * 1000.0;
  vec3 n = octDec(g.ba);
  float L = dot(texture2D(tLight, uv).rgb, vec3(0.3333));
  float v = clamp(pow(max(L * uExposure, 0.0), 0.75), 0.0, 1.0);
  float far = smoothstep(1500.0, 5200.0, depth);
  if (cat == 9.0) v *= 0.55;
  if (cat == 5.0) v = min(v, 0.9);
  v = mix(v, 1.0, far * 0.7);
  float ink = 0.0;
  if (cat == 0.0) {
    // engraver's sky: fine horizontals, denser toward the horizon, a few cloud banks
    float hy = uv.y;
    float band = smoothstep(0.95, 0.25, hy);
    float cl = smoothstep(0.55, 0.75, fbm2(vec2(P.x * 0.0022, P.y * 0.009) + 3.0)) * smoothstep(0.35, 0.8, hy);
    ink = lineMask(P + vec2(0.0, sin(P.x * 0.01) * 1.5), 1.5708, 5.5, 0.07 + 0.18 * band) * (0.25 + 0.55 * band);
    ink = max(ink * (1.0 - cl), cl * lineMask(P, 1.2, 4.5, 0.25) * 0.55);
    ink *= smoothstep(1.0, 0.55, hy) + cl;
  } else if (cat == 4.0) {
    // water: long horizontal strokes that ripple
    float rip = sin(P.x * 0.045 + fbm2(P * 0.01) * 6.0 + uTime * 0.6) * 1.6;
    float t = 1.0 - v * 0.8;
    ink = lineMask(P + vec2(0.0, rip), 1.5708, 4.2, 0.12 + 0.45 * t) * (0.55 + 0.4 * t);
  } else {
    float wob = 0.35;
    float h1 = lineMask(P + vnoise2(P * 0.03) * 1.5, 0.785, 4.2, 0.16 + 0.55 * smoothstep(0.98, 0.3, v));
    float h2 = lineMask(P + vnoise2(P * 0.031 + 7.0) * 1.5, -0.52, 4.9, 0.1 + 0.45 * smoothstep(0.62, 0.15, v));
    float h3 = lineMask(P, 1.38, 5.3, 0.1 + 0.4 * smoothstep(0.35, 0.0, v));
    ink = h1 * smoothstep(1.0, 0.75, v) + h2 * smoothstep(0.72, 0.45, v) + h3 * smoothstep(0.42, 0.15, v);
    // roofs: follow the tiles with short strokes
    if (cat == 2.0 || cat == 3.0) ink = max(ink, lineMask(P, 0.1, 3.8, 0.1) * smoothstep(0.9, 0.5, v) * 0.6);
    if (cat == 6.0) ink = max(ink, 0.55 + 0.35 * vnoise2(P * 0.3));
    ink = clamp(ink, 0.0, 1.0) * (1.0 - far * 0.6);
  }
  // ink outlines from depth / normal / category discontinuities
  vec2 px = 1.0 / uRes;
  float e = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = (i == 0 ? vec2(1, 0) : i == 1 ? vec2(-1, 0) : i == 2 ? vec2(0, 1) : vec2(0, -1)) * px * 1.2;
    vec4 q = texture2D(tG, uv + o);
    float dq = q.g * 1000.0;
    float dd = abs(log(max(dq, 0.1)) - log(max(depth, 0.1)));
    float nn = 1.0 - dot(octDec(q.ba), n);
    float cc = abs(floor(q.r * 10.0 + 0.5) - cat) > 0.5 ? 1.0 : 0.0;
    e = max(e, smoothstep(0.03, 0.08, dd) + smoothstep(0.25, 0.6, nn) * (cat == 5.0 ? 0.0 : 1.0) + cc * 0.8);
  }
  e = clamp(e * 1.2, 0.0, 1.0) * (1.0 - far * 0.45);
  if (cat == 0.0) e *= 0.0;
  ink = max(ink, e * 0.95);
  // the reveal: ink spreads from the foundry across the plate
  vec2 a = vec2(1920.0 / 804.0, 1.0);
  float r = length((uv - uRC) * a) + fbm2(P * 0.004) * 0.35;
  float rev = smoothstep(r - 0.02, r + 0.25, uReveal * 3.2);
  ink *= rev;
  // paper
  float fib = vnoise2(P * vec2(0.9, 0.12)) * 0.5 + vnoise2(P * 0.05) * 0.5;
  vec3 paper = uPaper * (0.93 + 0.07 * fib) * (1.0 - 0.18 * smoothstep(0.35, 0.95, length((uv - 0.5) * vec2(1.2, 1.5))));
  paper *= 1.0 - 0.05 * smoothstep(0.4, 0.9, fbm2(P * 0.0015 + 9.0));
  vec3 col = mix(paper, uInk, clamp(ink, 0.0, 1.0) * 0.95);
  // furnace fire is the only colour on the plate
  if (cat == 8.0) col = uGlow * uGlowI * rev;
  gl_FragColor = vec4(col, 1.0);
}`;

export async function create(engine) {
  const city = buildFlorence();
  const scene = new THREE.Scene();
  scene.add(city);
  // per-category albedo drives the engraving density (roofs and trees darker than stone walls)
  const ALB = { stone: 0.95, roof: 0.5, dome: 0.55, water: 0.8, hill: 0.8, tree: 0.3, foundry: 0.7, glow: 1.0, dark: 0.15 };
  const lamb = {};
  for (const [k, a] of Object.entries(ALB)) lamb[k] = new THREE.MeshLambertMaterial({ color: new THREE.Color(a, a, a) });
  const gbMats = {};
  for (const [k, v] of Object.entries(CATS)) gbMats[k] = new THREE.ShaderMaterial({ vertexShader: GB_VERT, fragmentShader: GB_FRAG, uniforms: { uCat: { value: v } }, side: THREE.DoubleSide });
  const meshes = [];
  city.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 1.5;
  Object.assign(sun.shadow.camera, { left: -1500, right: 1500, top: 1500, bottom: -1500, near: 10, far: 6000 });
  sun.position.set(2200, 900, 1100); sun.target.position.set(-100, 0, 200);
  scene.add(sun, sun.target, new THREE.AmbientLight(0xffffff, 0.35));
  const camera = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 5, 20000);
  const cam = keyed(THREE, [
    { t: 0, pos: [960, 175, 1560], look: [-40, 8, 210], fov: 17 },
    { t: 6, pos: [925, 170, 1500], look: [-50, 12, 190], fov: 16 },
    { t: 12, pos: [890, 165, 1440], look: [-60, 16, 170], fov: 15 },
  ]);
  const w = engine.rw, h = engine.rh;
  const rtL = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 0 });
  const rtG = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, samples: 0, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const quad = new FSQuad();
  const etch = fsMaterial(ETCH_FRAG, {
    tLight: { value: rtL.texture }, tG: { value: rtG.texture }, uRes: { value: new THREE.Vector2(w, h) }, uTime: { value: 0 }, uReveal: { value: 1 },
    uRC: { value: new THREE.Vector2(0.5, 0.5) }, uPaper: { value: new THREE.Color(1.32, 1.12, 0.84) }, uInk: { value: new THREE.Color(0.05, 0.028, 0.016) },
    uGlow: { value: new THREE.Color(4.0, 1.4, 0.35) }, uExposure: { value: 1.0 }, uGlowI: { value: 1.0 },
  });
  const embers = createEmbers({ count: 320, origin: city.userData.chimneyTop.toArray(), spread: [3, 2, 3], rise: 9, life: 6, swirl: 5, size: 1500, wind: [-6, 0, -3], intensity: 4, seed: 11 });
  const fx = new THREE.Scene(); fx.add(embers.points);
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();

  const shot = {
    scene, camera,
    update(lt) {
      setAtmos({ density: 0 });
      const fov = cam(lt, tmpP, tmpL);
      camera.position.copy(tmpP); camera.lookAt(tmpL); camera.fov = fov; camera.updateProjectionMatrix();
      embers.uniforms.uTime.value = lt + 5;
      etch.uniforms.uTime.value = lt;
      etch.uniforms.uReveal.value = ease.outCubic(range(lt, 0.1, 3.4));
      const c = city.userData.foundry.clone().project(camera);
      etch.uniforms.uRC.value.set(c.x * 0.5 + 0.5, c.y * 0.5 + 0.5);
      etch.uniforms.uGlowI.value = 0.8 + 0.2 * Math.sin(lt * 7.0) * Math.sin(lt * 3.1);
    },
    render(eng, target, lt) {
      const r = engine.renderer;
      engine.applyJitter(camera);
      // pass 1: light
      for (const m of meshes) m.material = lamb[m.userData.cat] || lamb.stone;
      r.setRenderTarget(rtL); r.setClearColor(0xffffff, 1); r.clear(); r.render(scene, camera);
      // pass 2: g-buffer
      for (const m of meshes) m.material = gbMats[m.userData.cat] || gbMats.stone;
      r.setRenderTarget(rtG); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
      // composite into the shot target, then add the sparks in colour
      quad.render(r, target, etch);
      r.autoClear = false; r.setRenderTarget(target); r.render(fx, camera); r.autoClear = true;
      camera.clearViewOffset();
    },
    post(lt) {
      return { exposure: 1.0, bloom: 0.035, vignette: 0.5, grain: 0.05, ca: 0.3, sat: 1.05, contrast: 1.12, lookPower: 1.0, lookSat: 1.1 };
    },
    overlay(ctx, lt) {
      const a = envelope(lt, 1.6, 11.6, 1.0, 1.0);
      tracked(ctx, 'Firenze', 150, 300, { font: F.serif(400, 84, true), tracking: 1, color: '#2A1D12', alpha: a * 0.9, reveal: range(lt, 1.6, 3.0), rise: 8 });
      tracked(ctx, '1842', 156, 350, { font: F.serif(500, 34), tracking: 8, color: '#2A1D12', alpha: a * 0.85, reveal: range(lt, 2.2, 3.4) });
      tracked(ctx, 'FONDERIA DEL PIGNONE', 158, 390, { font: F.mono(500, 14), tracking: 4, color: '#8a3b12', alpha: a * 0.85, reveal: range(lt, 2.6, 3.8) });
    },
  };
  return shot;
}
