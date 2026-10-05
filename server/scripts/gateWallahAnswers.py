"""Conservative extraction of Gate Wallah's chapter answer-key tables.

Pages passed to ``extract_answer_table`` are one-based and inclusive.  Returned
bounding boxes are [left, top, right, bottom], in PDF points with a top origin.
Only the compact four-column answer table is authoritative; the later solution
headings must never overwrite its answers.  Unsupported answers return no
grading fields so that the importer can retain the question as a review draft.
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterable
from typing import Any


_DASHES = str.maketrans({"\u2212": "-", "\u2013": "-", "\u2014": "-", "\u2010": "-", "\u2011": "-"})
_NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)"
_SINGLE_NUMBER = re.compile(rf"^{_NUMBER}$")
_RANGE = re.compile(rf"^({_NUMBER})\s*(?:to|-)\s*({_NUMBER})$", re.IGNORECASE)
_ENTRY = re.compile(r"(?<![\w.])(\d{1,3})\.\s*\(([^()]{1,90})\)")


def _clean_answer(value: Any) -> str:
    if value is None:
        return ""
    value = re.sub(r"\s+", " ", str(value).translate(_DASHES)).strip()
    if value.startswith("(") and value.endswith(")"):
        value = value[1:-1].strip()
    return value


def parse_answer(value: Any, question_type: str) -> tuple[dict, list[str]]:
    """Return database grading fields and review reasons, failing closed.

    MCQ answers use zero-based option indices; MSQ answers use sorted lists of
    those indices.  NAT supports exact values and closed ranges, including
    signed decimals.  Disjoint ranges, alternative MSQ sets and "Marks to All"
    cannot be represented by the current grading schema and require review.
    """
    answer = _clean_answer(value)
    kind = str(question_type).strip().lower()
    if not answer:
        return {}, ["Answer key is missing."]
    if kind not in {"mcq", "msq", "nat"}:
        return {}, [f"Unsupported question type: {question_type}."]
    if re.search(r"\bor\b", answer, re.IGNORECASE):
        return {}, ["Answer key contains alternative answers or disjoint ranges; manual review is required."]
    if re.search(r"marks?\s+to\s+all|bonus|cancelled|canceled", answer, re.IGNORECASE):
        return {}, ["Source awards marks to all or cancels the question; manual review is required."]

    if kind == "mcq":
        if re.fullmatch(r"[a-d]", answer, re.IGNORECASE):
            return {"correctAnswer": ord(answer.lower()) - ord("a")}, []
        return {}, ["MCQ answer key is not one unambiguous option from A to D."]

    if kind == "msq":
        # Recognize explicit sets only, never extract letters from prose.
        letters = answer.lower()
        if not re.fullmatch(r"[a-d](?:(?:\s*,\s*|\s+|\s*&\s*|\s+and\s+)[a-d])*", letters):
            return {}, ["MSQ answer key is not an unambiguous set of options from A to D."]
        choices = re.findall(r"(?<![a-z])[a-d](?![a-z])", letters)
        if len(choices) != len(set(choices)):
            return {}, ["MSQ answer key repeats an option; manual review is required."]
        return {"correctAnswer": sorted(ord(choice) - ord("a") for choice in choices)}, []

    # The PDF sometimes inserts a space between a minus glyph and its number.
    numeric = re.sub(r"([+-])\s+(?=\d|\.)", r"\1", answer)
    match = _RANGE.fullmatch(numeric)
    if match:
        minimum, maximum = map(float, match.groups())
    elif _SINGLE_NUMBER.fullmatch(numeric):
        minimum = maximum = float(numeric)
    else:
        return {}, ["NAT answer key is not one numeric value or one closed numeric range."]
    if not math.isfinite(minimum) or not math.isfinite(maximum):
        return {}, ["NAT answer key contains a non-finite value."]
    if minimum > maximum:
        return {}, ["NAT answer range is reversed; manual review is required."]
    midpoint = minimum / 2 + maximum / 2
    return {"correctAnswer": midpoint, "natAnswerMin": minimum, "natAnswerMax": maximum}, []


def _text_box(textpage: Any, text: str, start: int, end: int, height: float) -> list[float]:
    """Map PDFium's extracted-text indices to its internal character indices."""
    import pypdfium2.raw as pdfium_c

    boxes = []
    for index in range(start, end):
        if text[index].isspace():
            continue
        char_index = pdfium_c.FPDFText_GetCharIndexFromTextIndex(textpage, index)
        if char_index < 0:
            continue
        left, bottom, right, top = textpage.get_charbox(char_index)
        if right > left and top > bottom:
            boxes.append((left, height - top, right, height - bottom))
    if not boxes:
        raise ValueError("Answer entry has no positioned glyphs")
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]


