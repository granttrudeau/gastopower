// S08 — Too much gas. Golden hour over the Permian; the land turns x-ray and the gathering lines pulse toward
// a trunk line that cannot take it all. The flare burns the excess.
import * as THREE from 'three';
import { getPermian } from '../world/permian.js';
import { ease, range, smooth, lerp, keyed, envelope, fbm1 } from '../engine/util.js';
import { slug, tracked, callout, toScreen, F, C } from '../engine/type.js';
import { CDP } from '../world/layout.js';
import { setPropsEnv } from '../world/props.js';

export async function create(engine) {
  const W = getPermian(engine);
  const camera = new THREE.PerspectiveCamera(34, engine.AW / engine.AH, 1, 60000);
  const golden = { ...W.presets.golden, cloudOff: [0.3, 0.1], glowAmt: 0.7, glowPow: 60, hazeAmt: 0.22, horizon: [0.9, 0.5, 0.28], zenith: [0.05, 0.1, 0.26], sunDisk: 60 };
  const cam = keyed(THREE, [
    { t: 0, pos: [430, 44, 310], look: [-520, 58, -160], fov: 34 },
    { t: 8, pos: [320, 38, 215], look: [-520, 52, -175], fov: 32 },
    { t: 15.5, pos: [225, 32, 130], look: [-430, 46, -175], fov: 30 },
  ]);
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  const tip = W.flareTip.clone();
  let env = null;
  const shot = {
    scene: W.scene, camera,
    update(lt) {
      W.reset();
      W.setTimeOfDay(golden, {
        sunI: 4.2, sunColor: [1.0, 0.74, 0.5], hemiI: 0.28, hemiSky: [0.42, 0.55, 0.85], hemiGround: [0.35, 0.25, 0.18],
        fog: { fogColor: [0.2, 0.2, 0.26], sunFogColor: [0.75, 0.42, 0.2], density: 0.000035, height: 220, sunPow: 16 },
      });
      if (!env) env = W.envFor('golden');
      W.scene.environment = null; setPropsEnv(env, 0.7);
      W.focusShadows(60, 60, 520);
      W.animate(lt + 100);
      W.ground.uniforms.uDiagram.value = 0;
      W.ground.uniforms.uGlowCount.value = 0;
      W.flareLight.intensity = 0;
      const xr = smooth(range(lt, 3.2, 5.0));
      const g = W.layers.gasLines;
      g.mesh.visible = xr > 0.001;
      g.set({ progress: (lt - 3.2) * 1.0, time: lt, res: [engine.rw, engine.rh], opacity: xr * 0.8 });
      // the flare swells as the backed-up gas has nowhere to go
      const swell = 1 + 0.5 * smooth(range(lt, 7.0, 10.0));
      W.heroFlame.mesh.scale.multiplyScalar(swell);
      W.heroFlame.set(lt + 100, { uIntensity: 0.55 });
      W.halo.material.color.setRGB(0.12, 0.05, 0.02);
      W.flareDots.material.uniforms.uIntensity.value = 0.8;
      const fov = cam(lt, p, l);
      camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    },
    post(lt) {
      const hz = [];
      const s = tip.clone().add(new THREE.Vector3(0, 14, 0)).project(camera);
      if (s.z < 1) hz.push([s.x * 0.5 + 0.5, s.y * 0.5 + 0.5, 0.012, 1.0]);
      const sp = W.sky.uniforms.uSunDir.value.clone().multiplyScalar(10000).add(camera.position).project(camera);
      return {
        exposure: 0.72, bloom: 0.05, vignette: 0.58, grain: 0.035, ca: 0.4, sat: 1.05, contrast: 1.18,
        lift: [0.0, 0.0, 0.004], gain: [1.03, 0.99, 0.94], lookPower: 1.35, lookSat: 1.35,
        shadowTint: [0.92, 0.97, 1.08], highTint: [1.06, 1.0, 0.92], haze: hz,
        rays: sp.z < 1 ? [sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5, 0.35] : null, raysColor: [1.0, 0.75, 0.45],
      };
    },
    overlay(ctx, lt) {
      slug(ctx, lt, { x: 150, y: 866, a: 0.6, b: 7.5, line1: 'PERMIAN BASIN  ·  WEST TEXAS', line2: 'TODAY', accent: '#FF9A4D' });
      // gas output
      {
        const a = toScreen(new THREE.Vector3(CDP.x, 2, CDP.z), camera, engine);
        callout(ctx, { ax: a.x, ay: a.y, lx: a.x + 170, ly: a.y - 200, label: 'Permian natural gas output, 2025', value: '27.6', unit: 'BCF / DAY', sub: 'Source: U.S. EIA', color: '#9FC4FF', p: range(lt, 4.8, 6.4), alpha: envelope(lt, 4.8, 10.2, 0.01, 0.6) });
      }
      // Waha
      const wa = envelope(lt, 10.1, 14.7, 0.6, 0.5);
      if (wa > 0) {
        const w = tracked(ctx, '90', 150, 640, { font: F.num(200, 200), tracking: 4, color: C.white, alpha: wa, reveal: range(lt, 10.1, 11.1), rise: 16 });
        tracked(ctx, 'DAYS IN A ROW BELOW $0', 162 + w, 560, { font: F.mono(500, 18), tracking: 4, color: '#FF9A4D', alpha: wa, reveal: range(lt, 10.5, 11.7) });
        tracked(ctx, 'WAHA HUB NATURAL GAS PRICE, 2026', 162 + w, 592, { font: F.mono(400, 14), tracking: 3, color: C.dim, alpha: wa, reveal: range(lt, 11.1, 12.3) });
        tracked(ctx, 'Source: Reuters', 162 + w, 622, { font: F.sans(400, 12), tracking: 0.5, color: 'rgba(244,239,231,0.45)', alpha: wa });
      }
    },
  };
  return shot;
}
