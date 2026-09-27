"""Mix narration, music and sound design into the final soundtrack.

Reads film/edit.json (narration cue times), audio/vo/*.wav and audio/stems/{music,sfx}.wav.
Writes audio/mix.wav (48 kHz / 24-bit, -16 LUFS integrated, -1.5 dBTP) and audio/stems/vo.wav.
"""
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

import synth as S
from synth import SR

ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(ROOT / "render"))
from common import FFMPEG  # noqa: E402
edit = json.loads((ROOT / "film/edit.json").read_text())

music, sr = sf.read(ROOT / "audio/stems/music.wav", always_2d=True); music = music.T
sfx, _ = sf.read(ROOT / "audio/stems/sfx.wav", always_2d=True); sfx = sfx.T
n = max(music.shape[1], sfx.shape[1])


def compress(x, thresh_db=-18, ratio=3.0, attack=0.005, release=0.12):
    env = np.abs(x)
    a = np.exp(-1 / (attack * SR)); r = np.exp(-1 / (release * SR))
    # peak follower (vectorised approximation via one-pole filters on rectified signal)
    e = signal.lfilter([1 - r], [1, -r], env)
    e = np.maximum(e, signal.lfilter([1 - a], [1, -a], env))
    lvl = 20 * np.log10(np.maximum(e, 1e-6))
    over = np.maximum(lvl - thresh_db, 0)
    g = 10 ** (-(over - over / ratio) / 20)
    return x * g


# ---------------------------------------------------------------- narration
vo = np.zeros(n)
for cue in edit["vo"]:
    x, vsr = sf.read(ROOT / "audio/vo" / f"{cue['id']}.wav")
    x = signal.resample_poly(x, SR, vsr)
    x = S.hp(x, 75)
    x = S.eq(x, "lowshelf", 170, 0.7, 2.5)       # chest
    x = S.eq(x, "peak", 3200, 1.0, 2.0)          # presence
    x = S.eq(x, "peak", 7200, 2.0, -2.5)         # soften sibilance
    x = compress(x / (np.max(np.abs(x)) + 1e-9) * 0.7, thresh_db=-16, ratio=2.8)
    i = int(cue["start"] * SR)
    k = min(len(x), n - i)
    vo[i:i + k] += x[:k]
vo = vo / (np.sqrt(np.mean(vo[np.abs(vo) > 0.02] ** 2)) + 1e-9) * 0.12      # speech RMS ~ -18 dBFS
room = S.hall_ir(0.7, predelay=0.008, seed=3)
vo_st = np.vstack([vo, vo])
vo_st = vo_st + S.convolve_st(vo_st, room) * 0.07

# ---------------------------------------------------------------- ducking (sidechain from the narration)
env = np.abs(vo)
win = int(0.03 * SR)
env = np.sqrt(np.maximum(signal.fftconvolve(env ** 2, np.ones(win) / win, mode="same"), 0.0))
att, rel = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.45 * SR))
sm = signal.lfilter([1 - rel], [1, -rel], env)
sm = np.maximum(sm, signal.lfilter([1 - att], [1, -att], env))
d = np.clip(sm / 0.05, 0, 1)
duck_music = 1 - 0.62 * d          # up to ~-8.5 dB
duck_sfx = 1 - 0.4 * d             # ~-4.5 dB

music_g = music / (np.max(np.abs(music)) + 1e-9) * 0.62
sfx_g = sfx / (np.max(np.abs(sfx)) + 1e-9) * 0.5
mixd = music_g * duck_music + sfx_g * duck_sfx + vo_st
# master bus: gentle glue compression + soft clip
mixd = np.vstack([compress(mixd[0], -10, 1.8, 0.01, 0.2), compress(mixd[1], -10, 1.8, 0.01, 0.2)])
mixd = np.tanh(mixd * 1.1) / 1.1

tmp = ROOT / "audio/mix_pre.wav"
sf.write(tmp, mixd.T.astype(np.float32), SR, subtype="FLOAT")
sf.write(ROOT / "audio/stems/vo.wav", vo_st.T.astype(np.float32), SR, subtype="FLOAT")

# ---------------------------------------------------------------- loudness: two-pass EBU R128
meas = subprocess.run([FFMPEG, "-hide_banner", "-i", str(tmp), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(re.findall(r"\{[^{}]*\}", meas)[-1])
af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true:print_format=summary")
out = ROOT / "audio/mix.wav"
subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(tmp), "-af", af, "-ar", str(SR), "-c:a", "pcm_s24le", str(out)], check=True)
tmp.unlink()
print("input loudness", j["input_i"], "LUFS; true peak", j["input_tp"], "-> normalised to -16 LUFS:", out)
