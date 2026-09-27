// Procedural oilfield and power-island props. All geometry is built from primitives in code.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stdMat } from '../engine/atmos.js';

export const M = {};
function mats() {
  if (M.steel) return M;
  M.steel = stdMat({ color: 0x5c6166, metalness: 0.6, roughness: 0.55 });
  M.darkSteel = stdMat({ color: 0x24282b, metalness: 0.5, roughness: 0.6 });
  M.galv = stdMat({ color: 0x9aa1a6, metalness: 0.7, roughness: 0.45 });
  M.olive = stdMat({ color: 0x6b6b4c, metalness: 0.15, roughness: 0.7 });
  M.tan = stdMat({ color: 0xb9ab8e, metalness: 0.1, roughness: 0.75 });
  M.white = stdMat({ color: 0xd9dcdc, metalness: 0.1, roughness: 0.5 });
  M.panel = stdMat({ color: 0xc7cbcc, metalness: 0.25, roughness: 0.45 });
  M.panelDark = stdMat({ color: 0x8d9396, metalness: 0.3, roughness: 0.5 });
  M.yellow = stdMat({ color: 0xe0b21e, metalness: 0.1, roughness: 0.5 });
  M.black = stdMat({ color: 0x151617, metalness: 0.2, roughness: 0.65 });
  M.wood = stdMat({ color: 0x5a4a38, metalness: 0.0, roughness: 0.9 });
  M.green = stdMat({ color: 0x02bc94, metalness: 0.2, roughness: 0.45 });
  M.teal = stdMat({ color: 0x0f5e55, metalness: 0.3, roughness: 0.5 });
  M.concrete = stdMat({ color: 0xa8a39a, metalness: 0.0, roughness: 0.95 });
  M.rust = stdMat({ color: 0x6d4b33, metalness: 0.3, roughness: 0.8 });
  M.reflective = [M.steel, M.darkSteel, M.galv, M.white, M.panel, M.panelDark, M.yellow, M.green, M.teal];
  M.glassLit = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.6, 1.9) });
  M.lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 12, 9) });
  M.lampGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 9, 6) });
  M.lampRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(12, 0.6, 0.3) });
  return M;
}

// Give the metal/painted props an environment map (sky of the hour) without lighting the whole world with it.
export function setPropsEnv(tex, intensity = 0.8) {
  mats();
  for (const m of M.reflective) { m.envMap = tex; m.envMapIntensity = intensity; m.needsUpdate = true; }
}

const box = (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cyl = (r, h, x = 0, y = 0, z = 0, seg = 20, r2 = r) => { const g = new THREE.CylinderGeometry(r2, r, h, seg); g.translate(x, y, z); return g; };
const cylX = (r, len, x = 0, y = 0, z = 0, seg = 20) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return g; };
const cylZ = (r, len, x = 0, y = 0, z = 0, seg = 20) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };

function meshOf(geos, mat, cast = true) {
  const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

// Beam between two points (for trusses, braces, pitman arms)
function strut(a, b, w, h = w) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.BoxGeometry(w, len, h);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  return g;
}

