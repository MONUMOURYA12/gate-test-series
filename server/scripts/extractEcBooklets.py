"""Extract the supplied TARGATE EC booklets with original question artwork.

Requires pypdfium2 and Pillow. Source PDFs are read locally and never served.
"""

import argparse
import bisect
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import pypdfium2 as pdfium

from bookletArtwork import omit_booklet_extras


BOOKS = [
    ("signals-systems", "Signals and Systems", "Signals and Systems Booklet (124 Pages).pdf", 6, 118,
     [(1, "Continuous Time Signals and Systems"), (26, "Discrete Time Signals and Systems"), (35, "Fourier Series"), (45, "Fourier Transform"), (59, "Laplace Transform"), (75, "Sampling Theorem"), (80, "Z Transform"), (94, "DFS, DTFT, DFT and FFT"), (98, "Random Variables"), (103, "Mixed Signals and Systems")]),
    ("networks", "Network Theory", "Networks Booklet (186 Pages).pdf", 6, 185,
     [(1, "Basic Network Concepts"), (39, "Network Theorems"), (67, "DC Transient Analysis"), (102, "Phasor and Locus Diagrams"), (108, "Laplace Network Analysis"), (111, "AC Transient Analysis"), (114, "Resonance"), (123, "Sinusoidal Steady State"), (133, "Complex Power and RMS"), (140, "Magnetic Circuits"), (143, "Graph Theory"), (146, "Network Functions and Filters"), (154, "Two Port Networks")]),
    ("electronic-devices", "Electronic Devices", "Electronic Devices Booklet (125 Pages).pdf", 4, 124,
     [(3, "Semiconductor Physics"), (45, "PN Junction Theory"), (71, "BJT Construction"), (85, "MOSFETs and MOS Capacitors"), (112, "IC Technology"), (117, "Special Purpose Diodes")]),
    ("engineering-mathematics", "Engineering Mathematics", "Engineering Mathematics Booklet (151 Pages).pdf", 8, 150,
     [(1, "Linear Algebra"), (31, "Calculus"), (73, "Differential Equations"), (92, "Complex Variables"), (103, "Probability and Statistics"), (132, "Numerical Methods")]),
    ("analog-circuits", "Analog Circuits", "Analog Circuits Booklet (172 Pages).pdf", 6, 167,
     [(1, "Operational Amplifiers"), (46, "Diode Circuits"), (80, "Amplifiers"), (119, "Transistor DC Biasing"), (141, "Regulators"), (147, "Oscillators"), (156, "Timers"), (161, "Additional Questions")]),
    ("communications", "Communications", "Communications Booklet (92 Pages).pdf", 4, 91,
     [(3, "Amplitude Modulation"), (23, "Angle Modulation"), (30, "Shift Keying"), (35, "Pulse Code Modulation"), (41, "PAM and PWM"), (43, "Multiplexing"), (47, "Information Theory"), (53, "Delta Modulation"), (55, "Digital Communications"), (68, "GSM, CDMA and BCM"), (74, "Mixed Communications"), (77, "Random Signals and Noise")]),
    ("electromagnetics", "Electromagnetics", "Electromagnetics for EC Booklet (149 Pages).pdf", 6, 139,
     [(1, "Vector Calculus"), (19, "Electric Fields"), (44, "Magnetic Fields"), (53, "Maxwell Equations"), (66, "Plane Waves"), (92, "Transmission Lines"), (115, "Waveguides"), (127, "Antennas")]),
    ("digital-circuits", "Digital Circuits", "Digital Circuits Booklet (149 Pages).pdf", 6, 143,
     [(1, "Number System"), (9, "Boolean Algebra"), (24, "Logic GATES"), (40, "Combinational Digital Circuits"), (59, "Sequential Digital Circuits"), (90, "Semiconductor Memories"), (95, "Logic Gate Families"), (111, "A/D & D/A Converters"), (122, "Microprocessor 8085 Programming & Basics"), (134, "Memories & Interfacing")]),
    ("control-systems", "Control Systems", "Control Systems Booklet (186 Pages).pdf", 8, 185,
     [(1, "Basics of Control System"), (9, "Block Diagram"), (21, "Signal Flow Graph"), (29, "Stability / Routh Hurwitz"), (42, "Time Domain Parameters"), (66, "Steady State Errors"), (74, "Root Locus"), (99, "Bode Plot"), (117, "Nyquist / Polar Plot"), (132, "Phase & Gain Margin"), (142, "Frequency Parameter"), (146, "State Space Analysis"), (163, "Controller / Compensators"), (176, "Modelling")]),
]

