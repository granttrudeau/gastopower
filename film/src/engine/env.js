import * as THREE from 'three';

// A procedural photo studio (softboxes and rim panels) baked into a PMREM environment map.
// Gives polished turbine metal something beautiful to reflect.
export function studioEnvironment(renderer, { key = 2.4, rim = 1.6, top = 3.0, teal = 0.9, warm = 1.0 } = {}) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.014, 0.016), side: THREE.BackSide })));
  const panel = (w, h, pos, color, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m);
  };
  panel(34, 10, [0, 30, 4], 0xffffff, top);          // overhead softbox
  panel(12, 26, [-34, 6, 14], 0xffe2c4, key * warm);  // warm key
  panel(10, 26, [34, 8, -12], 0xcfe9ff, rim);         // cool rim
  panel(48, 3, [0, -14, 34], 0x02bc94, teal);         // brand-teal floor kicker
  panel(6, 30, [8, 4, -36], 0xffffff, rim * 0.6);     // back strip
  // a faint gradient floor so the lower hemisphere is not pure black
  const floor = new THREE.Mesh(new THREE.CircleGeometry(58, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.035, 0.035) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -20; scene.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  return rt.texture;
}

// Sky-dome environment for outdoor metal (packages in the Permian); pass a scene containing a sky mesh.
export function envFromScene(renderer, scene, blur = 0.04) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, blur);
  pmrem.dispose();
  return rt.texture;
}
