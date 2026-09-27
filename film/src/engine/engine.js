import * as THREE from 'three';
import { TONEMAP, NOISE } from './glsl.js';
import { halton, lerp, clamp } from './util.js';

const FSQ_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class FSQuad {
  constructor(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(renderer, target, material) {
    if (material) this.mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.mesh, this.cam);
  }
}

export function fsMaterial(fragmentShader, uniforms = {}, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FSQ_VERT, fragmentShader, uniforms,
    depthTest: false, depthWrite: false, ...extra,
  });
}

// ---------------------------------------------------------------- post shaders
const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uKaris; uniform float uThreshold;
varying vec2 vUv;
vec3 s(vec2 o){ vec3 c = texture2D(tSrc, vUv + o * uTexel).rgb; return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : c; }
float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
vec3 k(vec3 c){ return c / (1.0 + lum(c)); }
void main(){
  vec3 a=s(vec2(-2,2)), b=s(vec2(0,2)), c=s(vec2(2,2));
  vec3 d=s(vec2(-2,0)), e=s(vec2(0,0)), f=s(vec2(2,0));
  vec3 g=s(vec2(-2,-2)), h=s(vec2(0,-2)), i=s(vec2(2,-2));
  vec3 j=s(vec2(-1,1)), kk=s(vec2(1,1)), l=s(vec2(-1,-1)), m=s(vec2(1,-1));
  vec3 col;
  if (uKaris > 0.5) {
    vec3 g0 = (k(j)+k(kk)+k(l)+k(m))*0.25*0.5;
    vec3 g1 = (k(a)+k(b)+k(d)+k(e))*0.25*0.125;
    vec3 g2 = (k(b)+k(c)+k(e)+k(f))*0.25*0.125;
    vec3 g3 = (k(d)+k(e)+k(g)+k(h))*0.25*0.125;
    vec3 g4 = (k(e)+k(f)+k(h)+k(i))*0.25*0.125;
    col = g0+g1+g2+g3+g4;
    col = col / max(1.0 - lum(col), 1e-3);
    col = max(col - uThreshold, 0.0);
  } else {
    col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+kk+l+m)*0.125;
  }
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius;
varying vec2 vUv;
void main(){
  vec2 r = uTexel * uRadius;
  vec3 c = texture2D(tSrc, vUv + vec2(-r.x, r.y)).rgb + texture2D(tSrc, vUv + vec2(0, r.y)).rgb*2.0 + texture2D(tSrc, vUv + vec2(r.x, r.y)).rgb
         + texture2D(tSrc, vUv + vec2(-r.x, 0)).rgb*2.0 + texture2D(tSrc, vUv).rgb*4.0 + texture2D(tSrc, vUv + vec2(r.x, 0)).rgb*2.0
         + texture2D(tSrc, vUv + vec2(-r.x,-r.y)).rgb + texture2D(tSrc, vUv + vec2(0,-r.y)).rgb*2.0 + texture2D(tSrc, vUv + vec2(r.x,-r.y)).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}`;

const STREAK_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uStep;
varying vec2 vUv;
void main(){
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -12; i <= 12; i++){
    float x = float(i);
    float w = exp(-abs(x) * 0.18);
    vec3 c = texture2D(tSrc, vUv + vec2(x * uStep * uTexel.x, 0.0)).rgb;
    c = max(c - uThreshold, 0.0);
    acc += c * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const ACCUM_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform float uWeight; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(min(c, vec3(6.0e4)) * uWeight, uWeight); }`;

