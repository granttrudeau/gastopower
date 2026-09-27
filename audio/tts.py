"""Narration synthesis with Kokoro-82M (local, offline).

Each line of audio/script.json becomes audio/vo/<id>.wav (24 kHz mono) and
durations are written to audio/vo/durations.json.

  tools/venv/bin/python audio/tts.py                  # voice from script.json
  tools/venv/bin/python audio/tts.py --voice am_michael --out audio/vo_cand/michael
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--voice", help="voice name or blend like am_michael:0.6,am_onyx:0.4")
ap.add_argument("--speed", type=float)
ap.add_argument("--out", default=str(ROOT / "audio" / "vo"))
ap.add_argument("--only", nargs="*")
args = ap.parse_args()

script = json.loads((ROOT / "audio" / "script.json").read_text())
k = Kokoro(str(ROOT / "tools/kokoro/kokoro-v1.0.onnx"), str(ROOT / "tools/kokoro/voices-v1.0.bin"))

def parse_voice(spec):
    if isinstance(spec, dict):
        return spec
    if ":" in spec or "," in spec:
        out = {}
        for part in spec.split(","):
            n, w = part.split(":")
            out[n.strip()] = float(w)
        return out
    return {spec: 1.0}

vspec = parse_voice(args.voice) if args.voice else script["voice"]["blend"]
speed = args.speed or script["voice"]["speed"]
total = sum(vspec.values())
style = sum(k.get_voice_style(v) * (w / total) for v, w in vspec.items())

MARK = re.compile(r"\[([^\]]+)\]\(/([^/]+)/\)")

def phonemes_for(say):
    out, pos = [], 0
    for m in MARK.finditer(say):
        pre = say[pos:m.start()]
        if pre.strip():
            out.append(k.tokenizer.phonemize(pre, lang="en-us").strip())
        out.append(m.group(2))
        pos = m.end()
    rest = say[pos:]
    if rest.strip():
        out.append(k.tokenizer.phonemize(rest, lang="en-us").strip())
    return " ".join(out)

outdir = Path(args.out)
outdir.mkdir(parents=True, exist_ok=True)
durs = {}
dfile = outdir / "durations.json"
if dfile.exists():
    durs = json.loads(dfile.read_text())
for line in script["lines"]:
    if args.only and line["id"] not in args.only:
        continue
    say = line.get("say", line["text"]).replace("…", "...")
    ph = phonemes_for(say)
    samples, sr = k.create(ph, voice=style, speed=speed, is_phonemes=True)
    x = np.asarray(samples, dtype=np.float32)
    # trim residual silence and add short fades
    thr = 0.01 * np.max(np.abs(x))
    nz = np.where(np.abs(x) > thr)[0]
    if len(nz):
        a = max(0, nz[0] - int(0.03 * sr)); b = min(len(x), nz[-1] + int(0.12 * sr))
        x = x[a:b]
    f = int(0.012 * sr)
    x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    sf.write(outdir / f"{line['id']}.wav", x, sr)
    durs[line["id"]] = round(len(x) / sr, 3)
    print(f"{line['id']}  {len(x)/sr:5.2f}s  {ph[:90]}")
dfile.write_text(json.dumps(durs, indent=1))
print("total speech:", round(sum(durs.values()), 2), "s")