// ---------------------------------------------------------------- pumpjack
// Conventional crank-balanced beam pump. Local +x points toward the wellhead (horsehead end).
const PJ = { samsonH: 6.2, beamFront: 4.6, beamBack: 3.6, crankR: 1.25, crankY: 2.35, crankX: -3.6 };
let _pjGeo = null;
function pumpjackGeo() {
  if (_pjGeo) return _pjGeo;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const base = [box(9.5, 0.45, 1.6, -0.6, 0.22, 0), box(9.5, 0.12, 0.3, -0.6, 0.5, 0.65), box(9.5, 0.12, 0.3, -0.6, 0.5, -0.65)];
  const samson = [
    strut(V(-1.6, 0.45, 0.75), V(0, PJ.samsonH, 0.18), 0.28), strut(V(-1.6, 0.45, -0.75), V(0, PJ.samsonH, -0.18), 0.28),
    strut(V(1.2, 0.45, 0.75), V(0, PJ.samsonH, 0.18), 0.26), strut(V(1.2, 0.45, -0.75), V(0, PJ.samsonH, -0.18), 0.26),
    box(0.5, 0.35, 0.6, 0, PJ.samsonH + 0.1, 0),
  ];
  const ladder = [];
  for (let i = 0; i < 12; i++) ladder.push(box(0.04, 0.04, 0.5, -1.25 + i * 0.105, 0.9 + i * 0.44, 0.9));
  ladder.push(strut(V(-1.35, 0.45, 0.66), V(-0.1, 5.8, 0.66), 0.05), strut(V(-1.35, 0.45, 1.14), V(-0.1, 5.8, 1.14), 0.05));
  const gear = [box(1.9, 1.5, 1.3, PJ.crankX, 1.3, 0), cylZ(0.62, 1.34, PJ.crankX, PJ.crankY, 0, 24), box(1.1, 0.8, 0.8, PJ.crankX - 2.0, 0.9, 0), cylX(0.34, 1.2, PJ.crankX - 2.0, 1.1, 0)];
  const wellhead = [cyl(0.16, 1.4, PJ.beamFront + 0.05, 0.7, 0), cyl(0.28, 0.35, PJ.beamFront + 0.05, 0.25, 0), box(0.5, 0.18, 0.5, PJ.beamFront + 0.05, 1.1, 0), cylX(0.08, 1.4, PJ.beamFront + 0.7, 0.95, 0)];
  // walking beam (pivot at origin), horsehead at +x
  const beam = [box(PJ.beamFront + PJ.beamBack, 0.55, 0.38, (PJ.beamFront - PJ.beamBack) / 2, 0, 0), box(1.2, 0.22, 0.7, -PJ.beamBack + 0.3, 0.1, 0)];
  // Horsehead: a curved plate whose face is an arc centred on the beam pivot (keeps the bridle vertical).
  const shape = new THREE.Shape();
  const Rf = PJ.beamFront + 0.95, Rb = PJ.beamFront - 0.25, a0 = -0.34, a1 = 0.2;
  shape.moveTo(Rb * Math.cos(a0), Rb * Math.sin(a0));
  for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * (i / 16); shape.lineTo(Rf * Math.cos(a), Rf * Math.sin(a)); }
  shape.lineTo(Rb * Math.cos(a1) - 0.2, Rb * Math.sin(a1) + 0.25);
  shape.lineTo(Rb - 0.6, 0.3); shape.lineTo(Rb - 0.6, -0.3);
  shape.closePath();
  const hh = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false, curveSegments: 16 });
  hh.translate(0, 0, -0.275);
  const crank = [box(0.35, PJ.crankR * 2 + 0.9, 0.22, 0, -PJ.crankR * 0.3, 0.8), box(0.35, PJ.crankR * 2 + 0.9, 0.22, 0, -PJ.crankR * 0.3, -0.8), box(1.1, 0.8, 0.3, 0, -PJ.crankR - 0.35, 0.82), box(1.1, 0.8, 0.3, 0, -PJ.crankR - 0.35, -0.82)];
  _pjGeo = {
    steel: mergeGeometries([...base, ...samson, ...gear, ...wellhead]),
    ladder: mergeGeometries(ladder),
    beam: mergeGeometries(beam), head: hh,
    crank: mergeGeometries(crank.slice(0, 2)), weights: mergeGeometries(crank.slice(2)),
    pitman: strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.16),
  };
  return _pjGeo;
}

