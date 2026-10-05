"""Checksum-bound bilingual question extraction for the supplied 248-page book.

Requires pypdfium2 and Pillow. Questions are rendered from the source, preserving
Hindi glyphs, fractions and diagrams. Printed answer keys are parsed separately
and are never included in student artwork. No OCR-generated answers are used.
"""
import argparse
import ctypes
import hashlib
import json
import math
import re
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw

SOURCE_SHA = '31109702672d5ad8a88bd70e7c734ba66243fd95303e6d9b83d70d0b39eca37a'
SLUG = 'railway-maths-2026'
SCALE = 2.5
# Printed first question page, answer-key page and question total, from the index.
CHAPTERS = [
    ('Percentage', 1, 10, 109), ('Profit and Loss', 17, 24, 79),
    ('Discount', 30, 37, 79), ('Simple Interest', 42, 44, 27),
    ('Compound Interest', 46, 48, 26), ('Ratio and Proportion', 51, 58, 90),
    ('Age', 64, 67, 38), ('Partnership', 71, 74, 31),
    ('Mixture and Alligation', 77, 77, 5), ('Average', 79, 85, 72),
    ('Time and Work', 90, 94, 54), ('Pipes and Cisterns', 99, 103, 36),
    ('Time and Distance', 108, 112, 45), ('Trains', 116, 118, 28),
    ('Race and Circular Motion', 121, 121, 4), ('Boats and Streams', 122, 122, 5),
    ('Number System', 123, 127, 62), ('LCM and HCF', 131, 134, 40),
    ('Simplification', 137, 145, 120), ('Algebra', 152, 156, 51),
    ('Trigonometry', 160, 164, 50), ('Heights and Distances', 168, 169, 12),
    ('Geometry', 171, 177, 61), ('Coordinate Geometry', 183, 183, 5),
    ('Mensuration 2D', 185, 190, 64), ('Mensuration 3D', 196, 206, 112),
    ('Statistics', 215, 219, 55), ('Probability', 225, 226, 8),
    ('Data Interpretation', 227, 233, 36),
]
COLUMNS = [(42, 308), (314, 579)]


def page_words(page):
    textpage = page.get_textpage()
    try:
        text = textpage.get_text_range()
        if len(text) != textpage.count_chars():
            raise ValueError('Unexpected source character mapping.')
        words = []
        for match in re.finditer(r'\S+', text):
            boxes = [textpage.get_charbox(i) for i in range(match.start(), match.end())]
            channels = [ctypes.c_uint() for _ in range(4)]
            pdfium.raw.FPDFText_GetFillColor(textpage, match.start(), *(ctypes.byref(c) for c in channels))
            red, green, blue, _ = [c.value for c in channels]
            words.append(dict(text=match.group(), x0=min(b[0] for b in boxes), x1=max(b[2] for b in boxes),
                              top=page.get_height()-max(b[3] for b in boxes), bottom=page.get_height()-min(b[1] for b in boxes),
                              red=red > 150 and green < 90 and blue < 90))
        return words
    finally:
        textpage.close()


def parse_key(words, count):
    heading = [w for w in words if w['text'] == 'ANSWER']
    solutions = [w for w in words if w['text'] == 'SOLUTIONS']
    if len(heading) != 1 or len(solutions) > 1:
        raise ValueError('Missing or ambiguous answer/solution heading.')
    solution_top = solutions[0]['top'] if solutions else 755
    rows = []
    for word in sorted((w for w in words if heading[0]['bottom'] < w['top'] < solution_top-5), key=lambda w: w['top']):
        row = next((r for r in rows if abs(r[0]['top']-word['top']) < 2), None)
        if row is None:
            rows.append([word])
        else:
            row.append(word)
    keys = {}
    for row in rows:
        text = ' '.join(w['text'] for w in sorted(row, key=lambda w: w['x0']))
        for number, answer in re.findall(r'(\d+)\.\s*\(([a-d])\)', text):
            number = int(number)
            if number in keys:
                raise ValueError('Duplicate answer-key entry.')
            keys[number] = answer
    if set(keys) != set(range(1, count+1)):
        raise ValueError(f'Answer-key coverage mismatch: missing {sorted(set(range(1,count+1))-keys.keys())}')
    return keys, heading[0]['top']-5


