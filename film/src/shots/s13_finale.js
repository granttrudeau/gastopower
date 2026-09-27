// S13 — Finale. Dawn. The flare from the opening gutters and goes out; behind it the power island hums.
// "The same fire that lit the night… finally, put to work." End titles.
import * as THREE from 'three';
import { getPermian } from '../world/permian.js';
import { setPropsEnv } from '../world/props.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, title, F, C } from '../engine/type.js';
import { ISLAND } from '../world/layout.js';

export async function create(engine) {
  const W = getPermian(engine);
  const camera = new THREE.PerspectiveCamera(26, engine.AW / engine.AH, 0.5, 60000);
  const dawn = { ...W.presets.golden, sunDir: [0.85, 0.035, 0.52], glowAmt: 1.0, glowPow: 20, horizon: [1.0, 0.6, 0.38], horizonAway: [0.35, 0.36, 0.55], zenith: [0.05, 0.1, 0.25], cloudOff: [3.0, 1.0], cover: 0.3 };
  const tip = W.flareTip.clone();
  const cam = keyed(THREE, [
    { t: 0, pos: [520, 4.0, -470], look: [-250, 34, 170], fov: 10.5 },
    { t: 7.5, pos: [495, 4.6, -445], look: [-270, 33, 180], fov: 9.8 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  let env = null;
  const shot = {
    scene: W.scene, camera,
    update(lt) {
      W.reset();
      W.island.visible = true;
      W.setTimeOfDay(dawn, {
        sunI: 2.6, sunColor: [1.0, 0.66, 0.42], hemiI: 0.32, hemiSky: [0.4, 0.48, 0.8], hemiGround: [0.3, 0.22, 0.16],
        fog: { fogColor: [0.26, 0.24, 0.32], sunFogColor: [0.95, 0.55, 0.3], density: 0.00007, height: 180, sunPow: 10 },
      });
      if (!env) env = W.envFor('dawn');
      setPropsEnv(env, 0.8);
      W.focusShadows(-200, 150, 600);
      W.animate(lt + 600);
      for (const L of W.island.userData.lights) L.intensity = 900 * (1 - smooth(range(lt, 4, 8)));
      // the flare dies: it shrinks, gutters, and is gone
      const die = smooth(range(lt, 1.4, 4.2));
      const flick = 1 - 0.35 * Math.max(0, Math.sin(lt * 17.0)) * die;
      W.heroFlame.mesh.scale.multiplyScalar(Math.max(0.02, (1 - die) * flick));
      W.heroFlame.mesh.visible = die < 0.995;
      W.heroFlame.set(lt + 600, { uIntensity: 0.7 * (1 - die) });
      W.halo.material.color.setRGB(0.12 * (1 - die), 0.05 * (1 - die), 0.02 * (1 - die));
      W.flareDots.material.uniforms.uIntensity.value = 1.0 * (1 - die);
      const res = [engine.rw, engine.rh];

      const fov = cam(lt, p, l);
      camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    },
    post(lt) {
      const hz = [];
      for (const u of W.units) {
        const s = u.userData.stackTop.clone().add(u.position).add(new THREE.Vector3(0, 3, 0)).project(camera);
        if (s.z < 1 && Math.abs(s.x) < 1.2) hz.push([s.x * 0.5 + 0.5, s.y * 0.5 + 0.5, 0.008, 1.2]);
      }
      const fade = smooth(range(lt, 6.4, 7.6));
      return {
        exposure: 0.85, bloom: 0.05, vignette: 0.55, grain: 0.04, ca: 0.4, sat: 1.05, contrast: 1.12,
        lookPower: 1.3, lookSat: 1.3, shadowTint: [0.9, 0.96, 1.12], highTint: [1.07, 1.0, 0.9], haze: hz.slice(0, 8),
        fade,
      };
    },
    overlay(ctx, lt) {
      title(ctx, 'THE SAME FIRE', lt, { y: 520, a: 7.7, b: 13.2, size: 80, weight: 250, trackFrom: 44, trackTo: 26 });
      const a2 = envelope(lt, 9.0, 13.2, 0.9, 0.9);
      tracked(ctx, 'NovaLT™  ·  GAS-TO-POWER AS A SERVICE', 960, 590, { font: F.mono(500, 16), tracking: 5, color: C.mint, alpha: a2, align: 'center', reveal: range(lt, 9.0, 10.2) });
      const a3 = envelope(lt, 9.8, 13.2, 0.9, 0.9);
      tracked(ctx, 'Baker Hughes', 960, 690, { font: F.sans(500, 40), tracking: 1, color: C.white, alpha: a3, align: 'center', reveal: range(lt, 9.8, 11.0) });
      const a4 = envelope(lt, 10.4, 13.2, 0.9, 0.9);
      const notes = [
        'A concept film about a future opportunity; not a commercial offer.',
        'Sources: Baker Hughes NovaLT16 datasheet (2025) and order announcements (2025–2026); U.S. EIA; ERCOT; Reuters.',
      ];
      notes.forEach((n, i) => tracked(ctx, n, 960, 880 + i * 20, { font: F.sans(400, 12), tracking: 0.4, color: 'rgba(244,239,231,0.45)', alpha: a4, align: 'center' }));
    },
  };
  return shot;
}