export function pumpjack({ beamColor = 'black', headColor = 'yellow' } = {}) {
  mats();
  const g = pumpjackGeo();
  const root = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  root.add(add(g.steel, M.darkSteel));
  root.add(add(g.ladder, M.galv));
  const beamPivot = new THREE.Group(); beamPivot.position.set(0, PJ.samsonH + 0.35, 0); root.add(beamPivot);
  beamPivot.add(add(g.beam, M[beamColor] || M.black));
  beamPivot.add(add(g.head, M[headColor] || M.yellow));
  const crankPivot = new THREE.Group(); crankPivot.position.set(PJ.crankX, PJ.crankY, 0); root.add(crankPivot);
  crankPivot.add(add(g.crank, M.darkSteel));
  crankPivot.add(add(g.weights, M[headColor] || M.yellow));
  const pitL = add(g.pitman, M.galv), pitR = add(g.pitman, M.galv);
  root.add(pitL); root.add(pitR);
  // bridle cable from horsehead to polished rod
  const cableGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6); cableGeo.translate(0, -0.5, 0);
  const cable = add(cableGeo, M.black); root.add(cable);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function update(t, phase = 0, speed = 0.7) {
    const th = t * speed * Math.PI * 2 * 0.25 + phase; // ~10 strokes per minute
    crankPivot.rotation.z = -th;
    // crank pin in root space
    const pin = new THREE.Vector3(PJ.crankX + Math.sin(th) * 0.0, PJ.crankY + Math.cos(-th) * PJ.crankR * 0.0, 0);
    const cx = PJ.crankX + PJ.crankR * Math.sin(-th + Math.PI / 2) * 0, cy = 0;
    // simple kinematics: beam angle follows the crank vertical displacement
    const pinX = PJ.crankX + PJ.crankR * Math.cos(th + Math.PI / 2);
    const pinY = PJ.crankY + PJ.crankR * Math.sin(th + Math.PI / 2);
    const back = PJ.beamBack - 0.3;
    // solve beam angle so that the pitman length stays constant
    const pivot = beamPivot.position;
    const Lp = Math.hypot(-back - PJ.crankX, pivot.y - PJ.crankY) ; // nominal pitman length
    let ang = 0;
    for (let i = 0; i < 6; i++) {
      const ex = pivot.x - Math.cos(ang) * back, ey = pivot.y - Math.sin(ang) * back;
      const dx = ex - pinX, dy = ey - pinY;
      const len = Math.hypot(dx, dy);
      ang += (Lp - len) * 0.25 * Math.sign(dy || 1);
    }
    ang = Math.max(-0.42, Math.min(0.42, ang));
    beamPivot.rotation.z = ang;
    const ex = pivot.x - Math.cos(ang) * back, ey = pivot.y - Math.sin(ang) * back;
    for (const [pit, z] of [[pitL, 0.8], [pitR, -0.8]]) {
      tmpA.set(pinX, pinY, z); tmpB.set(ex, ey, z * 0.5);
      const d = tmpB.clone().sub(tmpA); const len = d.length();
      pit.position.copy(tmpA);
      pit.scale.set(1, len, 1);
      pit.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
    // cable hangs from the horsehead arc tip down to the wellhead
    const Rf = PJ.beamFront + 0.95;
    const tipY = pivot.y + Rf * Math.sin(ang) - 0.1;
    cable.position.set(pivot.x + Rf, tipY, 0);
    cable.scale.set(1, Math.max(0.3, tipY - 1.2), 1);
  }
  update(0);
  return { group: root, update };
}

// ---------------------------------------------------------------- tanks & vessels
export function tankBattery(n = 8, { r = 2.35, h = 7.3, color = 'olive' } = {}) {
  mats();
  const root = new THREE.Group();
  const shells = [], walk = [], rails = [];
  const cols = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const x = (i % cols) * (r * 2 + 0.6), z = Math.floor(i / cols) * (r * 2 + 1.4);
    shells.push(cyl(r, h, x, h / 2, z, 32), cyl(r * 0.98, 0.3, x, h + 0.15, z, 32, r * 0.2));
    rails.push(cyl(0.05, 0.9, x + r * 0.7, h + 0.75, z + r * 0.5, 6));
  }
  const W = cols * (r * 2 + 0.6);
  walk.push(box(W, 0.12, 1.2, W / 2 - r - 0.3, h + 0.35, r + 0.7));
  for (let i = 0; i <= 10; i++) rails.push(box(0.05, 1.1, 0.05, -r + i * W / 10, h + 0.9, r + 0.1), box(0.05, 1.1, 0.05, -r + i * W / 10, h + 0.9, r + 1.3));
  rails.push(box(W, 0.05, 0.05, W / 2 - r - 0.3, h + 1.45, r + 0.1), box(W, 0.05, 0.05, W / 2 - r - 0.3, h + 1.45, r + 1.3));
  // stair
  for (let i = 0; i < 18; i++) walk.push(box(1.0, 0.06, 0.4, -r - 1.2 + i * 0.0, 0.4 + i * 0.4, r + 0.7 + 0 * i));
  walk.push(strut(new THREE.Vector3(-r - 1.7, 0, r + 0.7), new THREE.Vector3(-r - 0.7, h + 0.35, r + 0.7), 0.1));
  root.add(meshOf(shells, M[color]));
  root.add(meshOf(walk, M.galv));
  root.add(meshOf(rails, M.galv));
  return root;
}

