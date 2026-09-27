"""The score and sound design for THE SAME FIRE, composed against the edit (film/edit.json).

Writes audio/stems/music.wav and audio/stems/sfx.wav (48 kHz, stereo, float).
Harmony: D minor for the lineage (i-VI-III-VII), tension over a D pedal as Act II opens,
F major as the idea takes hold, and a D major (Picardy) resolution at the end.
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf

import synth as S
from synth import SR, Bus, m

ROOT = Path(__file__).resolve().parent.parent
edit = json.loads((ROOT / "film/edit.json").read_text())
DUR = edit["shots"][-1]["end"] + 1.5
T = {s["id"]: (s["start"], s["end"]) for s in edit["shots"]}

music = Bus(DUR)
sfx = Bus(DUR)
rng = np.random.default_rng(7)

CH = {
    "Dm": [m("D2"), m("A2"), m("D3"), m("F3"), m("A3")],
    "Bb": [m("Bb1"), m("F2"), m("Bb2"), m("D3"), m("F3")],
    "F": [m("F2"), m("C3"), m("F3"), m("A3"), m("C4")],
    "C": [m("C2"), m("G2"), m("C3"), m("E3"), m("G3")],
    "Gm": [m("G2"), m("D3"), m("G3"), m("Bb3"), m("D4")],
    "Dsus": [m("D2"), m("A2"), m("D3"), m("G3"), m("A3")],
    "D": [m("D2"), m("A2"), m("D3"), m("F#3"), m("A3"), m("D4")],
}
ROOTS = {"Dm": "D", "Bb": "Bb", "F": "F", "C": "C", "Gm": "G", "D": "D", "Dsus": "D"}


def chord_seq(seq, t0, bar, gain=0.3, kind="strings", cutoff=2400, attack=0.9, release=1.6, octave=0):
    for i, ch in enumerate(seq):
        notes = [n + 12 * octave for n in CH[ch]]
        dur = bar + release * 0.8
        clip = S.strings(notes, dur, attack=attack, release=release, cutoff=cutoff, seed=i) if kind == "strings" else S.pad(notes, dur, attack=attack, release=release, cutoff=cutoff, seed=i)
        music.place(clip, t0 + i * bar, gain)


def bass_pulse(seq, t0, bar, step, gain=0.12, octave=1, cutoff=900, until=None):
    """Plucked synth bass ostinato on the chord roots."""
    for i, ch in enumerate(seq):
        root = m(ROOTS[ch] + "1") + 12 * octave
        tt = t0 + i * bar
        k = 0
        while tt + k * step < t0 + (i + 1) * bar - 1e-6:
            t = tt + k * step
            if until and t >= until:
                return
            n = int(0.32 * SR)
            f = S.note_hz(root + (12 if k % 4 == 3 else 0))
            s = S.saw(f, n) * 0.6 + S.sine(f, n) * 0.5
            env = S.expdecay(n, 0.09)
            fc = cutoff * (0.6 + 0.8 * env)
            s = S.sweep(s * env, "lp", fc, q=1.4)
            music.place(s, t, gain * (1.0 if k % 2 == 0 else 0.75), pan=0.5)
            k += 1


def arp(notes, t0, t1, step, gain=0.06, inst="bell", pan_walk=True):
    t, k = t0, 0
    while t < t1:
        n = notes[k % len(notes)]
        f = S.note_hz(n)
        clip = S.bell(f, 1.6, index=1.2, ratio=2.0, tau=0.7) if inst == "bell" else S.pluck(f, 1.6, bright=0.6, seed=k)
        music.place(clip, t, gain, pan=0.5 + (0.35 * np.sin(k * 0.9) if pan_walk else 0))
        t += step; k += 1


def motif(notes, times, gain=0.12, inst="bell"):
    for n, t in zip(notes, times):
        f = S.note_hz(n)
        clip = S.bell(f, 3.0, index=1.6, ratio=3.01, tau=1.3) if inst == "bell" else S.piano(f, 4.0) if inst == "piano" else S.pluck(f, 3.0, bright=0.5)
        music.place(clip, t, gain, pan=0.5 + rng.uniform(-0.15, 0.15))


# ============================================================ S01: night, the flare
a, b = T["s01"]
music.place(S.pad([m("D1"), m("A1"), m("D2")], 12.5, attack=4.0, release=2.5, cutoff=420, detune=0.08), 0.0, 0.55)
sfx.place(S.wind(12.0, seed=3, base=380, amount=1.0), 0.0, 0.55)
sfx.place(S.fire(5.2, roar=0.25, crackle=0.35, seed=1), 0.6, 0.35)
sfx.place(S.fire(5.6, roar=0.8, crackle=1.0, seed=2), 5.83, 0.55)
music.place(S.bell(S.note_hz(m("D5")), 6.0, index=0.8, ratio=2.0, tau=2.8), 2.1, 0.07)
music.place(S.bell(S.note_hz(m("A4")), 6.0, index=0.8, ratio=2.0, tau=2.8), 6.4, 0.05)
sfx.place(S.boom(2.4, f0=80, f1=34, tau=0.6, click=0.03), 5.83, 0.3)
sfx.place(S.riser(3.0, 180, 5200), 8.05, 0.33)
sfx.place(S.whoosh(1.6, 300, 2200), 9.6, 0.25)

# ============================================================ S02: THE SAME FIRE
a, b = T["s02"]
music.place(S.brass_hit([m("D1"), m("D2"), m("A2"), m("D3")], 6.0, peak=2400), a, 0.95)
sfx.place(S.boom(4.5, f0=95, f1=28, tau=1.4, click=0.2), a, 0.85)
sfx.place(S.taiko(2.5, 58), a, 0.45)
music.place(S.pad(CH["Dm"], 7.0, attack=0.25, release=2.8, cutoff=850), a, 0.32)
roar = S.fire(6.5, roar=1.3, crackle=0.6, seed=4)
roar = np.vstack([S.lp(roar[0], 500), S.lp(roar[1], 500)])     # slow-motion: deep, dark roar
sfx.place(roar, a - 0.2, 0.6)
sfx.place(S.whoosh(1.8, 250, 1800), b - 1.1, 0.3)

# ============================================================ S03: Firenze, 1842
a, b = T["s03"]
sfx.place(S.fire(2.2, roar=0.5, crackle=1.8, seed=5), a - 0.5, 0.4)          # the burn transition
chord_seq(["Dm", "Bb", "F", "C"], a + 0.3, 2.8, gain=0.3, cutoff=2200, attack=1.1)
harp = [("A4", "D5", "F5", "E5"), ("F4", "Bb4", "D5", "C5"), ("A4", "C5", "F5", "E5"), ("G4", "C5", "E5", "D5")]
for i, grp in enumerate(harp):
    t0 = a + 0.6 + i * 2.8
    for j, nn in enumerate(grp):
        music.place(S.pluck(S.note_hz(m(nn)), 3.0, bright=0.55, seed=10 + i * 4 + j), t0 + j * 0.42, 0.22, pan=0.3 + 0.13 * j)
for t in [a + 2.6, a + 3.8, a + 5.0, a + 7.4, a + 8.6]:                        # distant foundry hammers
    clk = S.lp(S.hammer_clink(640 + rng.uniform(-40, 40), 1.4), 3500)
    sfx.place(clk, t, 0.045, pan=0.72)
for t, nn in [(a + 1.9, "G2"), (a + 5.6, "D3")]:                               # a church bell across the river
    sfx.place(S.bell(S.note_hz(m(nn)), 7.0, index=2.4, ratio=2.76, tau=3.5), t, 0.05, pan=0.35)
sfx.place(S.fire(b - a, roar=0.15, crackle=0.5, seed=6), a, 0.12)             # the foundry fire, far off

# ============================================================ S04: the lineage
a, b = T["s04"]
music.place(np.vstack([S.bell(S.note_hz(m("A5")), 4, 0.6, 2.0, 2.0), S.bell(S.note_hz(m("E6")), 4, 0.6, 2.0, 2.0)]) * 0.5, a - 0.3, 0.12)
chord_seq(["Dm", "Bb", "F", "C"], a, 3.0, gain=0.24, cutoff=2600, attack=0.7)
bass_pulse(["Dm", "Bb", "F", "C"], a + 0.25, 3.0, 0.375, gain=0.1, octave=1, cutoff=700)
for t in [28.4, 32.3, 35.15, 37.45]:
    sfx.place(S.whoosh(1.3, 500, 3000), t - 0.35, 0.28, pan=rng.uniform(0.3, 0.7))
t = a
while t < b:
    sfx.place(S.tick(0.06, 5200), t, 0.025, pan=0.6); t += 0.75

# ============================================================ S05: the blueprint
a, b = T["s05"]
music.place(S.pad([m("D5"), m("E5"), m("A5")], 11.0, attack=2.5, release=2.5, cutoff=5200, detune=0.06), a - 0.5, 0.07)
music.place(S.pad([m("D2"), m("A2")], 10.5, attack=2.0, release=2.0, cutoff=500), a - 0.3, 0.26)
tt = a + 0.3
while tt < a + 4.2:                                                             # the pen on the drafting film
    L = rng.uniform(0.03, 0.12)
    n = int(L * SR)
    sc = S.bp(S.white(n), rng.uniform(2500, 5000), 1.5) * np.sin(np.linspace(0, np.pi, n)) ** 0.5
    sfx.place(sc, tt, 0.035, pan=0.3 + 0.4 * (tt - a) / 4.2)
    tt += rng.uniform(0.05, 0.16)
sfx.place(S.riser(4.2, 140, 2800), a + 4.4, 0.22)
music.place(S.strings([m("F2"), m("C3"), m("F3"), m("A3"), m("C4"), m("G4")], 5.0, attack=0.25, release=2.5, cutoff=3000), 47.0, 0.36)
motif([m("A4"), m("D5"), m("E5"), m("F5")], [47.2, 47.55, 47.9, 48.3], gain=0.1)

# ============================================================ S06: Air / Fire / Motion / Power
a, b = T["s06"]
sfx.place(S.turbine(5.6, 25, 190, curve=2.0, blades=12, noise=0.6), a + 0.1, 0.12)
sfx.place(S.whoosh(3.5, 200, 1400), a + 1.4, 0.12)
bass_pulse(["Dm", "Dm"], a + 0.75, 2.25, 0.375, gain=0.1, octave=1, cutoff=800)
music.place(S.pad(CH["Dm"], 6.0, attack=1.0, release=1.5, cutoff=1300), a, 0.2)
ig = 54.6                                                                      # ignition
sfx.place(S.boom(3.2, f0=72, f1=26, tau=1.1, click=0.12), ig, 0.75)
sfx.place(S.whoosh(1.3, 180, 1600), ig - 0.15, 0.4)
comb = S.fire(b - ig, roar=1.0, crackle=0.15, seed=9)
sfx.place(np.vstack([S.lp(comb[0], 380), S.lp(comb[1], 380)]), ig, 0.2)
chord_seq(["Bb", "F"], ig, 3.45, gain=0.3, cutoff=2600, attack=0.4)
bass_pulse(["Bb", "Bb", "F", "F"], ig, 1.725, 0.1875 * 2, gain=0.11, octave=1, cutoff=900)
for k in range(int((66.75 - ig) / 1.5) + 1):
    music.place(S.taiko(1.6, 60), ig + k * 1.5, 0.28)
music.place(S.strings([m("D4"), m("F4"), m("A4"), m("D5")], 5.8, attack=0.8, release=1.5, cutoff=4200), 61.5, 0.14)
arp([m("D5"), m("F5"), m("A5"), m("E5")], 61.6, 66.6, 0.1875 * 2, gain=0.035)
chord_seq(["Dm"], 61.5, 5.25, gain=0.18, cutoff=1800)
# motion: the power turbine spins up to 7,800 rpm (130 Hz shaft)
sfx.place(S.turbine(3.9, 18, 130, curve=1.6, blades=24, noise=0.8), 66.75, 0.3)
sfx.place(S.riser(3.3, 250, 6000), 67.3, 0.3)
chord_seq(["C"], 66.75, 3.75, gain=0.24, cutoff=3000, attack=0.3)
bass_pulse(["C", "C"], 66.75, 1.875, 0.1875, gain=0.11, octave=1, cutoff=1100)
for k in range(10):
    music.place(S.taiko(1.2, 64 + (k % 2) * 8), 66.75 + k * 0.375, 0.16 + 0.02 * k)
# power
pw = 70.5
music.place(S.brass_hit([m("F1"), m("F2"), m("C3"), m("F3"), m("A3")], 6.5, peak=3000), pw, 0.85)
sfx.place(S.boom(4.0, f0=100, f1=30, tau=1.3, click=0.2), pw, 0.7)
sfx.place(S.zap(0.6), pw + 0.05, 0.3); sfx.place(S.zap(0.5), pw + 0.9, 0.18, pan=0.7)
sfx.place(S.hum(6.0, 60, 1.0) * S.adsr(int(6 * SR), 0.6, 0.5, 0.8, 1.5), pw, 0.045)
chord_seq(["F"], pw, 6.0, gain=0.34, cutoff=3200, attack=0.2, release=2.5)
motif([m("C5"), m("F5"), m("G5"), m("A5")], [pw + 1.3, pw + 1.65, pw + 2.0, pw + 2.4], gain=0.09)

# ============================================================ S07: into service; ordered by the dozen
a, b = T["s07"]
sfx.place(S.wind(4.9, seed=21, base=1100, amount=0.9), a + 0.3, 0.32)
sfx.place(S.lp(S.hum(4.8, 60, 1.0) + S.pink(int(4.8 * SR)) * 0.2, 400), a + 0.3, 0.05)
motif([m("D5"), m("A4"), m("F4")], [a + 1.0, a + 1.6, a + 2.3], gain=0.07)
music.place(S.pad([m("D3"), m("A3"), m("E4")], 5.2, attack=1.6, release=1.5, cutoff=1600), a + 0.2, 0.12)
cut = a + 115 / 24
chord_seq(["Dm", "Bb", "F"], cut, 2.1, gain=0.32, cutoff=2600, attack=0.6)
bass_pulse(["Dm", "Bb", "F"], cut, 2.1, 0.375, gain=0.1, octave=1, cutoff=800, until=b - 0.3)
music.place(S.taiko(2.0, 55), cut, 0.35)
sfx.place(S.whoosh(2.0, 150, 900), b - 1.6, 0.25)

# ============================================================ S08: too much gas
a, b = T["s08"]
music.place(S.pad([m("D1"), m("D2")], b - a + 1.5, attack=2.5, release=2.0, cutoff=260, detune=0.05), a, 0.5)
music.place(S.strings([m("D4"), m("D#4"), m("A4")], b - a - 1.0, attack=3.0, release=2.0, cutoff=2400), a + 1.5, 0.07)
t = a + 0.9
while t < b - 0.3:                                                              # a heartbeat
    sfx.place(S.boom(0.7, f0=70, f1=40, tau=0.12, click=0.0), t, 0.2)
    sfx.place(S.boom(0.7, f0=66, f1=38, tau=0.1, click=0.0), t + 0.28, 0.13)
    t += 1.25
sfx.place(S.wind(b - a + 1, seed=31, base=420), a, 0.3)
sfx.place(S.fire(b - a, roar=0.35, crackle=0.3, seed=12), a, 0.1)
sfx.place(np.vstack([S.riser(1.8, 900, 7000, tone=False)] * 2) * 0.5, a + 3.0, 0.2)   # the x-ray scan
sfx.place(S.boom(3.2, f0=60, f1=28, tau=1.0, click=0.05), 97.2, 0.55)                  # Waha
music.place(S.piano(S.note_hz(m("D2")), 5.0) + S.piano(S.note_hz(m("D#2")), 5.0), 97.2, 0.22)

# ============================================================ S09: not enough power
a, b = T["s09"]
music.place(S.pad([m("D2"), m("A2")], b - a + 1, attack=1.5, release=2.0, cutoff=380), a, 0.24)
sfx.place(S.wind(b - a + 1, seed=41, base=300), a, 0.36)
sfx.place(S.hp(S.hum(b - a, 60, 1.0), 150), a + 0.5, 0.03)                   # the wire hum
motif([m("A4"), m("D5"), m("C5"), m("A4")], [a + 1.4, a + 3.4, a + 6.3, a + 8.9], gain=0.11, inst="piano")
sfx.place(S.boom(2.0, f0=70, f1=40, tau=0.5, click=0.02), a + 2.6, 0.22)
sfx.place(S.boom(2.0, f0=64, f1=36, tau=0.5, click=0.02), a + 6.8, 0.22)

# ============================================================ S10: the turn
a, b = T["s10"]
music.place(S.pad([m("D2"), m("A2")], 5.0, attack=0.8, release=2.0, cutoff=500), a, 0.2)
for t, f in [(114.25, 58), (115.4, 52)]:
    music.place(S.brass_hit([m("D2"), m("A2")] if f == 58 else [m("C2"), m("G2")], 3.0, peak=1500), t, 0.35)
    sfx.place(S.taiko(2.0, f), t, 0.4)
music.place(S.strings([m("A4")], 6.5, attack=1.5, release=2.0, cutoff=3000), 116.2, 0.08)
crick = np.zeros(int(8 * SR))                                                   # desert crickets
for k in range(int(8 * 3.2)):
    i = int(k / 3.2 * SR + rng.uniform(0, 0.05) * SR)
    n = int(0.035 * SR)
    if i + n < len(crick):
        crick[i:i + n] += np.sin(2 * np.pi * 4600 * np.arange(n) / SR) * np.sin(np.linspace(0, np.pi, n))
sfx.place(crick, 115.8, 0.012, pan=0.3); sfx.place(np.roll(crick, 9000), 116.3, 0.009, pan=0.75)
for k in range(9):                                                              # flares going out
    sfx.place(S.lp(S.pink(int(0.5 * SR)) * S.expdecay(int(0.5 * SR), 0.12), 900), 118.3 + k * 0.32 + rng.uniform(0, 0.1), 0.06, pan=rng.uniform(0.2, 0.8))
music.place(np.vstack([S.bell(S.note_hz(m(x)), 5.0, 1.0, 2.0, 2.2) for x in ("F5", "C6")]) * 0.6, 121.2, 0.1)
chord_seq(["F", "C"], 121.75, 3.4, gain=0.26, cutoff=3200, attack=1.2)
arp([m("F4"), m("A4"), m("C5"), m("F5"), m("A5"), m("C5")], 121.9, 128.4, 0.1875, gain=0.045)
for t in [122.1, 123.0, 123.8, 124.5]:
    sfx.place(np.vstack([S.riser(0.9, 1500, 9000, tone=False)] * 2) * 0.5, t, 0.08)
music.place(S.taiko(2.0, 60), 125.5, 0.3)

# ============================================================ S11: gas-to-power as a service
a, b = T["s11"]
seq = ["F", "C", "Dm", "Bb", "F", "C", "Bb"]
chord_seq(seq, a, 3.0, gain=0.3, cutoff=3000, attack=0.5)
bass_pulse(seq, a, 3.0, 0.375, gain=0.12, octave=1, cutoff=1000, until=b)
t = a + 0.02
k = 0
while t < b - 0.1:                                                              # groove
    if k % 2 == 0:
        music.place(S.boom(0.6, f0=110, f1=48, tau=0.14, click=0.08), t, 0.3)
    if k % 4 == 2:
        music.place(S.taiko(1.0, 88), t, 0.14)
    music.place(S.tick(0.05, 7500), t + 0.375, 0.025)
    t += 0.75; k += 1
music.place(S.brass_hit([m("F2"), m("C3"), m("F3"), m("A3")], 4.0, peak=2200), a + 6.0, 0.35)
music.place(S.brass_hit([m("Bb1"), m("F2"), m("Bb2"), m("D3")], 4.0, peak=2200), a + 14.42, 0.4)
motif([m("C5"), m("F5"), m("G5"), m("A5")], [a + 2.2, a + 2.55, a + 2.9, a + 3.3], gain=0.1)
sfx.place(S.turbine(8.5, 128, 130, curve=1.0, blades=24, noise=0.3), a + 6.0, 0.05)
sfx.place(S.lp(S.pink(int(8.4 * SR)), 300), a + 6.0, 0.05)

# ============================================================ S12: scale
a, b = T["s12"]
seq = ["Bb", "F", "C", "Gm"]
chord_seq(seq, a, 3.0, gain=0.34, cutoff=3400, attack=0.5)
bass_pulse(seq, a, 3.0, 0.1875 * 2, gain=0.13, octave=1, cutoff=1200, until=b)
t, k = a, 0
while t < b - 0.1:
    music.place(S.boom(0.6, f0=115, f1=48, tau=0.14, click=0.1), t, 0.24 if k % 2 == 0 else 0.13)
    if k % 2 == 1:
        music.place(S.taiko(1.0, 92), t, 0.1)
    t += 0.375 if t > a + 6 else 0.75; k += 1
music.place(S.pad([m("D4"), m("F4"), m("A4"), m("D5")], b - a, attack=3.0, release=1.5, cutoff=3500), a, 0.1)
sfx.place(S.hum(5.5, 120, 1.0), a + 0.3, 0.02)
sfx.place(S.riser(3.2, 200, 7000), b - 3.2, 0.3)

# ============================================================ S13: the same fire, put to work
a, b = T["s13"]
music.place(S.pad([m("D2"), m("A2"), m("D3")], 7.0, attack=1.2, release=2.5, cutoff=900), a, 0.22)
sfx.place(S.fire(3.6, roar=0.5, crackle=0.7, seed=17) * np.linspace(1, 0, int(3.6 * SR)) ** 1.5, a + 1.3, 0.28)
for t in [a + 0.9, a + 3.1]:                                                     # dawn birds
    n = int(0.25 * SR); tt = np.arange(n) / SR
    chirp = np.sin(2 * np.pi * np.cumsum(2800 + 900 * np.sin(2 * np.pi * 14 * tt)) / SR) * np.sin(np.pi * tt / 0.25)
    sfx.place(chirp, t, 0.012, pan=0.7)
motif([m("A4"), m("D5"), m("E5"), m("F#5")], [162.2, 162.75, 163.3, 164.0], gain=0.14, inst="piano")
music.place(S.strings(CH["D"] + [m("F#4"), m("A4")], 8.0, attack=1.2, release=3.0, cutoff=3400), 165.1, 0.42)
music.place(S.brass_hit([m("D2"), m("A2"), m("D3"), m("F#3")], 6.0, peak=1800), 165.15, 0.3)
music.place(S.bell(S.note_hz(m("D6")), 5.0, 1.0, 2.0, 2.5), 165.3, 0.05)
tt0 = 168.2                                                                      # end title
sfx.place(S.boom(5.0, f0=80, f1=28, tau=1.8, click=0.05), tt0, 0.6)
music.place(S.pad([m("D1"), m("D2"), m("A2")], 5.5, attack=0.1, release=4.0, cutoff=700), tt0, 0.3)

# ------------------------------------------------------------ space & export
ir = S.hall_ir(3.4, predelay=0.03)
irs = S.hall_ir(1.3, predelay=0.012, seed=5)
mus = music.x + S.convolve_st(music.x, ir) * 0.32
fx = sfx.x + S.convolve_st(sfx.x, irs) * 0.18
# end fade & safety
fade = np.ones(mus.shape[1]); k = int(1.2 * SR); fade[-k:] = np.linspace(1, 0, k)
mus *= fade; fx *= fade
out = ROOT / "audio/stems"; out.mkdir(parents=True, exist_ok=True)
sf.write(out / "music.wav", mus.T.astype(np.float32), SR, subtype="FLOAT")
sf.write(out / "sfx.wav", fx.T.astype(np.float32), SR, subtype="FLOAT")
print("music peak", np.max(np.abs(mus)), "sfx peak", np.max(np.abs(fx)), "dur", mus.shape[1] / SR)
