"""Small offline synthesis toolkit (numpy + scipy). Everything is deterministic."""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(1842)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def note_hz(n):
    """MIDI note number -> Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def m(name):
    """'D3' -> midi. Accepts sharps; 'Bb3' flats."""
    name = name.replace("Bb", "A#").replace("Eb", "D#").replace("Ab", "G#").replace("Db", "C#").replace("Gb", "F#")
    pitch, octv = name[:-1], int(name[-1])
    return 12 * (octv + 1) + NOTE[pitch]


# ------------------------------------------------------------------ oscillators
def polyblep(tp, dt):
    y = np.zeros_like(tp)
    a = tp < dt
    x = tp[a] / dt[a]
    y[a] = x + x - x * x - 1
    b = tp > 1 - dt
    x = (tp[b] - 1) / dt[b]
    y[b] = x * x + x + x + 1
    return y


def saw(freq, n, phase0=0.0):
    freq = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    dt = freq / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    return (2 * ph - 1) - polyblep(ph, dt)


def sine(freq, n, phase0=0.0):
    freq = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    ph = phase0 + np.cumsum(freq / SR)
    return np.sin(2 * np.pi * ph)


def tri(freq, n):
    s = saw(freq, n)
    return 2 * np.abs(s) - 1


# ------------------------------------------------------------------ envelopes
def adsr(n, a=0.01, d=0.1, s=0.8, r=0.2, sustain_end=None):
    e = np.zeros(n)
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    S_end = n - R if sustain_end is None else int(sustain_end * SR)
    S_end = max(min(S_end, n), 0)
    i = 0
    if A > 0:
        k = min(A, n); e[:k] = np.linspace(0, 1, A, endpoint=False)[:k]; i = k
    if D > 0 and i < n:
        k = min(D, n - i); e[i:i + k] = np.linspace(1, s, D, endpoint=False)[:k]; i += k
    if i < S_end:
        e[i:S_end] = s; i = S_end
    if i < n:
        e[i:] = np.linspace(e[i - 1] if i > 0 else s, 0, n - i)
    return e


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


# ------------------------------------------------------------------ filters
def lp(x, fc, q=0.707):
    b, a = signal.iirfilter(2, min(fc, SR * 0.45), btype="low", ftype="butter", fs=SR) if q == 0.707 else _rbj("lp", fc, q)
    return signal.lfilter(b, a, x)


def hp(x, fc):
    b, a = signal.iirfilter(2, fc, btype="high", ftype="butter", fs=SR)
    return signal.lfilter(b, a, x)


def bp(x, fc, q=2.0):
    b, a = _rbj("bp", fc, q)
    return signal.lfilter(b, a, x)


def _rbj(kind, fc, q, gain_db=0.0):
    w0 = 2 * np.pi * min(fc, SR * 0.45) / SR
    al = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    A = 10 ** (gain_db / 40)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "bp":
        b = [al, 0, -al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "peak":
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind == "lowshelf":
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sq)]
        a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sq]
    elif kind == "highshelf":
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
        a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    b = np.array(b) / a[0]; a = np.array(a) / a[0]
    return b, a


def eq(x, kind, fc, q=0.7, gain_db=0.0):
    b, a = _rbj(kind, fc, q, gain_db)
    return signal.lfilter(b, a, x)


def sweep(x, kind, fc_curve, q=0.8, block=256):
    """Time-varying biquad: fc_curve is an array (Hz) the same length as x (or broadcastable)."""
    fc_curve = np.broadcast_to(fc_curve, x.shape)
    y = np.zeros_like(x)
    zi = np.zeros(2)
    for i in range(0, len(x), block):
        fc = float(np.mean(fc_curve[i:i + block]))
        b, a = _rbj(kind, max(20.0, fc), q)
        y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
    return y


# ------------------------------------------------------------------ noise
def white(n):
    return rng.standard_normal(n)


def pink(n):
    # Voss-McCartney-ish via filtering white noise
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, white(n)) * 3.5


def brown(n):
    y = np.cumsum(white(n)) * 0.02
    return hp(y, 15)


def smooth_noise(n, rate_hz, seed=0):
    """Slowly varying random control signal in [-1, 1]."""
    r = np.random.default_rng(seed)
    k = max(4, int(n / SR * rate_hz) + 4)
    pts = r.uniform(-1, 1, k)
    xs = np.linspace(0, n, k)
    return np.interp(np.arange(n), xs, pts)


# ------------------------------------------------------------------ instruments
def pad(notes, dur, attack=1.5, release=2.0, detune=0.12, cutoff=1400, voices=5, bright=1.0, seed=0):
    """Warm analogue pad: detuned saw stacks through a low-pass. Returns stereo (2, n)."""
    n = int(dur * SR)
    L = np.zeros(n); R = np.zeros(n)
    r = np.random.default_rng(seed)
    for nt in notes:
        f0 = note_hz(nt)
        for v in range(voices):
            cents = (v - (voices - 1) / 2) / max(1, (voices - 1) / 2) * detune * 100 + r.uniform(-3, 3)
            f = f0 * 2 ** (cents / 1200)
            vib = 1 + 0.0025 * np.sin(2 * np.pi * (0.2 + 0.1 * v) * np.arange(n) / SR + r.uniform(0, 6.28))
            s = saw(f * vib, n, r.uniform(0, 1))
            pan = (v / max(1, voices - 1)) if voices > 1 else 0.5
            L += s * np.cos(pan * np.pi / 2); R += s * np.sin(pan * np.pi / 2)
    env = adsr(n, attack, 0.5, 0.85, release)
    L = lp(L, cutoff * bright) * env; R = lp(R, cutoff * bright) * env
    k = 1.0 / (len(notes) * voices) ** 0.5
    return np.vstack([L, R]) * k


def strings(notes, dur, attack=0.8, release=1.6, cutoff=2600, seed=1):
    st = pad(notes, dur, attack=attack, release=release, detune=0.08, cutoff=cutoff, voices=6, seed=seed)
    # bow-like brightness breathing
    n = st.shape[1]
    br = 1 + 0.15 * np.sin(2 * np.pi * 0.25 * np.arange(n) / SR)
    return st * br


def brass_hit(notes, dur=4.0, peak=2600, seed=2):
    """Big low brass 'braam' — filter envelope opens fast then closes."""
    n = int(dur * SR)
    out = np.zeros((2, n))
    r = np.random.default_rng(seed)
    fcurve = 180 + peak * np.exp(-np.arange(n) / (0.35 * SR)) * (1 - np.exp(-np.arange(n) / (0.03 * SR)))
    for nt in notes:
        for v, pan in enumerate([0.2, 0.5, 0.8]):
            f = note_hz(nt) * 2 ** (r.uniform(-8, 8) / 1200)
            s = saw(f, n) * 0.7 + np.sign(saw(f * 0.5, n)) * 0.3
            s = sweep(s, "lp", fcurve, q=1.1)
            out[0] += s * np.cos(pan * np.pi / 2); out[1] += s * np.sin(pan * np.pi / 2)
    env = adsr(n, 0.02, 0.4, 0.55, dur * 0.7)
    return out * env / (len(notes) * 1.7)


def pluck(freq, dur, bright=0.5, decay=0.996, seed=3):
    """Karplus-Strong string (harp / plucked motif)."""
    n = int(dur * SR)
    N = max(2, int(SR / freq))
    r = np.random.default_rng(seed)
    buf = r.uniform(-1, 1, N) * 0.5
    buf = lp(buf, 800 + 6000 * bright)
    out = np.zeros(n)
    # vectorised in chunks of N (each period is the smoothed previous period)
    prev = buf.copy()
    for i in range(0, n, N):
        k = min(N, n - i)
        out[i:i + k] = prev[:k]
        nxt = decay * 0.5 * (prev + np.roll(prev, 1))
        prev = nxt
    env = adsr(n, 0.002, 0.05, 1.0, 0.3)
    return out * env


def bell(freq, dur, index=3.0, ratio=3.5, tau=1.6):
    """FM bell / celesta."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = index * np.exp(-t / (tau * 0.4))
    mod = np.sin(2 * np.pi * freq * ratio * t) * idx
    car = np.sin(2 * np.pi * freq * t + mod)
    return car * np.exp(-t / tau) * (1 - np.exp(-t / 0.002))


