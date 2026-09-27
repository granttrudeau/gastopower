// S01 — Cold open. Night in the Permian: pumpjacks nod against a flare; the horizon is strewn with fire.
import * as THREE from 'three';
import { getPermian } from '../world/permian.js';
import { ease, range, smooth, fbm1 } from '../engine/util.js';
import { slug } from '../engine/type.js';
import { HEROPAD } from '../world/layout.js';

export const CUT = 140 / 24; // frame-accurate internal cut (5.833 s)

export async function create(engine) {
  const W = getPermian(engine);
  const camera = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 0.5, 40000);
  const tip = W.flareTip.clone();
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const night = {
    ...W.presets.night,
    horizonGlow: [0.14, 0.05, 0.016], horizonGlowAmt: 1.0, haze: [0.035, 0.018, 0.012], hazeAmt: 1.0, hazeSharp: 7,
    zenith: [0.0015, 0.003, 0.009], horizon: [0.014, 0.014, 0.026], stars: 1.1, milky: 1.3, milkyAxis: [0.8, 0.55, 0.62],
  };
  // setup A: behind the hero pad, pumpjacks between us and the flare
  const A0 = new THREE.Vector3(HEROPAD.x - 62, 0, HEROPAD.z + 58), A1 = new THREE.Vector3(HEROPAD.x - 44, 0, HEROPAD.z + 50);
  // setup B: telephoto, low, 140 m from the stack, pushing in and tilting up to the flame
  // setup B: from the open desert east of the stack (facility behind it), low and long-lens
  const B0 = tip.clone().add(new THREE.Vector3(150, 0, 34));
  const B1 = tip.clone().add(new THREE.Vector3(112, 0, 26));

  const shot = {
    scene: W.scene, camera,
    update(lt) {
      const flt = engine.frameT - shot.start;
      W.reset();
      W.ground.uniforms.uDiagram.value = 0;
      W.setTimeOfDay(night, {
        sunI: 0.08, sunColor: [0.5, 0.62, 1.0], hemiI: 0.045, hemiSky: [0.22, 0.3, 0.55], hemiGround: [0.1, 0.07, 0.05],
        fog: { fogColor: [0.008, 0.008, 0.013], sunFogColor: [0.008, 0.008, 0.013], density: 0.00022, height: 220, sunPow: 8 },
      });
      W.sky.uniforms.uSunDir.value.set(-0.35, 0.45, 0.8).normalize();
      W.sun.position.set(-700, 900, 1600).add(W.sun.target.position);
      W.animate(lt + 40);
      const f = 0.85 + 0.1 * Math.sin(lt * 11.3) + 0.05 * fbm1(lt * 6.0);
      W.flareLight.position.copy(tip).add(new THREE.Vector3(0, 7, 0));
      W.flareLight.intensity = 16000 * f; W.flareLight.distance = 1500; W.flareLight.decay = 2;
      W.ground.uniforms.uGlowCount.value = 1;
      W.ground.uniforms.uGlowPos.value[0].set(tip.x, tip.y - 20, tip.z, 1.6 * f);
      W.ground.uniforms.uGlowCol.value[0].set(1.0, 0.42, 0.12);
      W.heroFlame.set(lt + 40, { uIntensity: 1.25 });
      const hk = engine.frameT - shot.start < CUT ? 1 : 0.25;
      W.halo.material.color.setRGB(0.55 * f * hk, 0.19 * f * hk, 0.055 * f * hk);
      W.flareDots.material.uniforms.uIntensity.value = 9;

      if (flt < CUT) {
        W.focusShadows(HEROPAD.x, HEROPAD.z, 120);
        const p = ease.inOutSine(range(lt, 0, CUT));
        tmp.lerpVectors(A0, A1, p);
        camera.position.set(tmp.x, W.groundY(tmp.x, tmp.z) + 1.7 + p * 0.5, tmp.z);
        look.set(tip.x, tip.y - 12, tip.z);
        camera.lookAt(look);
        camera.fov = 26;
      } else {
        W.focusShadows(tip.x, tip.z, 120);
        const p = ease.inOutCubic(range(lt, CUT, 11.2));
        tmp.lerpVectors(B0, B1, p);
        camera.position.set(tmp.x, W.groundY(tmp.x, tmp.z) + 1.6 + p * 2.5 + fbm1(lt * 0.5) * 0.05, tmp.z);
        look.copy(tip).add(new THREE.Vector3(0, 1.0 + p * 8, 0));
        camera.lookAt(look);
        camera.fov = 13 - p * 6.5;
      }
      camera.updateProjectionMatrix();
    },
    post(lt) {
      const fin = smooth(range(lt, 0.2, 3.0));
      const hz = [];
      const s = tip.clone().add(new THREE.Vector3(0, 12, 0)).project(camera);
      if (s.z < 1) hz.push([s.x * 0.5 + 0.5, s.y * 0.5 + 0.5, lt < CUT ? 0.012 : 0.05, 1.0]);
      const B = lt >= CUT;
      return {
        exposure: B ? 1.05 : 1.35, bloom: B ? 0.035 : 0.07, bloomRadius: 1.0, streak: B ? 0.04 : 0.1, streakThreshold: 1.5,
        vignette: 0.6, grain: 0.05, ca: 0.6, sat: 1.05, contrast: 1.06,
        lift: [0.003, 0.005, 0.011], gain: [1.0, 0.98, 0.95], lookPower: 1.04, lookSat: 1.08,
        shadowTint: [0.9, 0.97, 1.14], highTint: [1.08, 1.0, 0.9],
        fade: 1 - fin, haze: hz,
      };
    },
    overlay(ctx, lt) {
      slug(ctx, lt, { x: 150, y: 866, a: 2.6, b: CUT - 0.3, line1: 'PERMIAN BASIN  ·  WEST TEXAS', line2: 'TODAY', accent: '#FF9A4D' });
    },
  };
  return shot;
}
