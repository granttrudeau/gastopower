// S12 — Scale. Seventeen megawatts at a time: two units run an electric frac fleet. Then the basin lights up.
import * as THREE from 'three';
import { getPermian } from '../world/permian.js';
import { setPropsEnv } from '../world/props.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, F, C } from '../engine/type.js';
import { FRAC } from '../world/layout.js';

export async function create(engine) {
  const W = getPermian(engine);
  const camera = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 1, 120000);
  const night = { ...W.presets.night, horizonGlow: [0.05, 0.03, 0.04], horizonGlowAmt: 0.6, stars: 1.0, milky: 0.9, milkyAxis: [0.5, 0.6, 0.5] };
  const FX = FRAC.x, FZ = FRAC.z;
  const cam = keyed(THREE, [
    { t: 0, pos: [FX + 78, 26, FZ + 82], look: [FX + 5, 2, FZ - 4], fov: 30 },
    { t: 5.2, pos: [FX + 150, 90, FZ + 170], look: [FX - 10, 0, FZ - 20], fov: 32 },
    { t: 12.5, pos: [FX + 5200, 6800, FZ + 9800], look: [-600, 0, -300], fov: 36 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  let env = null;
  const shot = {
    scene: W.scene, camera,
    update(lt) {
      W.reset();
      W.island.visible = true; W.frac.visible = true;
      W.setTimeOfDay(night, {
        sunI: 0.0, hemiI: 0.06, hemiSky: [0.25, 0.3, 0.55], hemiGround: [0.06, 0.05, 0.05],
        fog: { fogColor: [0.006, 0.007, 0.012], sunFogColor: [0.006, 0.007, 0.012], density: 0.00003, height: 600, sunPow: 8 },
      });
      W.sky.uniforms.uSunDir.value.set(-0.3, -0.4, 0.8).normalize();
      if (!env) env = W.envFor('night');
      setPropsEnv(env, 1.0);
      W.focusShadows(FX, FZ, 160);
      W.animate(lt + 500);
      for (const L of W.frac.userData.lights) L.intensity = 1100;
      for (const L of W.island.userData.lights) L.intensity = 2600;
      W.heroFlame.mesh.visible = false; W.halo.visible = false; W.flareDots.visible = false;
      const res = [engine.rw, engine.rh];
      const d = smooth(range(lt, 5.0, 8.0));
      W.ground.uniforms.uDiagram.value = 0.85 * d;
      W.ground.uniforms.uDiagramColor.value.setRGB(0.02, 0.026, 0.038);
      W.shrubs.visible = d < 0.5;
      W.layers.fracLines.mesh.visible = true; W.layers.fracLines.set({ progress: lt - 0.8, time: lt, res, opacity: 1 - d * 0.7 });
      W.layers.powerLines.mesh.visible = true; W.layers.powerLines.set({ progress: 100, time: lt, res, opacity: 0.4 + 0.6 * d, widthScale: 0.8 });
      W.layers.islandNode.points.visible = d > 0.05; W.layers.islandNode.uniforms.uOpacity.value = d;
      W.layers.basinNodes.points.visible = lt > 6.0; W.layers.basinNodes.uniforms.uProgress.value = (lt - 6.4) / 5.0;
      W.layers.basinLines.mesh.visible = lt > 6.0; W.layers.basinLines.set({ progress: (lt - 6.4) * 0.6, time: lt, res, widthScale: 0.8 });
      W.layers.wellPts.points.visible = d > 0.05; W.layers.wellPts.uniforms.uOpacity.value = d * 0.6;
      const fov = cam(lt, p, l);
      camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    },
    post(lt) {
      return { exposure: 1.15, bloom: 0.07, vignette: 0.6, grain: 0.045, ca: 0.5, sat: 1.1, contrast: 1.06, streak: 0.08, streakThreshold: 2.2, shadowTint: [0.9, 0.97, 1.12] };
    },
    overlay(ctx, lt) {
      const a = envelope(lt, 0.8, 6.2, 0.6, 0.6);
      if (a > 0) {
        const w = tracked(ctx, '2 × NovaLT16', 150, 300, { font: F.sans(300, 40), tracking: 3, color: C.white, alpha: a, reveal: range(lt, 0.8, 1.8), rise: 8 });
        tracked(ctx, '≈ 34 MW', 150, 372, { font: F.num(400, 72), tracking: 2, color: C.green, alpha: a, reveal: range(lt, 1.2, 2.2), rise: 8 });
        tracked(ctx, 'ENOUGH TO RUN AN ELECTRIC FRAC FLEET', 154, 410, { font: F.mono(500, 14), tracking: 3.2, color: C.white, alpha: a, reveal: range(lt, 1.8, 3.0) });
      }
      const b = envelope(lt, 6.8, 12.4, 0.6, 0.4);
      tracked(ctx, 'MOVED WHEN THE FIELD MOVES.', 960, 300, { font: F.sans(300, 34), tracking: 7, color: C.white, alpha: b, align: 'center', reveal: range(lt, 6.8, 7.8) });
      tracked(ctx, 'ADDED AS IT GROWS.', 960, 350, { font: F.sans(300, 34), tracking: 7, color: C.green, alpha: envelope(lt, 8.0, 12.4, 0.6, 0.4), align: 'center', reveal: range(lt, 8.0, 9.0) });
    },
  };
  return shot;
}