TAGGED = re.compile(r"(?P<marker>\[(?:GATE|IES|ESE)[^\[\]\r\n]*(?:\r?\n[A-Za-z][^\[\]\r\n]*)?\]?)\s*(?P<label>\(\d{1,3}\)|\d{1,3}\.)")
LABEL = re.compile(r"(?m)^[ \t]*(?P<label>\(\d{1,3}\)|\d{1,3}\.)(?=\s)")
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)"


def clean(value):
    return re.sub(r"\s+", " ", value).strip()


def answer_fields(prefix):
    value = clean(prefix).replace("\u2013", "-").replace("\u2014", "-").replace("\u2212", "-")
    value = re.sub(r"\bT\d+(?:\.\d+)*,?", "", value)
    value = re.sub(r"^S\d+\s*", "", value).strip()
    if re.fullmatch(r"A?[A-D]", value):
        return {"questionType": "mcq", "correctAnswer": ord(value[-1]) - 65}, []
    numeric = re.fullmatch(rf"A?\s*({NUMBER})(?:\s*(?:to|TO|-)\s*({NUMBER}))?", value)
    if numeric:
        lower = float(numeric[1])
        upper = float(numeric[2]) if numeric[2] else lower
        if lower <= upper:
            fields = {"questionType": "nat", "correctAnswer": lower}
            if numeric[2]:
                fields.update(natAnswerMin=lower, natAnswerMax=upper)
            return fields, []
    return {"questionType": "mcq", "correctAnswer": None}, ["Answer annotation needs verification"]


def bounds(tp, index, count, height):
    indexes = [pdfium.raw.FPDFText_GetCharIndexFromTextIndex(tp, i) for i in range(index, index + count)]
    boxes = [tp.get_charbox(i) for i in indexes if i >= 0]
    return (min(b[0] for b in boxes), height - max(b[3] for b in boxes),
            max(b[2] for b in boxes), height - min(b[1] for b in boxes))


def page_layout(page, nodes):
    width, height = page.get_size()
    lines = [o.get_bounds() for o in page.get_objects() if o.type == 2]
    dividers = [b for b in lines if b[2]-b[0] < 4 and b[3]-b[1] > 200 and width*.42 < b[0] < width*.58]
    if dividers:
        divider = max(dividers, key=lambda b: b[3]-b[1])
        middle = (divider[0]+divider[2])/2
        top, bottom = height-divider[3], height-divider[1]
    else:
        xs = [q['box'][0] for q in nodes]
        middle = 315.7 if any(65 < x < 100 or x > 325 for x in xs) else 279.7
        top, bottom = 60, height-45
    lefts = [q['box'][0] for q in nodes if q['box'][0]<middle]
    rights = [q['box'][0] for q in nodes if q['box'][0]>middle]
    left = Counter(round(x) for x in lefts).most_common(1)[0][0] if lefts else middle-244
    right = Counter(round(x) for x in rights).most_common(1)[0][0] if rights else middle+14
    # The widest text line determines the outside edge without cutting circuit drawings.
    return {"middle": middle, "top": max(35,top), "bottom": min(height-30,bottom),
            "columns": [(max(0,left-5), middle-9), (middle+9, min(width,right+(middle-left)-5))]}


