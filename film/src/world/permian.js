// The Permian Basin world: one persistent scene reused by every West Texas shot,
// re-lit per shot (night, golden hour, dusk, dawn) and re-dressed (present vs. future).
import * as THREE from 'three';
import { stdMat, setAtmos, ATMOS } from '../engine/atmos.js';
import { mulberry32, lerp } from '../engine/util.js';
import { createSky, SKY_PRESETS } from './sky.js';
import { createGround, maskSampler, HERO } from './ground.js';
import { createFlame, flareSprites, flameHalo } from './flame.js';
import { GlowLines, glowPoints } from './lines.js';
import * as P from './props.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PADS, ROADS, WELLS, FLARES, POLES, GATHER, CDP, ISLAND, FRAC, HEROPAD, FOCUS, groundY, GRID_END } from './layout.js';

let WORLD = null;
export function getPermian(engine) {
  if (!WORLD) WORLD = buildPermian(engine);
  return WORLD;
}

function place(obj, x, z, rotY = 0, sink = 0.05) {
  obj.position.set(x, groundY(x, z) - sink, z);
  obj.rotation.y = rotY;
  return obj;
}

function buildPermian(engine) {
  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  const ground = createGround(engine);
  scene.add(ground.mesh);

  // ------------------------------------------------------------ lights
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  const sc = sun.shadow.camera; sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.near = 10; sc.far = 4000;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x8fa6c8, 0x5a4636, 0.6);
  scene.add(hemi);
  const flareLight = new THREE.PointLight(0xff8a3a, 0, 900, 1.6);
  scene.add(flareLight);

  // ------------------------------------------------------------ far mountains (Delaware Basin horizon)
  {
    const segs = 720, R0 = 26000;
    const pos = [], idx = [];
    const rnd = mulberry32(7);
    const peaks = Array.from({ length: 9 }, () => ({ a: rnd() * Math.PI * 2, w: 0.15 + rnd() * 0.35, h: 250 + rnd() * 750 }));
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      let h = 40 + 30 * Math.sin(a * 7.0) * Math.sin(a * 3.1);
      for (const p of peaks) { let d = Math.abs(((a - p.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); h += p.h * Math.exp(-(d * d) / (p.w * p.w * 0.25)) * (0.8 + 0.2 * Math.sin(a * 90)); }
      h += 25 * Math.sin(a * 53) * Math.sin(a * 17);
      const r = R0 + 2500 * Math.sin(a * 2.3);
      pos.push(Math.cos(a) * r, -40, Math.sin(a) * r, Math.cos(a) * (r + 1500), h, Math.sin(a) * (r + 1500));
      if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, stdMat({ color: 0x7a6a62, roughness: 1, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    scene.add(m);
  }

  // ------------------------------------------------------------ scrub (instanced shrubs in tiles)
  const heroMask = maskSampler(ground.hero);
  const shrubs = new THREE.Group(); scene.add(shrubs);
  {
    const rnd = mulberry32(99);
    // Soft multi-lobe shrub: noisy spheres with normals blended toward the shrub centre (reads as foliage).
    const makeShrub = (lobes, detail) => {
      const parts = [];
      const centre = new THREE.Vector3(0, 0.42, 0);
      for (let i = 0; i < lobes; i++) {
        const r = 0.26 + rnd() * 0.2;
        const g = new THREE.IcosahedronGeometry(r, detail);
        const a = (i / lobes) * Math.PI * 2 + rnd() * 0.8;
        const rr = i === 0 ? 0 : 0.22 + rnd() * 0.28;
        const off = new THREE.Vector3(Math.cos(a) * rr, 0.3 + rnd() * 0.28 - (i ? 0.08 : 0), Math.sin(a) * rr);
        const pos = g.attributes.position, nor = g.attributes.normal;
        const v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
        for (let j = 0; j < pos.count; j++) {
          v.set(pos.getX(j), pos.getY(j), pos.getZ(j));
          n.copy(v).normalize();
          const k = 1 + 0.24 * Math.sin(n.x * 7.1 + n.y * 5.3 + i) * Math.sin(n.z * 6.7 + n.x * 3.1 + i * 2.0) + 0.2 * Math.sin(n.x * 17.3 + n.z * 11.1 + i) * Math.sin(n.y * 19.7 - n.x * 5.0);
          v.copy(n).multiplyScalar(r * k); v.y *= 0.8; v.add(off);
          c.copy(v).sub(centre).normalize();
          n.lerp(c, 0.55).normalize();
          pos.setXYZ(j, v.x, v.y, v.z); nor.setXYZ(j, n.x, n.y, n.z);
        }
        parts.push(g);
      }
      return mergeGeometries(parts, false);
    };
    const hi = [makeShrub(6, 1), makeShrub(7, 1), makeShrub(5, 1)];
    const lo = [makeShrub(3, 0), makeShrub(2, 0), makeShrub(3, 0)];
    const mat = stdMat({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    const tile = 340;
    const cols = [new THREE.Color(0x353b22), new THREE.Color(0x3f4429), new THREE.Color(0x4a4a33), new THREE.Color(0x544f3e), new THREE.Color(0x2e351e), new THREE.Color(0x4d4a37)];
    const dummy = new THREE.Object3D();
    const inFocus = (x, z) => FOCUS.some(([fx, fz, r]) => (x - fx) ** 2 + (z - fz) ** 2 < r * r);
    for (let tx = HERO.minX; tx < HERO.minX + HERO.size; tx += tile) {
      for (let tz = HERO.minZ; tz < HERO.minZ + HERO.size; tz += tile) {
        const per = { hi: [[], [], []], lo: [[], [], []] };
        const count = 9000;
        for (let i = 0; i < count; i++) {
          const x = tx + rnd() * tile, z = tz + rnd() * tile;
          const m = heroMask(x, z);
          if (m[0] > 0.05 || m[1] > 0.3 || m[2] > 0.05) continue;
          const dens = 0.5 + 0.5 * Math.sin(x * 0.011 + Math.sin(z * 0.007) * 2.0) * Math.sin(z * 0.009 + 1.3);
          if (rnd() > dens * 0.85 + 0.12) continue;
          const dc = (x - (HEROPAD.x - 55)) ** 2 + (z - (HEROPAD.z + 55)) ** 2;
          if (dc < 30 * 30) continue;
          if (dc < 70 * 70 && rnd() < 0.6) continue;
          const f = inFocus(x, z);
          per[f ? 'hi' : 'lo'][Math.floor(rnd() * 3)].push([x, z, rnd()]);
        }
        for (const lvl of ['hi', 'lo']) per[lvl].forEach((list, v) => {
          if (!list.length) return;
          const im = new THREE.InstancedMesh((lvl === 'hi' ? hi : lo)[v], mat, list.length);
          list.forEach(([x, z, r], i) => {
            const big = r > 0.93 ? 1.4 : 1.0;
            const s = (0.55 + r * 0.95) * big;
            dummy.position.set(x, groundY(x, z) - 0.08, z);
            dummy.rotation.set(0, r * 40, 0);
            dummy.scale.set(s * (0.9 + (r * 7 % 1) * 0.45), s * (0.55 + (r * 3 % 1) * 0.55), s);
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
            im.setColorAt(i, cols[Math.floor(r * 97) % cols.length].clone().multiplyScalar(0.8 + (r * 13 % 1) * 0.35));
          });
          im.castShadow = true; im.receiveShadow = true;
          im.computeBoundingSphere();
          shrubs.add(im);
        });
      }
    }
  }

  // ------------------------------------------------------------ central delivery point (CDP)
  const cdp = new THREE.Group(); scene.add(cdp);
  {
    const tb = P.tankBattery(8, { r: 2.4, h: 7.3 });
    place(tb, CDP.x - 55, CDP.z + 25); cdp.add(tb);
    for (let i = 0; i < 4; i++) { const v = P.hVessel(8.5, 1.2, 'olive'); place(v, CDP.x - 10 + i * 0, CDP.z - 25 + i * 9, 0); cdp.add(v); }
    for (let i = 0; i < 3; i++) { const v = P.vVessel(0.9, 6.5, 'olive'); place(v, CDP.x + 12 + i * 4, CDP.z + 20); cdp.add(v); }
    const comp = P.ehouse(16, 6, 5); place(comp, CDP.x + 20, CDP.z - 30); cdp.add(comp);
    const comp2 = P.ehouse(16, 6, 5); place(comp2, CDP.x + 20, CDP.z - 18); cdp.add(comp2);
    const t1 = P.pickup(); place(t1, CDP.x - 20, CDP.z + 45, 0.4); cdp.add(t1);
    const t2 = P.pickup(0xd8d8d8); place(t2, CDP.x + 40, CDP.z + 40, -1.2); cdp.add(t2);
  }
  // hero flare
  const fl = FLARES[0];
  const flareStack = P.flareStack(fl.h); place(flareStack, fl.x, fl.z); scene.add(flareStack);
  const flareTip = flareStack.userData.tip.clone().add(flareStack.position);
  const heroFlame = createFlame({ radius: 5.2, height: 21, lean: 0.42, seed: 3.1, steps: 64, intensity: 1.0 });
  heroFlame.mat.uniforms.uWidth.value = 1.05 / heroFlame.mesh.userData.B;
  heroFlame.mesh.position.copy(flareTip).add(new THREE.Vector3(0, -0.8, 0));
  heroFlame.mesh.rotation.y = 0.6;
  scene.add(heroFlame.mesh);
  const halo = flameHalo(); halo.position.copy(flareTip).add(new THREE.Vector3(0, 8, 0)); halo.scale.set(70, 70, 1); scene.add(halo);

  // ------------------------------------------------------------ well pads with pumpjacks
  const pumps = [];
  const pumpGroup = new THREE.Group(); scene.add(pumpGroup);
  for (const w of WELLS) {
    if (Math.hypot(w.x - (-300), w.z - 150) > 2600) continue;
    if (w.pump) {
      const pj = P.pumpjack({ beamColor: 'black', headColor: 'yellow' });
      // hero-pad units stand side-on to the cold-open camera so the horsehead reads in silhouette
      const rot = w.hero ? -0.72 + (w.phase > 2 ? Math.PI : 0) : Math.PI / 2 + (w.phase > 3 ? Math.PI : 0);
      place(pj.group, w.x, w.z, rot);
      pumpGroup.add(pj.group);
      pumps.push({ pj, w });
    } else {
      const wh = P.vVessel(0.25, 1.4, 'white'); place(wh, w.x, w.z); pumpGroup.add(wh);
    }
  }
  // small wellsite gensets and tanks on some pads (today's patchwork of off-grid power)
  const gensets = new THREE.Group(); scene.add(gensets);
  {
    const rnd = mulberry32(4);
    for (const p of PADS) {
      if (p.kind !== 'well' || p === HEROPAD || rnd() < 0.35) continue;
      const g = P.ehouse(6, 2.4, 2.4); place(g, p.x + p.w * 0.3, p.z + p.d * 0.3, 0); gensets.add(g);
      const t = P.tankBattery(2, { r: 1.8, h: 5 }); place(t, p.x - p.w * 0.35, p.z + p.d * 0.25); gensets.add(t);
    }
  }

  // ------------------------------------------------------------ grid distribution line (ends short of the field)
  const poleGeo = P.poleGeo();
  const poleWood = new THREE.InstancedMesh(poleGeo.wood, stdMat({ color: 0x4f4032, roughness: 0.9 }), POLES.length);
  const poleIns = new THREE.InstancedMesh(poleGeo.ins, stdMat({ color: 0x9aa6a8, roughness: 0.4 }), POLES.length);
  const tops = [];
  {
    const d = new THREE.Object3D();
    POLES.forEach((p, i) => {
      d.position.set(p.x, groundY(p.x, p.z) - 0.4, p.z); d.rotation.set(0, Math.PI / 2, 0); d.scale.set(1, 1, 1); d.updateMatrix();
      poleWood.setMatrixAt(i, d.matrix); poleIns.setMatrixAt(i, d.matrix);
      tops.push(new THREE.Vector3(p.x, groundY(p.x, p.z) + 11.2, p.z));
    });
    poleWood.castShadow = true; poleWood.computeBoundingSphere(); poleIns.computeBoundingSphere();
    scene.add(poleWood); scene.add(poleIns);
  }
  const gridWires = P.wires(tops, 1.2, [-1.1, 0, 1.1], 0x151515);
  scene.add(gridWires);

  // ------------------------------------------------------------ the power island (future)
  const island = new THREE.Group(); island.visible = false; scene.add(island);
  const units = [];
  {
    for (let i = 0; i < 5; i++) {
      const u = P.novaltPackage();
      place(u, ISLAND.x - 40 + i * 0, ISLAND.z - 44 + i * 13.5, 0);
      island.add(u); units.push(u);
    }
    const cs = P.condSkid(); place(cs, ISLAND.x - 72, ISLAND.z - 10, Math.PI / 2); island.add(cs);
    for (let i = 0; i < 3; i++) { const e = P.ehouse(12, 3.8, 3.6); place(e, ISLAND.x + 5 + i * 0, ISLAND.z - 35 + i * 16, 0); island.add(e); }
    for (let i = 0; i < 3; i++) { const t = P.transformer(); place(t, ISLAND.x + 30, ISLAND.z - 35 + i * 16); island.add(t); }
    // substation gantries
    const gant = [];
    for (let i = 0; i < 4; i++) {
      const x = ISLAND.x + 55 + i * 12;
      gant.push(new THREE.BoxGeometry(0.4, 14, 0.4).translate(x, 7, ISLAND.z - 30), new THREE.BoxGeometry(0.4, 14, 0.4).translate(x, 7, ISLAND.z + 10), new THREE.BoxGeometry(0.5, 0.5, 42).translate(x, 13.5, ISLAND.z - 10));
    }
    // (substation gantries omitted: they crowded the ground-level views)
    // floodlights for dusk/night
    for (const [x, z] of [[-95, 55], [85, -60], [-20, 70], [-60, -70]]) {
      const L = new THREE.PointLight(0xffe2b8, 0, 140, 2); L.position.set(ISLAND.x + x, groundY(ISLAND.x + x, ISLAND.z + z) + 12, ISLAND.z + z);
      island.add(L); island.userData.lights = (island.userData.lights || []).concat(L);
    }
    const lt = P.lightTower(); place(lt, ISLAND.x - 90, ISLAND.z + 50, 0.5); island.add(lt);
    const lt2 = P.lightTower(); place(lt2, ISLAND.x + 80, ISLAND.z - 55, 2.5); island.add(lt2);
    const pk = P.pickup(); place(pk, ISLAND.x - 85, ISLAND.z + 30, 1.2); island.add(pk);
  }
  // e-frac spread (future)
  const frac = new THREE.Group(); frac.visible = false; scene.add(frac);
  {
    for (let i = 0; i < 8; i++) { const f = P.fracPump(); place(f, FRAC.x - 45 + i * 0, FRAC.z - 30 + i * 7.5, 0); frac.add(f); }
    for (let i = 0; i < 2; i++) { const u = P.novaltPackage(); place(u, FRAC.x + 40, FRAC.z - 20 + i * 14); frac.add(u); }
    const e = P.ehouse(12, 3.6, 3.4); place(e, FRAC.x + 10, FRAC.z + 30); frac.add(e);
    for (const [x, z] of [[-70, 45], [70, -50], [0, 60]]) {
      const L = new THREE.PointLight(0xffe2b8, 0, 150, 2); L.position.set(FRAC.x + x, groundY(FRAC.x + x, FRAC.z + z) + 12, FRAC.z + z);
      frac.add(L); frac.userData.lights = (frac.userData.lights || []).concat(L);
    }
  }
  // power from the two frac-pad NovaLT units to the electric pumps
  const fracLines = new GlowLines({ width: 2.0, core: 1.4, flow: 40, flowSpacing: 18, headLen: 20, headBoost: 3.0 });
  for (let i = 0; i < 8; i++) {
    const pz = FRAC.z - 30 + i * 7.5;
    const src = [FRAC.x + 40 - 7.8, 1.2, FRAC.z - 20 + (i < 4 ? 0 : 14)];
    fracLines.add([src, [FRAC.x + 18, 1.2, src[2]], [FRAC.x + 18, 1.2, pz], [FRAC.x - 38, 1.2, pz]].map(([x, y, z]) => new THREE.Vector3(x, groundY(x, z) + y, z)), { color: [0.05, 2.6, 1.7], delay: i * 0.06, speed: 90, step: 2 });
  }
  scene.add(fracLines.build()); fracLines.mesh.visible = false;

  // ------------------------------------------------------------ distant flares: the constellation on the horizon
  const farFlares = [];
  {
    const rnd = mulberry32(2024);
    for (let i = 0; i < 120; i++) {
      const a = rnd() * Math.PI * 2, r = 1100 + Math.pow(rnd(), 0.8) * 17000;
      const x = Math.cos(a) * r - 300, z = Math.sin(a) * r;
      farFlares.push({ x, y: groundY(x, z) + 16 + rnd() * 12, z, seed: rnd(), size: 34 + rnd() * 50 });
    }
  }
  const flareDots = flareSprites(farFlares, { intensity: 9, scale: 1500 });
  scene.add(flareDots);

  // ------------------------------------------------------------ diagram layers (lines drawn onto the land)
  const Y = (x, z, lift = 0.6) => new THREE.Vector3(x, groundY(x, z) + lift, z);
  const polyOnGround = (pts, lift) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 20));
      for (let k = 0; k < n; k++) { const t = k / n; out.push(Y(ax + (bx - ax) * t, az + (bz - az) * t, lift)); }
    }
    const [lx, lz] = pts[pts.length - 1]; out.push(Y(lx, lz, lift));
    return out;
  };
  const GAS = [0.08, 0.42, 1.9], POWER = [0.05, 2.4, 1.55], FIRE = [2.6, 0.9, 0.25];
  const gasLines = new GlowLines({ width: 1.5, core: 0.9, flow: 60, flowSpacing: 90, headLen: 60, headBoost: 2.0 });
  GATHER.forEach((g, i) => gasLines.add(polyOnGround(g.map(([x, z]) => [x + 11, z + 11]), 0.8), { color: GAS, delay: (i % 7) * 0.12, speed: 900, seed: i * 0.37 }));
  scene.add(gasLines.build());
  // the trunk line to market (runs north to the horizon) — where the gas backs up
  const trunk = new GlowLines({ width: 2.2, core: 1.0, flow: 30, flowSpacing: 40, headLen: 80, headBoost: 2.0 });
  trunk.add(polyOnGround([[11, 11], [11, -1609 * 0.5 + 11], [611, -1609 * 0.5 + 11], [611, -9000]], 0.8), { color: [0.12, 0.55, 2.6], delay: 0.9, speed: 1600, seed: 0.9 });
  scene.add(trunk.build());
  // gas rerouted to the power island (the future)
  const toIsland = new GlowLines({ width: 2.4, core: 1.2, flow: 70, flowSpacing: 45, headLen: 60, headBoost: 3.0 });
  toIsland.add(polyOnGround([[11, 11], [11, 0.5 * 1609 - 11], [ISLAND.x + 11, 0.5 * 1609 - 11], [ISLAND.x + 11, ISLAND.z]], 0.9), { color: [0.12, 0.6, 2.8], delay: 0, speed: 700, seed: 0.3 });
  scene.add(toIsland.build());
  // power routes: from the island along roads to every pad, the CDP and the frac pad
  const powerLines = new GlowLines({ width: 2.4, flow: 120, flowSpacing: 70, headLen: 90, headBoost: 3.0 });
  const mile = 1609.34;
  const nearRoadZ = (z) => (Math.round(z / mile - 0.5) + 0.5) * mile;
  const routes = [];
  const iz = 0.5 * mile;
  for (const p of PADS) {
    if (p === ISLAND) continue;
    const rz = nearRoadZ(p.z);
    routes.push([[ISLAND.x, ISLAND.z], [ISLAND.x, iz], [p.x, iz], [p.x, rz === iz ? p.z : rz], [p.x, p.z]]);
  }
  routes.sort((a, b) => Math.hypot(a[4][0] - ISLAND.x, a[4][1] - ISLAND.z) - Math.hypot(b[4][0] - ISLAND.x, b[4][1] - ISLAND.z));
  routes.forEach((r, i) => powerLines.add(polyOnGround(r.map(([x, z]) => [x - 13, z - 13]), 1.0), { color: POWER, delay: i * 0.035, speed: 1400, seed: i * 0.61 }));
  scene.add(powerLines.build());
  // grid line glow (the existing grid that stops short)
  const gridGlow = new GlowLines({ width: 1.6, flow: 40, flowSpacing: 120, headLen: 50, headBoost: 1.5 });
  gridGlow.add(tops.map((t) => t.clone().add(new THREE.Vector3(0, -1.0, 0))), { color: [2.2, 1.6, 0.6], speed: 5000 });
  scene.add(gridGlow.build());
  // wells as points of light, flares as fire points
  const wellPts = glowPoints(WELLS.map((w, i) => ({ x: w.x, y: groundY(w.x, w.z) + 3, z: w.z, color: [1.4, 1.5, 1.6], size: 7, delay: 0, seed: i * 0.1 })), { twinkle: 0.3 });
  scene.add(wellPts.points);
  const frnd = mulberry32(77);
  const padFlares = PADS.filter((p) => p.kind === 'well').map((p, i) => ({ x: p.x + p.w * 0.42, y: groundY(p.x, p.z) + 12, z: p.z - p.d * 0.4, color: FIRE, size: 22, delay: frnd() * 0.8, seed: i * 0.31 }));
  padFlares.push({ x: flareTip.x, y: flareTip.y, z: flareTip.z, color: FIRE, size: 34, delay: 0.95, seed: 0.5 });
  const flarePts = glowPoints(padFlares, { twinkle: 1.0 });
  scene.add(flarePts.points);
  const islandNode = glowPoints([{ x: ISLAND.x - 40, y: groundY(ISLAND.x, ISLAND.z) + 8, z: ISLAND.z, color: [0.4, 5, 3.6], size: 46, delay: 0, seed: 0.2 }], { twinkle: 0.2 });
  scene.add(islandNode.points);

  // more power islands across the wider basin (for the scale-up sequence)
  const basin = [];
  {
    const r2 = mulberry32(501);
    for (let i = 0; i < 26; i++) {
      const a = r2() * Math.PI * 2, d = 3500 + r2() * 11000;
      basin.push({ x: Math.cos(a) * d - 300, y: 30, z: Math.sin(a) * d, color: [0.3, 4.2, 3.0], size: 30 + r2() * 18, delay: 0.05 + (d - 3500) / 11000 * 0.9 + r2() * 0.08, seed: r2() });
    }
  }
  const basinNodes = glowPoints(basin, { twinkle: 0.15 });
  scene.add(basinNodes.points);
  const basinLines = new GlowLines({ width: 1.6, core: 1.0, flow: 200, flowSpacing: 160, headLen: 200, headBoost: 3.0 });
  {
    const r3 = mulberry32(88);
    basin.forEach((b, i) => {
      for (let k = 0; k < 3; k++) {
        const a = r3() * Math.PI * 2, d = 600 + r3() * 1600;
        const ex = b.x + Math.cos(a) * d, ez = b.z + Math.sin(a) * d;
        basinLines.add([[b.x, 3, b.z], [ex, 3, b.z], [ex, 3, ez]].map(([x, y, z]) => new THREE.Vector3(x, groundY(x, z) + y, z)), { color: POWER, delay: b.delay * 3.0 + 0.2, speed: 2400, seed: r3() });
      }
    });
  }
  scene.add(basinLines.build());
  const beam = new GlowLines({ width: 2.0, core: 1.6, flow: 400, flowSpacing: 260, headLen: 300, headBoost: 3.0 });
  beam.add([new THREE.Vector3(ISLAND.x - 40, groundY(ISLAND.x, ISLAND.z) + 16, ISLAND.z), new THREE.Vector3(ISLAND.x - 40, 4200, ISLAND.z)], { color: [0.1, 2.6, 1.8], speed: 2600, step: 40 });
  scene.add(beam.build());
  const layers = { gasLines, trunk, toIsland, powerLines, gridGlow, basinLines, beam, fracLines, wellPts, flarePts, islandNode, basinNodes };
  for (const k of ['gasLines', 'trunk', 'toIsland', 'powerLines', 'gridGlow', 'basinLines', 'beam', 'fracLines']) layers[k].mesh.visible = false;
  basinNodes.points.visible = false;
  for (const k of ['wellPts', 'flarePts', 'islandNode']) layers[k].points.visible = false;

  const presets = SKY_PRESETS;
  // ------------------------------------------------------------ per-frame state
  function setTimeOfDay(p, { sunI, hemiI, hemiSky, hemiGround, sunColor, fog } = {}) {
    sky.apply(p);
    const sd = new THREE.Vector3(...p.sunDir).normalize();
    sun.position.copy(sun.target.position).addScaledVector(sd, 2000);
    sun.intensity = sunI ?? 3;
    if (sunColor) sun.color.setRGB(...sunColor);
    hemi.intensity = hemiI ?? 0.6;
    if (hemiSky) hemi.color.setRGB(...hemiSky);
    if (hemiGround) hemi.groundColor.setRGB(...hemiGround);
    if (fog) setAtmos({ sunDir: p.sunDir, ...fog });
  }
  function focusShadows(x, z, half = 300) {
    sun.target.position.set(x, groundY(x, z), z);
    const sd = sun.position.clone().sub(sun.target.position).normalize();
    sun.position.copy(sun.target.position).addScaledVector(sd, 2000);
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix();
  }
  function animate(t) {
    for (const { pj, w } of pumps) pj.update(t, w.phase, w.speed);
    heroFlame.set(t);
    const hf = 0.85 + 0.1 * Math.sin(t * 9.7) + 0.05 * Math.sin(t * 23.1);
    halo.material.opacity = hf;
    flareDots.material.uniforms.uTime.value = t;
    for (const k of ['gasLines', 'trunk', 'toIsland', 'powerLines', 'gridGlow', 'basinLines', 'beam', 'fracLines']) layers[k].set({ time: t });
    for (const k of ['wellPts', 'flarePts', 'islandNode', 'basinNodes']) layers[k].uniforms.uTime.value = t;
    // flicker the flare light
    const f = 0.8 + 0.12 * Math.sin(t * 13.1) + 0.08 * Math.sin(t * 29.7 + 1.3);
    flareLight.userData.flicker = f;
  }
  // Capture the current sky into an environment map so metal and paint catch the light of the hour.
  const envCache = new Map();
  function envFor(key) {
    if (envCache.has(key)) return envCache.get(key);
    const es = new THREE.Scene();
    const skyClone = new THREE.Mesh(sky.mesh.geometry, sky.mesh.material);
    skyClone.frustumCulled = false; es.add(skyClone);
    const pm = new THREE.PMREMGenerator(engine.renderer);
    const tex = pm.fromScene(es, 0.06).texture; pm.dispose();
    envCache.set(key, tex);
    return tex;
  }
  const flameBase = heroFlame.mesh.scale.clone();
  // Restore every piece of shared state; each Permian shot calls this before dressing the world.
  function reset() {
    hideLayers();
    island.visible = false; frac.visible = false; shrubs.visible = true; cdp.visible = true; gensets.visible = true;
    heroFlame.mesh.visible = true; heroFlame.mesh.scale.copy(flameBase); heroFlame.set(0, { uIntensity: 1.0 });
    halo.visible = true; halo.material.color.setRGB(0.55, 0.19, 0.055);
    flareLight.intensity = 0;
    ground.uniforms.uDiagram.value = 0; ground.uniforms.uGlowCount.value = 0;
    flareDots.visible = true; flareDots.material.uniforms.uIntensity.value = 9;
    for (const k of ['wellPts', 'flarePts', 'islandNode', 'basinNodes']) { layers[k].uniforms.uOff.value = -1; layers[k].uniforms.uProgress.value = 1; layers[k].uniforms.uOpacity.value = 1; }
    for (const k of ['gasLines', 'trunk', 'toIsland', 'powerLines', 'gridGlow', 'basinLines', 'beam', 'fracLines']) layers[k].set({ opacity: 1, intensity: 1, widthScale: 1 });
    for (const L of island.userData.lights || []) L.intensity = 0;
    for (const L of frac.userData.lights || []) L.intensity = 0;
    for (const k of ['wellPts', 'flarePts', 'islandNode', 'basinNodes']) layers[k].uniforms.uPx.value = 1;
    ground.uniforms.uDiagramColor.value.setRGB(0.004, 0.008, 0.012);
    scene.environment = null;
  }
  function hideLayers() {
    for (const k of ['gasLines', 'trunk', 'toIsland', 'powerLines', 'gridGlow', 'basinLines', 'beam', 'fracLines']) layers[k].mesh.visible = false;
    for (const k of ['wellPts', 'flarePts', 'islandNode', 'basinNodes']) layers[k].points.visible = false;
  }
  return {
    envFor, hideLayers, reset,
    scene, sky, ground, sun, hemi, flareLight, heroFlame, halo, flareTip, flareStack, flareDots, farFlares,
    cdp, island, units, frac, pumps, shrubs, gridWires, poleWood, poleIns, tops, gensets,
    layers, presets, setTimeOfDay, focusShadows, animate, groundY,
  };
}

function mergeParts(parts) {
  // local helper (avoid importing BufferGeometryUtils twice in this module)
  let total = 0; for (const g of parts) total += g.index ? g.index.count : g.attributes.position.count;
  const pos = [], nor = [];
  for (const g of parts) {
    const gi = g.index ? g.toNonIndexed() : g;
    if (!gi.attributes.normal) gi.computeVertexNormals();
    pos.push(...gi.attributes.position.array); nor.push(...gi.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.computeVertexNormals();
  return out;
}
