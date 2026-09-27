import * as THREE from 'three';
import { NOISE } from '../engine/glsl.js';

const VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;

const FRAG = /* glsl */ `
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunSize; uniform float uSunDisk;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHorizonAway; uniform float uAwayAmt; uniform vec3 uGround; uniform vec3 uHazeColor; uniform vec3 uGlowColor;
uniform float uGlowPow; uniform float uGlowAmt; uniform float uHazeAmt; uniform float uHazeSharp; uniform float uGradPow;
uniform float uCover; uniform float uSharp; uniform float uCloudH; uniform float uCloudScale; uniform vec2 uCloudOff;
uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uCloudRim; uniform float uCloudAlpha; uniform float uCloudDark;
uniform float uCirrus; uniform vec3 uCirrusColor;
uniform float uStars; uniform float uMilky; uniform vec3 uMilkyAxis; uniform float uTime; uniform vec3 uCamPos; uniform vec3 uHorizonGlow; uniform float uHorizonGlowAmt;
varying vec3 vDir;
${NOISE}
float cloudD(vec2 p){
  vec2 q = vec2(fbm2(p + vec2(0.0, uTime*0.004)), fbm2(p + vec2(5.2, 1.3) - uTime*0.003));
  float n = fbm2hq(p * 1.1 + 1.6 * q);
  return smoothstep(1.0 - uCover, 1.0 - uCover + uSharp, n);
}
float stars(vec3 d){
  // cube-ish mapping of direction into cells; one potential star per cell
  vec3 a = abs(d);
  vec2 uv; float face;
  if (a.x > a.y && a.x > a.z) { uv = d.yz / a.x; face = sign(d.x); }
  else if (a.y > a.z) { uv = d.xz / a.y; face = 2.0 + sign(d.y); }
  else { uv = d.xy / a.z; face = 4.0 + sign(d.z); }
  float s = 0.0;
  for (int k = 0; k < 2; k++) {
    float g = k == 0 ? 180.0 : 420.0;
    vec2 c = uv * g; vec2 id = floor(c) + face * 131.0; vec2 f = fract(c) - 0.5;
    float h = hash12(id + float(k) * 71.0);
    vec2 o = (hash22(id) - 0.5) * 0.7;
    float r = length(f - o);
    float thr = k == 0 ? 0.965 : 0.93;
    if (h > thr) {
      float b = pow((h - thr) / (1.0 - thr), 3.0);
      float tw = 0.75 + 0.25 * sin(uTime * (2.0 + h * 7.0) + h * 40.0);
      s += b * tw * exp(-r * r * (k == 0 ? 90.0 : 160.0)) * (k == 0 ? 6.0 : 1.6);
    }
  }
  return s;
}
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  // horizon colour depends on azimuth: warm toward the sun, cool and lavender away from it
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(uSunDir.xz + 1e-5);
  float toward = pow(clamp(0.5 + 0.5 * dot(dh, sh), 0.0, 1.0), 2.2);
  vec3 hor = mix(mix(uHorizon, uHorizonAway, uAwayAmt), uHorizon, toward);
  vec3 col = mix(hor, uZenith, pow(clamp(h, 0.0, 1.0), uGradPow));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uGlowColor * (pow(sd, uGlowPow) * uGlowAmt + pow(sd, 5.0) * 0.18 * uGlowAmt);
  col += uHazeColor * exp(-max(h, 0.0) * uHazeSharp) * uHazeAmt * mix(1.0 - uAwayAmt * 0.8, 1.0, toward);
  col += uHorizonGlow * exp(-max(h, 0.0) * 30.0) * uHorizonGlowAmt;
  // night sky
  if (uStars > 0.0 && h > -0.02) {
    float mw = 0.0;
    if (uMilky > 0.0) {
      vec3 axis = normalize(uMilkyAxis);
      float bq = dot(d, axis) / 0.16;
      float band = exp(-bq * bq);
      float n = fbm3(d * 7.0) * 0.5 + 0.5;
      float dust = smoothstep(0.35, 0.75, fbm3(d * 13.0 + 3.0) * 0.5 + 0.5);
      mw = band * n * (1.0 - dust * 0.7) * uMilky;
      col += vec3(0.55, 0.6, 0.75) * mw * 0.08;
    }
    float st = stars(d) * smoothstep(-0.02, 0.12, h);
    col += vec3(0.85, 0.9, 1.0) * st * uStars * (1.0 + mw * 3.0);
  }
  // sun disk
  float cs = dot(d, uSunDir);
  float disk = smoothstep(cos(uSunSize), cos(uSunSize * 0.7), cs);
  col += uSunColor * disk * uSunDisk;
  // cirrus: thin streaks, high altitude
  if (h > 0.0 && uCirrus > 0.0) {
    float t = (9000.0 - uCamPos.y) / h;
    vec2 p = (uCamPos.xz + d.xz * t) / 9000.0;
    float c = fbm2(vec2(p.x * 1.2, p.y * 6.0) + uCloudOff * 0.5);
    c = smoothstep(0.52, 0.85, c) * smoothstep(0.0, 0.12, h);
    col = mix(col, uCirrusColor * (0.6 + 0.8 * pow(sd, 3.0)), c * uCirrus);
  }
  // cumulus layer
  if (h > 0.0 && uCloudAlpha > 0.0) {
    float t = (uCloudH - uCamPos.y) / h;
    vec2 wp = uCamPos.xz + d.xz * t;
    vec2 p = wp / uCloudScale + uCloudOff;
    float den = cloudD(p);
    if (den > 0.001) {
      vec2 sp = normalize(uSunDir.xz + 1e-4) * 0.06;
      float sh = cloudD(p + sp) * 0.6 + cloudD(p + sp * 2.3) * 0.4;
      float lit = clamp(1.0 - sh * 0.85, 0.0, 1.0);
      vec3 cc = mix(uCloudShade, uCloudLit, lit);
      cc = mix(cc, uCloudShade * 0.55, den * den * uCloudDark);
      float edge = 1.0 - den;
      cc += uCloudRim * pow(sd, 6.0) * edge * 2.5;
      float dist = t / 30000.0;
      float fade = smoothstep(0.0, 0.02, h);
      cc = mix(cc, hor + uHazeColor * uHazeAmt * 0.6 * toward, clamp(dist * 0.45, 0.0, 0.7));
      col = mix(col, cc, den * uCloudAlpha * fade);
    }
  }
  col = mix(col, uGround, smoothstep(-0.005, -0.06, h));
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const v3 = (a) => new THREE.Vector3(...a);

export const SKY_PRESETS = {
  night: {
    sunDir: [-0.3, -0.35, 0.8], sunColor: [0, 0, 0], sunDisk: 0,
    zenith: [0.002, 0.004, 0.011], horizon: [0.012, 0.016, 0.03], ground: [0.004, 0.004, 0.006],
    haze: [0.02, 0.018, 0.02], hazeAmt: 1.0, hazeSharp: 9, glow: [0, 0, 0], glowAmt: 0, glowPow: 8, gradPow: 0.5,
    cover: 0.0, cloudAlpha: 0.0, stars: 1.0, milky: 1.0, cirrus: 0, horizonGlow: [0.09, 0.035, 0.01], horizonGlowAmt: 0.0,
  },
  predawn: {
    sunDir: [0.5, -0.06, -0.86], sunColor: [0, 0, 0], sunDisk: 0,
    zenith: [0.012, 0.02, 0.05], horizon: [0.16, 0.11, 0.12], ground: [0.01, 0.01, 0.012],
    haze: [0.35, 0.16, 0.08], hazeAmt: 0.5, hazeSharp: 12, glow: [0.9, 0.35, 0.12], glowAmt: 0.6, glowPow: 5, gradPow: 0.4,
    cover: 0.35, sharp: 0.3, cloudAlpha: 0.7, cloudLit: [0.5, 0.22, 0.18], cloudShade: [0.05, 0.05, 0.09], cloudRim: [0.8, 0.3, 0.1], cloudDark: 0.5,
    stars: 0.35, milky: 0.0, cirrus: 0.6, cirrusColor: [0.7, 0.28, 0.18],
  },
  golden: {
    sunDir: [-0.8, 0.16, -0.58], sunColor: [1.0, 0.62, 0.3], sunDisk: 40, sunSize: 0.012,
    zenith: [0.07, 0.15, 0.36], horizon: [0.95, 0.62, 0.4], horizonAway: [0.4, 0.44, 0.58], ground: [0.1, 0.08, 0.06],
    haze: [0.9, 0.5, 0.26], hazeAmt: 0.35, hazeSharp: 12, glow: [1.4, 0.72, 0.32], glowAmt: 1.2, glowPow: 16, gradPow: 0.5,
    cover: 0.34, sharp: 0.2, cloudH: 1700, cloudScale: 2600, cloudAlpha: 1.0,
    cloudLit: [1.6, 1.0, 0.62], cloudShade: [0.16, 0.17, 0.27], cloudRim: [1.4, 0.7, 0.3], cloudDark: 0.7,
    stars: 0, cirrus: 0.22, cirrusColor: [1.0, 0.7, 0.5],
  },
  day: {
    sunDir: [0.35, 0.72, -0.6], sunColor: [1.0, 0.95, 0.88], sunDisk: 30, sunSize: 0.01,
    zenith: [0.12, 0.26, 0.55], horizon: [0.68, 0.76, 0.86], ground: [0.2, 0.18, 0.15],
    haze: [0.72, 0.76, 0.84], hazeAmt: 0.35, hazeSharp: 8, glow: [1.0, 0.95, 0.85], glowAmt: 0.5, glowPow: 30, gradPow: 0.6,
    cover: 0.5, sharp: 0.22, cloudH: 2400, cloudScale: 5600, cloudAlpha: 1.0,
    cloudLit: [1.5, 1.5, 1.52], cloudShade: [0.36, 0.4, 0.5], cloudRim: [0.5, 0.5, 0.5], cloudDark: 0.8,
    stars: 0, cirrus: 0.2, cirrusColor: [1, 1, 1],
  },
  dusk: {
    sunDir: [-0.75, -0.02, -0.66], sunColor: [1.0, 0.4, 0.15], sunDisk: 12, sunSize: 0.013,
    zenith: [0.03, 0.05, 0.14], horizon: [0.7, 0.32, 0.2], horizonAway: [0.16, 0.14, 0.24], ground: [0.03, 0.025, 0.025],
    haze: [0.9, 0.32, 0.14], hazeAmt: 0.6, hazeSharp: 14, glow: [1.2, 0.42, 0.14], glowAmt: 1.1, glowPow: 7, gradPow: 0.42,
    cover: 0.4, sharp: 0.3, cloudH: 2600, cloudScale: 6000, cloudAlpha: 0.9,
    cloudLit: [1.1, 0.42, 0.26], cloudShade: [0.08, 0.07, 0.13], cloudRim: [1.0, 0.4, 0.15], cloudDark: 0.55,
    stars: 0.08, cirrus: 0.7, cirrusColor: [1.0, 0.45, 0.3],
  },
};

export function createSky() {
  const u = {
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() }, uSunColor: { value: new THREE.Vector3(1, 1, 1) },
    uSunSize: { value: 0.012 }, uSunDisk: { value: 30 },
    uZenith: { value: new THREE.Vector3() }, uHorizon: { value: new THREE.Vector3() }, uHorizonAway: { value: new THREE.Vector3() }, uAwayAmt: { value: 0 }, uGround: { value: new THREE.Vector3() },
    uHazeColor: { value: new THREE.Vector3() }, uGlowColor: { value: new THREE.Vector3() },
    uGlowPow: { value: 8 }, uGlowAmt: { value: 1 }, uHazeAmt: { value: 0.5 }, uHazeSharp: { value: 10 }, uGradPow: { value: 0.5 },
    uCover: { value: 0.4 }, uSharp: { value: 0.3 }, uCloudH: { value: 2400 }, uCloudScale: { value: 5000 }, uCloudOff: { value: new THREE.Vector2() },
    uCloudLit: { value: new THREE.Vector3(1, 1, 1) }, uCloudShade: { value: new THREE.Vector3(0.3, 0.3, 0.4) }, uCloudRim: { value: new THREE.Vector3() },
    uCloudAlpha: { value: 0 }, uCloudDark: { value: 0.5 }, uCirrus: { value: 0 }, uCirrusColor: { value: new THREE.Vector3(1, 1, 1) },
    uStars: { value: 0 }, uMilky: { value: 0 }, uMilkyAxis: { value: new THREE.Vector3(0.35, 0.55, -0.75) }, uTime: { value: 0 }, uCamPos: { value: new THREE.Vector3() },
    uHorizonGlow: { value: new THREE.Vector3() }, uHorizonGlowAmt: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, side: THREE.BackSide, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -1000;
  mesh.onBeforeRender = (r, s, cam) => { u.uCamPos.value.copy(cam.position); };

  function apply(p) {
    const set = (k, v) => { if (v === undefined) return; if (Array.isArray(v)) u[k].value.set(...v); else u[k].value = v; };
    set('uSunDir', p.sunDir); u.uSunDir.value.normalize();
    set('uSunColor', p.sunColor); set('uSunSize', p.sunSize); set('uSunDisk', p.sunDisk);
    set('uZenith', p.zenith); set('uHorizon', p.horizon); set('uGround', p.ground);
    if (p.horizonAway) { u.uHorizonAway.value.set(...p.horizonAway); u.uAwayAmt.value = 1; } else u.uAwayAmt.value = 0;
    set('uHazeColor', p.haze); set('uHazeAmt', p.hazeAmt); set('uHazeSharp', p.hazeSharp);
    set('uGlowColor', p.glow); set('uGlowAmt', p.glowAmt); set('uGlowPow', p.glowPow); set('uGradPow', p.gradPow);
    set('uCover', p.cover); set('uSharp', p.sharp); set('uCloudH', p.cloudH); set('uCloudScale', p.cloudScale);
    set('uCloudAlpha', p.cloudAlpha); set('uCloudLit', p.cloudLit); set('uCloudShade', p.cloudShade); set('uCloudRim', p.cloudRim);
    set('uCloudDark', p.cloudDark); set('uCirrus', p.cirrus); set('uCirrusColor', p.cirrusColor);
    set('uStars', p.stars); set('uMilky', p.milky); set('uHorizonGlow', p.horizonGlow); set('uHorizonGlowAmt', p.horizonGlowAmt);
    if (p.cloudOff) u.uCloudOff.value.set(...p.cloudOff);
    if (p.milkyAxis) u.uMilkyAxis.value.set(...p.milkyAxis);
  }

  // Blend two presets (for time-of-day transitions).
  function blend(a, b, t) {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const va = a[k] ?? b[k], vb = b[k] ?? a[k];
      out[k] = Array.isArray(va) ? va.map((x, i) => x + (vb[i] - x) * t) : va + (vb - va) * t;
    }
    return out;
  }
  return { mesh, uniforms: u, apply, blend, presets: SKY_PRESETS };
}
