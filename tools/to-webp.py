#!/usr/bin/env python3
"""
Convert site images to WebP and repoint the source files at them.

WHY: the repo had a mix of .png/.jpg/.jpeg/.webp. WebP is materially smaller for
both photographs and alpha graphics, so everything the page loads should use it.

WHAT IT SKIPS (deliberately):
  - assets/favicon/**   browsers + webmanifest expect png/ico at fixed names
  - anything in SKIP_NAMES below

Transparency is preserved (RGBA -> lossless-ish webp with alpha).

Usage:
    python3 tools/to-webp.py            # dry run: show what would change
    python3 tools/to-webp.py --apply    # convert, rewrite index.html, delete originals
    python3 tools/to-webp.py --apply --keep-originals
"""
import argparse
import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  python3 -m pip install --user Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
# Every file that can reference an asset. index.html is the obvious one, but the
# hero balloon loads a texture from JS — missing that broke the hero background
# the first time this ran, so scan the vendored scripts too.
SOURCE_FILES = [
    os.path.join(ROOT, "index.html"),
    os.path.join(ROOT, "vendor", "hero-balloon.js"),
]

# directories whose contents must stay in their original format
SKIP_DIRS = {"favicon"}
# individual files to leave alone
SKIP_NAMES: set[str] = set()

SRC_EXT = (".png", ".jpg", ".jpeg")
# photographs compress fine lossy; alpha graphics get a higher quality floor
QUALITY = 82
QUALITY_ALPHA = 90
# don't upscale; cap the long edge so hero-sized art doesn't ship at 4000px
MAX_EDGE = 1600


def should_skip(path: str) -> bool:
    rel = os.path.relpath(path, ASSETS)
    parts = rel.split(os.sep)
    if any(p in SKIP_DIRS for p in parts[:-1]):
        return True
    return parts[-1] in SKIP_NAMES


def convert(src: str, apply: bool) -> tuple[str, int, int]:
    """Return (dest, bytes_before, bytes_after). Sizes are 0 on a dry run."""
    dest = os.path.splitext(src)[0] + ".webp"
    before = os.path.getsize(src)
    if not apply:
        return dest, before, 0

    im = Image.open(src)
    has_alpha = im.mode in ("RGBA", "LA") or (
        im.mode == "P" and "transparency" in im.info
    )
    im = im.convert("RGBA" if has_alpha else "RGB")

    w, h = im.size
    scale = MAX_EDGE / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)

    im.save(dest, "WEBP", quality=QUALITY_ALPHA if has_alpha else QUALITY, method=6)
    return dest, before, os.path.getsize(dest)


def repoint_sources(converted: list[str], apply: bool) -> int:
    """Rewrite asset references to .webp across every file in SOURCE_FILES."""
    moved = 0
    for path in SOURCE_FILES:
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        original = text
        for src in converted:
            rel = os.path.relpath(src, ROOT).replace(os.sep, "/")
            moved += text.count(rel)
            text = text.replace(rel, os.path.splitext(rel)[0] + ".webp")
        if apply and text != original:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(text)
    return moved


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually write changes")
    ap.add_argument(
        "--keep-originals", action="store_true", help="don't delete the source files"
    )
    args = ap.parse_args()

    targets = []
    for dirpath, _dirnames, filenames in os.walk(ASSETS):
        for name in sorted(filenames):
            if not name.lower().endswith(SRC_EXT):
                continue
            path = os.path.join(dirpath, name)
            if should_skip(path):
                continue
            targets.append(path)

    if not targets:
        print("Nothing to convert — every asset is already webp.")
        return

    total_before = total_after = 0
    converted = []
    for src in sorted(targets):
        dest, before, after = convert(src, args.apply)
        converted.append(src)
        total_before += before
        total_after += after
        rel = os.path.relpath(src, ROOT)
        if args.apply:
            pct = (1 - after / before) * 100 if before else 0
            print(f"  {rel:44s} {before/1024:8.0f}K -> {after/1024:7.0f}K  ({pct:4.1f}% smaller)")
        else:
            print(f"  {rel:44s} {before/1024:8.0f}K")

    moved = repoint_sources(converted, args.apply)

    if args.apply and not args.keep_originals:
        for src in converted:
            os.remove(src)

    print()
    if args.apply:
        print(
            f"Converted {len(converted)} files: "
            f"{total_before/1024/1024:.1f}MB -> {total_after/1024/1024:.1f}MB "
            f"({(1 - total_after/total_before)*100:.0f}% smaller)"
        )
        print(f"Repointed {moved} reference(s) across {len(SOURCE_FILES)} source file(s)")
        if args.keep_originals:
            print("Originals kept.")
    else:
        print(f"{len(converted)} file(s) would be converted. Re-run with --apply.")


if __name__ == "__main__":
    main()
