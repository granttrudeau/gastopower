// Florence at dawn, built in code for the etching renderer. Units: metres. Duomo dome at the origin, +z south.
// Each mesh carries userData.cat: 'stone' | 'roof' | 'dome' | 'water' | 'ground' | 'tree' | 'hill' | 'foundry' | 'glow'.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../engine/util.js';

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
// Normalise any geometry to non-indexed position+normal so mixed primitives can be merged.
function clean(g) {
  const n = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', n.attributes.position);
  if (!n.attributes.normal) n.computeVertexNormals();
  out.setAttribute('normal', n.attributes.normal);
  return out;
}
const merge = (list) => mergeGeometries(list.map(clean), false);
function hipRoof(w, d, h) {
  // pyramid-ish hip roof over a w x d footprint, apex ridge along the longer side
  const g = new THREE.BufferGeometry();
  const r = Math.min(w, d) * 0.5, lx = w / 2, lz = d / 2;
  const ridge = w > d ? [[-lx + r, h, 0], [lx - r, h, 0]] : [[0, h, -lz + r], [0, h, lz - r]];
  const c = [[-lx, 0, -lz], [lx, 0, -lz], [lx, 0, lz], [-lx, 0, lz]];
  const [a, b] = ridge;
  const tris = w > d
    ? [c[0], c[1], b, c[0], b, a, c[2], c[3], a, c[2], a, b, c[1], c[2], b, c[3], c[0], a]
    : [c[0], c[1], a, c[1], c[2], b, c[1], b, a, c[2], c[3], b, c[3], c[0], a, c[3], a, b];
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

export function buildFlorence() {
  const root = new THREE.Group();
  const add = (geo, cat) => { const m = new THREE.Mesh(geo, null); m.userData.cat = cat; m.castShadow = true; m.receiveShadow = true; root.add(m); return m; };
  const rnd = mulberry32(1296);

  // ---------------- Santa Maria del Fiore
  {
    const stone = [], roof = [];
    // nave (west end = facade at x=-128), aisles, transept tribunes
    stone.push(box(96, 38, 38, -80, 0, 0), box(96, 24, 58, -80, 0, 0));
    roof.push(hipRoof(96, 38, 9).translate(-80, 38, 0));
    // facade
    stone.push(box(4, 46, 40, -130, 0, 0));
    // three tribunes (half-octagon apses) around the crossing
    for (const [x, z] of [[34, 0], [0, -34], [0, 34]]) {
      const g = new THREE.CylinderGeometry(19, 19, 30, 8, 1); g.translate(x, 15, z); stone.push(g);
      const rg = new THREE.ConeGeometry(20, 8, 8); rg.translate(x, 34, z); roof.push(rg);
      const lg = new THREE.CylinderGeometry(4, 4, 6, 8); lg.translate(x, 40, z); stone.push(lg);
    }
    stone.push(box(46, 44, 46, 0, 0, 0));
    // drum
    const drum = new THREE.CylinderGeometry(24.5, 24.5, 22, 8, 1); drum.rotateY(Math.PI / 8); drum.translate(0, 44 + 11, 0); stone.push(drum);
    add(merge(stone), 'stone');
    add(merge(roof), 'roof');
    // oculi on the drum (dark discs)
    const oc = [];
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) * Math.PI / 4 + Math.PI / 8;
      const g = new THREE.CylinderGeometry(1.7, 1.7, 1, 18); g.rotateX(Math.PI / 2); g.rotateY(-a + Math.PI / 2);
      g.translate(Math.cos(a) * 23.2, 55, Math.sin(a) * 23.2); oc.push(g.toNonIndexed());
    }
    add(merge(oc), 'dark');
    // the dome: octagonal cloister vault, pointed "quinto acuto" profile (arc radius 4/5 of the span)
    const R = 25.5, arcR = 0.8 * 2 * R, cx = R - arcR, H0 = 66;
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const x = R - (i / 24) * (R - 5.2);
      const y = Math.sqrt(Math.max(0, arcR * arcR - (x - cx) * (x - cx)));
      prof.push(new THREE.Vector2(x, y));
    }
    const dome = new THREE.LatheGeometry(prof, 8); dome.rotateY(Math.PI / 8); dome.translate(0, H0, 0);
    add(clean(dome), 'dome');
    // eight white ribs on the corners
    const ribs = [];
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8;
      const pts = prof.map((p) => new THREE.Vector3(Math.sin(a) * (p.x + 0.4), H0 + p.y + 0.2, Math.cos(a) * (p.x + 0.4)));
      ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.9, 5, false).toNonIndexed());
    }
    add(merge(ribs), 'stone');
    // lantern
    const top = prof[prof.length - 1].y + H0;
    const lan = [new THREE.CylinderGeometry(5.6, 5.8, 3, 8).translate(0, top + 1.5, 0), new THREE.CylinderGeometry(4.2, 4.2, 9, 8).translate(0, top + 7.5, 0), new THREE.ConeGeometry(4.6, 8, 8).translate(0, top + 16, 0), new THREE.SphereGeometry(1.3, 12, 8).translate(0, top + 21, 0), new THREE.BoxGeometry(0.4, 3.5, 0.4).translate(0, top + 23.5, 0), new THREE.BoxGeometry(1.8, 0.4, 0.4).translate(0, top + 24, 0)];
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; lan.push(new THREE.BoxGeometry(1.2, 9, 1.2).translate(Math.sin(a) * 5.4, top + 7.5, Math.cos(a) * 5.4)); }
    add(merge(lan), 'stone');
  }
  // ---------------- Giotto's campanile (84.7 m), at the south-west corner of the facade
  {
    const g = [], dark = [];
    const W = 14.5, x = -122, z = 30;
    g.push(box(W, 84.7, W, x, 0, z));
    for (const y of [16, 33, 49, 64, 81]) g.push(box(W + 1.2, 1.2, W + 1.2, x, y, z));
    g.push(box(W + 2.8, 1.6, W + 2.8, x, 84.7, z));
    for (const [yy, hh, n] of [[36, 9, 2], [52, 10, 2], [67, 12, 1]]) {
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : (i - 0.5) * 5;
        dark.push(box(2.6, hh, 0.6, x + off, yy, z + W / 2 + 0.1), box(0.6, hh, 2.6, x + W / 2 + 0.1, yy, z + off));
      }
    }
    add(merge(g), 'stone');
    add(merge(dark), 'dark');
  }
  // ---------------- Baptistery
  {
    const b = new THREE.CylinderGeometry(13.5, 13.5, 26, 8).translate(-185, 13, 0);
    const r = new THREE.ConeGeometry(14.5, 9, 8).translate(-185, 30.5, 0);
    const l = new THREE.CylinderGeometry(2.6, 2.6, 6, 8).translate(-185, 37, 0);
    add(mergeGeometries([b.toNonIndexed(), l.toNonIndexed()]), 'stone'); add(r.toNonIndexed(), 'roof');
  }
  // ---------------- Palazzo Vecchio with Arnolfo's tower (94 m)
  {
    const x = -150, z = 330;
    const g = [box(42, 33, 48, x, 0, z)];
    for (let i = 0; i < 12; i++) g.push(box(2.2, 2.4, 2.2, x - 20 + i * 3.6, 33, z - 24), box(2.2, 2.4, 2.2, x - 20 + i * 3.6, 33, z + 24));
    const tx = x, tz = z - 18;
    g.push(box(8, 72, 8, tx, 0, tz), box(10, 6, 10, tx, 70, tz), box(6.5, 12, 6.5, tx, 76, tz));
    for (let i = 0; i < 4; i++) g.push(box(1.2, 8, 1.2, tx - 2.2 + (i % 2) * 4.4, 88, tz - 2.2 + Math.floor(i / 2) * 4.4));
    add(merge(g), 'stone');
    add(new THREE.ConeGeometry(3.6, 5, 4).rotateY(Math.PI / 4).translate(tx, 98, tz).toNonIndexed(), 'roof');
    add(hipRoof(42, 48, 4).translate(x, 33, z), 'roof');
  }
  // ---------------- other churches and towers for the skyline
  {
    const g = [], r = [];
    // San Lorenzo dome (north-west), Santa Croce (east), Santa Maria Novella (west), Badia & Bargello towers
    g.push(box(30, 22, 70, -300, 0, -180), new THREE.CylinderGeometry(10, 10, 12, 8).translate(-300, 28, -150));
    r.push(new THREE.SphereGeometry(10, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.2, 1).translate(-300, 34, -150));
    g.push(box(90, 26, 38, 380, 0, 220)); r.push(hipRoof(90, 38, 8).translate(380, 26, 220));
    g.push(box(3.5, 60, 3.5, 440, 0, 190));
    g.push(box(70, 24, 30, -420, 0, -60)); r.push(hipRoof(70, 30, 7).translate(-420, 24, -60)); g.push(box(5, 58, 5, -400, 0, -80));
    g.push(box(4.5, 57, 4.5, -40, 0, 240), box(5.5, 54, 5.5, 30, 0, 190));
    add(merge(g), 'stone');
    add(merge(r), 'roof');
  }
  // ---------------- the city fabric: houses with hip roofs, avoiding monuments and the river
  const riverZ = (x) => 600 + 40 * Math.sin(x / 700) + 0.00004 * x * x;
  const keepOut = [[-80, 0, 150, 70], [-122, 30, 14, 14], [-185, 0, 22, 22], [-150, 330, 38, 40], [-300, -165, 26, 50], [380, 220, 60, 30], [-420, -60, 50, 30], [-40, 240, 8, 8], [30, 190, 8, 8], [440, 190, 6, 6], [-400, -80, 8, 8]];
  const bodies = [], roofs = [];
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const roofGeo = hipRoof(1, 1, 1);
  const d = new THREE.Object3D();
  for (let gx = -1300; gx < 1300; gx += 17) {
    for (let gz = -900; gz < 1100; gz += 17) {
      const x = gx + (rnd() - 0.5) * 6, z = gz + (rnd() - 0.5) * 6;
      const rz = riverZ(x);
      if (Math.abs(z - rz) < 70) continue;           // river + embankments
      if (z > rz + 70 && z > rz + 70 + 220 * (0.5 + 0.5 * Math.sin(x / 300))) continue; // the south bank thins out
      const dist = Math.hypot(x + 60, z - 150);
      if (dist > 1150 + 200 * Math.sin(x * 0.01)) continue;
      if (keepOut.some(([kx, kz, hw, hd]) => Math.abs(x - kx) < hw + 6 && Math.abs(z - kz) < hd + 6)) continue;
      if (rnd() < 0.1) continue;  // piazzas and gardens
      const w = 8 + rnd() * 9, dd = 8 + rnd() * 9, h = 9 + rnd() * 12 + (rnd() < 0.08 ? 8 : 0) - Math.max(0, dist - 700) * 0.008;
      const ry = (rnd() - 0.5) * 0.12;
      bodies.push({ x, z, w, dd, h, ry }); roofs.push({ x, z, w: w + 1, dd: dd + 1, h: 2.5 + rnd() * 2, y: h, ry });
    }
  }
  const bi = new THREE.InstancedMesh(bodyGeo, null, bodies.length); bi.userData.cat = 'stone';
  bodies.forEach((b, i) => { d.position.set(b.x, 0, b.z); d.rotation.set(0, b.ry, 0); d.scale.set(b.w, b.h, b.dd); d.updateMatrix(); bi.setMatrixAt(i, d.matrix); });
  const ri = new THREE.InstancedMesh(roofGeo, null, roofs.length); ri.userData.cat = 'roof';
  roofs.forEach((b, i) => { d.position.set(b.x, b.y, b.z); d.rotation.set(0, b.ry, 0); d.scale.set(b.w, b.h, b.dd); d.updateMatrix(); ri.setMatrixAt(i, d.matrix); });
  bi.castShadow = bi.receiveShadow = ri.castShadow = ri.receiveShadow = true;
  root.add(bi, ri);
  // ---------------- river, embankments, bridges
  {
    const pts = [];
    for (let x = -2500; x <= 2500; x += 50) pts.push(x);
    const pos = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = pts[i], x1 = pts[i + 1], z0 = riverZ(x0), z1 = riverZ(x1);
      pos.push(x0, -3, z0 - 55, x1, -3, z1 - 55, x1, -3, z1 + 55, x0, -3, z0 - 55, x1, -3, z1 + 55, x0, -3, z0 + 55);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = add(g, 'water'); m.castShadow = false;
    // Ponte Vecchio (arches with shops on top) and Ponte Santa Trinita
    const pv = [], x = -230, z = riverZ(-230);
    pv.push(box(22, 4, 120, x, 3, z), box(18, 9, 110, x, 7, z));
    for (const zz of [-35, 0, 35]) pv.push(box(22, 7, 6, x, -3, z + zz));
    const st = [box(16, 3, 120, -520, 4, riverZ(-520))];
    for (const zz of [-30, 30]) st.push(box(16, 8, 6, -520, -3, riverZ(-520) + zz));
    add(merge([...pv, ...st]), 'stone');
    add(hipRoof(18, 110, 3).translate(x, 16, z), 'roof');
  }
  // ---------------- ground, hills of Fiesole behind, the Oltrarno hill in front, cypresses
  {
    const g = new THREE.PlaneGeometry(9000, 9000, 180, 180); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let h = 0;
      if (z < -700) h += Math.pow(Math.min(1, (-700 - z) / 2600), 1.3) * (260 + 90 * Math.sin(x / 600) + 50 * Math.sin(x / 210 + 1));
      const south = riverZ(x) + 260;
      if (z > south) h += Math.pow(Math.min(1, (z - south) / 900), 1.4) * (130 + 40 * Math.sin(x / 400));
      h += 3 * Math.sin(x / 90) * Math.sin(z / 110);
      p.setY(i, h);
    }
    g.computeVertexNormals();
    const m = add(g, 'hill'); m.castShadow = false;
    // cypresses along the hills and gardens
    const cy = new THREE.ConeGeometry(2.2, 16, 7).translate(0, 8, 0);
    const trees = [];
    for (let i = 0; i < 520; i++) {
      const x = (rnd() - 0.5) * 3600, z = riverZ(x) + 300 + rnd() * 700;
      trees.push([x, z, 0.7 + rnd() * 0.8]);
    }
    const ti = new THREE.InstancedMesh(cy, null, trees.length); ti.userData.cat = 'tree';
    const hgt = (x, z) => {
      let h = 0; if (z < -700) h += Math.pow(Math.min(1, (-700 - z) / 2600), 1.3) * (260 + 90 * Math.sin(x / 600) + 50 * Math.sin(x / 210 + 1));
      const south = riverZ(x) + 260; if (z > south) h += Math.pow(Math.min(1, (z - south) / 900), 1.4) * (130 + 40 * Math.sin(x / 400));
      return h + 3 * Math.sin(x / 90) * Math.sin(z / 110);
    };
    trees.forEach(([x, z, s], i) => { d.position.set(x, hgt(x, z) - 1, z); d.rotation.set(0, 0, 0); d.scale.set(s, s * (1 + rnd() * 0.6), s); d.updateMatrix(); ti.setMatrixAt(i, d.matrix); });
    ti.castShadow = true; root.add(ti);
    root.userData.hgt = hgt;
  }
  // ---------------- the Pignone foundry, on the south bank in the foreground
  const foundry = new THREE.Group(); root.add(foundry);
  {
    const fx = 560, fz = riverZ(560) + 105;
    const g = [box(60, 11, 22, fx, 0, fz), box(24, 14, 18, fx - 42, 0, fz + 4)];
    const r = [hipRoof(60, 22, 6).translate(fx, 11, fz), hipRoof(24, 18, 5).translate(fx - 42, 14, fz + 4)];
    const ch = new THREE.CylinderGeometry(1.6, 2.6, 42, 12).translate(fx + 18, 21, fz - 4);
    const m1 = new THREE.Mesh(merge([...g, ch]), null); m1.userData.cat = 'foundry';
    const m2 = new THREE.Mesh(merge(r), null); m2.userData.cat = 'roof';
    m1.castShadow = m2.castShadow = true; m1.receiveShadow = m2.receiveShadow = true;
    foundry.add(m1, m2);
    // glowing furnace doors/windows
    const glow = [];
    for (let i = 0; i < 6; i++) glow.push(box(3, 4, 0.4, fx - 24 + i * 9, 2, fz + 11.2));
    const gm = new THREE.Mesh(merge(glow), null); gm.userData.cat = 'glow'; foundry.add(gm);
    root.userData.chimneyTop = new THREE.Vector3(fx + 18, 43, fz - 4);
    root.userData.foundry = new THREE.Vector3(fx, 6, fz);
  }
  return root;
}
