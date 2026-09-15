#!/usr/bin/env python3
"""Extract GATE General Aptitude PYQs and answer keys from the booklet PDF."""

from __future__ import annotations

import bisect
import json
import re
import sys
import unicodedata
from pathlib import Path

from pypdf import PdfReader


YEARS = [2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010]
QUESTION_RE = re.compile(r"(?:\b[A-Z]{1,3}\s+)?\[[^\]]*GATE[^\]]*\]\s*(\d{1,3})\.\s*", re.I)
OPTION_RE = re.compile(r"(?<!\w)\(([A-D])\)\s*", re.I)
ANSWER_TOKEN_RE = re.compile(r"MTA|\*|[A-D]+|[-+]?\d+(?:\.\d+)?", re.I)
NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")


def clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("\u00a0", " ")
    value = re.sub(r"(?:GENERAL APTITUDE QUESTIONS\s+)?Page\s+\d+\s+TARGATE EDUCATION\s+GATE-\S+", " ", value, flags=re.I)
    value = re.sub(r"GATE-\d{4}\s+PAPERS\s+www\.targate\.org\s+Page\s+\d+", " ", value, flags=re.I)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def page_for_offset(offsets: list[tuple[int, int, int]], offset: int) -> int:
    starts = [item[0] for item in offsets]
    position = bisect.bisect_right(starts, offset) - 1
    return offsets[max(position, 0)][2]


def find_year_sections(page_texts: list[str]) -> dict[int, tuple[int, int]]:
    starts: dict[int, int] = {}
    for year in YEARS:
        pattern = re.compile(rf"\bGATE\s+{year}\b", re.I)
        for index, text in enumerate(page_texts):
            if pattern.search(text) and "[GATE" in text and re.search(r"\d+\.\s", text):
                starts[year] = index
                break

    ordered = sorted(starts.items(), key=lambda item: item[1])
    sections: dict[int, tuple[int, int]] = {}
    for position, (year, start) in enumerate(ordered):
        end = ordered[position + 1][1] if position + 1 < len(ordered) else len(page_texts)
        sections[year] = (start, end)
    missing = [year for year in YEARS if year not in sections]
    if missing:
        raise RuntimeError(f"Could not locate question sections for: {missing}")
    return sections


def parse_answer_key(
    page_texts: list[str], answer_page_index: int, section_end: int, question_count: int
) -> dict[int, str]:
    lines = "\n".join(page_texts[answer_page_index:section_end]).splitlines()
    answers: dict[int, str] = {}

    for index, line in enumerate(lines):
        question_numbers = re.findall(r"(?<!\w)(\d{1,3})\.\s*", line)
        if len(question_numbers) >= 5:
            next_index = index + 1
            while next_index < len(lines) and not lines[next_index].strip():
                next_index += 1
            if next_index >= len(lines):
                continue
            tokens = [token.upper() for token in ANSWER_TOKEN_RE.findall(lines[next_index])]
            if len(tokens) == len(question_numbers):
                for number, token in zip(question_numbers, tokens):
                    answers[int(number)] = token

        single = re.match(r"^\s*(\d{1,3})\.\s*(.+?)\s*$", line)
        if not single:
            continue
        number = int(single.group(1))
        value = clean_text(single.group(2))
        if number > question_count:
            continue
        if value.upper() in {"MTA", "*"}:
            answers[number] = value.upper()
            continue
        if re.fullmatch(r"[-+]?\d+(?:\.\d+)?(?:\s+TO\s+[-+]?\d+(?:\.\d+)?)?", value, re.I):
            answers[number] = value

    return answers


def parse_options(block: str) -> tuple[str, list[str]]:
    block = re.sub(r"\s+(?:[A-Z]{1,3})\s*$", "", block)
    matches = list(OPTION_RE.finditer(block))
    for start_index in range(max(0, len(matches) - 3)):
        group = matches[start_index : start_index + 4]
        labels = [match.group(1).upper() for match in group]
        if labels != ["A", "B", "C", "D"]:
            continue
        question = clean_text(block[: group[0].start()])
        options = []
        for position, match in enumerate(group):
            end = group[position + 1].start() if position + 1 < len(group) else len(block)
            options.append(clean_text(block[match.end() : end]))
        return question, options
    return clean_text(block), []


