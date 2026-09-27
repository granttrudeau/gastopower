// S06 — Inside the machine: Air, Fire, Motion, Power.
import * as THREE from 'three';
import { getStudio } from '../turbine/studio.js';
import { setAtmos } from '../engine/atmos.js';
import { ease, range, smooth, lerp, keyed, rampAngle, envelope } from '../engine/util.js';
import { callout, tracked, toScreen, F, C } from '../engine/type.js';
import { X } from '../turbine/novalt.js';

export async function create(engine) {
  const S = getStudio(engine);
  const T = S.T;
  const camera = new THREE.PerspectiveCamera(30, engine.AW / engine.AH, 0.03, 900);
  const cam = keyed(THREE, [
    { t: 0.0, pos: [0.9, 1.75, 4.3], look: [-0.15, -0.05, 0], fov: 33 },
    { t: 1.6, pos: [-1.55, 1.05, 2.25], look: [-1.35, 0.1, 0], fov: 32 },
    { t: 4.6, pos: [-1.0, 0.95, 1.7], look: [-0.95, 0.15, 0], fov: 32 },
    { t: 7.5, pos: [-0.55, 1.35, 2.35], look: [0.0, 0.2, 0.0], fov: 33 },
    { t: 11.5, pos: [0.25, 1.45, 2.45], look: [0.1, 0.18, 0.0], fov: 33 },
    { t: 16.0, pos: [0.9, 1.6, 2.2], look: [0.35, 0.15, 0.0], fov: 33 },
    { t: 18.5, pos: [1.5, 1.45, 2.4], look: [1.15, 0.2, 0.0], fov: 32 },
    { t: 21.0, pos: [1.95, 1.5, 2.7], look: [1.4, 0.2, 0.0], fov: 32 },
    { t: 24.0, pos: [3.0, 2.3, 6.2], look: [3.0, 0.2, 0.0], fov: 34 },
    { t: 27.5, pos: [4.2, 2.9, 9.4], look: [3.6, 0.3, 0.0], fov: 34 },
  ]);
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  const shot = {
    scene: S.scene, camera,
    update(lt) {
      setAtmos({ density: 0 });
      const ignite = range(lt, 5.1, 6.9);
      const fire = smooth(range(lt, 5.0, 5.6));
      T.update(lt, {
        sweep: 10, capReveal: 100,
        ggAngle: rampAngle(lt, 0.25, 1.6, 0.0, 4.0),
        ptAngle: rampAngle(lt, 0.15, 9.0, 16.6, 19.2),
        flame: fire * 0.75, ignite: ignite * 1.25, h2: smooth(range(lt, 12.2, 13.6)) * (1 - smooth(range(lt, 16.2, 17.2))),
        heat: smooth(range(lt, 6.0, 9.0)),
        flow: smooth(range(lt, 0.4, 1.6)), flowSpeed: 0.1 + 0.08 * smooth(range(lt, 16.6, 19.0)),
        flowReveal: lt < 5.2 ? X.combIn + 0.05 : lerp(X.combIn + 0.05, 3.0, smooth(range(lt, 5.2, 8.0))),
        ghost: 1, outline: 0.85, res: [engine.rw, engine.rh],
      });
      S.draw.mesh.visible = false; S.gridU.uA.value = 0;
      T.plenum.visible = lt > 20.5; T.drive.visible = lt > 20.0;
      T.flow.visible = true; T.flames.visible = true;
      S.power.mesh.visible = lt > 22.0;
      S.power.set({ progress: lt - 22.2, time: lt, res: [engine.rw, engine.rh], intensity: 1 });
      S.bgU.uAmt.value = 1;
      const fov = cam(lt, pos, look);
      camera.position.copy(pos); camera.lookAt(look);
      camera.fov = fov; camera.updateProjectionMatrix();
    },
    post(lt) {
      return { exposure: 1.05, bloom: 0.055, vignette: 0.55, grain: 0.035, ca: 0.5, sat: 1.02, contrast: 1.08, shadowTint: [0.94, 1.0, 1.04], highTint: [1.04, 1.0, 0.96], streak: 0.05, streakThreshold: 3.0 };
    },
    overlay(ctx, lt) {
      const P = (v) => toScreen(v, camera, engine);
      const beat = (label, a, b, x = 150) => {
        const al = envelope(lt, a, b, 0.5, 0.6);
        if (al > 0) tracked(ctx, label, x, 250, { font: F.sans(200, 64), tracking: 18, color: C.white, alpha: al * 0.92, reveal: range(lt, a, a + 1.0), rise: 8 });
      };
      beat('AIR', 0.8, 4.6); beat('FIRE', 4.6, 11.6); beat('MOTION', 17.1, 21.0); beat('POWER', 21.0, 27.0);
      // AIR
      { const a = P(new THREE.Vector3(-1.05, 0.44, 0.02)); callout(ctx, { ax: a.x, ay: a.y, lx: a.x + 150, ly: a.y - 150, label: 'Axial compressor  ·  12 stages', value: '19:1', unit: 'PRESSURE RATIO', p: range(lt, 1.3, 2.8), alpha: envelope(lt, 1.3, 4.6, 0.01, 0.5) }); }
      { const a = P(new THREE.Vector3(X.cIn + 0.02, 0.45, 0.0)); callout(ctx, { ax: a.x, ay: a.y, lx: a.x - 60, ly: a.y + 190, label: 'Variable IGV + 2 stator rows', side: 'left', p: range(lt, 2.4, 3.6), alpha: envelope(lt, 2.4, 4.6, 0.01, 0.5) }); }
      // FIRE
      { const a = P(new THREE.Vector3(-0.12, 0.6, 0.02)); callout(ctx, { ax: a.x, ay: a.y, lx: a.x + 130, ly: a.y - 160, label: 'Single annular DLN combustor', value: '39', unit: 'PREMIXERS', p: range(lt, 6.0, 7.6), alpha: envelope(lt, 6.0, 11.6, 0.01, 0.5) }); }
      { const a = P(new THREE.Vector3(0.25, 0.46, 0.18)); callout(ctx, { ax: a.x, ay: a.y, lx: a.x + 160, ly: a.y + 120, label: 'NOx at 15% O2, 50–100% load', value: '<15', unit: 'ppm', sub: '9 ppm available', p: range(lt, 8.5, 10.0), alpha: envelope(lt, 8.5, 11.6, 0.01, 0.5) }); }
      // HYDROGEN
      { const a = P(new THREE.Vector3(-0.05, 0.5, 0.1)); callout(ctx, { ax: a.x, ay: a.y, lx: a.x + 170, ly: a.y - 150, label: 'Combustor tested on up to', value: '100%', unit: 'H₂', sub: 'hydrogen by volume', color: '#9FC4FF', p: range(lt, 12.4, 14.0), alpha: envelope(lt, 12.4, 16.6, 0.01, 0.5) }); }
      // MOTION
      { const a = P(new THREE.Vector3(1.35, 0.72, 0.02)); callout(ctx, { ax: a.x, ay: a.y, lx: a.x + 140, ly: a.y - 160, label: 'Free power turbine', value: '7,800', unit: 'RPM', p: range(lt, 17.6, 19.0), alpha: envelope(lt, 17.6, 21.0, 0.01, 0.5) }); }
      { const a = P(new THREE.Vector3(1.09, 0.64, 0.02)); callout(ctx, { ax: a.x, ay: a.y, lx: a.x - 100, ly: a.y + 170, side: 'left', label: 'Variable nozzle guide vanes', sub: 'efficient at part load, no bleed', p: range(lt, 18.6, 19.8), alpha: envelope(lt, 18.6, 21.0, 0.01, 0.5) }); }
      // POWER
      const pa = envelope(lt, 22.6, 27.2, 0.8, 0.5);
      if (pa > 0) {
        const bx = 154, by = 700;
        const w1 = tracked(ctx, '16.9', bx, by, { font: F.num(600, 120), tracking: 2, color: C.white, alpha: pa, reveal: range(lt, 22.6, 23.8), rise: 14 });
        tracked(ctx, 'MWe', bx + w1 + 16, by, { font: F.mono(400, 22), tracking: 3, color: C.green, alpha: pa });
        tracked(ctx, '36.4% EFFICIENCY  ·  ISO, NATURAL GAS', bx + 4, by + 40, { font: F.mono(400, 14), tracking: 2.6, color: C.dim, alpha: pa });
        tracked(ctx, '35,000', bx + 4, by + 120, { font: F.num(500, 54), tracking: 1.5, color: C.white, alpha: pa * smooth(range(lt, 23.8, 24.8)) });
        tracked(ctx, 'HOURS BETWEEN MAINTENANCE', bx + 4, by + 150, { font: F.mono(400, 14), tracking: 2.6, color: C.dim, alpha: pa * smooth(range(lt, 24.0, 25.0)) });
      }
    },
  };
  return shot;
}
