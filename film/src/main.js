import { Engine } from './engine/engine.js';
import { Timeline } from './engine/timeline.js';
import { loadFonts } from './engine/type.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'preview';
if (mode === 'render') document.body.classList.add('render');
const scale = parseFloat(params.get('scale') || (mode === 'preview' ? '0.5' : '1'));
const only = params.get('only'); // restrict to one shot id while developing

async function boot() {
  await loadFonts();
  const edit = await (await fetch('./edit.json', { cache: 'no-store' })).json();
  const canvas = document.getElementById('film');
  const engine = new Engine(canvas, { fps: edit.fps, aspect: edit.aspect, renderScale: scale, msaa: mode === 'preview' ? 0 : 4 });
  engine.edit = edit;

  const shots = [];
  for (const s of edit.shots) {
    if (only && s.id !== only) continue;
    const mod = await import(`./shots/${s.module}.js`);
    const shot = await mod.create(engine, s, edit);
    Object.assign(shot, { id: s.id, start: s.start, end: s.end, transitionIn: s.transitionIn, cfg: s });
    shots.push(shot);
  }
  const timeline = new Timeline(shots);
  // Each shot draws its typography on its own layer, composited with a transition-aware weight
  // (a dip to black takes the words down with the picture).
  const layer = document.createElement('canvas'); layer.width = engine.W; layer.height = engine.H;
  const lctx = layer.getContext('2d');
  const overlay = (ctx, t) => {
    const r = timeline.at(t, t);
    const list = r.b ? [{ shot: r.a, w: 1 - r.p }, { shot: r.b, w: r.p }] : [{ shot: r.a, w: 1 }];
    for (let i = 0; i < list.length; i++) {
      const { shot } = list[i];
      let { w } = list[i];
      if (!shot.overlay || w <= 0.001) continue;
      if (r.b && (r.type.code === 2)) w = i === 0 ? Math.max(0, 1 - 2 * r.p) : Math.max(0, 2 * r.p - 1);
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.save();
      shot.overlay(lctx, t - shot.start, t, w);
      lctx.restore();
      ctx.save(); ctx.globalAlpha = w; ctx.drawImage(layer, 0, 0); ctx.restore();
    }
  };

  window.FILM = {
    edit, engine, timeline,
    fps: edit.fps,
    duration: timeline.duration,
    frames: Math.round(timeline.duration * edit.fps),
    renderFrame(i, opts = {}) {
      engine.renderFrame(timeline, i, { subframes: opts.subframes ?? 1, shutter: opts.shutter ?? 0.5, overlay });
      if (opts.capture === false) return null;
      return canvas.toDataURL(opts.format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
    },
    renderTime(t, opts = {}) { return this.renderFrame(Math.round(t * edit.fps), opts); },
  };
  document.getElementById('loading').remove();
  window.FILM_READY = true;
  if (mode === 'preview') startPreview(engine, timeline, overlay, edit);
}

function fmt(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

function startPreview(engine, timeline, overlay, edit) {
  const playBtn = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const timeEl = document.getElementById('time');
  const shotEl = document.getElementById('shot');
  const q = document.getElementById('quality');
  q.value = String(scale);
  q.onchange = () => { params.set('scale', q.value); location.search = params.toString(); };
  const audio = new Audio('../audio/mix.wav');
  let hasAudio = false;
  audio.addEventListener('canplaythrough', () => { hasAudio = true; }, { once: true });
  audio.addEventListener('error', () => {
    // mix.wav is not committed to the repository; fall back to the compressed soundtrack
    if (!audio.src.endsWith('mix.m4a')) { audio.src = '../audio/mix.m4a'; audio.load(); } else hasAudio = false;
  });
  let playing = false, t = parseFloat(params.get('t') || '0'), last = performance.now();
  const D = timeline.duration;
  function setTime(nt) { t = Math.max(0, Math.min(D - 1e-3, nt)); if (hasAudio) audio.currentTime = t; }
  playBtn.onclick = () => {
    playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play';
    if (hasAudio) { if (playing) { audio.currentTime = t; audio.play(); } else audio.pause(); }
    last = performance.now();
  };
  scrub.oninput = () => setTime((scrub.value / 1000) * D);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { playBtn.click(); e.preventDefault(); }
    if (e.code === 'ArrowRight') setTime(t + (e.shiftKey ? 5 : 1 / edit.fps));
    if (e.code === 'ArrowLeft') setTime(t - (e.shiftKey ? 5 : 1 / edit.fps));
  });
  function tick(now) {
    if (playing) {
      if (hasAudio && !audio.paused) t = audio.currentTime;
      else t += (now - last) / 1000;
      if (t >= D) { t = 0; if (hasAudio) audio.currentTime = 0; }
    }
    last = now;
    engine.renderFrame(timeline, Math.floor(t * edit.fps), { subframes: 1, overlay });
    scrub.value = String(Math.round((t / D) * 1000));
    timeEl.textContent = `${fmt(t)} / ${fmt(D)}`;
    const cur = timeline.at(t);
    shotEl.textContent = cur.b ? `${cur.a.id} → ${cur.b.id}` : cur.a.id;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'ERROR: ' + e.message;
  window.FILM_ERROR = String(e && e.stack || e);
});
