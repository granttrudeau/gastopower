import * as THREE from 'three';

// Screen-space glowing polylines that draw themselves on, with a hot "pen tip" and flowing pulses.
// Used for field diagrams on the land, blueprint strokes, and energy flows.
const VERT = /* glsl */ `
attribute vec3 aPrev; attribute vec3 aNext; attribute float aSide; attribute float aDist;
attribute vec4 aInfo;   // x: total length, y: delay (s), z: speed (m/s), w: seed
attribute vec3 aColor; attribute float aWidth;
uniform vec2 uRes; uniform float uWidthScale;
varying float vSide; varying float vDist; varying vec4 vInfo; varying vec3 vColor; varying float vDepth;
vec2 toScreen(vec4 c){ return c.xy / c.w * uRes * 0.5; }
void main(){
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(aPrev, 1.0);
  vec4 n = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
  vec2 sc = toScreen(c), sp = toScreen(p), sn = toScreen(n);
  vec2 d1 = sc - sp, d2 = sn - sc;
  vec2 dir = normalize((length(d1) > 1e-4 ? normalize(d1) : vec2(0.0)) + (length(d2) > 1e-4 ? normalize(d2) : vec2(0.0)) + 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = aWidth * uWidthScale;
  c.xy += nrm * aSide * w / (uRes * 0.5) * c.w;
  gl_Position = c;
  vSide = aSide; vDist = aDist; vInfo = aInfo; vColor = aColor; vDepth = c.w;
}`;

const FRAG = /* glsl */ `
uniform float uTime; uniform float uProgress; uniform float uOpacity; uniform float uFlow; uniform float uFlowSpacing;
uniform float uHeadLen; uniform float uHeadBoost; uniform float uCore; uniform float uFade; uniform float uIntensity;
varying float vSide; varying float vDist; varying vec4 vInfo; varying vec3 vColor; varying float vDepth;
void main(){
  float head = (uProgress - vInfo.y) * vInfo.z;
  if (vDist > head) discard;
  float s = abs(vSide);
  float prof = exp(-s * s * 3.5) * 0.55 + exp(-s * s * 40.0) * uCore;
  float tip = exp(-(head - vDist) / uHeadLen) * uHeadBoost * step(head, vInfo.x + uHeadLen);
  float pulse = 0.0;
  if (uFlow > 0.0) {
    float f = fract((vDist - uTime * uFlow) / uFlowSpacing + vInfo.w);
    pulse = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.12, 0.5, f)) * 1.6;
  }
  // optional fade-out of the tail (older parts dim)
  float tail = uFade > 0.0 ? exp(-(head - vDist) / uFade) * 0.8 + 0.2 : 1.0;
  vec3 col = vColor * (prof * (1.0 + pulse) * tail + tip * prof * 3.0) * uIntensity;
  gl_FragColor = vec4(col * uOpacity, 1.0);
}`;

export class GlowLines {
  constructor({ width = 3, core = 1.2, headLen = 30, headBoost = 2.0, flow = 0, flowSpacing = 60, depthTest = true, fade = 0 } = {}) {
    this.uniforms = {
      uRes: { value: new THREE.Vector2(1920, 804) }, uWidthScale: { value: 1 },
      uTime: { value: 0 }, uProgress: { value: 0 }, uOpacity: { value: 1 }, uFlow: { value: flow }, uFlowSpacing: { value: flowSpacing },
      uHeadLen: { value: headLen }, uHeadBoost: { value: headBoost }, uCore: { value: core }, uFade: { value: fade }, uIntensity: { value: 1 },
    };
    this.defaultWidth = width;
    this.lines = [];
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = null;
  }

  // pts: array of [x,y,z] or Vector3; opts: {color:[r,g,b] (linear HDR), width, delay, speed, seed, step}
  add(pts, opts = {}) {
    const v = pts.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
    // resample so that long straight segments still reveal smoothly
    const step = opts.step ?? 8;
    const out = [v[0]];
    for (let i = 1; i < v.length; i++) {
      const a = v[i - 1], b = v[i];
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
      for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
    }
    this.lines.push({ pts: out, color: opts.color ?? [1, 1, 1], width: opts.width ?? this.defaultWidth, delay: opts.delay ?? 0, speed: opts.speed ?? 100, seed: opts.seed ?? Math.random() });
    return this;
  }

