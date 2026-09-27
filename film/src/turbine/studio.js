// Shared studio for the NovaLT sequences: one engine instance, a dark teal-black void, dramatic key/rim lights,
// a drafting grid (for the blueprint) and a green "power" layer around the generator.
import * as THREE from 'three';
import { buildNovaLT, hubR, tipR } from './novalt.js';
import { studioEnvironment } from '../engine/env.js';
import { GlowLines } from '../world/lines.js';
import { NOISE } from '../engine/glsl.js';

let STUDIO = null;
export function getStudio(engine) {
  if (!STUDIO) STUDIO = buildStudio(engine);
  return STUDIO;
}

function buildStudio(engine) {
  engine.renderer.localClippingEnabled = true;
  const env = studioEnvironment(engine.renderer, { key: 2.2, rim: 1.8, top: 2.4, teal: 1.0 });
  const scene = new THREE.Scene();
  const T = buildNovaLT(engine.renderer, env);
  scene.add(T.root);

  // backdrop: a huge sphere with a soft radial glow behind the machine
  const bgU = { uTop: { value: new THREE.Color(0.006, 0.012, 0.012) }, uBottom: { value: new THREE.Color(0.001, 0.002, 0.002) }, uGlow: { value: new THREE.Color(0.008, 0.03, 0.026) }, uGlowDir: { value: new THREE.Vector3(0, 0.15, -1).normalize() }, uAmt: { value: 1 } };
  const bg = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
    uniforms: bgU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }',
    fragmentShader: `uniform vec3 uTop, uBottom, uGlow, uGlowDir; uniform float uAmt; varying vec3 vD;
      ${NOISE}
      void main(){ vec3 c = mix(uBottom, uTop, smoothstep(-0.4, 0.6, vD.y));
        c += uGlow * pow(max(dot(vD, uGlowDir), 0.0), 3.0);
        c *= 0.92 + 0.08 * vnoise2(vD.xy * 40.0);
        gl_FragColor = vec4(c * uAmt, 1.0); }`,
  }));
  bg.renderOrder = -1000; bg.frustumCulled = false;
  scene.add(bg);

  // lights
  const key = new THREE.DirectionalLight(0xffeedd, 2.6); key.position.set(-5, 7, 6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
  const rim = new THREE.DirectionalLight(0xb9e4ff, 2.4); rim.position.set(6, 3, -7);
  const kick = new THREE.PointLight(0x02bc94, 6, 12, 2); kick.position.set(0.5, -1.4, 2.8);
  const hemi = new THREE.HemisphereLight(0x33484a, 0x080808, 0.35);
  scene.add(key, rim, kick, hemi);

  // drafting grid in the z = -0.004 plane (fades out once the solid starts to revolve)
  const gridU = { uA: { value: 0 }, uColor: { value: new THREE.Color(0.012, 0.085, 0.065) } };
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.ShaderMaterial({
    uniforms: gridU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA; uniform vec3 uColor; varying vec2 vP;
      float ln(float v, float w){ float x = 0.5 - abs(fract(v) - 0.5); float d = fwidth(v); return 1.0 - smoothstep(w - d, w + d, x); }
      void main(){
        float minor = ln(vP.x * 10.0, 0.02) * 0.35 + ln(vP.y * 10.0, 0.02) * 0.35;
        float major = ln(vP.x * 2.0, 0.012) + ln(vP.y * 2.0, 0.012);
        float axis = (1.0 - smoothstep(0.0, 0.006, abs(vP.y))) * step(0.5, fract(vP.x * 4.0 + 0.1)) * 1.5;
        float edge = smoothstep(8.0, 5.5, abs(vP.x)) * smoothstep(3.5, 2.2, abs(vP.y));
        gl_FragColor = vec4(uColor * (max(minor, major * 1.2) + axis) * edge * uA, 1.0);
      }`,
  }));
  grid.position.set(0.3, 0, -0.004);
  scene.add(grid);

  // the blueprint strokes: full longitudinal section (upper half = the vertical cut face, plus the mirror)
  const draw = new GlowLines({ width: 1.6, core: 1.8, headLen: 0.12, headBoost: 3.5 });
  const MINT = [0.35, 2.2, 1.6];
  const xmin = -3.3, xmax = 9.3;
  for (const pr of T.profiles) {
    const pts = pr.closed ? [...pr.pts, pr.pts[0]] : pr.pts;
    const x0 = Math.min(...pts.map((p) => p[0]));
    const delay = ((x0 - xmin) / (xmax - xmin)) * 2.4;   // the pen sweeps from inlet to generator
    draw.add(pts.map(([x, r]) => [x, r, 0.002]), { color: MINT, delay, speed: 5.5, step: 0.02 });
    draw.add(pts.map(([x, r]) => [x, -r, 0.002]), { color: MINT.map((c) => c * 0.55), delay: delay + 0.15, speed: 5.5, step: 0.02 });
  }
  // blade rows as the drafting convention: short vertical strokes from hub to tip
  for (const im of T.bladeMeshes) {
    const row = im.userData.row;
    const x = row.x, h = hubR(x) + 0.01, t = tipR(x) - 0.01, c = row.chord * 0.5;
    const delay = ((x - xmin) / (xmax - xmin)) * 2.4 + 0.3;
    const col = row.mat === 'hot' ? [2.2, 1.0, 0.35] : MINT;
    for (const sgn of [1, -1]) draw.add([[x - c, sgn * h, 0.002], [x + c * 0.2, sgn * (h + t) / 2, 0.002], [x + c, sgn * t, 0.002]], { color: sgn > 0 ? col : col.map((v) => v * 0.55), delay, speed: 2.5, step: 0.01 });
  }
  // centreline (dash-dot rendered as a long line)
  draw.add([[-3.3, 0, 0.002], [9.3, 0, 0.002]], { color: [0.2, 0.9, 0.7], delay: 0.0, speed: 9, step: 0.05 });
  scene.add(draw.build());

  // power: green field lines spiralling off the generator and up into the dark
  const power = new GlowLines({ width: 2.2, core: 1.6, headLen: 0.6, headBoost: 3.0, flow: 3.0, flowSpacing: 1.2 });
  const GREEN = [0.05, 3.0, 2.0];
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const a = t * Math.PI * 6 + k * 2.09;
      const x = 5.9 + t * 3.0;
      const r = 1.2 + 0.05 * Math.sin(t * 30);
      pts.push([x, 0.5 - r * Math.sin(a), r * Math.cos(a)]);
    }
    const end = pts[pts.length - 1];
    for (let i = 1; i <= 40; i++) pts.push([end[0] + i * 0.05, end[1] + i * 0.25, end[2] * (1 - i / 40)]);
    power.add(pts, { color: GREEN, delay: k * 0.18, speed: 9, step: 0.05, seed: k * 0.3 });
  }
  scene.add(power.build());
  power.mesh.visible = false;

  return { scene, T, env, bg, bgU, key, rim, kick, hemi, grid, gridU, draw, power };
}