export function hVessel(len = 9, r = 1.1, color = 'olive') {
  mats();
  const shell = cylX(r, len, 0, r + 1.0, 0, 28);
  const capA = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); capA.scale(0.5, 1, 1); capA.rotateZ(-Math.PI / 2); capA.translate(len / 2, r + 1.0, 0);
  const capB = capA.clone(); capB.rotateY(Math.PI);
  const saddles = [box(0.5, 1.1, r * 1.6, -len * 0.3, 0.55, 0), box(0.5, 1.1, r * 1.6, len * 0.3, 0.55, 0)];
  const nozzles = [cyl(0.18, 0.9, -len * 0.25, r * 2 + 1.3, 0), cyl(0.22, 0.7, len * 0.1, r * 2 + 1.2, 0), cyl(0.12, 0.8, len * 0.35, r * 2 + 1.25, 0)];
  const root = new THREE.Group();
  root.add(meshOf([shell, capA, capB, ...nozzles], M[color]));
  root.add(meshOf(saddles, M.darkSteel));
  root.add(meshOf([box(len + 1, 0.3, r * 2 + 0.6, 0, 0.15, 0)], M.darkSteel));
  return root;
}

export function vVessel(r = 0.8, h = 6, color = 'white') {
  mats();
  const g = [cyl(r, h, 0, h / 2 + 0.6, 0, 24)];
  const top = new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); top.scale(1, 0.5, 1); top.translate(0, h + 0.6, 0); g.push(top);
  const legs = [];
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; legs.push(box(0.15, 0.9, 0.15, Math.cos(a) * r * 0.8, 0.45, Math.sin(a) * r * 0.8)); }
  const root = new THREE.Group();
  root.add(meshOf(g, M[color])); root.add(meshOf(legs, M.darkSteel));
  return root;
}

// ---------------------------------------------------------------- flare stack
export function flareStack(h = 22) {
  mats();
  const g = [cyl(0.32, h, 0, h / 2, 0, 16), cyl(0.5, 1.4, 0, h + 0.3, 0, 16, 0.42), cyl(0.9, 0.3, 0, 0.15, 0, 16)];
  const guys = [];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.4;
    guys.push(strut(new THREE.Vector3(0, h * 0.72, 0), new THREE.Vector3(Math.cos(a) * h * 0.55, 0, Math.sin(a) * h * 0.55), 0.03));
  }
  const drum = [cylX(1.0, 5, -3.4, 1.2, 0, 20), box(5, 0.3, 1.6, -3.4, 0.15, 0)];
  const root = new THREE.Group();
  root.add(meshOf(g, M.darkSteel));
  root.add(meshOf(guys, M.galv, false));
  root.add(meshOf(drum, M.rust));
  root.userData.tip = new THREE.Vector3(0, h + 1.0, 0);
  return root;
}

// ---------------------------------------------------------------- power distribution
export function poleGeo() {
  // wooden pole with crossarm and three insulators
  const g = [cyl(0.14, 12, 0, 6, 0, 8, 0.17), box(2.6, 0.14, 0.14, 0, 11.2, 0)];
  const ins = [cyl(0.06, 0.35, -1.1, 11.45, 0, 8), cyl(0.06, 0.35, 0, 11.45, 0, 8), cyl(0.06, 0.35, 1.1, 11.45, 0, 8)];
  return { wood: mergeGeometries(g), ins: mergeGeometries(ins) };
}

