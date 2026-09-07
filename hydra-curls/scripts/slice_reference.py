#!/usr/bin/env python3
"""
Slice the full-page Figma reference render into per-section images, locally.

Why this exists
---------------
Figma rate-limits its image *render* endpoint hard (roughly 30 renders, then a
multi-minute cooldown). Rendering all 47 top-level nodes individually burns through
that budget and leaves the tail of the page unrendered.

Slicing the single full-page render instead costs *zero* API calls, and produces
section references that match how the page actually reads top-to-bottom -- which is
more useful than isolated nodes on transparent backgrounds anyway.

Usage
-----
    python scripts/slice_reference.py
    python scripts/slice_reference.py --overlap 80    # more context around each seam

Inputs   ../docs/figma/reference/full-page.png
         ../docs/figma/raw/nodes.json
Output   ../docs/figma/reference/slices/NN-<name>-y<start>-<end>.png
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the reference render is legitimately enormous

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / "docs" / "figma" / "reference"
FULL = REF / "full-page.png"
NODES = ROOT / "docs" / "figma" / "raw" / "nodes.json"
OUT = REF / "slices"

# The visual sections, derived from the y-coordinate map in docs/figma/DESIGN_SPEC.md.
# These are *visual* bands, not Figma nodes -- the file has no auto-layout, so node
# nesting carries no structure. Ranges are inclusive of decorative bleed.
SECTIONS: list[tuple[str, int, int]] = [
    ("navbar-and-ticker", 0, 140),
    ("hero", 100, 1233),
    ("wave-divider", 1122, 1291),
    ("new-launch", 1199, 2029),
    ("brand-key-visual", 1904, 3126),
    ("benefit-cards", 3246, 5250),
    ("curved-script-arc", 5251, 5700),
    ("hydra-curls-promise", 5700, 6635),
    ("premium-ingredients", 6636, 7747),
    ("testimonials", 7748, 8900),
    ("experts-saying", 8901, 10254),
    ("designed-for-you", 10255, 11848),
    ("learn-and-grow", 11849, 14208),
    ("final-cta", 14209, 14691),
    ("footer", 14692, 15249),
]


def frame_height() -> int:
    """Design-space height of frame 1:503, so we can derive the render's scale factor."""
    if not NODES.exists():
        sys.exit(f"  x Missing {NODES}\n    Run: node scripts/figma-extract.mjs --skip-images --skip-sections")
    data = json.loads(NODES.read_text(encoding="utf-8"))
    box = data["nodes"]["1:503"]["document"]["absoluteBoundingBox"]
    return round(box["height"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--overlap",
        type=int,
        default=40,
        help="extra design-space px above/below each slice, for seam context (default 40)",
    )
    args = ap.parse_args()

    if not FULL.exists():
        sys.exit(f"  x Missing {FULL}\n    Run: node scripts/figma-extract.mjs --skip-images --skip-sections")

    img = Image.open(FULL)
    design_h = frame_height()
    # full-page.png is rendered at scale 0.5, but derive it rather than assume -- the
    # scale in figma-extract.mjs may change if Figma's render ceiling does.
    scale = img.height / design_h
    print(f"   reference {img.width}x{img.height}px  |  design {design_h}px  |  scale {scale:.3f}")

    OUT.mkdir(parents=True, exist_ok=True)
    for i, (name, y0, y1) in enumerate(SECTIONS):
        top = max(0, round((y0 - args.overlap) * scale))
        bottom = min(img.height, round((y1 + args.overlap) * scale))
        if bottom <= top:
            print(f"   ! skipping {name}: empty range")
            continue
        crop = img.crop((0, top, img.width, bottom))
        dest = OUT / f"{i:02d}-{name}-y{y0}-{y1}.png"
        crop.save(dest, optimize=True)
        print(f"   {dest.name:<48} {crop.width}x{crop.height}")

    print(f"\n   {len(SECTIONS)} slices -> docs/figma/reference/slices/\n")


if __name__ == "__main__":
    main()
