from __future__ import annotations

import json
import re
from pathlib import Path

import pypdfium2 as pdfium

PDF_PATH = Path(r"c:\Users\monup\Downloads\dokumen.pub_gate-wallah-topicwise-pyq-computer-science-amp-it-engineering-1nbsped-9788119192724.pdf")
OUT_PATH = Path(r"c:\Users\monup\gate-test-series\server\data\gate-wallah-cs\preflight.json")


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract(pdf_path: Path) -> dict:
    doc = pdfium.PdfDocument(str(pdf_path))
    pages = []
    for index in range(len(doc)):
        page = doc[index]
        txt = page.get_textpage().get_text_range()
        pages.append({
            "page": index + 1,
            "text": normalize_text(txt),
        })
        page.close()
    doc.close()

    toc = []
    for item in pages[:80]:
        text = item["text"]
        if not text:
            continue
        if re.search(r"Database Design|Operating System|Computer Networks|Compiler Design|Algorithms|Theory of Computation|DBMS|Computer Organization", text, re.I):
            toc.append({"page": item["page"], "snippet": text[:500]})

    look_for = [
        "Database Design and ER Model",
        "Operating System",
        "Computer Networks",
        "Compiler Design",
        "Algorithms",
        "Database Management System",
        "Computer Organization and Architecture",
        "Theory of Computation",
        "Digital Logic",
        "Engineering Mathematics",
        "Data Structures",
    ]
    matches = []
    for item in pages:
        text = item["text"]
        for token in look_for:
            if token.lower() in text.lower():
                matches.append({"page": item["page"], "token": token})
                break

    result = {
        "pdf_exists": pdf_path.exists(),
        "pdf_size_bytes": pdf_path.stat().st_size if pdf_path.exists() else None,
        "page_count": len(pages),
        "subject_markers": matches,
        "toc_samples": toc[:20],
    }
    return result


if __name__ == "__main__":
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result = extract(PDF_PATH)
    OUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "pdf_exists": result["pdf_exists"],
        "page_count": result["page_count"],
        "markers": result["subject_markers"][:10],
    }, indent=2, ensure_ascii=False))
