import * as THREE from 'three';
// Deterministic falling snow (GPU-animated from time + seeds).
export function createSnow({ count = 6000, box = [60, 30, 40], centre = [0, 12, 0], fall = 1.1, size = 26, intensity = 1.4 } = {}) {
  const g = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  let s = 777; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count * 4; i++) seeds[i] = r();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const u = { uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uC: { value: new THREE.Vector3(...centre) }, uFall: { value: fall }, uSize: { value: size }, uI: { value: intensity } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aSeed; uniform float uTime; uniform vec3 uBox; uniform vec3 uC; uniform float uFall; uniform float uSize; varying float vA;
      void main(){
        float y = fract(aSeed.y - uTime * uFall * (0.6 + 0.6 * aSeed.w) / uBox.y);
        vec3 p = uC + (vec3(aSeed.x, y, aSeed.z) - 0.5) * uBox;
        p.x += sin(uTime * (0.6 + aSeed.w) + aSeed.x * 40.0) * 0.6; p.z += cos(uTime * (0.5 + aSeed.z) + aSeed.w * 30.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.9, y);
        gl_PointSize = max(1.0, uSize * (0.4 + aSeed.w) / -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; gl_FragColor = vec4(vec3(0.8, 0.88, 1.0) * exp(-d * d * 4.0) * vA * uI, 1.0); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false;
  return { points: pts, uniforms: u };
}
