// S04 — The lineage. A corridor of luminous drawings: Nuovo Pignone's compressors, gas turbines to GE designs,
// GE, and today Baker Hughes.
import * as THREE from 'three';
import { GlowLines } from '../world/lines.js';
import { centrifugalSection, impellerFront, heavyDutyGT } from '../world/drawings.js';
import { NOISE } from '../engine/glsl.js';
import { setAtmos } from '../engine/atmos.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, toScreen, F, C } from '../engine/type.js';

export async function create(engine) {
  const scene = new THREE.Scene();
  const bg = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }',
    fragmentShader: `varying vec3 vD; ${NOISE} void main(){ float g = pow(max(-vD.z, 0.0), 6.0); vec3 c = vec3(0.002, 0.006, 0.006) + vec3(0.008, 0.035, 0.03) * g; c *= 0.9 + 0.1 * vnoise2(vD.xy * 60.0); gl_FragColor = vec4(c, 1.0); }`,
  }));
  bg.renderOrder = -1000; bg.frustumCulled = false; scene.add(bg);
  // floor grid far below, for a sense of travel
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 400), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: `varying vec3 vW; float ln(float v){ float x = 0.5 - abs(fract(v) - 0.5); float d = fwidth(v); return 1.0 - smoothstep(0.02 - d, 0.02 + d, x); }
      void main(){ float g = max(ln(vW.x * 0.25), ln(vW.z * 0.25)); float f = exp(-abs(vW.z + 40.0) * 0.035) * exp(-abs(vW.x) * 0.08); gl_FragColor = vec4(vec3(0.01, 0.07, 0.055) * g * f, 1.0); }`,
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.2, -30); scene.add(floor);

  const MINT = [0.35, 2.3, 1.7], DIM = [0.12, 0.8, 0.6];
  const place = (lines, { x, y, z, s = 1, ry = 0, t0, dur = 2.4, pen = 'x' }) => {
    const gl = new GlowLines({ width: 1.5, core: 1.7, headLen: 0.25, headBoost: 3.2 });
    const xs = lines.flatMap((l) => l.pts.map((p) => p[0]));
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    for (const l of lines) {
      const lx = Math.min(...l.pts.map((p) => p[0]));
      const delay = t0 + ((lx - x0) / (x1 - x0 + 1e-6)) * dur * 0.7;
      const pts = l.pts.map(([px, py]) => new THREE.Vector3(px * s, py * s, 0).applyMatrix4(m));
      gl.add(pts, { color: l.dim ? DIM : MINT, delay, speed: 7 * s, step: 0.05 });
    }
    scene.add(gl.build());
    return gl;
  };
  const d1 = place(centrifugalSection(), { x: -4.2, y: 0.9, z: -9, s: 0.85, ry: 0.35, t0: 0.5, dur: 2.2 });
  const d2 = place(impellerFront(), { x: 3.4, y: 1.2, z: -15, s: 1.0, ry: -0.4, t0: 2.6, dur: 1.6 });
  const d3 = place(heavyDutyGT(), { x: -4.0, y: 0.8, z: -23, s: 0.9, ry: 0.32, t0: 4.3, dur: 2.6 });
  const drawings = [d1, d2, d3];
  const anchors = [new THREE.Vector3(-6.4, 3.0, -9.8), new THREE.Vector3(2.0, 3.4, -14.4), new THREE.Vector3(-7.4, 3.3, -24)];

  const camera = new THREE.PerspectiveCamera(42, engine.AW / engine.AH, 0.05, 1000);
  const cam = keyed(THREE, [
    { t: 0, pos: [0.5, 1.0, 5.0], look: [-1.5, 0.9, -8], fov: 42 },
    { t: 4, pos: [0.3, 1.0, -4.5], look: [1.0, 1.0, -18], fov: 42 },
    { t: 8, pos: [0.4, 1.1, -13], look: [-1.5, 0.9, -26], fov: 40 },
    { t: 12, pos: [0.6, 1.2, -26], look: [0.8, 1.2, -60], fov: 40 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  const shot = {
    scene, camera,
    update(lt) {
      setAtmos({ density: 0 });
      for (const d of drawings) d.set({ progress: lt, time: lt, res: [engine.rw, engine.rh], opacity: 1 });
      d1.set({ opacity: 1 - smooth(range(lt, 6.0, 8.0)) * 0.6 });
      d2.set({ opacity: 1 - smooth(range(lt, 8.0, 9.5)) * 0.6 });
      d3.set({ opacity: 1 - smooth(range(lt, 10.5, 12.0)) * 0.5 });
      const fov = cam(lt, p, l);
      camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    },
    post() { return { exposure: 1.0, bloom: 0.06, vignette: 0.6, grain: 0.04, ca: 0.6, contrast: 1.05 }; },
    overlay(ctx, lt) {
      const era = (i, year, line1, line2, a, b) => {
        const al = envelope(lt, a, b, 0.6, 0.6);
        if (al <= 0) return;
        const s = toScreen(anchors[i], camera, engine);
        const x = Math.min(Math.max(s.x, 150), 1500), y = Math.min(Math.max(s.y, 240), 860);
        tracked(ctx, year, x, y, { font: F.num(200, 96), tracking: 6, color: C.white, alpha: al * 0.9, reveal: range(lt, a, a + 1.0), rise: 10 });
        tracked(ctx, line1, x + 4, y + 36, { font: F.mono(500, 15), tracking: 3.5, color: C.mint, alpha: al, reveal: range(lt, a + 0.2, a + 1.2) });
        if (line2) tracked(ctx, line2, x + 4, y + 62, { font: F.mono(400, 13), tracking: 2.8, color: C.dim, alpha: al, reveal: range(lt, a + 0.4, a + 1.4) });
      };
      era(0, '1954', 'NUOVO PIGNONE', 'COMPRESSORS, PUMPS, TURBOMACHINERY', 0.7, 4.2);
      era(2, '1961', 'GAS TURBINES TO GE DESIGNS', 'BUILT UNDER LICENSE IN FLORENCE', 4.4, 7.4);
      // the corporate chapters, centred and quiet
      const c1 = envelope(lt, 7.4, 9.7, 0.5, 0.5);
      tracked(ctx, '1994', 960, 470, { font: F.num(200, 110), tracking: 8, color: C.white, alpha: c1, align: 'center', reveal: range(lt, 7.4, 8.3) });
      tracked(ctx, 'PART OF GE', 960, 520, { font: F.mono(500, 16), tracking: 5, color: C.mint, alpha: c1, align: 'center', reveal: range(lt, 7.6, 8.6) });
      const c2 = envelope(lt, 9.7, 12.2, 0.5, 0.8);
      tracked(ctx, '2017  ·  2019', 960, 470, { font: F.num(200, 110), tracking: 8, color: C.white, alpha: c2, align: 'center', reveal: range(lt, 9.7, 10.6) });
      tracked(ctx, 'BAKER HUGHES', 960, 522, { font: F.sans(500, 22), tracking: 9, color: C.green, alpha: c2, align: 'center', reveal: range(lt, 9.9, 10.9) });
    },
  };
  return shot;
}