def read_page(doc, index):
    page = doc[index]
    tp = page.get_textpage()
    text = tp.get_text_range()
    height=page.get_height()
    nodes={}
    for match in TAGGED.finditer(text):
        start=match.start('label')
        prefix_start=text.rfind('\n',0,match.start())+1
        prefix=text[prefix_start:match.start()]
        nodes[start]={"index":start,"markerIndex":match.start(),"prefixIndex":prefix_start,"label":match['label'],
                      "marker":match['marker'],"answerAnnotation":clean(prefix),"box":bounds(tp,start,len(match['label']),height),
                      "markerBox":bounds(tp,match.start(),len(match['marker']),height)}
    tagged=list(nodes.values())
    layout=page_layout(page,tagged)
    anchor_xs=[q['box'][0] for q in tagged]
    if not anchor_xs:
        anchor_xs=[layout['columns'][0][0]+5,layout['columns'][1][0]+5]
    for match in LABEL.finditer(text):
        start=match.start('label')
        if start in nodes:continue
        box=bounds(tp,start,len(match['label']),height)
        if not layout['top']-3 <= box[1] <= layout['bottom']:continue
        if not any(abs(box[0]-x)<5 for x in anchor_xs):continue
        prefix_start=text.rfind('\n',0,max(0,match.start()-2))+1
        prefix=text[prefix_start:match.start()].strip()
        nodes[start]={"index":start,"markerIndex":start,"prefixIndex":start,"label":match['label'],
                      "marker":"","answerAnnotation":prefix if len(prefix)<40 else "","box":box,"markerBox":box}
    ordered=sorted(nodes.values(),key=lambda q:(q['box'][0]>layout['middle'],q['box'][1]))
    for node in ordered:
        node.update(page=index+1,column=int(node['box'][0]>layout['middle']))
    tp.close();page.close()
    return {"text":text,"layout":layout,"nodes":ordered}


def question_segments(node, following, pages, last_page):
    segments=[]
    end_page=following['page'] if following else min(last_page,node['page']+1)
    end_col=following['column'] if following else 1
    for pn in range(node['page'],end_page+1):
        layout=pages[pn]['layout']
        first=node['column'] if pn==node['page'] else 0
        last=end_col if pn==end_page else 1
        for col in range(first,last+1):
            top=node['box'][1]-2 if pn==node['page'] and col==node['column'] else layout['top']+1
            bottom=following['markerBox'][1]-3 if following and pn==end_page and col==end_col else layout['bottom']-1
            left,right=layout['columns'][col]
            if bottom-top>4:
                segments.append({"page":pn,"box":[left,top,right,bottom]})
    return segments


