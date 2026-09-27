import * as THREE from 'three';
import { NOISE, BLACKBODY } from '../engine/glsl.js';

// Deterministic rising embers/sparks. All motion is computed on the GPU from time + per-particle seeds,
// so any frame can be rendered independently (and motion blur comes from temporal supersampling).
const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uOrigin; uniform vec3 uSpread; uniform float uRise; uniform float uLife;
uniform float uSwirl; uniform float uSize; uniform vec3 uWind; uniform float uGravity; uniform float uPx;
varying float vHeat; varying float vA;
${NOISE}
void main(){
  float life = uLife * (0.55 + 0.9 * aSeed.w);
  float age = mod(uTime + aSeed.x * life * 7.13, life);
  float k = age / life;
  vec3 start = uOrigin + (aSeed.xyz - 0.5) * uSpread;
  vec3 p = start;
  p.y += uRise * age * (0.6 + aSeed.y) - uGravity * age * age;
  p += uWind * age;
  float n1 = gnoise3(vec3(aSeed.xy * 13.0, age * 0.7));
  float n2 = gnoise3(vec3(aSeed.zw * 11.0, age * 0.7 + 3.0));
  p.x += n1 * uSwirl * age; p.z += n2 * uSwirl * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vHeat = 1.0 - k;
  vA = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.55, 1.0, k)) * (0.5 + 0.5 * sin(uTime * (9.0 + aSeed.z * 20.0) + aSeed.w * 40.0) * 0.5 + 0.5);
  gl_PointSize = max(1.2, uSize * uPx * (0.5 + aSeed.w) / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform float uIntensity; varying float vHeat; varying float vA;
${BLACKBODY}
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
  float g = exp(-r * r * 4.0);
  vec3 col = blackbody(mix(1300.0, 2600.0, vHeat)) * (0.6 + 2.4 * vHeat * vHeat);
  gl_FragColor = vec4(col * g * vA * uIntensity, 1.0);
}`;

export function createEmbers({ count = 400, origin = [0, 0, 0], spread = [2, 1, 2], rise = 3, life = 4, swirl = 1.2, size = 18, wind = [0.4, 0, 0], gravity = 0, intensity = 3, seed = 1 } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const sd = new Float32Array(count * 4);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < count; i++) { sd[i * 4] = rnd(); sd[i * 4 + 1] = rnd(); sd[i * 4 + 2] = rnd(); sd[i * 4 + 3] = rnd(); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  const u = {
    uTime: { value: 0 }, uOrigin: { value: new THREE.Vector3(...origin) }, uSpread: { value: new THREE.Vector3(...spread) },
    uRise: { value: rise }, uLife: { value: life }, uSwirl: { value: swirl }, uSize: { value: size }, uWind: { value: new THREE.Vector3(...wind) },
    uGravity: { value: gravity }, uIntensity: { value: intensity }, uPx: { value: 1 },
  };
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 12;
  return { points: pts, uniforms: u };
}