// Catenary wires through consecutive pole tops (world space). Returns LineSegments-like thin tubes.
export function wires(tops, sag = 1.4, offsets = [-1.1, 0, 1.1], color = 0x1a1a1a) {
  const pts = [];
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i], b = tops[i + 1];
    const dir = new THREE.Vector3().subVectors(b, a); dir.y = 0; dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const o of offsets) {
      const A = a.clone().addScaledVector(side, o), B = b.clone().addScaledVector(side, o);
      const N = 10;
      for (let k = 0; k < N; k++) {
        const t0 = k / N, t1 = (k + 1) / N;
        const p0 = A.clone().lerp(B, t0); p0.y -= sag * 4 * t0 * (1 - t0);
        const p1 = A.clone().lerp(B, t1); p1.y -= sag * 4 * t1 * (1 - t1);
        pts.push(p0, p1);
      }
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  return new THREE.LineSegments(geo, mat);
}

// ---------------------------------------------------------------- NovaLT16 power-generation package
// Dimensions from the Baker Hughes datasheet: 15.62 m x 3.15 m footprint, 9.52 m tall, 134 t.
export function novaltPackage({ stack = true } = {}) {
  mats();
  const L = 15.62, W = 3.15;
  const root = new THREE.Group();
  const skid = [box(L, 0.55, W, 0, 0.275, 0), box(L + 0.4, 0.2, W + 0.3, 0, 0.1, 0)];
  // GT enclosure (x from -L/2 to ~2.2) and generator enclosure (to +L/2)
  const gtLen = 9.4, genLen = L - gtLen;
  const encl = [box(gtLen, 3.9, W - 0.1, -L / 2 + gtLen / 2, 0.55 + 1.95, 0)];
  const gen = [box(genLen - 0.6, 3.1, W - 0.35, L / 2 - genLen / 2 + 0.2, 0.55 + 1.55, 0)];
  // vertical panel seams
  const seams = [];
  for (let i = 1; i < 12; i++) {
    const x = -L / 2 + i * (gtLen / 12);
    seams.push(box(0.05, 3.8, W + 0.02, x, 2.5, 0));
  }
  for (let i = 1; i < 5; i++) seams.push(box(0.05, 3.0, W - 0.3, L / 2 - genLen + i * (genLen / 5), 2.1, 0));
  // upper deck: filter house over the inlet end, ventilation fan, ducts
  const fh = [box(4.2, 3.2, W + 0.9, -L / 2 + 2.3, 4.45 + 1.6 + 0.3, 0), box(4.2, 0.25, W + 1.3, -L / 2 + 2.3, 4.45 + 3.3 + 0.3, 0)];
  const hoods = [];
  for (let i = 0; i < 4; i++) hoods.push(box(0.9, 0.7, 0.35, -L / 2 + 0.75 + i * 1.05, 4.45 + 1.0 + i * 0.0 + 0.3, W / 2 + 0.6), box(0.9, 0.7, 0.35, -L / 2 + 0.75 + i * 1.05, 4.45 + 2.0 + 0.3, W / 2 + 0.6), box(0.9, 0.7, 0.35, -L / 2 + 0.75 + i * 1.05, 4.45 + 1.0 + 0.3, -W / 2 - 0.6), box(0.9, 0.7, 0.35, -L / 2 + 0.75 + i * 1.05, 4.45 + 2.0 + 0.3, -W / 2 - 0.6));
  const duct = [box(1.6, 1.1, 1.6, -L / 2 + 2.3, 4.45 + 0.1, 0), box(2.0, 1.2, 2.0, -0.6, 4.45 + 0.1, 0), cyl(0.55, 1.2, 1.2, 5.0, 0, 16)];
  const deck = [box(gtLen - 4.4, 0.12, W + 0.6, -L / 2 + 4.4 + (gtLen - 4.4) / 2, 4.5, 0)];
  const rails = [];
  for (let i = 0; i <= 8; i++) { const x = -L / 2 + 4.4 + i * (gtLen - 4.4) / 8; rails.push(box(0.05, 1.1, 0.05, x, 5.05, W / 2 + 0.28), box(0.05, 1.1, 0.05, x, 5.05, -W / 2 - 0.28)); }
  rails.push(box(gtLen - 4.4, 0.05, 0.05, -L / 2 + 4.4 + (gtLen - 4.4) / 2, 5.6, W / 2 + 0.28), box(gtLen - 4.4, 0.05, 0.05, -L / 2 + 4.4 + (gtLen - 4.4) / 2, 5.6, -W / 2 - 0.28));
  // stairs to deck
  const stair = [];
  for (let i = 0; i < 11; i++) stair.push(box(0.35, 0.05, 1.0, -L / 2 + 6.0 + i * 0.32, 0.6 + i * 0.36, W / 2 + 0.85));
  stair.push(strut(new THREE.Vector3(-L / 2 + 5.8, 0.4, W / 2 + 1.35), new THREE.Vector3(-L / 2 + 9.5, 4.5, W / 2 + 1.35), 0.07));
  // exhaust: collector box at the GT/gen interface, rising duct and silenced stack
  const exh = stack ? [box(2.4, 2.2, 2.6, -L / 2 + gtLen - 1.6, 5.4, 0), cyl(0.95, 7.0, -L / 2 + gtLen - 1.6, 9.8, 0, 24), cyl(1.1, 0.6, -L / 2 + gtLen - 1.6, 13.4, 0, 24)] : [];
  // lube oil cooler & fin-fan off the generator end
  const cooler = [box(2.6, 1.5, 2.2, L / 2 - 1.4, 4.2, 0)];
  const doors = [box(1.2, 2.4, 0.06, -2.6, 1.85, W / 2), box(1.2, 2.4, 0.06, 0.2, 1.85, W / 2), box(1.0, 2.2, 0.06, L / 2 - 3.1, 1.75, W / 2 - 0.1)];
  root.add(meshOf(skid, M.darkSteel));
  root.add(meshOf(encl, M.panel));
  root.add(meshOf(gen, M.panel));
  root.add(meshOf(seams, M.panelDark, false));
  root.add(meshOf([...fh, ...hoods], M.panelDark));
  root.add(meshOf(duct, M.galv));
  root.add(meshOf(deck, M.galv));
  root.add(meshOf([...rails, ...stair], M.yellow));
  if (exh.length) root.add(meshOf(exh, M.galv));
  root.add(meshOf(cooler, M.darkSteel));
  root.add(meshOf(doors, M.panelDark, false));
  // green accent band along the enclosure
  root.add(meshOf([box(gtLen, 0.28, W + 0.02, -L / 2 + gtLen / 2, 3.6, 0)], M.green, false));
  // small status lamps
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.lampGreen); lamp.position.set(-L / 2 + 0.3, 4.1, W / 2 + 0.05); root.add(lamp);
  const lamp2 = lamp.clone(); lamp2.position.set(L / 2 - 0.3, 3.4, W / 2 + 0.05); root.add(lamp2);
  root.userData.stackTop = new THREE.Vector3(-L / 2 + gtLen - 1.6, 13.8, 0);
  root.userData.length = L;
  return root;
}

