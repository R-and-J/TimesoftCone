#!/usr/bin/env python3
"""presentation/img/*.mmd 를 kroki.io로 렌더해 같은 이름 .png로 저장 (발표용 그림).

사용법: python presentation/render-img.py
- 브라우저 User-Agent 필수(kroki Cloudflare 1010 회피). render-uml.py와 동일 방식.
"""
import os, sys, glob, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "img")
KROKI = "https://kroki.io/mermaid/png"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def render(src):
    req = urllib.request.Request(
        KROKI, data=src.encode("utf-8"),
        headers={"Content-Type": "text/plain", "User-Agent": UA, "Accept": "image/png"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def main():
    files = sorted(glob.glob(os.path.join(IMG, "*.mmd")))
    if not files:
        print("no .mmd in", IMG)
        return 1
    ok = fail = 0
    for f in files:
        out = f[:-4] + ".png"
        try:
            png = render(open(f, encoding="utf-8").read())
            if png[:8] != PNG_MAGIC:
                print("FAIL", os.path.basename(out), "->", png[:80])
                fail += 1
                continue
            with open(out, "wb") as w:
                w.write(png)
            print("OK  ", os.path.basename(out), f"({len(png)} bytes)")
            ok += 1
        except urllib.error.HTTPError as e:
            print("FAIL", os.path.basename(out), "HTTP", e.code, e.read()[:200])
            fail += 1
        except Exception as e:
            print("FAIL", os.path.basename(out), type(e).__name__, e)
            fail += 1
    print(f"\n== {ok} ok, {fail} fail ==")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
