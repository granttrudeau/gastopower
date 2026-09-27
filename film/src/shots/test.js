import * as THREE from 'three';
import { stdMat, setAtmos } from '../engine/atmos.js';
import { slug, title, callout, C } from '../engine/type.js';

export async function create(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.02, 0.03, 0.05);
  const camera = new THREE.PerspectiveCamera(35, engine.AW / engine.AH, 0.1, 5000);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), stdMat({ color: 0x8a7a66, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), stdMat({ color: 0xcccccc, metalness: 1, roughness: 0.3 }));
  ball.position.set(0, 1, 0); ball.castShadow = true; scene.add(ball);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(40, 18, 6) }));
  glow.position.set(2.2, 0.6, 0.5); scene.add(glow);
  const sun = new THREE.DirectionalLight(0xffe0c0, 3); sun.position.set(5, 6, 3); sun.castShadow = true; scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8899bb, 0x443322, 0.6));
  return {
    scene, camera,
    update(lt) {
      setAtmos({ sunDir: [5, 6, 3], fogColor: [0.05, 0.06, 0.08], density: 0.02, height: 30 });
      camera.position.set(Math.sin(lt * 0.3) * 6, 2.2, Math.cos(lt * 0.3) * 6);
      camera.lookAt(0, 0.8, 0);
    },
    post() { return { bloom: 0.08, streak: 0.6, exposure: 1.0 }; },
    overlay(ctx, lt) {
      slug(ctx, lt, { a: 0.2, b: 4.8, line1: 'PERMIAN BASIN · WEST TEXAS', line2: 'TODAY' });
      title(ctx, 'THE SAME FIRE', lt, { a: 0.5, b: 5 });
      callout(ctx, { ax: 1100, ay: 520, lx: 1250, ly: 400, label: 'Pressure ratio', value: '19:1', p: Math.min(1, lt / 2) });
    },
  };
}
