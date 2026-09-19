"""Read-only QR audit of all exported question images.

Requires Pillow and zxing-cpp. Decoded links are recorded but never opened.
An empty result means no QR was detected, not proof about every damaged code.
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--media-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data/question-media")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--deps-dir", type=Path)
    args = parser.parse_args()
    if args.deps_dir:
        sys.path.insert(0, str(args.deps_dir.resolve()))
    import zxingcpp

    files = sorted(args.media_dir.rglob("*.webp"))
    report = {"imagesScanned": 0, "imagesWithQr": 0, "codes": [], "unlocalizedErrors": []}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    for path in files:
        with Image.open(path) as image:
            found = zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.QRCode, return_errors=True)
        report["imagesScanned"] += 1
        detected = False
        for code in found:
            position = code.position
            corners = [position.top_left, position.top_right, position.bottom_right, position.bottom_left]
            if not code.valid and (len({p.x for p in corners}) < 2 or len({p.y for p in corners}) < 2):
                # A decoder error with no location is not a located QR. In
                # particular, plotted grid lines can trigger this condition.
                report["unlocalizedErrors"].append(path.relative_to(args.media_dir).as_posix())
                continue
            detected = True
            report["codes"].append({
                "url": "/question-media/" + path.relative_to(args.media_dir).as_posix(),
                "text": code.text, "valid": code.valid,
                "corners": [[point.x, point.y] for point in corners],
            })
        if detected:
            report["imagesWithQr"] += 1
        if report["imagesScanned"] % 500 == 0:
            print(json.dumps({key: value for key, value in report.items() if key != "codes"}), flush=True)
            args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "codes"}), flush=True)


if __name__ == "__main__":
    main()
