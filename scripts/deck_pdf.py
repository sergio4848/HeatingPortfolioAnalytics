"""Fallback: matching slide renders to PDF when Artifact Tool PDF fonts are unavailable."""

import sys
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

source, destination = map(Path, sys.argv[1:3])
pdf = canvas.Canvas(str(destination), pagesize=(960, 540))
pdf.setTitle("Portotherm - LIAA consultation proposal")
for image in sorted(source.glob("slide-*.png")):
    pdf.drawImage(ImageReader(str(image)), 0, 0, width=960, height=540)
    pdf.showPage()
pdf.save()
print("Matching rendered-slide PDF created:", destination)
