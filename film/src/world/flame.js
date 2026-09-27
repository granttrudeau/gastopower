import * as THREE from 'three';
import { NOISE, BLACKBODY, ATMOS_PARS } from '../engine/glsl.js';
import { ATMOS } from '../engine/atmos.js';

// Volumetric flare flame, raymarched inside a box in object space.
// Object space: x,z in [-1,1], y in [0,1]. Scale the mesh to (radius, height, radius).
const VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vCamObj; varying vec3 vWorld;
void main(){
  vObj = position;
  vCamObj = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform float uTime; uniform float uIntensity; uniform float uLean; uniform float uTurb; uniform float uSeed;
uniform float uSpeed; uniform float uSteps; uniform float uWidth; uniform float uCool; uniform float uSmoke; uniform vec2 uSize;
varying vec3 vObj; varying vec3 vCamObj; varying vec3 vWorld;
${NOISE}
${BLACKBODY}
${ATMOS_PARS}
vec2 boxHit(vec3 ro, vec3 rd){
  vec3 bmin = vec3(-1.0, 0.0, -1.0), bmax = vec3(1.0, 1.0, 1.0);
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
}
// returns (emission strength, temperature). Works in metres via uSize (radius, height).
vec2 field(vec3 p){
  float t = uTime * uSpeed;
  float y = p.y;
  vec3 q = p;
  q.x -= uLean * y * y;
  vec3 m = vec3(q.x * uSize.x, y * uSize.y, q.z * uSize.x);           // metres
  // domain warp: slow swirls that make tongues fold over
  vec3 wq = vec3(m.x * 0.16, m.y * 0.11 - t * 0.55, m.z * 0.16) + uSeed;
  vec2 warp = vec2(gnoise3(wq), gnoise3(wq + vec3(5.2, 1.3, 7.7)));
  q.xz += warp * (0.18 + 0.45 * y) * uTurb;
  float r = uWidth * (0.1 + 1.05 * pow(max(y, 0.0), 0.42) * pow(max(1.0 - y, 0.0), 0.75));
  float d = length(q.xz) / max(r, 1e-3);
  // turbulence advected upward (~6 m/s), finer detail rises faster
  float n = fbm3(vec3(m.x * 0.26, m.y * 0.2 - t * 1.3, m.z * 0.26) + uSeed * 1.3);
  float n2 = gnoise3(vec3(m.x * 0.9, m.y * 0.7 - t * 4.2, m.z * 0.9) + uSeed * 2.1);
  float edge = 1.0 - d + n * 0.7 + n2 * 0.22;
  float body = smoothstep(0.0, 0.28, edge);
  // break into separate tongues toward the top
  float tongues = smoothstep(0.0, 0.2, (0.9 - y) * 1.5 + n * 0.7 + n2 * 0.15 - 0.2) * (1.0 - smoothstep(0.86, 0.99, y));
  float base = smoothstep(0.0, 0.035, y);
  float e = body * tongues * base;
  float T = 3000.0 - uCool * y - 1250.0 * clamp(d, 0.0, 1.4) + 380.0 * n + 140.0 * n2;
  return vec2(e, T);
}
void main(){
  vec3 ro = vCamObj;
  vec3 rd = normalize(vObj - vCamObj);
  vec2 h = boxHit(ro, rd);
  float t0 = max(h.x, 0.0), t1 = h.y;
  if (t1 <= t0) discard;
  float steps = uSteps;
  float dt = (t1 - t0) / steps;
  float jit = hash12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0);
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  for (int i = 0; i < 96; i++){
    if (float(i) >= steps) break;
    vec3 p = ro + rd * (t0 + (float(i) + jit) * dt);
    vec2 f = field(p);
    if (f.x > 0.002) {
      float k = f.x;
      float T = max(f.y, 900.0);
      float I = pow(T / 2000.0, 4.0) * (1.0 + 1.5 * smoothstep(2500.0, 3100.0, T));
      acc += blackbody(T) * I * k * dt * trans * 2.4;
      trans *= exp(-k * dt * 1.6);
    }
    if (trans < 0.02) break;
  }
  vec3 col = acc * uIntensity;
  // atmospheric extinction of the emission (no in-scatter added: additive blend)
  vec3 d = vWorld - cameraPosition;
  float dist = length(d);
  float b = 1.0 / uFogHeight;
  float amt = uFogDensity * exp(-cameraPosition.y * b) * dist;
  col *= exp(-amt * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`;

export function flameMaterial(opts = {}) {
  const u = {
    uTime: { value: 0 }, uIntensity: { value: opts.intensity ?? 1 }, uLean: { value: opts.lean ?? 0.25 },
    uTurb: { value: opts.turb ?? 1 }, uSeed: { value: opts.seed ?? 0 }, uSpeed: { value: opts.speed ?? 1 },
    uSteps: { value: opts.steps ?? 48 }, uWidth: { value: opts.width ?? 0.8 }, uCool: { value: opts.cool ?? 1250 },
    uSize: { value: new THREE.Vector2(opts.radius ?? 3, opts.height ?? 12) },
    uSmoke: { value: 0 },
    ...ATMOS,
  };
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  });
}

export function createFlame({ radius = 2.5, height = 12, lean = 0.3, seed = 0, steps = 48, intensity = 1 } = {}) {
  // The bounding box is 1.6x wider than the nominal flame so leaning, warped tongues never clip.
  const B = 1.6;
  const geo = new THREE.BoxGeometry(2, 1, 2); geo.translate(0, 0.5, 0);
  const mat = flameMaterial({ lean: lean / B, seed, steps, intensity, radius: radius * B, height });
  mat.uniforms.uWidth.value = 1.0 / B;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(radius * B, height, radius * B);
  mesh.userData.B = B;
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  return { mesh, mat, set(t, o = {}) { mat.uniforms.uTime.value = t; for (const k in o) if (mat.uniforms[k]) mat.uniforms[k].value = o[k]; } };
}

// Cheap flickering glow sprites for flares far away (the "constellation").
const SPRITE_VERT = /* glsl */ `
attribute float aSeed; attribute float aSize;
uniform float uTime; uniform float uScale; uniform float uFadeNear;
varying float vI; varying float vSeed;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float f = 0.75 + 0.25 * sin(uTime * (5.0 + aSeed * 7.0) + aSeed * 60.0) * sin(uTime * (2.3 + aSeed * 3.0));
  vI = f; vSeed = aSeed;
  gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 180.0);
  gl_Position = projectionMatrix * mv;
}`;
const SPRITE_FRAG = /* glsl */ `
uniform float uIntensity; uniform vec3 uColor; uniform vec3 uCore;
varying float vI; varying float vSeed;
void main(){
  vec2 c = gl_PointCoord - 0.5; c.y *= 0.8;
  float r = length(c) * 2.0;
  float g = exp(-r * r * 5.0) + exp(-r * 22.0) * 2.5;
  vec3 col = mix(uColor, uCore, exp(-r * 9.0));
  gl_FragColor = vec4(col * g * vI * uIntensity, 1.0);
}`;
export function flareSprites(points, { color = [1.0, 0.42, 0.1], core = [1.0, 0.85, 0.55], intensity = 6, scale = 900 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = [], seed = [], size = [];
  for (const p of points) { pos.push(p.x, p.y, p.z); seed.push(p.seed ?? Math.random()); size.push(p.size ?? 30); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG,
    uniforms: { uTime: { value: 0 }, uScale: { value: scale }, uIntensity: { value: intensity }, uColor: { value: new THREE.Vector3(...color) }, uCore: { value: new THREE.Vector3(...core) }, uFadeNear: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Soft atmospheric glow around a flame (light scattered by haze), as an additive billboard.
let _haloTex = null;
export function flameHalo(color = [2.2, 0.8, 0.25]) {
  if (!_haloTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.12)'); g.addColorStop(0.65, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    _haloTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.SpriteMaterial({ map: _haloTex, color: new THREE.Color(...color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1 });
  const s = new THREE.Sprite(m);
  s.renderOrder = 9;
  return s;
}
