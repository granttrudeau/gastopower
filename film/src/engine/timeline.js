import { clamp } from './util.js';

const CODES = { cut: 0, crossfade: 1, dip: 2, flash: 3, burn: 4, luma: 5, invert: 6 };

// A shot list with transitions centred on each shot's start time.
export class Timeline {
  constructor(shots) {
    this.shots = shots.slice().sort((x, y) => x.start - y.start);
    for (const s of this.shots) {
      const tr = s.transitionIn || { type: 'cut', dur: 0 };
      s._tr = { ...tr, code: CODES[tr.type] ?? 0 };
    }
    this.duration = Math.max(...this.shots.map((s) => s.end));
  }

  indexAt(t) {
    let idx = 0;
    for (let i = 0; i < this.shots.length; i++) if (t >= this.shots[i].start) idx = i;
    return idx;
  }

  // t: (sub)frame time used for transitions; tf: the frame's centre time, used for hard cuts
  // so motion-blur subframes never straddle a cut.
  at(t, tf = t) {
    t = clamp(t, 0, this.duration - 1e-6);
    tf = clamp(tf, 0, this.duration - 1e-6);
    const i = this.indexAt(tf);
    const cur = this.shots[i];
    // Are we in the second half of the transition into `cur`?
    const trIn = cur._tr;
    if (i > 0 && trIn.dur > 0 && t < cur.start + trIn.dur / 2) {
      const p = (t - (cur.start - trIn.dur / 2)) / trIn.dur;
      return { a: this.shots[i - 1], b: cur, p: clamp(p), type: trIn };
    }
    // Or the first half of the transition into the next shot?
    const next = this.shots[i + 1];
    if (next && next._tr.dur > 0 && t >= next.start - next._tr.dur / 2) {
      const p = (t - (next.start - next._tr.dur / 2)) / next._tr.dur;
      return { a: cur, b: next, p: clamp(p), type: next._tr };
    }
    return { a: cur, b: null, p: 0, type: null };
  }

  // Shots whose overlays should draw at time t, with a visibility weight.
  visible(t) {
    const r = this.at(t);
    if (!r.b) return [{ shot: r.a, w: 1 }];
    return [{ shot: r.a, w: 1 - r.p }, { shot: r.b, w: r.p }];
  }
}