const TRANSITION_FRAG = /* glsl */ `
uniform sampler2D tA; uniform sampler2D tB; uniform float uP; uniform int uType; uniform vec2 uAspect; uniform float uSeed;
uniform vec3 uEdgeColor;
varying vec2 vUv;
${NOISE}
float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
void main(){
  vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb;
  vec3 col;
  if (uType == 1) { col = mix(a, b, uP); }
  else if (uType == 2) { col = uP < 0.5 ? a * pow(1.0 - uP*2.0, 1.6) : b * pow(uP*2.0 - 1.0, 1.6); }
  else if (uType == 3) { float f = 1.0 - abs(uP*2.0-1.0); vec3 w = vec3(6.0) * f*f; col = mix(a, b, smoothstep(0.35,0.65,uP)) + w; }
  else if (uType == 4) {
    // Film burn: a warped front eats the frame; behind the thin ember line the old image chars, then B shows through.
    vec2 p = vUv * uAspect;
    vec2 w = vec2(fbm2(p * 2.2 + uSeed), fbm2(p * 2.2 + uSeed + 7.3));
    float n = fbm2(p * 1.6 + w * 1.4 + uSeed * 0.5) * 0.8 + vnoise2(p * 40.0 + uSeed) * 0.06;
    float front = uP * 1.25 - 0.12;
    float d = n - front;                           // > 0: not yet burned
    float edge = exp(-abs(d) * 90.0);
    float glow = exp(-max(d, 0.0) * 18.0) * step(0.0, d);
    float charZone = smoothstep(0.0, 0.05, d) * (1.0 - smoothstep(0.05, 0.14, d));
    vec3 aa = a * (1.0 - 0.85 * charZone) * (1.0 - 0.6 * glow);
    col = mix(b, aa, smoothstep(-0.004, 0.004, d));
    col += uEdgeColor * (edge * 14.0 + glow * 1.5) * smoothstep(0.0, 0.06, uP) * (1.0 - smoothstep(0.92, 1.0, uP));
  }
  else if (uType == 5) {
    // Luma reveal: bright parts of B appear first (light pours in).
    float l = clamp(lum(b) * 0.6, 0.0, 1.0);
    float m = smoothstep(l - 0.25, l + 0.05, uP * 1.3 - 0.1);
    col = mix(a * (1.0 - uP*0.7), b, m);
  }
  else if (uType == 6) {
    // Invert: the paper goes dark and the ink turns to light (etching -> blueprint), then B takes over.
    float la = lum(a);
    vec3 inv = vec3(0.25, 1.6, 1.15) * pow(clamp(1.0 - la / 1.15, 0.0, 1.0), 6.0) * 0.45 + vec3(0.003, 0.009, 0.008);
    vec3 a2 = mix(a, inv, smoothstep(0.0, 0.55, uP));
    col = mix(a2, b, smoothstep(0.45, 1.0, uP));
  }
  else { col = uP < 0.5 ? a : b; }
  gl_FragColor = vec4(col, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tStreak; uniform sampler2D tOverlay; uniform sampler2D tRays;
uniform vec2 uRes; uniform vec4 uBand; // band: x0,y0,w,h in full-frame uv
uniform float uExposure, uBloom, uStreak, uVignette, uGrain, uCA, uSat, uContrast, uFade, uWhiteFade, uTime, uFrame;
uniform vec3 uLift, uGamma, uGain, uTint, uShadowTint, uHighTint;
uniform float uLookPower, uLookSat;
uniform vec4 uHaze[8]; uniform int uHazeCount; uniform float uHazeTime;
uniform vec3 uRays; uniform vec3 uRaysColor; uniform float uOverlayOnly;
varying vec2 vUv;
${NOISE}
${TONEMAP}
float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
void main(){
  vec3 outc = vec3(0.0);
  vec2 buv = (vUv - uBand.xy) / uBand.zw;
  bool inBand = all(greaterThanEqual(buv, vec2(0.0))) && all(lessThanEqual(buv, vec2(1.0)));
  if (inBand && uOverlayOnly < 0.5) {
    vec2 uv = buv;
    // heat haze
    vec2 aspect = vec2(uRes.x / uRes.y * uBand.z / uBand.w, 1.0);
    for (int i = 0; i < 8; i++) {
      if (i >= uHazeCount) break;
      vec4 h = uHaze[i];
      vec2 d = (uv - h.xy) * aspect;
      float up = max(d.y, 0.0);
      float w = h.z * (1.0 + up * 3.0);
      float dxw = d.x / w;
      float m = exp(-dxw * dxw) * smoothstep(-h.z*0.3, h.z*0.5, d.y) * exp(-up / (h.z * 6.0));
      vec2 q = uv * vec2(90.0, 60.0) + vec2(0.0, -uHazeTime * 5.0);
      vec2 off = vec2(vnoise2(q) - 0.5, vnoise2(q + 17.0) - 0.5);
      uv += off * h.w * m * 0.012;
    }
    vec2 cc = uv - 0.5;
    float r2 = dot(cc, cc);
    vec2 caOff = cc * r2 * uCA * 0.02;
    vec3 col;
    col.r = texture2D(tScene, uv - caOff).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv + caOff).b;
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    vec3 bloom = texture2D(tBloom, uv).rgb;
    col = mix(col, bloom, clamp(uBloom, 0.0, 1.0)) + bloom * max(uBloom - 1.0, 0.0);
    col += texture2D(tStreak, uv).rgb * uStreak * vec3(0.75, 0.85, 1.25);
    // god rays from a screen-space light position
    if (uRays.z > 0.0) {
      vec2 dir = (uv - uRays.xy);
      vec3 acc = vec3(0.0);
      float decay = 1.0;
      for (int i = 0; i < 32; i++) {
        vec2 p = uv - dir * (float(i) / 32.0) * 0.9;
        acc += texture2D(tRays, p).rgb * decay;
        decay *= 0.95;
      }
      col += acc / 32.0 * uRays.z * uRaysColor;
    }
    col *= uExposure * uTint;
    // split toning in scene-linear space before the tone curve
    float L = lum(col);
    col *= mix(uShadowTint, uHighTint, smoothstep(0.02, 1.2, L));
    col = agx(col);
    col = agxLook(col, uLookPower, uLookSat);
    col = agxEotf(col);
    // lift / gamma / gain + contrast + saturation in display-referred linear
    col = uGain * (col + uLift * (1.0 - col));
    col = pow(max(col, 0.0), 1.0 / uGamma);
    float l2 = lum(col);
    col = l2 + uSat * (col - l2);
    col = (col - 0.18) * uContrast + 0.18;
    col = max(col, 0.0);
    // vignette (cos^4-ish)
    vec2 vv = (buv - 0.5) * vec2(1.0, 0.75);
    col *= mix(1.0, smoothstep(0.85, 0.15, length(vv)), uVignette);
    outc = linearToSRGB(clamp(col, 0.0, 1.0));
    // film grain (display space, stronger in midtones)
    float g = hash12(vUv * uRes + fract(uFrame * 0.6180339) * 1000.0) + hash12(vUv * uRes * 1.37 + fract(uFrame * 0.414) * 711.0) - 1.0;
    float gm = 4.0 * l2 * (1.0 - l2) + 0.25;
    outc += g * uGrain * gm;
    outc = mix(outc, vec3(1.0), uWhiteFade);
    outc *= (1.0 - uFade);
  }
  // overlay typography composited in display space (already sRGB)
  vec4 ov = texture2D(tOverlay, vUv);
  outc = mix(outc, ov.rgb, ov.a);
  // triangular dither to fight banding in dark gradients
  float dn = hash12(vUv * uRes + uFrame * 3.1) + hash12(vUv * uRes * 0.71 + uFrame * 1.7) - 1.0;
  outc += dn / 255.0;
  gl_FragColor = vec4(outc, 1.0);
}`;