def extract(pdf_path, output, media_dir, geometry_cache=None, render=True):
    if hashlib.sha256(pdf_path.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError('This extractor only supports the reviewed source PDF checksum.')
    doc = pdfium.PdfDocument(str(pdf_path))
    if len(doc) != 248:
        raise ValueError('Unexpected source page count.')
    needed = {pn for _, start, end, _ in CHAPTERS for pn in range(start+11, end+12)}
    geometry = {p['page']: p['words'] for p in json.loads(geometry_cache.read_text(encoding='utf-8'))} if geometry_cache else {}
    for pn in sorted(needed):
        if pn not in geometry:
            page = doc[pn-1]
            geometry[pn] = page_words(page)
            page.close()
    output.parent.mkdir(parents=True, exist_ok=True)
    (media_dir/SLUG).mkdir(parents=True, exist_ok=True)
    chapters = []
    all_questions = []
    for chapter_index, (name, start, end, count) in enumerate(CHAPTERS, 1):
        start += 11
        end += 11
        keys, cutoff = parse_key(geometry[end], count)
        columns = []
        nodes = []
        for pn in range(start, end+1):
            top = 135 if pn == start else 35
            bottom = min(750, cutoff) if pn == end else 750
            if bottom <= top:
                continue
            for col, (left, right) in enumerate(COLUMNS):
                words = [w for w in geometry[pn] if left-1 <= w['x0'] < right and top <= w['top'] < bottom]
                ci = len(columns)
                columns.append(dict(page=pn, column=col, top=top, bottom=bottom, words=words))
                for word in words:
                    # Source page 153 prints question 72 without the trailing dot.
                    numbered = re.fullmatch(r'\d+\.', word['text']) or (pn == 153 and col == 0 and word['text'] == '72')
                    if numbered and left <= word['x0'] <= left+5:
                        # Hindi fractions/superscripts can rise above the number.
                        # Red source text identifies that first line without pulling
                        # in the previous question's black answer choices.
                        prior_choices = [w['bottom'] for w in words if re.fullmatch(r'\(?[a-d]\)', w['text'].lower())
                                         and word['top']-35 < w['top'] < word['top']-2]
                        floor = max(prior_choices, default=word['top']-21)
                        raised = [w['top'] for w in words if w.get('red') and max(word['top']-20, floor+3) <= w['top'] <= word['top']+2]
                        boundary = min([word['top'], *raised])-3
                        nodes.append(dict(number=int(word['text'].rstrip('.')), ci=ci, top=boundary))
        nodes.sort(key=lambda n: (n['ci'], n['top']))
        actual = [n['number'] for n in nodes]
        if actual != list(range(1, count+1)):
            raise ValueError(f'{name}: question sequence mismatch: {actual}')
        chapter_questions = []
        rendered_pages = {}
        for index, node in enumerate(nodes):
            following = nodes[index+1] if index+1 < len(nodes) else dict(ci=len(columns)-1, top=columns[-1]['bottom'])
            segments = []
            question_words = []
            for ci in range(node['ci'], following['ci']+1):
                column = columns[ci]
                top = max(column['top'], node['top']) if ci == node['ci'] else column['top']
                bottom = following['top'] if ci == following['ci'] else column['bottom']
                words = [w for w in column['words'] if top <= w['top'] < bottom]
                if bottom-top < 2 or not words:
                    continue
                # Skip empty continuation space, while preserving diagrams/tables
                # between text blocks and the printed options at the end.
                bottom = min(bottom, max(w['bottom'] for w in words)+3)
                left, right = COLUMNS[column['column']]
                segments.append(dict(page=column['page'], box=[left, top, right, bottom]))
                question_words.extend(words)
            labels = {w['text'].lower().lstrip('(') for w in question_words if re.fullmatch(r'\(?[a-d]\)', w['text'].lower())}
            reasons = []
            # Visually checked source typo: Algebra Q11 labels its fourth option (s).
            label_typo = name == 'Algebra' and node['number'] == 11 and labels == {'a)', 'b)', 'c)'} and any(w['text'] == '(s)' for w in question_words)
            if labels != {'a)', 'b)', 'c)', 'd)'} and not label_typo:
                reasons.append('The four option labels need visual review.')
            source_id = hashlib.sha256(f'{SLUG}:{chapter_index}:{node["number"]}'.encode()).hexdigest()[:24]
            image_key = f'{SLUG}/{source_id}-1.webp'
            q = dict(sourceId=source_id, chapter=name, chapterOrder=chapter_index, sourceQuestionNumber=node['number'],
                     sourcePage=segments[0]['page'], sourceMarker=f'Chapter {chapter_index}, question {node["number"]}',
                     questionText=f'{name} - Question {node["number"]}. Read the bilingual question and options in the image.',
                     questionType='mcq', options=['A', 'B', 'C', 'D (fourth option)' if label_typo else 'D'], correctAnswer=ord(keys[node['number']])-97,
                     sourceAnswer=keys[node['number']], marks=1, requiresReview=bool(reasons), reviewReasons=reasons,
                     segments=segments, questionImages=[])
            if render:
                crops = []
                for segment in segments:
                    pn = segment['page']
                    if pn not in rendered_pages:
                        page = doc[pn-1]
                        rendered_pages[pn] = page.render(scale=SCALE).to_pil().convert('RGB')
                        page.close()
                    box = segment['box']
                    crops.append(rendered_pages[pn].crop((math.floor(box[0]*SCALE), math.floor(box[1]*SCALE), math.ceil(box[2]*SCALE), math.ceil(box[3]*SCALE))))
                joined = Image.new('RGB', (max(c.width for c in crops)+16, sum(c.height for c in crops)+12*(len(crops)+1)), 'white')
                y = 12
                for crop in crops:
                    joined.paste(crop, (8, y))
                    y += crop.height+12
                joined.save(media_dir/image_key, 'WEBP', quality=88, method=4)
                q['questionImages'] = [dict(url=f'/question-media/{image_key}', width=joined.width, height=joined.height, alt=f'{name}, question {node["number"]}, Hindi and English')]
            chapter_questions.append(q)
        chapters.append(dict(name=name, order=chapter_index, totalQuestions=count))
        all_questions.extend(chapter_questions)
        print(json.dumps(dict(chapter=name, questions=count, review=sum(q['requiresReview'] for q in chapter_questions))), flush=True)
    payload = dict(version=1, slug=SLUG, sourceName='Railway Maths Smart Book - Aditya Ranjan, bilingual',
                   sourceSha256=SOURCE_SHA, sourcePages=248, subjectName='Mathematics', chapters=chapters, questions=all_questions)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(total=len(all_questions), review=[dict(chapter=q['chapter'], number=q['sourceQuestionNumber']) for q in all_questions if q['requiresReview']]), ensure_ascii=True))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--media-dir', type=Path, required=True)
    parser.add_argument('--geometry-cache', type=Path)
    parser.add_argument('--inspect-only', action='store_true')
    args = parser.parse_args()
    extract(args.pdf, args.output, args.media_dir, args.geometry_cache, not args.inspect_only)