def piano(freq, dur, vel=0.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.0004
    for k in range(1, 9):
        fk = freq * k * np.sqrt(1 + B * k * k)
        if fk > SR * 0.45:
            break
        amp = (1 / k ** 1.3) * (0.6 + 0.4 * vel)
        out += amp * np.sin(2 * np.pi * fk * t) * np.exp(-t / (2.8 / (1 + 0.35 * k)))
    hammer = lp(white(n) * np.exp(-t / 0.004), 3000) * 0.05
    return (out + hammer) * (1 - np.exp(-t / 0.003))


def boom(dur=3.0, f0=110, f1=34, tau=0.9, click=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.08)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    ck = hp(white(n) * np.exp(-t / 0.006), 1500) * click
    return body + ck


def taiko(dur=2.0, f=62):
    n = int(dur * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * f * t * (1 + 0.4 * np.exp(-t / 0.05))) * np.exp(-t / 0.45)
    skin = bp(white(n), 180, 1.2) * np.exp(-t / 0.08) * 0.9
    return body + skin


def tick(dur=0.08, fc=6000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return bp(white(n), fc, 3.0) * np.exp(-t / 0.01)


def hammer_clink(freq=620, dur=1.6):
    """Anvil / metallic strike: inharmonic decaying partials."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, amp, tau in [(1.0, 1.0, 0.5), (2.76, 0.6, 0.35), (5.4, 0.4, 0.2), (8.93, 0.25, 0.12), (13.3, 0.15, 0.07)]:
        out += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / tau)
    return out * (1 - np.exp(-t / 0.0008)) + hp(white(n) * np.exp(-t / 0.003), 2000) * 0.3


def riser(dur, f_start=300, f_end=6000, tone=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = (t / dur) ** 2
    fc = f_start * (f_end / f_start) ** k
    nz = sweep(white(n), "bp", fc, q=1.8) * (0.2 + 0.8 * k)
    out = nz
    if tone:
        out = out + sine(fc * 0.25, n) * 0.15 * k
    return out * adsr(n, dur * 0.6, 0.0, 1.0, 0.05)


def whoosh(dur=1.4, f0=400, f1=2400):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = np.sin(np.pi * t / dur) ** 2
    fc = f0 + (f1 - f0) * np.sin(np.pi * t / dur)
    return sweep(pink(n), "bp", fc, q=1.4) * k


def wind(dur, seed=5, base=500, amount=1.0):
    n = int(dur * SR)
    g = smooth_noise(n, 0.35, seed) * 0.5 + 0.6
    fc = base * (1 + 0.6 * smooth_noise(n, 0.25, seed + 1))
    L = sweep(pink(n), "bp", fc, q=0.6) * g
    R = sweep(pink(n), "bp", fc * 1.08, q=0.6) * (smooth_noise(n, 0.35, seed + 2) * 0.5 + 0.6)
    return np.vstack([L, R]) * amount


def fire(dur, roar=1.0, crackle=1.0, seed=7):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    body = lp(brown(n), 260) * 2.5 * (0.8 + 0.2 * smooth_noise(n, 3.0, seed))
    hiss = bp(white(n), 1800, 0.5) * 0.05 * (0.6 + 0.4 * smooth_noise(n, 5.0, seed + 1))
    cr = np.zeros(n)
    k = int(dur * 18 * crackle)
    for _ in range(k):
        i = r.integers(0, n - 2000)
        L = r.integers(200, 1600)
        cr[i:i + L] += r.uniform(0.2, 1.0) * np.exp(-np.arange(L) / (L * 0.2)) * r.standard_normal(L)
    cr = hp(cr, 1200) * 0.35
    mono = body * roar + hiss * roar + cr * crackle
    return np.vstack([mono, np.roll(mono, 173)])


def turbine(dur, f_start, f_end, curve=2.0, blades=12, noise=0.5):
    """Spool-up: shaft tone + blade-pass whine + airflow noise."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = (t / dur) ** (1 / curve)
    f = f_start + (f_end - f_start) * k
    shaft = sine(f, n) * 0.5 + sine(f * 2, n) * 0.25
    bpf = np.minimum(f * blades, 9000)
    whine = sine(bpf, n) * 0.08 + sine(bpf * 1.5, n) * 0.03
    air = sweep(pink(n), "bp", 200 + 2500 * k, q=0.7) * (0.3 + 0.7 * k) * noise
    return (shaft + whine) * (0.4 + 0.6 * k) + air


def hum(dur, f=60.0, amt=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * h * t) / h ** 1.2 for h in (1, 2, 3, 4, 5, 7))
    return s * (0.85 + 0.15 * np.sin(2 * np.pi * 0.3 * t)) * amt


def zap(dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    chirp = np.sin(2 * np.pi * np.cumsum(3000 * np.exp(-t / 0.05) + 200) / SR)
    return (chirp * 0.4 + hp(white(n), 3000) * 0.3) * np.exp(-t / 0.08)


# ------------------------------------------------------------------ space
def hall_ir(dur=3.5, predelay=0.02, damp=0.00012, seed=11):
    """Synthetic stereo hall impulse response: early reflections + exponentially decaying diffuse tail."""
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        tail = r.standard_normal(n) * np.exp(-t * 6.9 / dur)
        # frequency-dependent decay: progressively low-passed tail
        tail = lp(tail, 9000) * 0.6 + lp(tail, 2500) * 0.4
        ir[ch] = tail
        for _ in range(14):
            d = int((predelay + r.uniform(0.005, 0.09)) * SR)
            ir[ch, d] += r.uniform(-0.6, 0.6)
    pd = int(predelay * SR)
    ir[:, :pd] = 0
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir


def convolve_st(x, ir):
    """x: (2, n) stereo, ir: (2, m) -> (2, n)."""
    y0 = signal.fftconvolve(x[0], ir[0])[: x.shape[1]]
    y1 = signal.fftconvolve(x[1], ir[1])[: x.shape[1]]
    return np.vstack([y0, y1])


def pan_mono(x, pan=0.5):
    return np.vstack([x * np.cos(pan * np.pi / 2), x * np.sin(pan * np.pi / 2)])


class Bus:
    """Stereo timeline buffer; place() mixes clips at absolute times."""

    def __init__(self, dur):
        self.n = int(dur * SR)
        self.x = np.zeros((2, self.n))

    def place(self, clip, t, gain=1.0, pan=0.5):
        if clip.ndim == 1:
            clip = pan_mono(clip, pan)
        i = int(t * SR)
        if i >= self.n:
            return
        k = min(clip.shape[1], self.n - i)
        if i < 0:
            clip = clip[:, -i:]; k = min(clip.shape[1], self.n); i = 0
        self.x[:, i:i + k] += clip[:, :k] * gain
