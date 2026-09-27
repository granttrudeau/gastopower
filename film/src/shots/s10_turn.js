// S10 — The turn. Night falls; the field becomes a diagram of light. Too much gas, not enough power.
// Then the flares go out, the gas stays home, and power spreads from a single island to every pad.
import * as THREE from 'three';
import { getPermian } from '../world/permian.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, F, C } from '../engine/type.js';
import { ISLAND } from '../world/layout.js';

export async function create(engine) {
  const W = getPermian(engine);
  const camera = new THREE.PerspectiveCamera(34, engine.AW / engine.AH, 5, 90000);
  const night = { ...W.presets.night, horizonGlow: [0.12, 0.05, 0.03], horizonGlowAmt: 0.8, stars: 0.9, milky: 0.6, milkyAxis: [0.3, 0.7, 0.6] };
  const cam = keyed(THREE, [
    { t: 0, pos: [1900, 2300, 3900], look: [-450, 0, -300], fov: 30 },
    { t: 8, pos: [1650, 2150, 3500], look: [-500, 0, -250], fov: 30 },
    { t: 15.5, pos: [1400, 2000, 3150], look: [-540, 0, -200], fov: 30 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  const shot = {
    scene: W.scene, camera,
    update(lt) {
      W.reset();
      W.setTimeOfDay(night, {
        sunI: 0.0, hemiI: 0.02, hemiSky: [0.2, 0.25, 0.5], hemiGround: [0.05, 0.04, 0.04],
        fog: { fogColor: [0.004, 0.005, 0.009], sunFogColor: [0.004, 0.005, 0.009], density: 0.00004, height: 400, sunPow: 8 },
      });
      W.sky.uniforms.uSunDir.value.set(-0.9, -0.15, -0.4).normalize();
      W.animate(lt + 300);
      const d = smooth(range(lt, 0.2, 2.6));
      W.ground.uniforms.uDiagram.value = 0.92 * d;
      W.ground.uniforms.uDiagramColor.value.setRGB(0.02, 0.026, 0.038);
      W.shrubs.visible = d < 0.5;
      W.heroFlame.mesh.visible = false; W.halo.visible = false;
      W.flareDots.material.uniforms.uIntensity.value = 5 * (1 - smooth(range(lt, 4.8, 7.6)));
      const L = W.layers, res = [engine.rw, engine.rh];
      for (const k of ['gasLines', 'trunk', 'toIsland', 'powerLines', 'gridGlow']) L[k].set({ widthScale: 0.7 });
      L.flarePts.uniforms.uPx.value = 0.8; L.wellPts.uniforms.uPx.value = 0.7;
      const inA = smooth(range(lt, 0.4, 2.0));
      const surge = 1 + 0.6 * envelope(lt, 0.8, 2.0, 0.2, 0.6);
      L.gasLines.mesh.visible = true; L.gasLines.set({ progress: 100, time: lt, res, opacity: inA * (1 - 0.35 * smooth(range(lt, 5.0, 7.0))), intensity: surge });
      L.trunk.mesh.visible = true; L.trunk.set({ progress: 100, time: lt, res, opacity: inA * (1 - 0.85 * smooth(range(lt, 5.0, 7.2))) });
      L.gridGlow.mesh.visible = true;
      const flick = 0.55 + 0.45 * Math.abs(Math.sin(lt * 23.0) * Math.sin(lt * 7.0));
      L.gridGlow.set({ progress: 100, time: lt, res, opacity: inA * (lt > 1.9 && lt < 3.2 ? flick : 1) * (1 - 0.6 * smooth(range(lt, 9, 11))) });
      L.wellPts.points.visible = true; L.wellPts.uniforms.uOpacity.value = inA;
      L.flarePts.points.visible = true; L.flarePts.uniforms.uOpacity.value = inA; L.flarePts.uniforms.uOff.value = lerp(-0.4, 1.35, range(lt, 4.8, 7.6));
      L.toIsland.mesh.visible = lt > 5.3; L.toIsland.set({ progress: lt - 5.4, time: lt, res });
      L.islandNode.points.visible = lt > 7.6; L.islandNode.uniforms.uOpacity.value = smooth(range(lt, 7.7, 8.6)) * (1 + 0.4 * Math.sin(lt * 3.0));
      L.powerLines.mesh.visible = lt > 8.5; L.powerLines.set({ progress: lt - 8.6, time: lt, res, intensity: 1.0 });
      const fov = cam(lt, p, l);
      camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    },
    post(lt) {
      return { exposure: 1.1, bloom: 0.07, bloomRadius: 1.0, vignette: 0.6, grain: 0.045, ca: 0.5, sat: 1.1, contrast: 1.05, streak: 0.08, streakThreshold: 2.0, shadowTint: [0.9, 0.97, 1.12] };
    },
    overlay(ctx, lt) {
      const a = envelope(lt, 0.7, 3.4, 0.4, 0.6);
      tracked(ctx, 'TOO MUCH GAS', 150, 300, { font: F.sans(300, 30), tracking: 10, color: '#8FB8FF', alpha: a, reveal: range(lt, 0.7, 1.5) });
      tracked(ctx, 'NOT ENOUGH POWER', 150, 344, { font: F.sans(300, 30), tracking: 10, color: '#FFB067', alpha: envelope(lt, 1.9, 3.4, 0.4, 0.6), reveal: range(lt, 1.9, 2.7) });
      const b = envelope(lt, 12.0, 15.6, 0.8, 0.3);
      tracked(ctx, 'BEHIND THE METER', 960, 880, { font: F.sans(400, 26), tracking: 14, color: C.green, alpha: b, align: 'center', reveal: range(lt, 12.0, 13.2) });
    },
  };
  return shot;
}
