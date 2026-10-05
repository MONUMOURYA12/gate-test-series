"""Locate QR image objects in original PDFs, including QR codes split by crops.

This only writes an audit. Review matched objects before adding their exact
hashes to bookletQrObjects.json. Decoded URLs are never requested.
"""

import argparse
import hashlib
import json
import sys
from contextlib import closing
from pathlib import Path

import pypdfium2 as pdfium

from bookletArtwork import omit_publisher_logo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, action="append", required=True)
    parser.add_argument("--pdf-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--deps-dir", type=Path)
    args = parser.parse_args()
    if args.deps_dir:
        sys.path.insert(0, str(args.deps_dir.resolve()))
    import zxingcpp

    report = {"pagesScanned": 0, "codes": [], "unresolved": []}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    for filename in args.input:
        for book in json.loads(filename.read_text(encoding="utf-8"))["books"]:
            pdf_path = args.pdf_dir / book["sourceFile"]
            if pdf_path.parent.resolve() != args.pdf_dir.resolve():
                raise ValueError("Invalid source PDF path.")
            if hashlib.sha256(pdf_path.read_bytes()).hexdigest() != book["sourceSha256"]:
                raise ValueError("Source PDF checksum mismatch.")
            pages = sorted({segment["page"] for question in book["questions"] for segment in question["segments"]})
            with pdfium.PdfDocument(str(pdf_path)) as doc:
                for number in pages:
                    with closing(doc[number - 1]) as page:
                        omit_publisher_logo(page)
                        with closing(page.render(scale=2.5)) as bitmap:
                            with bitmap.to_pil() as image:
                                found = zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.QRCode)
                        objects = list(page.get_objects(filter=[pdfium.raw.FPDF_PAGEOBJ_IMAGE])) if found else []
                        for code in found:
                            points = [code.position.top_left, code.position.top_right, code.position.bottom_right, code.position.bottom_left]
                            left, right = min(p.x for p in points) / 2.5, max(p.x for p in points) / 2.5
                            bottom = page.get_height() - max(p.y for p in points) / 2.5
                            top = page.get_height() - min(p.y for p in points) / 2.5
                            matches = []
                            for obj in objects:
                                l, b, r, t = obj.get_bounds()
                                if min(r, right) <= max(l, left) or min(t, top) <= max(b, bottom):
                                    continue
                                # QR artwork can include a small border/caption or be split
                                # into strips; do not select a surrounding page/diagram.
                                if r - l > (right - left) * 1.8 + 5 or t - b > (top - bottom) * 1.8 + 5:
                                    continue
                                matches.append({"sha256": hashlib.sha256(obj.get_data()).hexdigest(),
                                                "bounds": [l, b, r, t], "pixels": obj.get_px_size()})
                            row = {"book": book["slug"], "sourceFile": book["sourceFile"], "page": number,
                                   "text": code.text, "bounds": [left, bottom, right, top], "objects": matches}
                            report["codes" if matches else "unresolved"].append(row)
                    report["pagesScanned"] += 1
                    if report["pagesScanned"] % 50 == 0:
                        print(json.dumps({"pagesScanned": report["pagesScanned"], "qrCodes": len(report["codes"]), "unresolved": len(report["unresolved"])}), flush=True)
                        args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pagesScanned": report["pagesScanned"], "qrCodes": len(report["codes"]), "unresolved": len(report["unresolved"])}), flush=True)


if __name__ == "__main__":
    main()
