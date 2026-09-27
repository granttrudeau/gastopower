"""Render individual frames to PNG for review.

  tools/venv/bin/python render/stills.py --times 1 5.5 12 --scale 0.5 --out /tmp/stills
  tools/venv/bin/python render/stills.py --shot s03 --n 6 --scale 0.5
"""
import argparse
import io
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import film_page, data_url_bytes  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--times", type=float, nargs="*", default=[])
ap.add_argument("--shot", help="sample frames evenly across one shot")
ap.add_argument("--n", type=int, default=5)
ap.add_argument("--scale", type=float, default=0.5)
ap.add_argument("--sub", type=int, default=1, help="temporal subframes")
ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "out" / "stills"))
ap.add_argument("--only", help="load only this shot id (faster boot)")
ap.add_argument("--sheet", action="store_true", help="also write a contact sheet")
ap.add_argument("--width", type=int, default=960, help="contact sheet tile width")
ap.add_argument("--post", help="JSON post-process override, e.g. {\"lookPower\":1.35}")
ap.add_argument("--tag", default="")
ap.add_argument("--js", help="JavaScript to evaluate before rendering (debug)")
args = ap.parse_args()

out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
q = f"mode=render&scale={args.scale}" + (f"&only={args.only}" if args.only else "")
t0 = time.time()
with film_page(q) as (page, logs):
    boot = time.time() - t0
    times = list(args.times)
    if args.shot:
        info = page.evaluate(f"() => {{ const s = FILM.timeline.shots.find(s => s.id === '{args.shot}'); return s ? [s.start, s.end] : null; }}")
        if not info:
            raise SystemExit(f"no shot {args.shot}")
        a, b = info
        times += [a + (b - a) * (i + 0.5) / args.n for i in range(args.n)]
    files = []
    if args.post:
        page.evaluate(f"() => {{ window.__postOverride = {args.post}; }}")
    if args.js:
        print("js:", page.evaluate(args.js))
    for t in times:
        t1 = time.time()
        url = page.evaluate(f"() => FILM.renderTime({t}, {{ subframes: {args.sub} }})")
        dt = time.time() - t1
        fn = out / f"t{t:07.2f}{args.tag}.png"
        fn.write_bytes(data_url_bytes(url))
        files.append(fn)
        print(f"{fn.name}  {dt*1000:.0f} ms")
    for line in logs[-20:]:
        print(line)
    print(f"boot {boot:.1f}s")

if args.sheet and files:
    from PIL import Image, ImageDraw
    ims = [Image.open(f).convert("RGB") for f in files]
    w = args.width
    ims = [im.resize((w, int(im.height * w / im.width))) for im in ims]
    cols = 2 if len(ims) > 1 else 1
    rows = (len(ims) + cols - 1) // cols
    h = ims[0].height
    sheet = Image.new("RGB", (cols * w, rows * h), "black")
    d = ImageDraw.Draw(sheet)
    for i, (im, f) in enumerate(zip(ims, files)):
        x, y = (i % cols) * w, (i // cols) * h
        sheet.paste(im, (x, y))
        d.text((x + 6, y + 4), f.stem, fill="yellow")
    sheet.save(out / "sheet.png")
    print("sheet:", out / "sheet.png")
