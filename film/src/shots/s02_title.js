// S02 — Title. The flare's fire in slow motion, close enough to feel the heat. THE SAME FIRE.
import * as THREE from 'three';
import { createFlame } from '../world/flame.js';
import { createEmbers } from '../world/embers.js';
import { setAtmos } from '../engine/atmos.js';
import { ease, range, smooth } from '../engine/util.js';
import { title, tracked, F, C } from '../engine/type.js';

export async function create(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.0015, 0.0018, 0.003);
  const camera = new THREE.PerspectiveCamera(34, engine.AW / engine.AH, 0.1, 2000);
  const fl = createFlame({ radius: 5.6, height: 22, lean: 0.35, seed: 3.1, steps: 80 });
  fl.mat.uniforms.uWidth.value = 1.1 / fl.mesh.userData.B;
  scene.add(fl.mesh);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.6, 20), new THREE.MeshBasicMaterial({ color: 0x020202 }));
  tip.position.y = -0.6; scene.add(tip);
  const embers = createEmbers({ count: 160, origin: [1.0, 13, 0], spread: [7, 9, 5], rise: 3.2, life: 6, swirl: 2.6, size: 110, wind: [1.4, 0, 0.3], intensity: 4, seed: 7 });
  scene.add(embers.points);
  return {
    scene, camera,
    update(lt) {
      setAtmos({ density: 0.0, fogColor: [0, 0, 0] });
      // slow motion: the flame runs at ~30% speed
      const ft = 40 + lt * 0.32;
      fl.set(ft, { uIntensity: 1.2 });
      embers.uniforms.uTime.value = 10 + lt * 0.45;
      const p = ease.inOutSine(range(lt, 0, 6));
      camera.position.set(-3 + p * 2.0, 9.5 + p * 1.5, 25 - p * 5);
      camera.lookAt(0.5, 10.5 + p * 1.2, 0);
      camera.fov = 40; camera.updateProjectionMatrix();
    },
    post(lt) {
      return {
        exposure: 0.95, bloom: 0.05, bloomRadius: 1.0, streak: 0.0, vignette: 0.65, grain: 0.05, ca: 0.8,
        sat: 1.05, contrast: 1.08, lookPower: 1.05, lookSat: 1.05, highTint: [1.05, 1.0, 0.92],
        fade: 0,
      };
    },
    overlay(ctx, lt) {
      title(ctx, 'THE SAME FIRE', lt, { y: 560, a: 0.5, b: 5.9, size: 88, weight: 250, trackFrom: 60, trackTo: 30 });
    },
  };
}
