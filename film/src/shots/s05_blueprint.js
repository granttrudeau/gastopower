// S05 — The blueprint. A pen draws the NovaLT16 section; the sections fill; the drawing revolves into metal.
import * as THREE from 'three';
import { getStudio } from '../turbine/studio.js';
import { setAtmos } from '../engine/atmos.js';
import { ease, range, smooth, lerp } from '../engine/util.js';
import { tracked, F, C, title } from '../engine/type.js';

export async function create(engine) {
  const S = getStudio(engine);
  const T = S.T;
  const camera = new THREE.PerspectiveCamera(36, engine.AW / engine.AH, 0.05, 900);
  const A = { pos: new THREE.Vector3(0.05, 0.05, 6.0), look: new THREE.Vector3(0.05, 0.05, 0) };
  const B = { pos: new THREE.Vector3(0.9, 1.75, 4.3), look: new THREE.Vector3(-0.15, -0.05, 0) };
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  const shot = {
    scene: S.scene, camera,
    update(lt) {
      setAtmos({ density: 0 });
      const rev = ease.inOutCubic(range(lt, 4.3, 8.9));
      T.update(lt, {
        sweep: rev * 6.35, capReveal: lerp(-3.4, 9.4, ease.inOutSine(range(lt, 2.4, 4.9))),
        flame: 0, flow: 0, heat: 0, ggRate: 0.05 * rev, ptRate: 0.04 * rev,
        ghost: 1, outline: smooth(range(lt, 4.0, 6.0)) * 0.9, res: [engine.rw, engine.rh],
      });
      S.gridU.uA.value = smooth(range(lt, 0, 0.8)) * (1 - smooth(range(lt, 4.4, 6.2)));
      S.draw.set({ progress: lt - 0.3, time: lt, res: [engine.rw, engine.rh], opacity: 1 - 0.75 * smooth(range(lt, 6.0, 8.8)) });
      S.draw.mesh.visible = true;
      S.power.mesh.visible = false;
      S.bgU.uAmt.value = 0.4 + 0.6 * rev;
      T.plenum.visible = lt > 5.0; T.drive.visible = false; T.flow.visible = false; T.flames.visible = false;
      const k = ease.inOutCubic(range(lt, 4.1, 9.6));
      p.lerpVectors(A.pos, B.pos, k); l.lerpVectors(A.look, B.look, k);
      // slight drift during the drawing phase
      p.x += (1 - k) * (lt * 0.02); p.z -= (1 - k) * lt * 0.05;
      camera.position.copy(p); camera.lookAt(l);
      camera.fov = lerp(36, 33, k); camera.updateProjectionMatrix();
    },
    post(lt) {
      return { exposure: 1.0, bloom: 0.035, vignette: 0.6, grain: 0.035, ca: 0.4, sat: 1.0, contrast: 1.08, shadowTint: [0.95, 1.02, 1.02] };
    },
    overlay(ctx, lt) {
      // title block, as on a real engineering drawing
      const a = smooth(range(lt, 1.2, 2.2)) * (1 - smooth(range(lt, 5.0, 6.0)));
      if (a > 0) {
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(143,232,207,0.6)'; ctx.lineWidth = 1;
        const x = 1330, y = 780, w = 440, h = 118;
        ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y + 40); ctx.lineTo(x + w, y + 40); ctx.moveTo(x + 300, y + 40); ctx.lineTo(x + 300, y + h); ctx.stroke();
        ctx.restore();
        tracked(ctx, 'NOVALT16  ·  GAS TURBINE', 1346, 807, { font: F.mono(500, 15), tracking: 3, color: C.mint, alpha: a });
        tracked(ctx, 'LONGITUDINAL SECTION', 1346, 847, { font: F.mono(400, 13), tracking: 2.5, color: C.dim, alpha: a });
        tracked(ctx, 'FIRENZE  ·  2013', 1346, 875, { font: F.mono(400, 13), tracking: 2.5, color: C.dim, alpha: a });
        tracked(ctx, 'SCALE', 1644, 847, { font: F.mono(400, 12), tracking: 2.5, color: C.dim, alpha: a });
        tracked(ctx, '1 : 25', 1644, 875, { font: F.mono(500, 14), tracking: 2, color: C.mint, alpha: a });
      }
      // the name
      const na = smooth(range(lt, 7.3, 8.3));
      if (na > 0) {
        tracked(ctx, 'NovaLT', 150, 250, { font: F.sans(250, 76), tracking: 4, color: C.white, alpha: na, reveal: range(lt, 7.3, 8.6), rise: 12 });
        const w = 150 + 318;
        tracked(ctx, '16', w + 6, 250, { font: F.sans(600, 76), tracking: 2, color: C.green, alpha: na, reveal: range(lt, 7.6, 8.8), rise: 12 });
        tracked(ctx, 'TM', w - 8, 206, { font: F.mono(400, 12), tracking: 1, color: C.dim, alpha: na * 0.8 });
        tracked(ctx, 'GAS TURBINE  ·  16.9 MWe CLASS', 154, 292, { font: F.mono(400, 15), tracking: 3.5, color: C.mint, alpha: na, reveal: range(lt, 7.9, 9.2) });
      }
    },
  };
  return shot;
}
