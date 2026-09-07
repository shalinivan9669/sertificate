"""Inspect an actual downloaded synthetic pilot PDF, render it and decode its QR."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image
from pypdf import PdfReader
import zxingcpp

source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
assert source.name.startswith("TEST-ONLY-"), "Only synthetic pilot downloads allowed"
reader = PdfReader(source)
assert len(reader.pages) == 1
text = "\n".join(page.extract_text() or "" for page in reader.pages)
assert "SYNTHETIC LOCAL TEST - NOT A VALID CREDENTIAL" in text
assert not reader.get_fields(), "Issued PDF must have no editable fields"
annotations = [annotation.get_object() for page in reader.pages for annotation in page.get("/Annots", [])]
assert all(annotation is not None for annotation in annotations), "Issued PDF contains dangling annotation references"
widgets = [annotation for annotation in annotations if annotation.get("/Subtype") == "/Widget"]
assert not widgets, "Issued PDF must have no form widgets"
bundled = Path("C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe")
poppler = os.environ.get("OT_TEST_PDFTOPPM") or shutil.which("pdftoppm") or (str(bundled) if bundled.exists() else None)
assert poppler, "Install Poppler or set OT_TEST_PDFTOPPM"
prefix = output.with_suffix("")
subprocess.run([poppler, "-png", "-r", "150", "-singlefile", str(source), str(prefix)], check=True)
image = Image.open(prefix.with_suffix(".png"))
decoded = zxingcpp.read_barcodes(image)
assert len(decoded) == 1, "Exactly one actual QR must decode from the rendered PDF"
qr_url = decoded[0].text
assert qr_url.startswith("http://127.0.0.1:3103/verify/"), "No real verification host in synthetic pilot"
output.write_text(json.dumps({"source": str(source), "pages": 1, "text": text, "qrUrl": qr_url, "widgets": 0, "png": str(prefix.with_suffix('.png'))}, ensure_ascii=False, indent=2), encoding="utf-8")
print("Actual PDF text, flattened fields, rendered image and QR verified")
