#!/usr/bin/env python3
"""docs/03_design/uml/*.md 의 첫 mermaid 블록을 kroki.io로 렌더해 PNG로 저장.

사용법: python presentation/render-uml.py
- 네트워크로 https://kroki.io 에 POST. 실패 시 mermaid.ink 폴백.
- 기존 PNG는 최신 렌더로 덮어씀(소스가 단일 진실 원천).
"""
import os, re, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UML = os.path.join(ROOT, "docs", "03_design", "uml")
KROKI = "https://kroki.io/mermaid/png"

JOBS = [
    ("01-use-case.md", "usecase.png"),
    ("02-class.md", "class.png"),
    ("03-sequence.md", "sequence.png"),
    ("04-state.md", "state.png"),
    ("05-activity-year-end.md", "activity-year-end.png"),
    ("06-component-hexagonal.md", "component-hexagonal.png"),
    ("07-object-integrity.md", "object-integrity.png"),
    ("08-activity-deduction.md", "activity-deduction.png"),
]

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def first_mermaid(md):
    m = re.search(r"```mermaid\s*\n(.*?)\n```", md, re.S)
    return m.group(1) if m else None


UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def render(src):
    data = src.encode("utf-8")
    req = urllib.request.Request(
        KROKI,
        data=data,
        headers={"Content-Type": "text/plain", "User-Agent": UA, "Accept": "image/png"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def main():
    if not os.path.isdir(UML):
        print("UML dir not found:", UML)
        return 1
    filters = sys.argv[1:]  # 예: python render-uml.py 05- 06- 08-  → 일부만 렌더
    ok = fail = 0
    for srcname, outname in JOBS:
        if filters and not any(f in srcname or f in outname for f in filters):
            continue
        p = os.path.join(UML, srcname)
        if not os.path.exists(p):
            print(f"SKIP {outname}: source missing")
            fail += 1
            continue
        code = first_mermaid(open(p, encoding="utf-8").read())
        if not code:
            print(f"SKIP {outname}: no mermaid block")
            fail += 1
            continue
        try:
            png = render(code)
            if png[:8] != PNG_MAGIC:
                print(f"FAIL {outname}: not a PNG -> {png[:80]!r}")
                fail += 1
                continue
            with open(os.path.join(UML, outname), "wb") as f:
                f.write(png)
            print(f"OK   {outname}  ({len(png)} bytes)")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"FAIL {outname}: HTTP {e.code} -> {e.read()[:300]!r}")
            fail += 1
        except Exception as e:
            print(f"FAIL {outname}: {type(e).__name__}: {e}")
            fail += 1
    print(f"\n== done: {ok} ok, {fail} fail ==")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