  build() {
    const P = [], PR = [], NX = [], SD = [], DI = [], IN = [], CO = [], WI = [], IDX = [];
    let base = 0;
    for (const L of this.lines) {
      const n = L.pts.length;
      let d = 0; const dist = [0];
      for (let i = 1; i < n; i++) { d += L.pts[i].distanceTo(L.pts[i - 1]); dist.push(d); }
      for (let i = 0; i < n; i++) {
        const p = L.pts[i], pr = L.pts[Math.max(0, i - 1)], nx = L.pts[Math.min(n - 1, i + 1)];
        for (const s of [-1, 1]) {
          P.push(p.x, p.y, p.z); PR.push(pr.x, pr.y, pr.z); NX.push(nx.x, nx.y, nx.z);
          SD.push(s); DI.push(dist[i]); IN.push(d, L.delay, L.speed, L.seed); CO.push(...L.color); WI.push(L.width);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        const a = base + i * 2;
        IDX.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      base += n * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aPrev', new THREE.Float32BufferAttribute(PR, 3));
    g.setAttribute('aNext', new THREE.Float32BufferAttribute(NX, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(SD, 1));
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(DI, 1));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(IN, 4));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(CO, 3));
    g.setAttribute('aWidth', new THREE.Float32BufferAttribute(WI, 1));
    g.setIndex(IDX);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    return this.mesh;
  }

  set({ progress, time, opacity, res, widthScale, intensity } = {}) {
    const u = this.uniforms;
    if (progress !== undefined) u.uProgress.value = progress;
    if (time !== undefined) u.uTime.value = time;
    if (opacity !== undefined) u.uOpacity.value = opacity;
    if (res) u.uRes.value.set(res[0], res[1]);
    if (widthScale !== undefined) u.uWidthScale.value = widthScale;
    if (intensity !== undefined) u.uIntensity.value = intensity;
  }
}

// Soft glowing points (wells, lamps, nodes), sized in pixels.
const PVERT = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute float aDelay; attribute float aSeed;
uniform float uProgress; uniform float uTime; uniform float uPx; uniform float uTwinkle; uniform float uOff;
varying vec3 vColor; varying float vOn;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float on = smoothstep(aDelay, aDelay + 0.35, uProgress);
  on *= 1.0 - smoothstep(aDelay, aDelay + 0.25, uOff);
  float tw = 1.0 + uTwinkle * 0.25 * sin(uTime * (2.0 + aSeed * 3.0) + aSeed * 30.0);
  vOn = on * tw; vColor = aColor;
  gl_PointSize = aSize * uPx * (0.6 + 0.4 * on);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */ `
uniform float uOpacity; varying vec3 vColor; varying float vOn;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
  float g = exp(-r * r * 6.0) * 0.6 + exp(-r * 18.0) * 1.4;
  gl_FragColor = vec4(vColor * g * vOn * uOpacity, 1.0);
}`;
export function glowPoints(list, { px = 1, twinkle = 0 } = {}) {
  const P = [], C = [], S = [], D = [], E = [];
  for (const p of list) { P.push(p.x, p.y, p.z); C.push(...(p.color ?? [1, 1, 1])); S.push(p.size ?? 8); D.push(p.delay ?? 0); E.push(p.seed ?? Math.random()); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1));
  g.setAttribute('aDelay', new THREE.Float32BufferAttribute(D, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(E, 1));
  const u = { uProgress: { value: 1 }, uTime: { value: 0 }, uPx: { value: px }, uTwinkle: { value: twinkle }, uOpacity: { value: 1 }, uOff: { value: -1 } };
  const m = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 21;
  return { points: pts, uniforms: u };
}
