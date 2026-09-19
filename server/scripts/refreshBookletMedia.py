"""Re-render existing question crops, preserving source identities and geometry.

By default, write clean previews to --output-dir. With --apply, replace local
media after backing up changed originals under that output directory. Original
PDFs and question/answer datasets are never modified.
"""

import argparse
import hashlib
import io
import json
import re
from contextlib import closing
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image

from bookletArtwork import omit_booklet_extras


MEDIA_PATH = re.compile(r"/question-media/([a-z0-9-]+/[a-f0-9-]+\.webp)")
SCALE = 2.5


def load_books(inputs, pdf_dir, media_dir):
    books = []
    seen = set()
    for filename in inputs:
        payload = json.loads(filename.read_text(encoding="utf-8"))
        if payload.get("version") != 1 or not payload.get("books"):
            raise ValueError(f"Unsupported booklet dataset: {filename}")
        for book in payload["books"]:
            if book["slug"] in seen:
                raise ValueError(f"Duplicate booklet: {book['slug']}")
            seen.add(book["slug"])
            pdf = pdf_dir / book["sourceFile"]
            if pdf.parent.resolve() != pdf_dir.resolve():
                raise ValueError("Source PDF must be inside --pdf-dir.")
            if hashlib.sha256(pdf.read_bytes()).hexdigest() != book["sourceSha256"]:
                raise ValueError(f"Source PDF has changed: {pdf.name}")
            with pdfium.PdfDocument(str(pdf)) as doc:
                for question in book["questions"]:
                    images = question["questionImages"]
                    segments = question["segments"]
                    if not images or len(images) != len(segments):
                        raise ValueError(f"Crop/image mismatch: {question['sourceId']}")
                    for segment, image in zip(segments, images):
                        match = MEDIA_PATH.fullmatch(image["url"])
                        if not match or match[1].split("/")[0] != book["slug"]:
                            raise ValueError("Invalid question media path.")
                        if not 1 <= segment["page"] <= len(doc):
                            raise ValueError("Invalid source page.")
                        left, top, right, bottom = [round(v * SCALE) for v in segment["box"]]
                        size = (right - left, bottom - top)
                        if min(size) <= 0 or size != (image["width"], image["height"]):
                            raise ValueError("Crop dimensions have changed.")
                        with Image.open(media_dir / match[1]) as existing:
                            if existing.format != "WEBP" or existing.size != size:
                                raise ValueError(f"Existing media does not match: {match[1]}")
            books.append(book)
    return books


def refresh_book(book, pdf_dir, media_dir, output_dir, apply, qr_only=False):
    jobs = {}
    for question in book["questions"]:
        for segment, image in zip(question["segments"], question["questionImages"]):
            jobs.setdefault(segment["page"], []).append((segment, image))
    report = {"subject": book["subjectName"], "questions": len(book["questions"]),
              "imagesChecked": 0, "imagesChanged": 0, "logoObjectsOmitted": 0, "qrObjectsOmitted": 0, "pages": []}
    with pdfium.PdfDocument(str(pdf_dir / book["sourceFile"])) as doc:
        for number, page_jobs in sorted(jobs.items()):
            with closing(doc[number - 1]) as page:
                omitted = omit_booklet_extras(page)
                logos = sum(item["kind"] == "logo" for item in omitted)
                qr_codes = sum(item["kind"] == "qr" for item in omitted)
                report["logoObjectsOmitted"] += logos
                report["qrObjectsOmitted"] += qr_codes
                report["imagesChecked"] += len(page_jobs)
                if not omitted or (qr_only and not qr_codes):
                    continue
                report["pages"].append({"page": number, "logoObjects": logos, "qrObjects": qr_codes, "omitted": omitted})
                with closing(page.render(scale=SCALE)) as bitmap:
                    with bitmap.to_pil() as full:
                        for segment, image in page_jobs:
                            key = MEDIA_PATH.fullmatch(image["url"])[1]
                            original = media_dir / key
                            with full.crop(tuple(round(v * SCALE) for v in segment["box"])) as cropped:
                                with Image.open(original) as existing:
                                    if existing.convert("RGB").tobytes() == cropped.convert("RGB").tobytes():
                                        continue
                                output = io.BytesIO()
                                cropped.save(output, format="WEBP", lossless=True)
                            data = output.getvalue()
                            backup = output_dir / "originals" / key
                            if apply:
                                backup.parent.mkdir(parents=True, exist_ok=True)
                                # Never overwrite a backup from an earlier run.
                                if not backup.exists():
                                    backup.write_bytes(original.read_bytes())
                                destination = original
                            else:
                                destination = output_dir / "preview" / key
                            destination.parent.mkdir(parents=True, exist_ok=True)
                            temporary = destination.with_suffix(".webp.tmp")
                            temporary.write_bytes(data)
                            temporary.replace(destination)
                            report["imagesChanged"] += 1
            if number % 25 == 0:
                print(f"{book['slug']}: page {number}, {report['imagesChanged']} changed images", flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, action="append", required=True)
    parser.add_argument("--pdf-dir", type=Path, required=True)
    parser.add_argument("--media-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data/question-media")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--qr-only", action="store_true", help="Only re-export pages with identified QR badges; still omit their logos.")
    args = parser.parse_args()
    books = load_books(args.input, args.pdf_dir, args.media_dir)
    print(f"Validated source checksums and crop dimensions for {len(books)} booklets.", flush=True)
    report = {"mode": "apply" if args.apply else "preview", "books": []}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for book in books:
        entry = refresh_book(book, args.pdf_dir, args.media_dir, args.output_dir, args.apply, args.qr_only)
        report["books"].append(entry)
        print(json.dumps({key: value for key, value in entry.items() if key != "pages"}), flush=True)
        (args.output_dir / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
