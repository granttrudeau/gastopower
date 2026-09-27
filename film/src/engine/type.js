// Cinematic typography for the Canvas2D overlay (full 1920x1080 frame, display-space colours).
import { clamp, smooth, ease, range } from './util.js';

export const C = {
  white: '#F4EFE7',
  dim: 'rgba(244,239,231,0.62)',
  green: '#02BC94',
  teal: '#018374',
  mint: '#8FE8CF',
  ember: '#FF9A4D',
  ink: '#2A1D12',
  paper: '#EFE4CF',
};

export const F = {
  sans: (w, px) => `${w} ${px}px Inter`,
  mono: (w, px) => `${w} ${px}px "IBM Plex Mono"`,
  serif: (w, px, it = false) => `${it ? 'italic ' : ''}${w} ${px}px "Cormorant Garamond"`,
  num: (w, px) => `${w} ${px}px "Big Shoulders Display"`,
};

export async function loadFonts() {
  const faces = [
    ['Inter', 'fonts/Inter-normal-100_900.woff2', { weight: '100 900' }],
    ['IBM Plex Mono', 'fonts/IBMPlexMono-normal-300.woff2', { weight: '300' }],
    ['IBM Plex Mono', 'fonts/IBMPlexMono-normal-400.woff2', { weight: '400' }],
    ['IBM Plex Mono', 'fonts/IBMPlexMono-normal-500.woff2', { weight: '500' }],
    ['Cormorant Garamond', 'fonts/CormorantGaramond-normal-400.woff2', { weight: '400' }],
    ['Cormorant Garamond', 'fonts/CormorantGaramond-normal-500.woff2', { weight: '500' }],
    ['Cormorant Garamond', 'fonts/CormorantGaramond-italic-400.woff2', { weight: '400', style: 'italic' }],
    ['Cormorant Garamond', 'fonts/CormorantGaramond-italic-500.woff2', { weight: '500', style: 'italic' }],
    ['Big Shoulders Display', 'fonts/BigShouldersDisplay-normal-100_900.woff2', { weight: '100 900' }],
  ];
  await Promise.all(faces.map(async ([fam, url, desc]) => {
    const f = new FontFace(fam, `url(${url})`, desc);
    await f.load();
    document.fonts.add(f);
  }));
}

// Draw text with tracking; returns width. Optional per-character reveal (0..1) with stagger.
export function tracked(ctx, text, x, y, { font, tracking = 0, color = C.white, alpha = 1, align = 'left', reveal = 1, stagger = 0.5, rise = 0, blur = 0 } = {}) {
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const n = chars.length;
  ctx.fillStyle = color;
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14;
  for (let i = 0; i < n; i++) {
    // each character fades in over its own window
    const w0 = (i / Math.max(1, n)) * stagger;
    const a = reveal >= 1 ? 1 : smooth((reveal - w0) / Math.max(1e-3, 1 - stagger));
    if (a > 0.001) {
      ctx.globalAlpha = alpha * a;
      ctx.fillText(chars[i], cx, y + (1 - a) * rise);
    }
    cx += widths[i];
  }
  ctx.restore();
  return total;
}

export function measure(ctx, text, font, tracking = 0) {
  ctx.save(); ctx.font = font;
  let w = 0; for (const c of text) w += ctx.measureText(c).width + tracking;
  ctx.restore();
  return w - tracking;
}

