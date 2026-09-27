// S11 — The opportunity: gas-to-power as a service. The power island at dusk.
import * as THREE from 'three';
import { getPermian } from '../world/permian.js';
import { setPropsEnv } from '../world/props.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, callout, toScreen, F, C } from '../engine/type.js';
import { ISLAND } from '../world/layout.js';

export const CUT1 = 144 / 24, CUT2 = 346 / 24;

export async function create(engine) {
  const W = getPermian(engine);
  const camera = new THREE.PerspectiveCamera(28, engine.AW / engine.AH, 0.5, 60000);
  const dusk = { ...W.presets.dusk, sunDir: [-0.85, -0.02, -0.52], cloudOff: [2.0, 0.6], stars: 0.15, horizonGlowAmt: 0 };
  const gy = (x, z) => W.groundY(x, z);
  const IX = ISLAND.x, IZ = ISLAND.z;
  const camA = keyed(THREE, [
    { t: 0, pos: [IX + 95, 2.4, IZ + 52], look: [IX - 40, 11, IZ - 12], fov: 30 },
    { t: CUT1 + 0.5, pos: [IX + 74, 2.8, IZ + 40], look: [IX - 40, 11, IZ - 12], fov: 30 },
  ]);
  const camB = keyed(THREE, [
    { t: CUT1, pos: [IX - 6, 5.0, IZ - 82], look: [IX - 40, 6.5, IZ - 40], fov: 34 },
    { t: CUT2 + 0.5, pos: [IX - 9, 6.5, IZ - 16], look: [IX - 42, 6.5, IZ + 16], fov: 34 },
  ]);
  const camC = keyed(THREE, [
    { t: CUT2, pos: [IX + 150, 30, IZ + 190], look: [IX - 20, 8, IZ], fov: 30 },
    { t: 21.5, pos: [IX + 380, 170, IZ + 520], look: [IX - 40, 0, IZ - 60], fov: 32 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  let env = null;
  const shot = {
    scene: W.scene, camera,
    update(lt) {
      const flt = engine.frameT - shot.start;
      W.reset();
      W.island.visible = true;
      W.setTimeOfDay(dusk, {
        sunI: 0.0, hemiI: 0.45, hemiSky: [0.45, 0.45, 0.75], hemiGround: [0.18, 0.12, 0.1],
        fog: { fogColor: [0.06, 0.055, 0.09], sunFogColor: [0.55, 0.25, 0.12], density: 0.00008, height: 160, sunPow: 8 },
      });
      if (!env) env = W.envFor('dusk');
      setPropsEnv(env, 1.0);
      W.focusShadows(IX, IZ, 200);
      W.animate(lt + 400);
      for (const L of W.island.userData.lights) L.intensity = 2600;
      W.heroFlame.mesh.visible = false; W.halo.visible = false;
      W.flareDots.material.uniforms.uIntensity.value = 1.5;
      const res = [engine.rw, engine.rh];
      const aerial = flt >= CUT2;
      W.layers.powerLines.mesh.visible = aerial; W.layers.powerLines.set({ progress: 100, time: lt, res, opacity: 0.75, widthScale: 0.8 });
      W.layers.toIsland.mesh.visible = aerial; W.layers.toIsland.set({ progress: 100, time: lt, res, opacity: 0.8, widthScale: 0.8 });
      W.layers.beam.mesh.visible = flt > CUT2; W.layers.beam.set({ progress: lt - CUT2 - 0.8, time: lt, res, opacity: 0.9 });
      const cam = flt < CUT1 ? camA : flt < CUT2 ? camB : camC;
      const fov = cam(lt, p, l);
      p.y += gy(p.x, p.z); l.y += gy(l.x, l.z);
      camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    },
    post(lt) {
      const hz = [];
      for (const u of W.units) {
        const s = u.userData.stackTop.clone().add(u.position).add(new THREE.Vector3(0, 3, 0)).project(camera);
        if (s.z < 1 && Math.abs(s.x) < 1.2 && Math.abs(s.y) < 1.2) hz.push([s.x * 0.5 + 0.5, s.y * 0.5 + 0.5, 0.012, 1.4]);
      }
      return {
        exposure: 1.05, bloom: 0.06, vignette: 0.58, grain: 0.045, ca: 0.45, sat: 1.08, contrast: 1.1,
        lift: [0.0, 0.002, 0.008], gain: [1.02, 0.99, 0.96], lookPower: 1.25, lookSat: 1.25,
        shadowTint: [0.88, 0.96, 1.15], highTint: [1.08, 1.0, 0.9], haze: hz.slice(0, 8), streak: 0.08, streakThreshold: 2.5,
      };
    },
    overlay(ctx, lt) {
      const flt = lt;
      // A: the proposition
      const a = envelope(lt, 0.8, CUT1 - 0.1, 0.9, 0.4);
      if (a > 0) {
        tracked(ctx, 'THE OPPORTUNITY', 150, 280, { font: F.mono(500, 15), tracking: 5, color: C.mint, alpha: a, reveal: range(lt, 0.8, 1.8) });
        tracked(ctx, 'Gas-to-Power', 146, 356, { font: F.sans(250, 74), tracking: 1, color: C.white, alpha: a, reveal: range(lt, 1.1, 2.3), rise: 10 });
        tracked(ctx, 'as a Service', 148, 432, { font: F.sans(250, 74), tracking: 1, color: C.green, alpha: a, reveal: range(lt, 1.7, 2.9), rise: 10 });
        tracked(ctx, 'A VISION FOR UPSTREAM OIL & GAS', 152, 480, { font: F.mono(400, 14), tracking: 3.5, color: C.dim, alpha: a, reveal: range(lt, 2.4, 3.6) });
      }
      // B: the chain, left to right along the island
      if (lt >= CUT1 && lt < CUT2) {
        const ca = (x0, x1) => envelope(lt, x0, x1, 0.01, 0.4);
        const P = (x, y, z) => toScreen(new THREE.Vector3(x, W.groundY(x, z) + y, z), camera, engine);
        const lead = envelope(lt, CUT1 + 0.2, CUT1 + 4.6, 0.5, 0.5);
        tracked(ctx, 'FIELD GAS IN  ·  CONDITIONED ON SITE', 150, 280, { font: F.mono(500, 15), tracking: 4, color: '#8FB8FF', alpha: lead, reveal: range(lt, CUT1 + 0.2, CUT1 + 1.4) });
        { const u = W.units[2]; const s = P(u.position.x - 1.6, 13.5, u.position.z); callout(ctx, { ax: s.x, ay: s.y, lx: s.x + 80, ly: s.y - 120, label: 'NovaLT16 × 5', value: '~85', unit: 'MW', sub: '16.9 MWe each (ISO)', p: range(lt, CUT1 + 1.2, CUT1 + 2.6), alpha: ca(CUT1 + 1.2, CUT2) }); }
        { const u = W.units[1]; const s = P(u.position.x + 6.5, 2.2, u.position.z + 1.6); callout(ctx, { ax: s.x, ay: s.y, lx: s.x + 110, ly: s.y + 140, label: 'BRUSH generators  ·  switchgear  ·  microgrid', p: range(lt, CUT1 + 3.0, CUT1 + 4.4), alpha: ca(CUT1 + 3.0, CUT2) }); }
        const b = envelope(lt, CUT1 + 4.8, CUT2 - 0.05, 0.6, 0.3);
        tracked(ctx, 'OWNED  ·  OPERATED  ·  MONITORED 24/7  BY BAKER HUGHES', 960, 900, { font: F.mono(500, 16), tracking: 4, color: C.white, alpha: b, align: 'center', reveal: range(lt, CUT1 + 4.8, CUT1 + 6.2) });
      }
      // C: the model
      if (lt >= CUT2) {
        const c1 = envelope(lt, CUT2 + 0.8, 21.2, 0.6, 0.5);
        tracked(ctx, 'NO POWER PLANT TO BUY.', 150, 300, { font: F.sans(300, 44), tracking: 5, color: C.white, alpha: c1, reveal: range(lt, CUT2 + 0.8, CUT2 + 2.0), rise: 8 });
        const c2 = envelope(lt, CUT2 + 2.6, 21.2, 0.6, 0.5);
        tracked(ctx, 'POWER, BY THE MEGAWATT-HOUR.', 150, 356, { font: F.sans(300, 44), tracking: 5, color: C.green, alpha: c2, reveal: range(lt, CUT2 + 2.6, CUT2 + 3.8), rise: 8 });
        const s = toScreen(new THREE.Vector3(IX - 40, 380, IZ), camera, engine);
        const c3 = envelope(lt, CUT2 + 1.4, 21.2, 0.6, 0.5);
        tracked(ctx, '24/7 REMOTE MONITORING', s.x + 18, Math.max(250, s.y), { font: F.mono(500, 13), tracking: 3, color: C.mint, alpha: c3 });
        tracked(ctx, 'Baker Hughes iCenter', s.x + 18, Math.max(250, s.y) + 22, { font: F.sans(400, 13), tracking: 0.5, color: C.dim, alpha: c3 });
      }
    },
  };
  return shot;
}