def _page_entries(doc: Any, page_number: int) -> list[dict]:
    page = doc[page_number - 1]
    textpage = page.get_textpage()
    try:
        text = textpage.get_text_range()
        height = page.get_height()
        entries = []
        for match in _ENTRY.finditer(text):
            try:
                anchor = _text_box(textpage, text, match.start(1), match.end(1), height)
                bbox = _text_box(textpage, text, match.start(), match.end(), height)
            except ValueError:
                continue
            entries.append({
                "number": int(match[1]),
                "raw": re.sub(r"\s+", " ", match[2]).strip(),
                "page": page_number,
                "bbox": [round(value, 3) for value in bbox],
                "anchor": anchor,
                "textOffset": match.start(),
            })
        return entries
    finally:
        textpage.close()
        page.close()


def _rows(entries: list[dict]) -> list[list[dict]]:
    """Group key markers geometrically, independently of PDF reading order."""
    rows: list[list[dict]] = []
    for entry in sorted(entries, key=lambda value: (value["anchor"][1], value["anchor"][0])):
        if rows and abs(entry["anchor"][1] - rows[-1][0]["anchor"][1]) <= 3:
            rows[-1].append(entry)
        else:
            rows.append([entry])
    for row in rows:
        row.sort(key=lambda value: value["anchor"][0])
    return rows


def _select_table(page_rows: list[tuple[int, list[list[dict]]]], expected: set[int]) -> tuple[dict[int, dict], list[dict]]:
    """Select one compact table, stopping before the numbered solutions."""
    answers: dict[int, dict] = {}
    issues: list[dict] = []
    first_row = None
    first_location = None
    for page_position, (page_number, rows) in enumerate(page_rows):
        for row_position, row in enumerate(rows):
            numbers = [entry["number"] for entry in row]
            # Every chapter in this edition has at least three questions. Its
            # key begins 1,2,3[,4] across the page. Two solution columns cannot
            # accidentally satisfy this seed condition.
            if len(row) in {3, 4} and numbers == list(range(1, len(row) + 1)):
                if row[-1]["anchor"][0] - row[0]["anchor"][0] < 150:
                    continue
                first_row = row
                first_location = page_position, row_position
                break
        if first_row is not None:
            break

    if first_row is None:
        return {}, [{"code": "answer_table_not_found", "message": "No compact chapter answer table beginning with questions 1, 2 and 3 was found."},
                    {"code": "missing_answer_keys", "numbers": sorted(expected)}]

    columns = [entry["anchor"][0] for entry in first_row]
    last_number = 0
    last_top = None
    last_page = None
    finished = False
    start_page_position, start_row_position = first_location
    for page_position in range(start_page_position, len(page_rows)):
        page_number, rows = page_rows[page_position]
        if last_page is not None and page_number > last_page + 1:
            break
        row_offset = start_row_position if page_position == start_page_position else 0
        for row in rows[row_offset:]:
            numbers = [entry["number"] for entry in row]
            top = row[0]["anchor"][1]
            # Adjacent table rows use a 16.3 pt pitch. A wrapped key can use a
            # taller row, but solution headings sit well outside this region.
            if last_page == page_number and last_top is not None and top - last_top > 40:
                finished = True
                break
            if last_page != page_number and last_page is not None and top > 150:
                finished = True
                break
            if (len(row) > len(columns)
                    or numbers != list(range(last_number + 1, last_number + len(row) + 1))
                    or any(abs(entry["anchor"][0] - columns[index]) > 12 for index, entry in enumerate(row))
                    or any(entry["bbox"][3] - entry["bbox"][1] > 35 for entry in row)):
                finished = True
                break
            for entry in row:
                number = entry["number"]
                answers[number] = {key: entry[key] for key in ("raw", "page", "bbox")}
                last_number = number
            last_top, last_page = top, page_number
        if finished:
            break

    missing = sorted(expected - answers.keys())
    unexpected = sorted(answers.keys() - expected)
    if missing:
        issues.append({"code": "missing_answer_keys", "numbers": missing})
    if unexpected:
        issues.append({"code": "unexpected_answer_keys", "numbers": unexpected})
    return answers, issues


def extract_answer_table(doc: Any, start_page: int, end_page: int, expected_numbers: Iterable[int]) -> tuple[dict[int, dict], list[dict]]:
    """Return ``({number: {raw, page, bbox}}, issues)`` for one chapter.

    The caller owns the PDFium document. The function opens and closes its own
    page/text-page handles. Missing or unexpected question numbers are reported;
    repeated answer headings in solutions are deliberately never used as a
    fallback. Call :func:`parse_answer` with each question's actual type before
    using any returned key for grading.
    """
    if not 1 <= start_page <= end_page <= len(doc):
        raise ValueError("Page range must be one-based, inclusive, and inside the PDF")
    expected = {int(number) for number in expected_numbers}
    if any(number < 1 for number in expected):
        raise ValueError("Question numbers must be positive")
    page_rows = [(page, _rows(_page_entries(doc, page))) for page in range(start_page, end_page + 1)]
    return _select_table(page_rows, expected)
