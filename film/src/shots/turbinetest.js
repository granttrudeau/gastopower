import * as THREE from 'three';
import { buildNovaLT } from '../turbine/novalt.js';
import { studioEnvironment } from '../engine/env.js';
import { setAtmos } from '../engine/atmos.js';
export async function create(engine) {
  engine.renderer.localClippingEnabled = true;
  const env = studioEnvironment(engine.renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.01, 0.012, 0.014);
  const T = buildNovaLT(engine.renderer, env);
  scene.add(T.root);
  const key = new THREE.DirectionalLight(0xfff0e0, 2.5); key.position.set(-4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe6ff, 2.0); rim.position.set(5, 3, -6); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x405060, 0x101010, 0.4));
  const camera = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 0.05, 200);
  const views = [ [[-1.0, 2.6, 6.8], [0.2, 0.1, 0]], [[-3.2, 1.2, 2.2], [-1.4, 0.2, 0]], [[0.2, 1.1, 1.8], [0.1, 0.3, 0]], [[3, 3, 9], [2.8, 0, 0]] ];
  return {
    scene, camera,
    update(lt) {
      setAtmos({ density: 0 });
      const v = views[Math.min(views.length - 1, Math.floor(lt))];
      camera.position.set(...v[0]); camera.lookAt(...v[1]); camera.updateProjectionMatrix();
      T.update(lt, { flame: 1, flow: 1, heat: 1, ggRate: 0.1, ptRate: 0.08, ghost: 1, outline: 1, res: [engine.rw, engine.rh] });
    },
    post() { return { exposure: 1.0, bloom: 0.05, vignette: 0.4, grain: 0.02 }; },
  };
}
