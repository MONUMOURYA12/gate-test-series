"""Answer-key grading and table-boundary regression checks.

Run: python -m unittest discover -s server/tests -p gate_wallah_answers_test.py
Optional full-book check: set GATE_WALLAH_PDF to the supplied PDF path.
"""

import importlib.util
import os
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "gateWallahAnswers.py"
SPEC = importlib.util.spec_from_file_location("gate_wallah_answers", SCRIPT)
answers = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(answers)


def entry(number, raw, left, top, page=1):
    box = [left, top, left + 40, top + 10]
    return {"number": number, "raw": raw, "page": page, "bbox": box, "anchor": box}


def row(start, count=4, top=100, page=1, raw="a"):
    return [entry(start + index, raw, 45 + 135 * index, top, page) for index in range(count)]


class ParseAnswerTests(unittest.TestCase):
    def test_mcq_and_msq_use_zero_based_option_indices(self):
        self.assertEqual(answers.parse_answer("(D)", "mcq"), ({"correctAnswer": 3}, []))
        self.assertEqual(answers.parse_answer("c, a, d", "MSQ"), ({"correctAnswer": [0, 2, 3]}, []))
        self.assertEqual(answers.parse_answer("b", "msq"), ({"correctAnswer": [1]}, []))

    def test_nat_closed_ranges_and_signed_values(self):
        cases = [("19 to 19", 19, 19), (".5 - 0.7", .5, .7),
                 ("-5--1", -5, -1), ("\u2013 11 to \u201311", -11, -11),
                 ("\u22121", -1, -1), ("-0.7 to +.5", -.7, .5), ("0", 0, 0)]
        for raw, minimum, maximum in cases:
            with self.subTest(raw=raw):
                fields, reasons = answers.parse_answer(raw, "nat")
                self.assertEqual(reasons, [])
                self.assertEqual(fields["natAnswerMin"], minimum)
                self.assertEqual(fields["natAnswerMax"], maximum)
                self.assertAlmostEqual(fields["correctAnswer"], (minimum + maximum) / 2)

    def test_unrepresentable_or_ambiguous_answers_have_no_grading_fields(self):
        for raw, kind in [("a, c, d or c, d", "msq"), ("819 to 820 or 205 to 205", "nat"),
                          ("Marks to All", "mcq"), ("d, d", "msq"), ("a,c", "mcq"),
                          ("5 to 4", "nat"), ("5 +/- 1", "nat"), ("5/2", "nat"),
                          ("25 percent", "nat"), ("nan", "nat"), ("\ufffd5", "nat"),
                          ("", "mcq"), (None, "nat"), ("a or b", "mcq"),
                          ("abc", "msq"), ("a,", "msq"), ("(a) explanation", "mcq")]:
            with self.subTest(raw=raw, kind=kind):
                fields, reasons = answers.parse_answer(raw, kind)
                self.assertEqual(fields, {})
                self.assertTrue(reasons)


class TableBoundaryTests(unittest.TestCase):
    def test_solution_headings_do_not_overwrite_key(self):
        rows = [row(1), row(5, count=2, top=116),
                [entry(1, "d", 36, 220), entry(4, "c", 320, 220)]]
        mapping, issues = answers._select_table([(1, rows)], set(range(1, 7)))
        self.assertEqual(issues, [])
        self.assertEqual(mapping[1]["raw"], "a")
        self.assertEqual(list(mapping), list(range(1, 7)))

    def test_one_entry_final_row_is_retained(self):
        mapping, issues = answers._select_table([(1, [row(1), row(5, count=1, top=116)])], set(range(1, 6)))
        self.assertEqual(issues, [])
        self.assertIn(5, mapping)

    def test_table_continues_across_page_boundary(self):
        page_one = [row(1, top=680), row(5, top=696)]
        page_two = [row(9, top=75, page=2), row(13, count=2, top=91, page=2),
                    [entry(1, "c", 36, 180, 2)]]
        mapping, issues = answers._select_table([(1, page_one), (2, page_two)], set(range(1, 15)))
        self.assertEqual(issues, [])
        self.assertEqual(mapping[14]["page"], 2)

    def test_stops_on_a_missing_key_instead_of_shifting_answers(self):
        incomplete = row(5, top=116)
        incomplete[1]["number"] = 7
        mapping, issues = answers._select_table([(1, [row(1), incomplete])], set(range(1, 9)))
        self.assertEqual(list(mapping), [1, 2, 3, 4])
        self.assertEqual(issues, [{"code": "missing_answer_keys", "numbers": [5, 6, 7, 8]}])

    def test_two_solution_columns_are_not_a_table(self):
        mapping, issues = answers._select_table([(1, [[entry(1, "a", 36, 100), entry(2, "b", 320, 100)]])], {1, 2})
        self.assertEqual(mapping, {})
        self.assertEqual(issues[0]["code"], "answer_table_not_found")


@unittest.skipUnless(os.environ.get("GATE_WALLAH_PDF"), "Set GATE_WALLAH_PDF to run the source-PDF regression checks")
class SourcePdfTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import pypdfium2
        cls.doc = pypdfium2.PdfDocument(os.environ["GATE_WALLAH_PDF"])

    @classmethod
    def tearDownClass(cls):
        cls.doc.close()

    def test_first_chapter_and_solution_boundary(self):
        mapping, issues = answers.extract_answer_table(self.doc, 11, 17, range(1, 15))
        self.assertEqual(issues, [])
        self.assertEqual(len(mapping), 14)
        self.assertEqual(mapping[2]["raw"], "19 to 19")
        self.assertEqual(mapping[1]["page"], 14)

    def test_split_key_table(self):
        mapping, issues = answers.extract_answer_table(self.doc, 230, 256, range(1, 48))
        self.assertEqual(issues, [])
        self.assertEqual(len(mapping), 47)
        self.assertEqual(mapping[20]["page"], 236)
        self.assertEqual(mapping[21]["page"], 237)

    def test_excluded_pdfium_characters_do_not_shift_geometry(self):
        mapping, issues = answers.extract_answer_table(self.doc, 438, 448, range(1, 22))
        self.assertEqual(issues, [])
        self.assertEqual(mapping[1]["raw"], "c")
        self.assertTrue(all(0 <= value["bbox"][1] < value["bbox"][3] < 792 for value in mapping.values()))


if __name__ == "__main__":
    unittest.main()
