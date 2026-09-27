"""Transcribe narration clips with Whisper and score them against the script (blind QA)."""
import json, re, sys
from pathlib import Path
import numpy as np, soundfile as sf
from faster_whisper import WhisperModel
ROOT = Path(__file__).resolve().parent.parent
script = {l["id"]: l["text"] for l in json.loads((ROOT/"audio/script.json").read_text())["lines"]}
model = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=str(ROOT/"tools/whisper"))
NUM = {"1842":"eighteen forty two","2013":"twenty thirteen","2017":"twenty seventeen","2038":"twenty thirty eight"}
def norm(s):
    s = s.lower()
    for k,v in NUM.items(): s = s.replace(k, v)
    s = s.replace("novalt","nova l t").replace("nox","knox").replace("-"," ").replace("—"," ").replace("…"," ")
    s = re.sub(r"[^a-z0-9 ]"," ", s)
    return s.split()
def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = np.zeros((len(r)+1, len(h)+1), int); d[:,0] = range(len(r)+1); d[0,:] = range(len(h)+1)
    for i in range(1,len(r)+1):
        for j in range(1,len(h)+1):
            d[i,j] = min(d[i-1,j]+1, d[i,j-1]+1, d[i-1,j-1]+(r[i-1]!=h[j-1]))
    return d[-1,-1], len(r)
def f0(x, sr):
    fr = int(0.04*sr); hop = fr//2; out=[]
    for i in range(0, len(x)-fr, hop):
        w = x[i:i+fr]*np.hanning(fr)
        if np.sqrt(np.mean(w**2)) < 0.02: continue
        ac = np.correlate(w, w, 'full')[fr-1:]
        lo, hi = int(sr/300), int(sr/55)
        j = lo + np.argmax(ac[lo:hi])
        if ac[j] > 0.35*ac[0]: out.append(sr/j)
    return out
for cand in sys.argv[1:]:
    d = ROOT/"audio/vo_cand"/cand if not cand.startswith("/") else Path(cand)
    errs = toks = 0; allf = []; bad = []
    for lid, text in script.items():
        fn = d/f"{lid}.wav"
        x, sr = sf.read(fn)
        segs, _ = model.transcribe(str(fn), language="en", beam_size=5, initial_prompt="NovaLT, Nuovo Pignone, Baker Hughes, Permian, Waha, NOx, premixers, frac")
        hyp = " ".join(s.text for s in segs).strip()
        e, n = wer(text, hyp); errs += e; toks += n
        allf += f0(x, sr)
        if e: bad.append(f"   {lid} ({e}/{n}): {hyp}")
    print(f"{cand:10s} WER {100*errs/toks:5.1f}%  F0 median {np.median(allf):5.1f} Hz  p10 {np.percentile(allf,10):5.1f}  p90 {np.percentile(allf,90):5.1f}")
    print("\n".join(bad))
