"""Shared helpers: a local static server for the film and a headless Chrome page driving it."""
import base64
import functools
import http.server
import os
import socketserver
import threading
import time
from contextlib import contextmanager
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def _find_ffmpeg():
    """$FFMPEG, then ffmpeg on PATH, then the binary bundled with imageio-ffmpeg."""
    import glob, os, shutil
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    if shutil.which("ffmpeg"):
        return shutil.which("ffmpeg")
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        hits = glob.glob(str(Path.home() / "Library/Python/*/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-*"))
        if hits:
            return hits[0]
    raise RuntimeError("ffmpeg not found: set $FFMPEG or install ffmpeg")


FFMPEG = _find_ffmpeg()
CHROME_ARGS = [
    "--use-angle=metal",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
]


class _Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
        ".woff2": "font/woff2", ".wav": "audio/wav", ".glsl": "text/plain",
    }

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


@contextmanager
def serve(port=0):
    handler = functools.partial(_Handler, directory=str(ROOT))
    httpd = _Server(("127.0.0.1", port), handler)
    th = threading.Thread(target=httpd.serve_forever, daemon=True)
    th.start()
    try:
        yield httpd.server_address[1]
    finally:
        httpd.shutdown()


@contextmanager
def film_page(query="mode=render", timeout=180):
    with serve() as port, sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True, args=CHROME_ARGS)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        logs = []
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        page.goto(f"http://127.0.0.1:{port}/film/index.html?{query}")
        t0 = time.time()
        while True:
            state = page.evaluate("() => window.FILM_READY ? 'ready' : (window.FILM_ERROR || null)")
            if state == "ready":
                break
            if state:
                raise RuntimeError("Film failed to boot:\n" + state + "\n" + "\n".join(logs[-30:]))
            if time.time() - t0 > timeout:
                raise TimeoutError("Film boot timeout\n" + "\n".join(logs[-30:]))
            time.sleep(0.25)
        try:
            yield page, logs
        finally:
            browser.close()


def data_url_bytes(url):
    return base64.b64decode(url.split(",", 1)[1])
