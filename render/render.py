"""Render the film (or a time range) to video by stepping the page frame by frame.

  preview: tools/venv/bin/python render/render.py --scale 0.5 --sub 1 --jpeg --out out/preview.mp4
  master:  tools/venv/bin/python render/render.py --scale 1 --sub 8 --out out/master_video.mp4
"""
import argparse
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import FFMPEG, data_url_bytes, film_page  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--sub", type=int, default=8, help="temporal subframes (motion blur + AA)")
ap.add_argument("--shutter", type=float, default=0.5)
ap.add_argument("--start", type=float, default=0.0)
ap.add_argument("--end", type=float, default=None)
ap.add_argument("--jpeg", action="store_true", help="JPEG frame transport (faster, for previews)")
ap.add_argument("--crf", type=int, default=14)
ap.add_argument("--preset", default="slow")
ap.add_argument("--out", required=True)
args = ap.parse_args()

out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
q = f"mode=render&scale={args.scale}"
t_boot = time.time()
with film_page(q) as (page, logs):
    info = page.evaluate("() => ({ fps: FILM.fps, frames: FILM.frames, duration: FILM.duration })")
    fps = info["fps"]
    f0 = int(round(args.start * fps))
    f1 = int(round((args.end if args.end is not None else info["duration"]) * fps))
    print(f"booted in {time.time() - t_boot:.1f}s; rendering frames {f0}..{f1 - 1} ({(f1 - f0) / fps:.1f}s) at {fps} fps", flush=True)
    codec_in = "mjpeg" if args.jpeg else "png"
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", codec_in, "-i", "-",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf), "-pix_fmt", "yuv420p",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-x264-params", "aq-mode=3:deblock=-1,-1", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    fmt = "jpeg" if args.jpeg else "png"
    t0 = time.time()
    for i in range(f0, f1):
        url = page.evaluate(f"() => FILM.renderFrame({i}, {{ subframes: {args.sub}, shutter: {args.shutter}, format: '{fmt}' }})")
        proc.stdin.write(data_url_bytes(url))
        done = i - f0 + 1
        if done % 48 == 0 or i == f1 - 1:
            el = time.time() - t0
            rate = done / el
            eta = (f1 - f0 - done) / max(rate, 1e-6)
            print(f"  frame {i}/{f1 - 1}  {rate:.2f} fps  elapsed {el / 60:.1f} min  eta {eta / 60:.1f} min", flush=True)
    proc.stdin.close()
    proc.wait()
    errs = [l for l in logs if "error" in l.lower() and "404" not in l]
    for l in errs[-10:]:
        print(l)
print("wrote", out)