// ---------------------------------------------------------------- electrical house, transformer, conditioning skid
export function ehouse(len = 12, w = 3.6, h = 3.4) {
  mats();
  const root = new THREE.Group();
  root.add(meshOf([box(len, h, w, 0, h / 2 + 0.5, 0), box(len + 0.3, 0.5, w + 0.3, 0, 0.25, 0)], M.white));
  const vents = []; for (let i = 0; i < 6; i++) vents.push(box(0.8, 0.5, 0.06, -len / 2 + 1.2 + i * 1.9, h - 0.4, w / 2 + 0.02));
  root.add(meshOf(vents, M.panelDark, false));
  root.add(meshOf([box(1.0, 2.2, 0.06, -len / 2 + 1.0, 1.6, w / 2 + 0.03), box(1.0, 2.2, 0.06, len / 2 - 1.0, 1.6, w / 2 + 0.03)], M.darkSteel, false));
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.12), M.lamp); lamp.position.set(-len / 2 + 1.0, 3.0, w / 2 + 0.12); root.add(lamp);
  return root;
}

export function transformer() {
  mats();
  const g = [box(3.2, 2.8, 2.2, 0, 1.8, 0)];
  const fins = []; for (let i = 0; i < 9; i++) fins.push(box(0.06, 2.2, 1.0, -1.4 + i * 0.35, 1.7, 1.7), box(0.06, 2.2, 1.0, -1.4 + i * 0.35, 1.7, -1.7));
  const bush = [cyl(0.12, 1.1, -0.9, 3.7, 0, 10), cyl(0.12, 1.1, 0, 3.7, 0, 10), cyl(0.12, 1.1, 0.9, 3.7, 0, 10)];
  const root = new THREE.Group();
  root.add(meshOf([...g, ...fins], M.panelDark));
  root.add(meshOf(bush, M.white));
  root.add(meshOf([box(4.2, 0.4, 4.4, 0, 0.2, 0)], M.concrete));
  return root;
}

