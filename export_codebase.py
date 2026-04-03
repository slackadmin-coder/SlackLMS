#!/usr/bin/env python3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_TXT = ROOT / "codebase_verbatim_export.txt"
OUT_PDF = ROOT / "codebase_verbatim_export.pdf"

files = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()

with OUT_TXT.open("wb") as out:
    first = True
    for rel in files:
        p = ROOT / rel
        if not p.is_file():
            continue
        if not first:
            out.write(b"\n")
        first = False
        out.write(rel.encode("utf-8"))
        out.write(b"\n")
        out.write(p.read_bytes())

# Minimal PDF writer (monospace text rendering)
text = OUT_TXT.read_bytes().decode("latin-1")
lines = text.split("\n")

page_width = 612
page_height = 792
margin_left = 36
margin_top = 36
font_size = 8
leading = 9
lines_per_page = int((page_height - 2 * margin_top) / leading)

def pdf_escape(s: str) -> str:
    out = []
    for ch in s:
        c = ord(ch)
        if ch in "\\()":
            out.append("\\" + ch)
        elif 32 <= c <= 126:
            out.append(ch)
        else:
            out.append(f"\\{c:03o}")
    return "".join(out)

pages = [lines[i:i + lines_per_page] for i in range(0, len(lines), lines_per_page)]
objects = []

# 1: Catalog, 2: Pages
objects.append("<< /Type /Catalog /Pages 2 0 R >>")

kids = []
next_obj_num = 3
content_obj_nums = []
for _ in pages:
    page_obj_num = next_obj_num
    content_obj_num = next_obj_num + 1
    next_obj_num += 2
    kids.append(f"{page_obj_num} 0 R")
    content_obj_nums.append(content_obj_num)

objects.append(f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(pages)} >>")

for idx, page_lines in enumerate(pages):
    page_obj_num = 3 + idx * 2
    content_obj_num = page_obj_num + 1
    y_start = page_height - margin_top - font_size
    content = ["BT", f"/F1 {font_size} Tf", f"{margin_left} {y_start} Td", f"{leading} TL"]
    first_line = True
    for line in page_lines:
        escaped = pdf_escape(line)
        if first_line:
            content.append(f"({escaped}) Tj")
            first_line = False
        else:
            content.append("T*")
            content.append(f"({escaped}) Tj")
    content.append("ET")
    stream = "\n".join(content).encode("latin-1")

    objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] /Resources << /Font << /F1 0 0 R >> >> /Contents {content_obj_num} 0 R >>")
    objects.append((f"<< /Length {len(stream)} >>", stream))

# Insert font object before pages at object number 0 0 R placeholder hack:
# We'll put font as last object and then patch references to actual object number.
font_obj_num = len(objects) + 1
objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

# Replace placeholder "0 0 R" with real font ref
for i, obj in enumerate(objects):
    if isinstance(obj, str):
        objects[i] = obj.replace("0 0 R", f"{font_obj_num} 0 R")

pdf = bytearray(b"%PDF-1.4\n")
offsets = [0]
for i, obj in enumerate(objects, start=1):
    offsets.append(len(pdf))
    pdf.extend(f"{i} 0 obj\n".encode("ascii"))
    if isinstance(obj, tuple):
        dict_part, stream_bytes = obj
        pdf.extend(dict_part.encode("latin-1"))
        pdf.extend(b"\nstream\n")
        pdf.extend(stream_bytes)
        pdf.extend(b"\nendstream\n")
    else:
        pdf.extend(obj.encode("latin-1"))
        pdf.extend(b"\n")
    pdf.extend(b"endobj\n")

xref_pos = len(pdf)
count = len(objects) + 1
pdf.extend(f"xref\n0 {count}\n".encode("ascii"))
pdf.extend(b"0000000000 65535 f \n")
for i in range(1, count):
    pdf.extend(f"{offsets[i]:010d} 00000 n \n".encode("ascii"))

pdf.extend(f"trailer\n<< /Size {count} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("ascii"))

OUT_PDF.write_bytes(pdf)
print(f"Wrote {OUT_TXT} and {OUT_PDF}")
