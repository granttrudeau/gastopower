// S07 — Into service. 2017: the first NovaLT16 drives a pipeline compressor in the Canadian cold.
// Then: a hall of power-generation packages, ordered by the dozen for data centers and the oilfield.
import * as THREE from 'three';
import * as P from '../world/props.js';
import { createSnow } from '../world/snow.js';
import { studioEnvironment } from '../engine/env.js';
import { setAtmos, stdMat } from '../engine/atmos.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, slug, F, C } from '../engine/type.js';

export const CUT = 115 / 24;

export async function create(engine) {
  const env = studioEnvironment(engine.renderer, { key: 1.6, rim: 1.4, top: 1.6, teal: 0.6 });
  // --- A: snowy pipeline station at night
  const sceneA = new THREE.Scene();
  sceneA.environment = env; sceneA.environmentIntensity = 0.35;
  sceneA.background = new THREE.Color(0.012, 0.016, 0.024);
  const snowGround = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), stdMat({ color: 0xdfe6ee, roughness: 0.9 }));
  snowGround.rotation.x = -Math.PI / 2; snowGround.receiveShadow = true; sceneA.add(snowGround);
  const mech = P.novaltMechPackage(); sceneA.add(mech);
  // yard piping into the ground, snow-capped
  const pipeMat = stdMat({ color: 0xc8c26a, roughness: 0.6, metalness: 0.2 });
  for (const [x, z, l] of [[10.3, 0, 18], [11.9, 0, 18]]) {
    const g = new THREE.CylinderGeometry(0.5, 0.5, l, 20); g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, pipeMat); m.position.set(x, 0.3, z - l / 2 - 0.5); m.castShadow = true; sceneA.add(m);
  }
  const lampPos = [[-9, 7, 7], [16, 7, -6]];
  for (const [x, y, z] of lampPos) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, y, 8), stdMat({ color: 0x333333 })); pole.position.set(x, y / 2, z); sceneA.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(20, 12, 5) })); lamp.position.set(x, y, z); sceneA.add(lamp);
    const L = new THREE.PointLight(0xffb86b, 900, 60, 2); L.position.set(x, y - 0.3, z); L.castShadow = false; sceneA.add(L);
  }
  const moon = new THREE.DirectionalLight(0x9fb8ff, 0.35); moon.position.set(-20, 30, 10); moon.castShadow = true;
  Object.assign(moon.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 }); moon.shadow.mapSize.set(2048, 2048); sceneA.add(moon);
  sceneA.add(new THREE.HemisphereLight(0x6a7fa8, 0x404650, 0.3));
  const snow = createSnow({ count: 7000, box: [70, 26, 50], centre: [2, 12, 2], fall: 1.3, size: 30, intensity: 1.2 });
  sceneA.add(snow.points);
  const camA = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 0.3, 2000);

  // --- B: the hall of machines
  const sceneB = new THREE.Scene();
  sceneB.environment = env; sceneB.environmentIntensity = 0.6;
  sceneB.background = new THREE.Color(0.004, 0.008, 0.008);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), stdMat({ color: 0x0b0f0e, roughness: 0.55, metalness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sceneB.add(floor);
  const T = [];
  const rows = 4, cols = 19;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) T.push({ x: c * 21 - 190, z: r * 10 - 15, ry: 0 });
  const fleet = P.packageFleet(T); sceneB.add(fleet);
  const top = new THREE.DirectionalLight(0xffffff, 1.4); top.position.set(-40, 80, 60); top.castShadow = true;
  Object.assign(top.shadow.camera, { left: -220, right: 220, top: 80, bottom: -80, near: 1, far: 400 }); top.shadow.mapSize.set(4096, 2048); sceneB.add(top);
  const rimB = new THREE.DirectionalLight(0x6fe8cf, 0.9); rimB.position.set(60, 20, -80); sceneB.add(rimB);
  sceneB.add(new THREE.HemisphereLight(0x223330, 0x050505, 0.4));
  const camB = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 0.5, 3000);
  const camBK = keyed(THREE, [
    { t: CUT, pos: [-205, 3.5, 34], look: [-150, 3, 0], fov: 30 },
    { t: CUT + 3, pos: [-212, 16, 52], look: [-140, 2, -2], fov: 32 },
    { t: 11.0, pos: [-222, 34, 78], look: [-120, 0, -4], fov: 34 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();

  const shot = {
    scene: sceneA, camera: camA,
    render(engine2, target, lt) {
      const r = engine.renderer;
      const flt = engine.frameT - shot.start;
      const A = flt < CUT;
      const cam = A ? camA : camB;
      engine.applyJitter(cam);
      r.setRenderTarget(target); r.setClearColor(0, 1); r.clear();
      r.render(A ? sceneA : sceneB, cam);
      cam.clearViewOffset();
    },
    update(lt) {
      const flt = engine.frameT - shot.start;
      if (flt < CUT) {
        setAtmos({ fogColor: [0.03, 0.035, 0.05], sunFogColor: [0.03, 0.035, 0.05], density: 0.012, height: 60, sunDir: [-0.5, 0.6, 0.3] });
        snow.uniforms.uTime.value = lt + 20;
        const k = ease.inOutSine(range(lt, 0, CUT));
        camA.position.set(lerp(-14, -8, k), lerp(3.2, 4.2, k), lerp(26, 21, k));
        camA.lookAt(2.5, 3.6, 0);
        camA.fov = 32; camA.updateProjectionMatrix();
      } else {
        setAtmos({ fogColor: [0.003, 0.008, 0.008], sunFogColor: [0.003, 0.008, 0.008], density: 0.0045, height: 120, sunDir: [0.3, 0.5, -0.8] });
        const fov = camBK(lt, p, l);
        camB.position.copy(p); camB.lookAt(l); camB.fov = fov; camB.updateProjectionMatrix();
      }
    },
    post(lt) {
      const A = lt < CUT;
      return A
        ? { exposure: 1.2, bloom: 0.06, vignette: 0.55, grain: 0.05, ca: 0.5, sat: 0.9, contrast: 1.05, shadowTint: [0.9, 0.97, 1.12], highTint: [1.08, 1.0, 0.9] }
        : { exposure: 1.1, bloom: 0.05, vignette: 0.6, grain: 0.04, ca: 0.4, sat: 1.0, contrast: 1.08, shadowTint: [0.92, 1.02, 1.02] };
    },
    overlay(ctx, lt) {
      if (lt < CUT) {
        const a = envelope(lt, 0.6, CUT - 0.15, 0.8, 0.4);
        tracked(ctx, '2017', 150, 300, { font: F.num(300, 110), tracking: 6, color: C.white, alpha: a, reveal: range(lt, 0.6, 1.6), rise: 10 });
        tracked(ctx, 'FIRST NovaLT16 IN SERVICE', 154, 346, { font: F.mono(500, 16), tracking: 3.5, color: C.mint, alpha: a, reveal: range(lt, 1.0, 2.2) });
        tracked(ctx, 'DRIVING A PIPELINE COMPRESSOR  ·  ALBERTA, CANADA', 154, 374, { font: F.mono(400, 14), tracking: 2.8, color: C.dim, alpha: a, reveal: range(lt, 1.3, 2.6) });
      } else {
        const a = envelope(lt, CUT + 0.4, 11.2, 0.8, 0.6);
        tracked(ctx, 'NOW  ·  ORDERED BY THE DOZEN', 150, 262, { font: F.mono(500, 16), tracking: 4, color: C.mint, alpha: a, reveal: range(lt, CUT + 0.4, CUT + 1.4) });
        const rowsT = [
          ['2025', 'FRONTIER', '16 × NovaLT', '270 MW', 'DATA CENTERS'],
          ['2026', 'KODIAK', 'NovaLT16 + FRAME 5', '~1 GW', 'BEHIND THE METER'],
          ['2026', 'DYNAMIS', '76 × NovaLT16', '~1.3 GW', 'DATA CENTERS + OIL & GAS'],
        ];
        rowsT.forEach((r, i) => {
          const ra = a * smooth(range(lt, CUT + 1.0 + i * 0.55, CUT + 1.8 + i * 0.55));
          const y = 760 + i * 34;
          const xs = [150, 245, 395, 640, 770];
          r.forEach((cell, j) => tracked(ctx, cell, xs[j], y, { font: F.mono(j === 3 ? 500 : 400, 15), tracking: 2.2, color: j === 3 ? C.white : j === 0 ? C.mint : C.dim, alpha: ra }));
        });
        tracked(ctx, 'Orders announced by Baker Hughes and customers, 2025–2026', 150, 880, { font: F.sans(400, 12), tracking: 0.5, color: 'rgba(244,239,231,0.4)', alpha: a });
      }
    },
  };
  return shot;
}
