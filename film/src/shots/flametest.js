import * as THREE from 'three';
import { createFlame } from '../world/flame.js';
import { setAtmos } from '../engine/atmos.js';
export async function create(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.004, 0.005, 0.01);
  const camera = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 0.1, 1000);
  const fl = createFlame({ radius: 5.2, height: 21, lean: 0.42, seed: 3.1, steps: 64 });
  fl.mat.uniforms.uWidth.value = 1.05;
  scene.add(fl.mesh);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 30, 12), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  stack.position.y = -15.2; scene.add(stack);
  return {
    scene, camera,
    update(lt) {
      setAtmos({ density: 0.0, fogColor: [0, 0, 0] });
      fl.set(lt + 10);
      const far = lt < 3;
      camera.position.set(far ? 0 : 0, far ? 5 : 8, far ? 70 : 34);
      camera.lookAt(0, far ? 10 : 11, 0);
      camera.fov = far ? 30 : 38; camera.updateProjectionMatrix();
    },
    post() { return { exposure: 1.0, bloom: 0.06, vignette: 0.3, grain: 0.02 }; },
  };
}