// Whole-line text with a soft left-to-right wipe.
export function wipeText(ctx, text, x, y, { font, color = C.white, alpha = 1, align = 'left', p = 1, feather = 80, letterSpacing = '0px' } = {}) {
  if (p <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.font = font; ctx.letterSpacing = letterSpacing;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = align;
  const w = ctx.measureText(text).width;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const edge = x0 + (w + feather) * p;
  const g = ctx.createLinearGradient(edge - feather, 0, edge, 0);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p >= 1 ? color : g;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Location slug: a short rule grows, then two lines of tracked caps appear.
export function slug(ctx, lt, { x = 150, y = 880, a = 0, b = 5, line1, line2, color = C.white, accent = C.green, align = 'left' }) {
  const fin = range(lt, a, a + 1.2), fout = 1 - range(lt, b - 0.8, b);
  const alpha = Math.min(1, fout);
  if (fin <= 0 || alpha <= 0) return;
  ctx.save();
  const ruleW = 46 * ease.outCubic(fin);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = accent;
  const rx = align === 'right' ? x - ruleW : x;
  ctx.fillRect(rx, y - 34, ruleW, 2);
  ctx.restore();
  tracked(ctx, line1, x, y, { font: F.sans(500, 21), tracking: 6.5, color, alpha, reveal: range(lt, a + 0.25, a + 1.4), rise: 6, align });
  if (line2) tracked(ctx, line2, x, y + 30, { font: F.mono(400, 15), tracking: 3.5, color: accent, alpha, reveal: range(lt, a + 0.6, a + 1.7), align });
}

// A technical callout: anchor dot, elbow leader line, mono label and big value.
export function callout(ctx, { ax, ay, lx, ly, label, value, unit, p = 1, alpha = 1, color = C.mint, side = 'right', valueSize = 58, sub }) {
  if (p <= 0 || alpha <= 0) return;
  ly = Math.min(Math.max(ly, 138 + 70), 942 - (value ? 110 : 40));
  lx = Math.min(Math.max(lx, 180), 1740);
  // flip to the other side if the label would run off the frame
  {
    ctx.save(); ctx.font = F.mono(500, 14);
    let lw = 0; for (const ch of label.toUpperCase()) lw += ctx.measureText(ch).width + 3.2;
    ctx.restore();
    const need = Math.max(lw, 190) + 20;
    if (side === 'right' && lx + need > 1900) side = 'left';
    else if (side === 'left' && lx - need < 20) side = 'right';
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.25;
  const pl = clamp(p / 0.45);
  // anchor
  const pr = ease.outCubic(clamp(p / 0.2));
  ctx.beginPath(); ctx.arc(ax, ay, 3.2 * pr, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha * (1 - clamp(p / 0.6)) * 0.8;
  ctx.beginPath(); ctx.arc(ax, ay, 4 + 18 * clamp(p / 0.6), 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = alpha;
  // leader: anchor -> elbow (lx, ly) -> horizontal run
  const run = 170;
  const ex = side === 'right' ? lx + run : lx - run;
  const seg1 = Math.hypot(lx - ax, ly - ay), seg2 = run, L = seg1 + seg2;
  const d = L * ease.inOutCubic(pl);
  ctx.beginPath(); ctx.moveTo(ax, ay);
  if (d <= seg1) { const k = d / seg1; ctx.lineTo(ax + (lx - ax) * k, ay + (ly - ay) * k); }
  else { ctx.lineTo(lx, ly); const k = (d - seg1) / seg2; ctx.lineTo(lx + (ex - lx) * k, ly); }
  ctx.stroke();
  ctx.restore();
  const tp = range(p, 0.35, 1);
  const tx = side === 'right' ? lx + 6 : lx - 6;
  const align = side === 'right' ? 'left' : 'right';
  tracked(ctx, label.toUpperCase(), tx, ly - 12, { font: F.mono(500, 14), tracking: 3.2, color, alpha, reveal: tp, align });
  if (value) {
    const vw = tracked(ctx, value, tx, ly + valueSize * 0.95 + 4, { font: F.num(600, valueSize), tracking: 1, color: C.white, alpha: alpha * smooth(range(p, 0.45, 0.9)), align, rise: 10 });
    if (unit) {
      const ux = side === 'right' ? tx + vw + 10 : tx - vw - 10;
      tracked(ctx, unit, ux, ly + valueSize * 0.95 + 4, { font: F.mono(400, 18), tracking: 2, color: C.dim, alpha: alpha * smooth(range(p, 0.55, 1)), align });
    }
  }
  if (sub) tracked(ctx, sub, tx, ly + (value ? valueSize + 34 : 16), { font: F.sans(400, 16), tracking: 0.6, color: C.dim, alpha: alpha * smooth(range(p, 0.6, 1)), align });
}

// Centered film title with a slow tracking-in.
export function title(ctx, text, lt, { x = 960, y = 560, a = 0, b = 4, size = 92, weight = 250, color = C.white, font = 'sans', trackFrom = 42, trackTo = 22 }) {
  const fin = range(lt, a, a + 2.2), fout = 1 - range(lt, b - 1.0, b);
  const alpha = Math.min(smooth(fin), smooth(fout));
  if (alpha <= 0) return;
  const tr = trackFrom + (trackTo - trackFrom) * ease.outCubic(range(lt, a, b));
  const f = font === 'serif' ? F.serif(weight, size) : F.sans(weight, size);
  tracked(ctx, text, x, y, { font: f, tracking: tr, color, alpha, align: 'center', blur: (1 - smooth(fin)) * 6 });
}

// Project a world point to overlay pixels (full 1920x1080 frame, letterbox band aware).
export function toScreen(v, camera, engine) {
  const p = v.clone().project(camera);
  const top = (engine.H - engine.AH) / 2;
  return { x: (p.x * 0.5 + 0.5) * engine.W, y: top + (0.5 - p.y * 0.5) * engine.AH, behind: p.z > 1 };
}
