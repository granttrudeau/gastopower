import * as THREE from 'three';
import { ATMOS_PARS } from './glsl.js';

// Global atmosphere uniforms, shared by reference with every material in the film.
export const ATMOS = {
  uSunDir: { value: new THREE.Vector3(0.3, 0.4, -0.8).normalize() },
  uFogColor: { value: new THREE.Color(0.55, 0.62, 0.72) },
  uSunFogColor: { value: new THREE.Color(1.0, 0.75, 0.5) },
  uFogDensity: { value: 0.00012 },
  uFogHeight: { value: 400 },
  uFogSunPow: { value: 8 },
  uFogMax: { value: 1.0 },
};

export function setAtmos(o) {
  if (o.sunDir) ATMOS.uSunDir.value.set(...o.sunDir).normalize();
  if (o.fogColor) ATMOS.uFogColor.value.setRGB(...o.fogColor);
  if (o.sunFogColor) ATMOS.uSunFogColor.value.setRGB(...o.sunFogColor);
  if (o.density !== undefined) ATMOS.uFogDensity.value = o.density;
  if (o.height !== undefined) ATMOS.uFogHeight.value = o.height;
  if (o.sunPow !== undefined) ATMOS.uFogSunPow.value = o.sunPow;
  if (o.max !== undefined) ATMOS.uFogMax.value = o.max;
}

// Patch a built-in lit material so its fog is our height fog with sun in-scatter.
// Pass a distinct `key` whenever a pre-existing onBeforeCompile hook changes the shader,
// so three.js does not share one compiled program between different variants.
export function atmos(mat, key = '') {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    Object.assign(shader.uniforms, ATMOS);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAtmosWorld;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vec4 atmosWp = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          atmosWp = batchingMatrix * atmosWp;
        #endif
        #ifdef USE_INSTANCING
          atmosWp = instanceMatrix * atmosWp;
        #endif
        vAtmosWorld = (modelMatrix * atmosWp).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAtmosWorld;\n' + ATMOS_PARS)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = applyAtmos(gl_FragColor.rgb, vAtmosWorld, cameraPosition);');
  };
  mat.customProgramCacheKey = () => 'atmos|' + key;
  return mat;
}

export function stdMat(params) { return atmos(new THREE.MeshStandardMaterial(params)); }
export function physMat(params) { return atmos(new THREE.MeshPhysicalMaterial(params)); }