export function condSkid() {
  // fuel-gas conditioning: filter/coalescers, a heater and a knockout drum on a skid
  const root = new THREE.Group();
  root.add(meshOf([box(14, 0.4, 5, 0, 0.2, 0)], (mats(), M.darkSteel)));
  for (let i = 0; i < 3; i++) { const v = vVessel(0.55, 4.5, 'white'); v.position.set(-5 + i * 1.8, 0.4, -1.2); root.add(v); }
  const h = hVessel(6, 0.9, 'white'); h.position.set(2.5, 0.4, 0.8); root.add(h);
  const pipes = [cylX(0.14, 12, 0, 1.4, 1.9), cylX(0.14, 12, 0, 1.9, -2.2), cyl(0.14, 3.0, 5.8, 1.0, 1.9)];
  root.add(meshOf(pipes, M.yellow));
  return root;
}

export function pickup(color = 0xf2f2f2) {
  mats();
  const body = stdMat({ color, metalness: 0.5, roughness: 0.35 });
  const g = [box(5.6, 0.9, 2.0, 0, 0.95, 0), box(2.6, 0.9, 1.9, 0.5, 1.8, 0)];
  const wheels = [];
  for (const [x, z] of [[-1.8, 0.95], [-1.8, -0.95], [1.7, 0.95], [1.7, -0.95]]) wheels.push(cylZ(0.42, 0.3, x, 0.42, z, 14));
  const root = new THREE.Group();
  root.add(meshOf(g, body)); root.add(meshOf(wheels, M.black));
  root.add(meshOf([box(0.1, 0.7, 1.7, 1.82, 1.8, 0), box(2.3, 0.65, 0.05, 0.5, 1.85, 0.96), box(2.3, 0.65, 0.05, 0.5, 1.85, -0.96)], M.black, false));
  return root;
}

export function fracPump() {
  // electric frac pump trailer
  mats();
  const root = new THREE.Group();
  root.add(meshOf([box(13, 0.5, 2.6, 0, 1.2, 0)], M.darkSteel));
  root.add(meshOf([box(4.2, 2.6, 2.4, -2.5, 2.75, 0)], M.white));
  root.add(meshOf([box(3.0, 1.8, 2.2, 2.4, 2.35, 0), cylX(0.45, 2.5, 5.0, 1.9, 0)], M.teal));
  const w = []; for (const x of [-4.5, -3.3, 4.8]) for (const z of [1.1, -1.1]) w.push(cylZ(0.5, 0.35, x, 0.5, z, 14));
  root.add(meshOf(w, M.black));
  return root;
}

export function lightTower() {
  mats();
  const root = new THREE.Group();
  root.add(meshOf([box(2.2, 1.1, 1.4, 0, 0.8, 0), cyl(0.08, 8, 0, 5, 0, 8)], M.yellow));
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.2), M.lamp); panel.position.set(0, 9.1, 0.1); root.add(panel);
  root.userData.lamp = new THREE.Vector3(0, 9.1, 0.3);
  return root;
}

