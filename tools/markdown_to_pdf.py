import re
import textwrap
from pathlib import Path
from typing import List

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
MARGIN_LEFT = 50
MARGIN_TOP = 790
LINE_HEIGHT = 14
MAX_CHARS = 95


def _strip_md(line: str) -> str:
    line = line.rstrip()
    if line.startswith("#"):
        line = line.lstrip("#").strip()
        line = line.upper()
    line = line.replace("**", "")
    line = line.replace("`", "")
    line = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", line)
    line = re.sub(r"^\s*-\s+", "- ", line)
    return line


def _wrap_lines(lines: List[str]) -> List[str]:
    wrapped: List[str] = []
    for line in lines:
        clean = _strip_md(line)
        if not clean:
            wrapped.append("")
            continue
        for chunk in textwrap.wrap(clean, width=MAX_CHARS):
            wrapped.append(chunk)
    return wrapped


def _escape_pdf(text: str) -> str:
    return (
        text.replace("“", "\"")
        .replace("”", "\"")
        .replace("’", "'")
        .replace("–", "-")
        .replace("—", "-")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def _make_pages(lines: List[str]) -> List[List[str]]:
    lines_per_page = int((MARGIN_TOP - 60) / LINE_HEIGHT)
    pages = []
    current = []
    for line in lines:
        current.append(line)
        if len(current) >= lines_per_page:
            pages.append(current)
            current = []
    if current:
        pages.append(current)
    return pages


def write_pdf(text: str, out_path: Path) -> None:
    lines = _wrap_lines(text.splitlines())
    pages = _make_pages(lines)

    objects = []
    xref_positions = []

    def add_obj(content: str) -> None:
        objects.append(content)

    # Font object (will be object 4)
    # We build pages dynamically and then insert font object later.

    # Build page and content objects
    page_objects = []
    content_objects = []
    for page_lines in pages:
        content_lines = ["BT", "/F1 11 Tf", f"{MARGIN_LEFT} {MARGIN_TOP} Td"]
        for line in page_lines:
            content_lines.append(f"({_escape_pdf(line)}) Tj")
            content_lines.append(f"0 -{LINE_HEIGHT} Td")
        content_lines.append("ET")
        content_stream = "\n".join(content_lines)
        content_objects.append(content_stream)

    # Build PDF structure
    # Object 1: Catalog
    add_obj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

    # Object 2: Pages (Kids to be filled later)
    kids_refs = []
    # Prepare placeholders for pages and contents
    # Object numbers: 3.. for pages, content after pages, and font at the end
    page_start = 3
    content_start = page_start + len(pages)
    font_obj_num = content_start + len(pages)

    for i in range(len(pages)):
        kids_refs.append(f"{page_start + i} 0 R")

    add_obj(f"2 0 obj\n<< /Type /Pages /Kids [{ ' '.join(kids_refs) }] /Count {len(pages)} >>\nendobj\n")

    # Page objects
    for i in range(len(pages)):
        page_obj_num = page_start + i
        content_obj_num = content_start + i
        page_obj = (
            f"{page_obj_num} 0 obj\n"
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {font_obj_num} 0 R >> >> /Contents {content_obj_num} 0 R >>\n"
            "endobj\n"
        )
        add_obj(page_obj)

    # Content objects
    for i, content in enumerate(content_objects):
        content_obj_num = content_start + i
        stream = content.encode("latin-1")
        content_obj = (
            f"{content_obj_num} 0 obj\n"
            f"<< /Length {len(stream)} >>\nstream\n"
            f"{content}\nendstream\nendobj\n"
        )
        add_obj(content_obj)

    # Font object
    add_obj(
        f"{font_obj_num} 0 obj\n"
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    )

    # Build xref
    output = ["%PDF-1.4\n"]
    for obj in objects:
        xref_positions.append(sum(len(part.encode("latin-1")) for part in output))
        output.append(obj)

    xref_start = sum(len(part.encode("latin-1")) for part in output)
    output.append(f"xref\n0 {len(objects) + 1}\n")
    output.append("0000000000 65535 f \n")
    for pos in xref_positions:
        output.append(f"{pos:010d} 00000 n \n")

    output.append("trailer\n")
    output.append(f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n")
    output.append("startxref\n")
    output.append(f"{xref_start}\n")
    output.append("%%EOF\n")

    out_path.write_bytes("".join(output).encode("latin-1"))


def main() -> int:
    import sys

    if len(sys.argv) != 3:
        print("Usage: markdown_to_pdf.py input.md output.pdf")
        return 1
    in_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    text = in_path.read_text(encoding="utf-8")
    write_pdf(text, out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
