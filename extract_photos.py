"""
Extract student photos from Smartschool PDF (Klaslijst.pdf).

FIX: Sorteert fotos op visuele positie (y dan x) i.p.v. interne PDF-volgorde.
Toont een preview VOOR het opslaan zodat je de koppeling kan controleren.

Vereisten: pip install pymupdf
"""

import csv
import os
import sys
import fitz  # PyMuPDF

# ── Paden ─────────────────────────────────────────────────────────────────────
PDF_PATH   = "C:/Users/herma/Documents/LO-app/Klaslijst.pdf"
CSV_PATH   = "C:/Users/herma/Documents/LO-app/students.csv"
OUTPUT_DIR = "C:/Users/herma/Documents/LO-app/photos"

# ── Pagina → klas_id mapping (0-geïndexeerd) ──────────────────────────────────
# Pagina's 16-17 (SEM1, SEM2) worden overgeslagen — duplicaten
PAGE_CLASS_MAP = {
    0:  "4e",   # 4eLa
    1:  "4e",   # 4eLaSt
    2:  "4f",   # 4fNw
    3:  "5a",   # 5aBw
    4:  "5a",   # 5aWw
    5:  "5b",   # 5bEcMt
    6:  "5b",   # 5bLaMt
    7:  "5b",   # 5bLaWe
    8:  "5b",   # 5bMt
    9:  "5d",   # 5dHw
    10: "6b",   # 6bEcMt
    11: "6b",   # 6bLaMt
    12: "6b",   # 6bLaWe
    13: "6b",   # 6bMt
    14: "6e",   # 6eWeWi
    15: "6e",   # 6eWeWi (vervolg)
}

# Fotos waarvan de y0-coördinaat minder dan deze waarde verschilt
# worden als 'zelfde rij' beschouwd (aanpassen als sortering fout blijft)
ROW_TOLERANCE = 25  # punten (≈ pixels bij 72 dpi)

# Minimale afmeting om decoratieve/kleine elementen te filteren (in punten)
MIN_PHOTO_WIDTH  = 30
MIN_PHOTO_HEIGHT = 30


# ── Hulpfuncties ──────────────────────────────────────────────────────────────

def load_students(csv_path):
    """Laad leerlingen uit CSV, gegroepeerd per klas_id, in CSV-volgorde."""
    students_by_class = {}
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            klas = row["klas_id"]
            students_by_class.setdefault(klas, []).append(row)
    return students_by_class


def get_images_sorted(page, doc):
    """
    Haal alle foto's van een pagina op, gesorteerd in leesvolgorde:
      1. boven → onder  (y-coördinaat)
      2. links → rechts (x-coördinaat)

    Gebruikt page.get_image_info(xrefs=True) voor positie-informatie.
    """
    # get_image_info geeft: [{'xref', 'smask', 'width', 'height',
    #   'colorspace', 'bpc', 'cs-name', 'ext', 'name', 'bbox', ...}, ...]
    infos = page.get_image_info(xrefs=True)

    # Filter: alleen echte foto's (minimale afmeting, xref aanwezig)
    infos = [
        i for i in infos
        if i.get("xref")
        and (i["bbox"][2] - i["bbox"][0]) >= MIN_PHOTO_WIDTH
        and (i["bbox"][3] - i["bbox"][1]) >= MIN_PHOTO_HEIGHT
    ]

    # Sorteer op rij (y0 afgerond op ROW_TOLERANCE), dan op x0
    def sort_key(info):
        x0, y0, x1, y1 = info["bbox"]
        row_bucket = round(y0 / ROW_TOLERANCE)
        return (row_bucket, x0)

    infos.sort(key=sort_key)

    # Extraheer de afbeeldingsdata
    result = []
    seen_xrefs = set()
    for info in infos:
        xref = info["xref"]
        if xref in seen_xrefs:
            continue  # dubbele referentie op zelfde pagina overslaan
        seen_xrefs.add(xref)
        try:
            img_data = doc.extract_image(xref)
            result.append({
                "data": img_data,
                "bbox": info["bbox"],
                "xref": xref,
            })
        except Exception as e:
            print(f"    ⚠  Kon xref {xref} niet extraheren: {e}")

    return result


def format_bbox(bbox):
    x0, y0, x1, y1 = bbox
    return f"y={y0:5.0f} x={x0:5.0f}"