def answer_metadata(raw_answer: str | None, options: list[str]) -> dict:
    if not raw_answer:
        return {"questionType": "mcq" if options else "nat", "requiresReview": True}

    answer = raw_answer.strip().upper()
    if re.fullmatch(r"[A-D]+", answer):
        indexes = [ord(letter) - ord("A") for letter in answer]
        if len(indexes) > 1:
            return {
                "questionType": "msq",
                "correctAnswer": indexes,
                "requiresReview": not bool(options),
            }
        return {
            "questionType": "mcq",
            "correctAnswer": indexes[0],
            "requiresReview": not bool(options),
        }

    if answer in {"*", "MTA"}:
        return {"questionType": "mcq" if options else "nat", "requiresReview": True}

    range_match = re.fullmatch(
        r"([-+]?\d+(?:\.\d+)?)\s+TO\s+([-+]?\d+(?:\.\d+)?)", answer, re.I
    )
    if range_match:
        return {
            "questionType": "nat",
            "natAnswerMin": float(range_match.group(1)),
            "natAnswerMax": float(range_match.group(2)),
            "requiresReview": not options,
        }

    if NUMBER_RE.fullmatch(answer):
        numeric = float(answer)
        if numeric.is_integer():
            numeric = int(numeric)
        return {"questionType": "nat", "correctAnswer": numeric, "requiresReview": bool(options)}

    return {"questionType": "mcq" if options else "nat", "requiresReview": True}


def extract(pdf_path: Path) -> dict:
    reader = PdfReader(str(pdf_path))
    page_texts = [(page.extract_text() or "") for page in reader.pages]
    sections = find_year_sections(page_texts)
    years: list[dict] = []

    for year in YEARS:
        section_start, section_end = sections[year]
        section_pages = page_texts[section_start:section_end]
        answer_relative = next(
            (index for index, text in enumerate(section_pages) if re.search(r"\bAnswer\s*:", text, re.I)),
            None,
        )
        if answer_relative is None:
            raise RuntimeError(f"Could not locate answer key for {year}")

        question_pages = section_pages[:answer_relative]
        answer_page_index = section_start + answer_relative
        parts: list[str] = []
        offsets: list[tuple[int, int, int]] = []
        cursor = 0
        for relative_page, text in enumerate(question_pages):
            page_number = section_start + relative_page + 1
            parts.append(text)
            offsets.append((cursor, cursor + len(text), page_number))
            cursor += len(text)
            parts.append("\n\n")
            cursor += 2

        joined = "".join(parts)
        matches = list(QUESTION_RE.finditer(joined))
        answers = parse_answer_key(page_texts, answer_page_index, section_end, len(matches))
        questions: list[dict] = []

        for position, match in enumerate(matches):
            question_number = int(match.group(1))
            block_end = matches[position + 1].start() if position + 1 < len(matches) else len(joined)
            question_text, options = parse_options(joined[match.end() : block_end])
            raw_answer = answers.get(question_number)
            metadata = answer_metadata(raw_answer, options)
            source_page = page_for_offset(offsets, match.start())
            lower_text = question_text.lower()
            figure_hint = any(word in lower_text for word in ("figure", "graph", "plot", "table", "diagram"))
            if metadata["questionType"] in {"mcq", "msq"} and len(options) < 2:
                metadata["requiresReview"] = True
            if metadata["questionType"] == "nat" and options:
                metadata["requiresReview"] = True
            if figure_hint:
                metadata["requiresReview"] = True

            question = {
                "year": year,
                "questionNumber": question_number,
                "questionText": question_text,
                "options": options,
                "sourcePage": source_page,
                "sourceMarker": re.search(r"\[[^\]]*GATE[^\]]*\]", match.group(0), re.I).group(0),
                "rawAnswer": raw_answer,
                "tags": [
                    "PYQ",
                    "General Aptitude",
                    "TARGATE Education",
                    f"source-page:{source_page}",
                ],
                **metadata,
            }
            questions.append(question)

        years.append(
            {
                "year": year,
                "questionCount": len(questions),
                "answerCount": len(answers),
                "questions": questions,
            }
        )

    return {
        "sourceName": "General Aptitude Booklet (92 Pages) - TARGATE EDUCATION",
        "sourceFile": pdf_path.name,
        "permissionNote": "Imported from the user-provided publication with permission asserted by the user.",
        "subjectName": "General Aptitude",
        "years": years,
    }


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("Usage: extractAptitudePdf.py <input.pdf> [output.json]")
    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    output_path = Path(sys.argv[2]).expanduser().resolve() if len(sys.argv) == 3 else Path("general-aptitude-pyq.json").resolve()
    payload = extract(pdf_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    total = sum(year["questionCount"] for year in payload["years"])
    review = sum(
        1
        for year in payload["years"]
        for question in year["questions"]
        if question.get("requiresReview")
    )
    print(f"Extracted {total} questions across {len(payload['years'])} years")
    print(f"Questions requiring admin review: {review}")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
