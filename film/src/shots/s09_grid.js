// S09 — Not enough power. The grid runs west into the sunset… and stops short of the field.
import * as THREE from 'three';
import { getPermian } from '../world/permian.js';
import { setPropsEnv } from '../world/props.js';
import { ease, range, smooth, lerp, keyed, envelope } from '../engine/util.js';
import { tracked, callout, toScreen, F, C } from '../engine/type.js';
import { GRID_END } from '../world/layout.js';

export async function create(engine) {
  const W = getPermian(engine);
  const camera = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 0.5, 60000);
  const z = GRID_END.z, x = GRID_END.x;
  const sunset = { ...W.presets.dusk, sunDir: [-0.93, -0.03, -0.36], glowAmt: 1.3, glowPow: 9, hazeAmt: 0.7, horizon: [0.95, 0.42, 0.2], horizonAway: [0.2, 0.18, 0.3], zenith: [0.02, 0.04, 0.12], gradPow: 0.3, cloudOff: [1.2, 0.4], cover: 0.3, cloudLit: [1.2, 0.45, 0.25], stars: 0.1 };
  const cam = keyed(THREE, [
    { t: 0, pos: [x + 24, 2.2, z + 9], look: [x - 900, 30, z - 6], fov: 30 },
    { t: 6, pos: [x + 55, 2.8, z + 12], look: [x - 900, 28, z - 6], fov: 30 },
    { t: 12.5, pos: [x + 105, 4.0, z + 16], look: [x - 700, 22, z - 10], fov: 31 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  let env = null;
  const shot = {
    scene: W.scene, camera,
    update(lt) {
      W.reset();
      W.setTimeOfDay(sunset, {
        sunI: 0.0, sunColor: [1.0, 0.6, 0.35], hemiI: 0.38, hemiSky: [0.4, 0.4, 0.7], hemiGround: [0.15, 0.1, 0.08],
        fog: { fogColor: [0.05, 0.05, 0.08], sunFogColor: [0.5, 0.22, 0.1], density: 0.00006, height: 160, sunPow: 8 },
      });
      if (!env) env = W.envFor('sunset');
      setPropsEnv(env, 0.6);
      W.focusShadows(x + 40, z, 260);
      W.animate(lt + 200);
      W.ground.uniforms.uDiagram.value = 0; W.ground.uniforms.uGlowCount.value = 0;
      W.flareLight.intensity = 0;
      // the existing grid glows faintly amber, and simply ends
      const gg = W.layers.gridGlow;
      gg.mesh.visible = true; gg.set({ progress: 100, time: lt, res: [engine.rw, engine.rh], opacity: 0.35 + 0.35 * smooth(range(lt, 2, 4)) });
      W.heroFlame.set(lt + 200, { uIntensity: 0.5 });
      W.halo.material.color.setRGB(0.1, 0.04, 0.015);
      W.flareDots.material.uniforms.uIntensity.value = 1.2;
      const fov = cam(lt, p, l);
      camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    },
    post(lt) {
      const sp = W.sky.uniforms.uSunDir.value.clone().multiplyScalar(10000).add(camera.position).project(camera);
      return {
        exposure: 1.0, bloom: 0.055, vignette: 0.6, grain: 0.045, ca: 0.45, sat: 1.08, contrast: 1.12,
        lift: [0.0, 0.0, 0.006], gain: [1.03, 0.98, 0.93], lookPower: 1.35, lookSat: 1.35,
        shadowTint: [0.9, 0.96, 1.12], highTint: [1.07, 1.0, 0.9],
        rays: null,
      };
    },
    overlay(ctx, lt) {
      const a1 = envelope(lt, 2.6, 12.0, 0.8, 0.6);
      if (a1 > 0) {
        const w = tracked(ctx, '26.4', 150, 330, { font: F.num(300, 120), tracking: 2, color: C.white, alpha: a1, reveal: range(lt, 2.6, 3.6), rise: 14 });
        tracked(ctx, 'GW', 164 + w, 330, { font: F.mono(400, 22), tracking: 3, color: '#FFB067', alpha: a1 });
        tracked(ctx, 'PERMIAN ELECTRICITY DEMAND FORECAST FOR 2038', 154, 370, { font: F.mono(500, 14), tracking: 2.8, color: C.white, alpha: a1, reveal: range(lt, 3.0, 4.2) });
        tracked(ctx, 'Source: ERCOT Permian Basin Reliability Plan', 154, 396, { font: F.sans(400, 12), tracking: 0.5, color: 'rgba(244,239,231,0.5)', alpha: a1 });
      }
      const a2 = envelope(lt, 6.8, 12.0, 0.8, 0.6);
      if (a2 > 0) {
        const s = toScreen(new THREE.Vector3(x, W.groundY(x, z) + 11.4, z), camera, engine);
        callout(ctx, { ax: s.x, ay: s.y, lx: s.x - 60, ly: 330, side: 'left', label: 'New 765-kV import lines', value: '~2031', unit: 'EXPECTED IN SERVICE', sub: 'Source: ERCOT', color: '#FFB067', p: range(lt, 6.8, 8.4), alpha: a2 });
      }
    },
  };
  return shot;
}