# ── Hoofdprogramma ─────────────────────────────────────────────────────────────

def main():
    print(f"PyMuPDF versie : {fitz.version[0]}")
    print(f"PDF            : {PDF_PATH}")
    print(f"CSV            : {CSV_PATH}")
    print(f"Output         : {OUTPUT_DIR}")
    print()

    # Controleer bestanden
    for path, label in [(PDF_PATH, "PDF"), (CSV_PATH, "CSV")]:
        if not os.path.exists(path):
            print(f"FOUT: {label} niet gevonden: {path}")
            sys.exit(1)

    students_by_class = load_students(CSV_PATH)
    doc = fitz.open(PDF_PATH)

    print(f"PDF heeft {doc.page_count} pagina's. Verwerking pagina's: {sorted(PAGE_CLASS_MAP.keys())}\n")

    # ── Stap 1: Fotos extraheren per pagina, accumuleren per klas ────────────
    images_by_class = {}

    for page_idx in sorted(PAGE_CLASS_MAP):
        klas_id = PAGE_CLASS_MAP[page_idx]
        page    = doc[page_idx]
        imgs    = get_images_sorted(page, doc)
        images_by_class.setdefault(klas_id, []).extend(imgs)
        print(f"  Pagina {page_idx + 1:2d}  ({klas_id:4s}) : {len(imgs):2d} foto's gevonden")

    # ── Stap 2: Preview ───────────────────────────────────────────────────────
    print("\n" + "═" * 65)
    print("  PREVIEW — controleer de koppeling vóór je opslaat")
    print("═" * 65)

    all_pairs   = []   # (student_dict, img_dict) om later op te slaan
    has_warning = False

    for klas_id, students in students_by_class.items():
        imgs = images_by_class.get(klas_id, [])

        mismatch = len(students) != len(imgs)
        if mismatch:
            has_warning = True

        print(f"\n  ── Klas {klas_id.upper():4s}  "
              f"({len(students)} leerlingen  /  {len(imgs)} foto's)"
              + ("  ⚠  AANTAL KLOPT NIET!" if mismatch else ""))

        for i, student in enumerate(students):
            sid  = student["student_id"]
            naam = f"{student['voornaam']} {student['achternaam']}"

            if i < len(imgs):
                img  = imgs[i]
                ext  = img["data"]["ext"]
                pos  = format_bbox(img["bbox"])
                print(f"    Foto {i + 1:2d}  ({pos})  →  {sid}.{ext:<5}  {naam}")
                all_pairs.append((student, img))
            else:
                print(f"    !!  GEEN foto beschikbaar voor  {sid}  {naam}")
                has_warning = True

        # Overtollige foto's (meer foto's dan leerlingen)
        for i in range(len(students), len(imgs)):
            img = imgs[i]
            pos = format_bbox(img["bbox"])
            print(f"    ??  EXTRA foto {i + 1} ({pos}) — geen leerling meer")

    print("\n" + "═" * 65)

    if has_warning:
        print("⚠  Er zijn waarschuwingen. Controleer de preview hierboven goed.")
    else:
        print("✓  Alle koppelingen zien er correct uit.")

    print()

    # ── Stap 3: Bevestiging ───────────────────────────────────────────────────
    try:
        antwoord = input("Klopt de koppeling? Fotos opslaan? [j/N]: ").strip().lower()
    except EOFError:
        antwoord = ""

    if antwoord != "j":
        print("\nGeannuleerd — geen bestanden opgeslagen.")
        doc.close()
        sys.exit(0)

    # ── Stap 4: Opslaan ───────────────────────────────────────────────────────
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    saved  = 0
    errors = 0

    for student, img in all_pairs:
        ext      = img["data"]["ext"]
        filename = f"{student['student_id']}.{ext}"
        filepath = os.path.join(OUTPUT_DIR, filename)
        try:
            with open(filepath, "wb") as f:
                f.write(img["data"]["image"])
            saved += 1
        except Exception as e:
            print(f"  FOUT bij opslaan {filename}: {e}")
            errors += 1

    doc.close()

    print(f"\n✅  {saved} foto's opgeslagen in {OUTPUT_DIR}")
    if errors:
        print(f"⚠   {errors} foto's konden niet worden opgeslagen.")


if __name__ == "__main__":
    main()