export const DEFAULT_POST = {
  exposure: 1.0, bloom: 0.06, bloomRadius: 1.0, bloomThreshold: 0.0, streak: 0.0, streakThreshold: 3.0,
  vignette: 0.35, grain: 0.035, ca: 0.5, sat: 1.0, contrast: 1.0,
  lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], tint: [1, 1, 1],
  shadowTint: [1, 1, 1], highTint: [1, 1, 1], lookPower: 1.0, lookSat: 1.0,
  fade: 0, whiteFade: 0, haze: [], rays: null, raysColor: [1, 0.85, 0.6],
};

function mixPost(a, b, t) {
  const out = {};
  for (const k of Object.keys(DEFAULT_POST)) {
    const va = a[k] ?? DEFAULT_POST[k], vb = b[k] ?? DEFAULT_POST[k];
    if (k === 'haze') out[k] = t < 0.5 ? va : vb;
    else if (k === 'rays') out[k] = t < 0.5 ? va : vb;
    else if (Array.isArray(va)) out[k] = va.map((x, i) => lerp(x, vb[i], t));
    else out[k] = lerp(va, vb, t);
  }
  return out;
}

export class Engine {
  constructor(canvas, opts = {}) {
    this.W = opts.width ?? 1920; this.H = opts.height ?? 1080;
    this.aspect = opts.aspect ?? 2.39;
    this.AW = this.W; this.AH = Math.round(this.W / this.aspect / 2) * 2;
    this.fps = opts.fps ?? 24;
    this.renderScale = opts.renderScale ?? 1;
    const r = this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance', stencil: false,
    });
    r.setPixelRatio(1);
    r.setSize(this.W, this.H, false);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.quad = new FSQuad();
    this.msaa = opts.msaa ?? 4;
    this._buildTargets();
    this._buildMaterials();
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = this.W; this.overlayCanvas.height = this.H;
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.overlayTex = new THREE.CanvasTexture(this.overlayCanvas);
    this.overlayTex.colorSpace = THREE.NoColorSpace;
    this.overlayTex.minFilter = THREE.LinearFilter; this.overlayTex.magFilter = THREE.LinearFilter;
    this.overlayTex.generateMipmaps = false;
    this.jitter = { x: 0, y: 0 };
    this.frame = 0;
  }

  get rw() { return Math.round(this.AW * this.renderScale); }
  get rh() { return Math.round(this.AH * this.renderScale); }

  _hdrTarget(w, h, msaa, depth = true) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: depth, stencilBuffer: false,
      samples: msaa, colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
  }

  _buildTargets() {
    const w = this.rw, h = this.rh;
    this.rtA = this._hdrTarget(w, h, this.msaa);
    this.rtB = this._hdrTarget(w, h, this.msaa);
    this.rtMix = this._hdrTarget(w, h, 0, false);
    this.rtAccum = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.FloatType, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < 7; i++) {
      mw = Math.max(2, Math.round(mw / 2)); mh = Math.max(2, Math.round(mh / 2));
      this.mips.push(this._hdrTarget(mw, mh, 0, false));
    }
    this.streakA = this._hdrTarget(this.mips[2].width, this.mips[2].height, 0, false);
    this.streakB = this._hdrTarget(this.mips[2].width, this.mips[2].height, 0, false);
  }

  _buildMaterials() {
    this.downMat = fsMaterial(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uKaris: { value: 0 }, uThreshold: { value: 0 } });
    this.upMat = fsMaterial(UP_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } },
      { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });
    this.streakMat = fsMaterial(STREAK_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 3 }, uStep: { value: 1 } });
    this.accumMat = fsMaterial(ACCUM_FRAG, { tSrc: { value: null }, uWeight: { value: 1 } },
      { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });
    this.transMat = fsMaterial(TRANSITION_FRAG, {
      tA: { value: null }, tB: { value: null }, uP: { value: 0 }, uType: { value: 1 },
      uAspect: { value: new THREE.Vector2(this.aspect, 1) }, uSeed: { value: 0 }, uEdgeColor: { value: new THREE.Color(1.0, 0.45, 0.12) },
    });
    const hz = []; for (let i = 0; i < 8; i++) hz.push(new THREE.Vector4());
    this.compMat = fsMaterial(COMPOSITE_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, tStreak: { value: null }, tOverlay: { value: null }, tRays: { value: null },
      uRes: { value: new THREE.Vector2(this.W, this.H) },
      uBand: { value: new THREE.Vector4(0, (1 - this.AH / this.H) / 2, 1, this.AH / this.H) },
      uExposure: { value: 1 }, uBloom: { value: 0.05 }, uStreak: { value: 0 }, uVignette: { value: 0.3 }, uGrain: { value: 0.03 },
      uCA: { value: 0.5 }, uSat: { value: 1 }, uContrast: { value: 1 }, uFade: { value: 0 }, uWhiteFade: { value: 0 },
      uTime: { value: 0 }, uFrame: { value: 0 },
      uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uTint: { value: new THREE.Vector3(1, 1, 1) }, uShadowTint: { value: new THREE.Vector3(1, 1, 1) }, uHighTint: { value: new THREE.Vector3(1, 1, 1) },
      uLookPower: { value: 1 }, uLookSat: { value: 1 },
      uHaze: { value: hz }, uHazeCount: { value: 0 }, uHazeTime: { value: 0 },
      uRays: { value: new THREE.Vector3(0.5, 0.5, 0) }, uRaysColor: { value: new THREE.Vector3(1, 0.85, 0.6) },
      uOverlayOnly: { value: 0 },
    });
  }

  // Apply sub-pixel jitter to a perspective camera for temporal supersampling.
  applyJitter(camera) {
    if (this.jitter.x === 0 && this.jitter.y === 0) { camera.clearViewOffset(); return; }
    camera.setViewOffset(this.rw, this.rh, this.jitter.x, this.jitter.y, this.rw, this.rh);
  }

  // Render one shot's HDR image into target.
  renderShot(shot, t, target) {
    const lt = t - shot.start;
    shot.update(lt, t);
    if (shot.render) shot.render(this, target, lt, t);
    else {
      this.applyJitter(shot.camera);
      this.renderer.setRenderTarget(target);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.renderer.render(shot.scene, shot.camera);
      shot.camera.clearViewOffset();
    }
  }

  // Compose the timeline at time t into an HDR target; returns {target, post}.
  composeAt(timeline, t) {
    const { a, b, p, type } = timeline.at(t, this.frameT ?? t);
    if (!b) {
      this.renderShot(a, t, this.rtA);
      return { tex: this.rtA.texture, post: a.post ? a.post(t - a.start, t) : {} };
    }
    this.renderShot(a, t, this.rtA);
    this.renderShot(b, t, this.rtB);
    const m = this.transMat.uniforms;
    m.tA.value = this.rtA.texture; m.tB.value = this.rtB.texture; m.uP.value = p; m.uType.value = type.code;
    m.uSeed.value = type.seed ?? 0;
    if (type.edge) m.uEdgeColor.value.setRGB(...type.edge);
    this.quad.render(this.renderer, this.rtMix, this.transMat);
    const pa = a.post ? a.post(t - a.start, t) : {}, pb = b.post ? b.post(t - b.start, t) : {};
    return { tex: this.rtMix.texture, post: mixPost({ ...DEFAULT_POST, ...pa }, { ...DEFAULT_POST, ...pb }, p) };
  }

  bloom(srcTex, post) {
    const r = this.renderer;
    let src = srcTex, sw = this.rw, sh = this.rh;
    for (let i = 0; i < this.mips.length; i++) {
      const u = this.downMat.uniforms;
      u.tSrc.value = src; u.uTexel.value.set(1 / sw, 1 / sh); u.uKaris.value = i === 0 ? 1 : 0;
      u.uThreshold.value = post.bloomThreshold ?? 0;
      this.quad.render(r, this.mips[i], this.downMat);
      src = this.mips[i].texture; sw = this.mips[i].width; sh = this.mips[i].height;
    }
    r.autoClear = false;
    for (let i = this.mips.length - 1; i > 0; i--) {
      const u = this.upMat.uniforms;
      u.tSrc.value = this.mips[i].texture; u.uTexel.value.set(1 / this.mips[i].width, 1 / this.mips[i].height);
      u.uRadius.value = post.bloomRadius ?? 1;
      this.quad.render(r, this.mips[i - 1], this.upMat);
    }
    r.autoClear = true;
    if ((post.streak ?? 0) > 0) {
      const m2 = this.mips[1];
      const su = this.streakMat.uniforms;
      su.tSrc.value = m2.texture; su.uTexel.value.set(1 / this.streakA.width, 1 / this.streakA.height);
      su.uThreshold.value = post.streakThreshold ?? 3; su.uStep.value = 2.0;
      this.quad.render(r, this.streakA, this.streakMat);
      su.tSrc.value = this.streakA.texture; su.uThreshold.value = 0; su.uStep.value = 6.0;
      this.quad.render(r, this.streakB, this.streakMat);
      su.tSrc.value = this.streakB.texture; su.uStep.value = 16.0;
      this.quad.render(r, this.streakA, this.streakMat);
    }
  }

  composite(sceneTex, post, t, overlayOnly = false) {
    const p = { ...DEFAULT_POST, ...post, ...(window.__postOverride || {}) };
    const u = this.compMat.uniforms;
    u.tScene.value = sceneTex; u.tBloom.value = this.mips[0].texture; u.tStreak.value = this.streakA.texture;
    u.tRays.value = this.mips[2].texture;
    u.tOverlay.value = this.overlayTex;
    u.uExposure.value = p.exposure; u.uBloom.value = p.bloom; u.uStreak.value = p.streak;
    u.uVignette.value = p.vignette; u.uGrain.value = p.grain; u.uCA.value = p.ca; u.uSat.value = p.sat; u.uContrast.value = p.contrast;
    u.uFade.value = p.fade; u.uWhiteFade.value = p.whiteFade; u.uTime.value = t; u.uFrame.value = this.frame;
    u.uLift.value.set(...p.lift); u.uGamma.value.set(...p.gamma); u.uGain.value.set(...p.gain); u.uTint.value.set(...p.tint);
    u.uShadowTint.value.set(...p.shadowTint); u.uHighTint.value.set(...p.highTint);
    u.uLookPower.value = p.lookPower; u.uLookSat.value = p.lookSat;
    const hz = p.haze || [];
    u.uHazeCount.value = Math.min(hz.length, 8);
    for (let i = 0; i < 8; i++) { const h = hz[i]; if (h) u.uHaze.value[i].set(h[0], h[1], h[2], h[3]); }
    u.uHazeTime.value = t;
    if (p.rays) { u.uRays.value.set(p.rays[0], p.rays[1], p.rays[2]); } else u.uRays.value.set(0.5, 0.5, 0);
    u.uRaysColor.value.set(...p.raysColor);
    u.uOverlayOnly.value = overlayOnly ? 1 : 0;
    this.renderer.setRenderTarget(null);
    this.renderer.setViewport(0, 0, this.W, this.H);
    this.quad.render(this.renderer, null, this.compMat);
  }

  // Full frame: temporal supersampling (jitter + shutter), post, overlay.
  renderFrame(timeline, frameIndex, { subframes = 1, shutter = 0.5, overlay } = {}) {
    const r = this.renderer;
    const t = frameIndex / this.fps;
    this.frame = frameIndex;
    this.frameT = t;
    let post = {};
    if (subframes <= 1) {
      this.jitter.x = 0; this.jitter.y = 0;
      const res = this.composeAt(timeline, t);
      post = res.post;
      this._finish(res.tex, post, t, overlay, timeline);
      return;
    }
    r.setRenderTarget(this.rtAccum); r.setClearColor(0x000000, 0); r.clear();
    for (let s = 0; s < subframes; s++) {
      const ts = t + ((s + 0.5) / subframes - 0.5) * shutter / this.fps;
      this.jitter.x = (halton(s + 1, 2) - 0.5); this.jitter.y = (halton(s + 1, 3) - 0.5);
      const res = this.composeAt(timeline, ts);
      if (s === Math.floor(subframes / 2)) post = res.post;
      const u = this.accumMat.uniforms; u.tSrc.value = res.tex; u.uWeight.value = 1 / subframes;
      r.autoClear = false;
      this.quad.render(r, this.rtAccum, this.accumMat);
      r.autoClear = true;
    }
    this.jitter.x = 0; this.jitter.y = 0;
    this._finish(this.rtAccum.texture, post, t, overlay, timeline);
  }

  _finish(tex, post, t, overlay, timeline) {
    const p = { ...DEFAULT_POST, ...post };
    this.bloom(tex, p);
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (overlay) overlay(ctx, t, this);
    this.overlayTex.needsUpdate = true;
    this.composite(tex, p, t);
  }
}