def extract_book(config, pdf_dir, asset_dir, mode, render):
    slug,subject,filename,offset,last_page,chapters=config
    pdf_path=pdf_dir/filename
    checksum=hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    doc=pdfium.PdfDocument(str(pdf_path))
    first_page=offset+chapters[0][0]
    pages={pn:read_page(doc,pn-1) for pn in range(first_page,last_page+1)}
    nodes=[node for page in pages.values() for node in page['nodes']]
    selected=[]
    for position,node in enumerate(nodes):
        marker=node['marker']
        if mode=='gate' and 'GATE' not in marker:continue
        following=nodes[position+1] if position+1<len(nodes) else None
        fields,reasons=answer_fields(node['answerAnnotation'])
        segments=question_segments(node,following,pages,last_page)
        pieces=[]
        for segment in segments:
            page=doc[segment['page']-1]; tp=page.get_textpage(); height=page.get_height()
            left,top,right,bottom=segment['box']
            pieces.append(tp.get_text_bounded(left=left,bottom=height-bottom,right=right,top=height-top))
            tp.close();page.close()
        raw='\n'.join(pieces)
        option_labels=re.findall(r'\(([A-D])\)',raw)
        has_options=all(letter in option_labels for letter in 'ABCD')
        if fields['questionType']=='mcq' and not has_options:reasons.append('Option labels incomplete')
        if fields['questionType']=='nat' and has_options:reasons.append('Numeric key conflicts with option layout')
        if re.search(r'\b(?:Ans(?:wer)?s?\s*:|Sol(?:ution)?\s*:|Common\s+(?:data|statement)|Linked\s+(?:answer|question)|Statement\s+for)',raw,re.I):
            reasons.append('Shared data, multipart question or printed solution needs review')
        previous=nodes[max(0,position-2):position]
        for prev in previous:
            source_text=pages[prev['page']]['text']
            if re.search(r'common\s+(?:data|statement)|linked\s+(?:answer|question)',source_text[max(0,prev['index']-250):node['index'] if prev['page']==node['page'] else prev['index']+200],re.I):
                reasons.append('Shared question context needs review')
        year_match=re.search(r'\b(19\d{2}|20\d{2})\b',marker)
        if marker and not year_match:reasons.append('Exam year needs verification')
        if marker and not marker.endswith(']'):reasons.append('Incomplete source reference')
        if not segments or len(segments)>3:reasons.append('Question crop boundaries need review')
        if not following:reasons.append('Final question boundary needs review')
        chapter_index=bisect.bisect_right([c[0] for c in chapters],node['page']-offset)-1
        chapter=chapters[max(0,chapter_index)][1]
        if chapter=='Additional Questions':reasons.append('Multipart question needs manual formatting')
        source_id=hashlib.sha256(f"{checksum}:{node['page']}:{node['index']}".encode()).hexdigest()[:24]
        question={"sourceId":source_id,"sourcePage":node['page'],"sourceQuestionNumber":int(re.search(r'\d+',node['label'])[0]),
                  "sourceMarker":marker,"sourceAnswer":node['answerAnnotation'],"chapter":chapter,"chapterOrder":chapter_index+1,
                  "questionText":clean(raw) or f"{subject} question {node['label']}","options":[f"Option {letter}" for letter in 'ABCD'] if fields['questionType']=='mcq' else [],
                  "year":int(year_match[1]) if year_match else None,"examName":marker.split('-')[0].lstrip('[').split()[0] if marker else 'Practice',
                  "reviewReasons":sorted(set(reasons)),"requiresReview":bool(reasons),"questionImages":[],"segments":segments,**fields}
        if 'GATE' in marker:question['examName']='GATE'
        elif 'IES' in marker:question['examName']='IES'
        elif 'ESE' in marker:question['examName']='ESE'
        selected.append(question)

    if render:
        target=asset_dir/slug
        target.mkdir(parents=True,exist_ok=True)
        jobs={}
        for q in selected:
            for index,segment in enumerate(q['segments']):
                jobs.setdefault(segment['page'],[]).append((q,index,segment))
        for pn,page_jobs in jobs.items():
            page=doc[pn-1]
            omit_booklet_extras(page)
            bitmap=page.render(scale=2.5); full=bitmap.to_pil()
            for q,index,segment in page_jobs:
                box=tuple(round(v*2.5) for v in segment['box'])
                cropped=full.crop(box)
                name=f"{q['sourceId']}-{index+1}.webp"
                cropped.save(target/name,format='WEBP',lossless=True)
                q['questionImages'].append({"url":f"/question-media/{slug}/{name}","width":cropped.width,"height":cropped.height})
            full.close();bitmap.close();page.close()
    doc.close()
    result={"slug":slug,"subjectName":subject,"sourceFile":filename,"sourceName":f"{filename[:-4]} - TARGATE EDUCATION",
            "sourceSha256":checksum,"chapters":[name for _,name in chapters],"questions":selected}
    print(json.dumps({"subject":subject,"questions":len(selected),"ready":sum(not q['requiresReview'] for q in selected),
                      "review":sum(q['requiresReview'] for q in selected),"images":sum(len(q['questionImages']) for q in selected)}),flush=True)
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--pdf-dir',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--asset-dir',type=Path,required=True)
    parser.add_argument('--mode',choices=['gate','all'],default='gate')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--slugs', help='Comma-separated book slugs to extract instead of every configured book')
    args=parser.parse_args()
    selected_slugs={slug.strip() for slug in args.slugs.split(',')} if args.slugs else None
    configs=[book for book in BOOKS if selected_slugs is None or book[0] in selected_slugs]
    if not configs:
        raise SystemExit('No configured books matched --slugs.')
    payload={"version":1,"mode":args.mode,"books":[extract_book(b,args.pdf_dir,args.asset_dir,args.mode,not args.no_render) for b in configs]}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(payload,ensure_ascii=True,indent=2),encoding='utf8')


if __name__=='__main__':
    main()
