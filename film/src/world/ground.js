import * as THREE from 'three';
import { NOISE } from '../engine/glsl.js';
import { atmos } from '../engine/atmos.js';
import { PADS, ROADS, GATHER, groundY } from './layout.js';

// Mask textures painted with Canvas2D: R = caliche (roads, pads), G = disturbed soil, B = asphalt.
function paintMask(N, minX, minZ, size, { ruts = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, N, N);
  const s = N / size;
  const X = (x) => (x - minX) * s, Z = (z) => (z - minZ) * s;
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round'; c.lineJoin = 'round';
  // pipeline right-of-way scars alongside roads (disturbed soil)
  c.strokeStyle = 'rgb(0,110,0)';
  for (const g of GATHER) {
    c.lineWidth = 13 * s;
    c.beginPath(); g.forEach(([x, z], i) => { const ox = x + 11, oz = z + 11; i ? c.lineTo(X(ox), Z(oz)) : c.moveTo(X(ox), Z(oz)); }); c.stroke();
  }
  // pad halos (disturbed)
  for (const p of PADS) {
    c.fillStyle = 'rgb(0,90,0)';
    c.fillRect(X(p.x - p.w / 2 - 14), Z(p.z - p.d / 2 - 14), (p.w + 28) * s, (p.d + 28) * s);
  }
  // roads
  for (const r of ROADS) {
    c.strokeStyle = r.kind === 'asphalt' ? 'rgb(0,0,255)' : 'rgb(225,0,0)';
    c.lineWidth = r.w * s;
    c.beginPath(); r.pts.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.stroke();
  }
  // pads
  for (const p of PADS) {
    c.fillStyle = 'rgb(255,0,0)';
    c.fillRect(X(p.x - p.w / 2), Z(p.z - p.d / 2), p.w * s, p.d * s);
  }
  if (ruts) {
    // darker wheel ruts on caliche roads: drawn as negative red via 'difference'-free approach: store in G high bit
    c.globalCompositeOperation = 'source-over';
    for (const r of ROADS) {
      if (r.kind === 'asphalt') continue;
      for (const off of [-1.2, 1.2]) {
        c.strokeStyle = 'rgb(255,255,0)';
        c.lineWidth = 0.55 * s;
        c.beginPath();
        r.pts.forEach(([x, z], i) => {
          const [nx, nz] = r.pts[Math.min(i + 1, r.pts.length - 1)];
          const [px, pz] = r.pts[Math.max(i - 1, 0)];
          const dx = nx - px, dz = nz - pz, l = Math.hypot(dx, dz) || 1;
          const ox = x - (dz / l) * off, oz = z + (dx / l) * off;
          i ? c.lineTo(X(ox), Z(oz)) : c.moveTo(X(ox), Z(oz));
        });
        c.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return { tex, canvas: cv, ctx: c, minX, minZ, size, N };
}

export const HERO = { minX: -1250, minZ: -650, size: 1700 };
export const WORLDM = { minX: -7000, minZ: -7000, size: 14000 };

export function createGround(engine) {
  const world = paintMask(4096, WORLDM.minX, WORLDM.minZ, WORLDM.size);
  const hero = paintMask(4096, HERO.minX, HERO.minZ, HERO.size, { ruts: true });
  const maxAniso = engine.renderer.capabilities.getMaxAnisotropy();
  world.tex.anisotropy = hero.tex.anisotropy = maxAniso;

  // Warped grid: dense near the origin, sparse toward the 18 km horizon.
  const N = 520, R = 18000, P = 2.1;
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  let k = 0;
  const warp = (u) => Math.sign(u) * Math.pow(Math.abs(u), P) * R;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = warp(i / N * 2 - 1) - 250, z = warp(j / N * 2 - 1) + 120;
    pos[k++] = x; pos[k++] = groundY(x, z); pos[k++] = z;
  }
  const idx = new Uint32Array(N * N * 6); k = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();

  const uniforms = {
    uWorldMask: { value: world.tex }, uHeroMask: { value: hero.tex },
    uWorldRect: { value: new THREE.Vector3(WORLDM.minX, WORLDM.minZ, WORLDM.size) },
    uHeroRect: { value: new THREE.Vector3(HERO.minX, HERO.minZ, HERO.size) },
    uSoilA: { value: new THREE.Color(0.64, 0.52, 0.43) }, uSoilB: { value: new THREE.Color(0.76, 0.65, 0.54) },
    uSoilC: { value: new THREE.Color(0.56, 0.43, 0.35) }, uVeg: { value: new THREE.Color(0.16, 0.18, 0.1) },
    uCaliche: { value: new THREE.Color(0.86, 0.8, 0.7) }, uAsphalt: { value: new THREE.Color(0.08, 0.08, 0.085) },
    uDiagram: { value: 0 }, uDiagramColor: { value: new THREE.Color(0.004, 0.008, 0.012) },
    uXray: { value: 0 },
    uGlowPos: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uGlowCol: { value: Array.from({ length: 12 }, () => new THREE.Vector3(0, 0, 0)) },
    uGlowCount: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uWorldMask; uniform sampler2D uHeroMask; uniform vec3 uWorldRect; uniform vec3 uHeroRect;
        uniform vec3 uSoilA, uSoilB, uSoilC, uVeg, uCaliche, uAsphalt, uDiagramColor; uniform float uDiagram; uniform float uXray;
        uniform vec4 uGlowPos[12]; uniform vec3 uGlowCol[12]; uniform int uGlowCount;
        ${NOISE}
        vec4 groundMasks(vec2 wp, float bias){
          vec2 wuv = (wp - uWorldRect.xy) / uWorldRect.z;
          vec2 huv = (wp - uHeroRect.xy) / uHeroRect.z;
          vec4 m = texture2D(uWorldMask, wuv, bias);
          float inH = step(0.0, huv.x) * step(huv.x, 1.0) * step(0.0, huv.y) * step(huv.y, 1.0);
          if (inH > 0.5) {
            vec2 e = min(huv, 1.0 - huv);
            float w = smoothstep(0.0, 0.03, min(e.x, e.y));
            m = mix(m, texture2D(uHeroMask, huv, bias), w);
          }
          return m;
        }
        float gHeight(vec2 wp){
          return vnoise2(wp * 0.45) * 0.5 + vnoise2(wp * 1.7) * 0.25 + worley2(wp / 3.7) * 0.4;
        }`)
      .replace('#include <map_fragment>', `
        vec2 wp = vAtmosWorld.xz;
        float fw = length(fwidth(wp));
        vec4 msk = groundMasks(wp, 0.0);
        vec4 halo = groundMasks(wp, 3.0);
        float n1 = fbm2(wp / 210.0), n2 = fbm2(wp / 27.0 + 4.0), n3 = vnoise2(wp / 2.3);
        vec3 soil = mix(uSoilA, uSoilB, smoothstep(0.3, 0.72, n1));
        soil = mix(soil, uSoilC, smoothstep(0.55, 0.85, n2) * 0.6);
        soil *= 0.9 + 0.2 * n3;
        // scrub: dark rounded shrubs on a cellular pattern, density varies over the land
        float dens = smoothstep(0.2, 0.7, fbm2(wp / 320.0 + 7.0)) * 0.8 + 0.18;
        dens *= 1.0 - clamp((halo.r + halo.g + halo.b) * 1.6, 0.0, 1.0);
        vec2 cell = wp / 3.9;
        float wd = worley2(cell);
        float pick = step(hash12(floor(cell + 0.5) + 3.1), dens);
        float shrub = (1.0 - smoothstep(0.16, 0.44, wd)) * pick;
        float detail = 1.0 - smoothstep(0.6, 4.5, fw);
        float veg = mix(dens * 0.3, shrub, detail);
        vec3 vegC = uVeg * (0.75 + 0.5 * vnoise2(wp / 11.0));
        vec3 col = mix(soil, vegC, veg * 0.92);
        // shrub shadows as slight darkening around the dots
        col *= 1.0 - (1.0 - smoothstep(0.2, 0.6, wd)) * pick * 0.25 * detail;
        // disturbed soil: paler, less vegetated
        col = mix(col, mix(soil, uCaliche, 0.35), msk.g * 0.75);
        // caliche roads & pads
        vec3 cal = uCaliche * (0.9 + 0.14 * n3) * (0.94 + 0.08 * vnoise2(wp * 0.9));
        col = mix(col, cal, clamp(msk.r * 1.1, 0.0, 1.0));
        // wheel ruts (encoded as high G on caliche)
        float rut = smoothstep(0.55, 0.65, msk.g) * msk.r;
        col *= 1.0 - rut * 0.18 * detail;
        col = mix(col, uAsphalt * (0.9 + 0.2 * n3), msk.b);
        // diagram mode: the land goes dark so light-lines can draw the field
        col = mix(col, uDiagramColor * (0.7 + 0.6 * n2) + msk.r * uDiagramColor * 4.0, uDiagram);
        diffuseColor.rgb = col;
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float e = 0.12;
          float h0 = gHeight(wp), hx = gHeight(wp + vec2(e, 0.0)), hz = gHeight(wp + vec2(0.0, e));
          vec3 gw = vec3(-(hx - h0) / e, 0.0, -(hz - h0) / e) * 0.35 * detail * (1.0 - msk.r * 0.6);
          normal = normalize(normal + (viewMatrix * vec4(gw, 0.0)).xyz);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        for (int i = 0; i < 12; i++) {
          if (i >= uGlowCount) break;
          vec4 gp = uGlowPos[i];
          float d = distance(vAtmosWorld, gp.xyz);
          totalEmissiveRadiance += diffuseColor.rgb * uGlowCol[i] * gp.w / (1.0 + d * d * 0.02);
        }`);
  };
  atmos(mat, 'ground');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, uniforms, world, hero };
}

// CPU-side mask lookup (for scattering bushes) from the painted canvases.
export function maskSampler(maskObj) {
  const { canvas, minX, minZ, size, N } = maskObj;
  const data = canvas.getContext('2d').getImageData(0, 0, N, N).data;
  return (x, z) => {
    const px = Math.floor((x - minX) / size * N), pz = Math.floor((z - minZ) / size * N);
    if (px < 0 || pz < 0 || px >= N || pz >= N) return [0, 0, 0];
    const o = (pz * N + px) * 4;
    return [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255];
  };
}