// ---------------------------------------------------------------- merged package (for large instanced fleets)
// Collapses a package group into one geometry per material so dozens of units cost ~10 draw calls.
export function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const keep = {};
    for (const k of ['position', 'normal']) keep[k] = g.attributes[k];
    const clean = new THREE.BufferGeometry();
    clean.setAttribute('position', keep.position); if (keep.normal) clean.setAttribute('normal', keep.normal);
    if (g.index) clean.setIndex(g.index);
    const list = buckets.get(o.material) || [];
    list.push(clean.index ? clean.toNonIndexed() : clean);
    buckets.set(o.material, list);
  });
  const out = [];
  for (const [mat, list] of buckets) out.push({ material: mat, geometry: mergeGeometries(list, false) });
  return out;
}

export function packageFleet(transforms, { stack = true } = {}) {
  const proto = novaltPackage({ stack });
  const parts = mergeByMaterial(proto);
  const root = new THREE.Group();
  const d = new THREE.Object3D();
  for (const { material, geometry } of parts) {
    const im = new THREE.InstancedMesh(geometry, material, transforms.length);
    transforms.forEach((t, i) => { d.position.set(t.x, t.y ?? 0, t.z); d.rotation.set(0, t.ry ?? 0, 0); d.scale.setScalar(1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    root.add(im);
  }
  return root;
}

// ---------------------------------------------------------------- mechanical-drive package (pipeline compression)
// NovaLT16 driving a centrifugal pipeline compressor directly (no gearbox); filter house raised on a steel frame.
export function novaltMechPackage() {
  mats();
  const root = new THREE.Group();
  const L = 12.5, W = 3.15;
  root.add(meshOf([box(L + 5.2, 0.5, W, 2.3, 0.25, 0)], M.darkSteel));
  root.add(meshOf([box(L, 3.6, W - 0.1, 0, 0.5 + 1.8, 0)], M.panel));
  const seams = []; for (let i = 1; i < 14; i++) seams.push(box(0.05, 3.5, W + 0.02, -L / 2 + i * L / 14, 2.3, 0));
  root.add(meshOf(seams, M.panelDark, false));
  // raised filter house on a frame (per the mechanical-drive package drawing)
  const frame = [];
  for (const [x, z] of [[-6.0, -1.6], [-6.0, 1.6], [-2.2, -1.6], [-2.2, 1.6]]) frame.push(box(0.25, 4.6, 0.25, x, 2.3 + 2.4, z));
  frame.push(box(4.3, 0.2, 3.6, -4.1, 7.1, 0));
  root.add(meshOf(frame, M.darkSteel));
  root.add(meshOf([box(4.2, 3.0, 3.9, -4.1, 8.7, 0)], M.panelDark));
  root.add(meshOf([box(1.3, 3.0, 1.3, -4.1, 5.6, 0)], M.galv));
  root.add(meshOf([box(4.4, 0.08, 3.9, -4.1, 7.25, 0)], M.yellow, false));
  // exhaust duct and stack
  root.add(meshOf([box(2.2, 1.8, 2.2, 3.6, 5.1, 0), cyl(0.95, 6.5, 3.6, 9.2, 0, 24)], M.galv));
  // centrifugal barrel compressor with suction/discharge nozzles going down into the yard
  const comp = [cylX(1.25, 3.4, L / 2 + 2.5, 2.2, 0, 32), cyl(0.55, 2.4, L / 2 + 1.7, 0.9, 0, 20), cyl(0.5, 2.4, L / 2 + 3.3, 0.9, 0, 20)];
  root.add(meshOf(comp, M.teal));
  root.add(meshOf([cyl(0.62, 0.3, L / 2 + 1.7, 0.2, 0, 20), cyl(0.58, 0.3, L / 2 + 3.3, 0.2, 0, 20)], M.darkSteel));
  root.add(meshOf([box(L, 0.28, W + 0.02, 0, 3.75, 0)], M.green, false));
  root.userData.stackTop = new THREE.Vector3(3.6, 12.6, 0);
  return root;
}
