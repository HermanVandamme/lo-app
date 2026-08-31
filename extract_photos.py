"""
Extract student photos from Smartschool PDF (Klaslijst.pdf).

Volledig automatisch: geen PAGE_CLASS_MAP meer om jaarlijks aan te passen.
De klas per pagina wordt afgeleid uit de tekst "Klaslijst (4eLa)" die
Smartschool zelf op elke pagina afdrukt (klas_id = het leidende
cijfer+kleine-letter-voorvoegsel, bv. "4eLa" -> "4e"). Pagina's zonder
zo'n cijfer-klascode (bv. "SEM1 - VDAH") worden automatisch overgeslagen.

Elke foto wordt bovendien gekoppeld aan de leerlingnaam die Smartschool
er in de PDF vlak onder afdrukt (leesbare tekst, geen OCR nodig) en die
naam wordt gematcht tegen students.csv — i.p.v. blind te vertrouwen op
dezelfde volgorde in CSV en PDF. Enkel wanneer een naam niet uniek
gematcht kan worden, valt de koppeling terug op positie (oude gedrag),
en dat wordt duidelijk gemarkeerd in de preview.

FIX: Sorteert fotos op visuele positie (y dan x) i.p.v. interne PDF-volgorde.
Toont een preview VOOR het opslaan zodat je de koppeling kan controleren.

Vereisten: pip install pymupdf
"""

import csv
import os
import re
import sys
import unicodedata
import fitz  # PyMuPDF

# ── Paden ─────────────────────────────────────────────────────────────────────
PDF_PATH   = "C:/Users/herma/Documents/LO-app/Klaslijst.pdf"
CSV_PATH   = "C:/Users/herma/Documents/LO-app/students.csv"
OUTPUT_DIR = "C:/Users/herma/Documents/LO-app/photos"

# Fotos waarvan de y0-coördinaat minder dan deze waarde verschilt
# worden als 'zelfde rij' beschouwd (aanpassen als sortering fout blijft)
ROW_TOLERANCE = 25  # punten (≈ pixels bij 72 dpi)

# Minimale afmeting om decoratieve/kleine elementen te filteren (in punten)
MIN_PHOTO_WIDTH  = 30
MIN_PHOTO_HEIGHT = 30

# Maximale afstand tussen de onderkant van een foto en een naamregel eronder
# om ze nog als bij elkaar horend te beschouwen (in punten)
NAME_MAX_GAP = 40

# "Klaslijst (4eLa)" -> groep "4eLa"; klas_id = leidend cijfer+kleine-letter-
# voorvoegsel ("4e"). Codes die niet met een cijfer beginnen (SEM1, SEM2, ...)
# leveren geen klas_id op en worden overgeslagen.
CODE_PATTERN        = re.compile(r"Klaslijst\s*\(([^)]+)\)")
KLAS_PREFIX_PATTERN = re.compile(r"^(\d+[a-z]+)")


# ── Hulpfuncties: klas-detectie ────────────────────────────────────────────────

def get_class_code(page):
    """Haalt de ruwe klascode uit de paginatekst, bv. '4eLa' of 'SEM1 - VDAH'."""
    text = page.get_text()
    m = CODE_PATTERN.search(text)
    return m.group(1).strip() if m else None


def klas_prefix_from_code(code):
    """Leidt klas_id af uit een klascode, bv. '4eLa' -> '4e'. None indien geen cijferklas."""
    if not code:
        return None
    m = KLAS_PREFIX_PATTERN.match(code)
    return m.group(1) if m else None


# ── Hulpfuncties: leerlingen ────────────────────────────────────────────────────

def load_students(csv_path):
    """Laad leerlingen uit CSV, gegroepeerd per klas_id, in CSV-volgorde."""
    students_by_class = {}
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            klas = row["klas_id"]
            students_by_class.setdefault(klas, []).append(row)
    return students_by_class


def normalize_naam(s):
    """Normaliseert een naam voor vergelijking (hoofdletters/spaties/unicode)."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


# ── Hulpfuncties: foto's + naam-koppeling op positie ───────────────────────────

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
                "naam_pdf": None,
            })
        except Exception as e:
            print(f"    ⚠  Kon xref {xref} niet extraheren: {e}")

    return result


def assign_names_to_photos(page, photos):
    """
    Koppelt aan elke foto de leerlingnaam die Smartschool er in de PDF vlak
    onder afdrukt: voor elke tekstregel wordt de dichtstbijzijnde foto erboven
    in dezelfde kolom (x-overlap) gezocht. Namen die over 2 regels wrappen
    (lange achternamen) worden automatisch samengevoegd, want beide regels
    wijzen naar dezelfde foto. Zet 'naam_pdf' op elke foto-dict (str of None).
    """
    lines = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                lines.append((line["bbox"], text))

    toegewezen = {}  # index in photos -> [(y0, text), ...]
    for (lx0, ly0, lx1, ly1), text in lines:
        beste_idx, beste_afstand = None, None
        for idx, photo in enumerate(photos):
            px0, py0, px1, py1 = photo["bbox"]
            if lx1 <= px0 or lx0 >= px1:
                continue  # geen x-overlap: andere kolom
            afstand = ly0 - py1
            if afstand < -2 or afstand > NAME_MAX_GAP:
                continue  # regel staat niet (net) onder deze foto
            if beste_afstand is None or afstand < beste_afstand:
                beste_afstand, beste_idx = afstand, idx
        if beste_idx is not None:
            toegewezen.setdefault(beste_idx, []).append((ly0, text))

    for idx, photo in enumerate(photos):
        stukken = sorted(toegewezen.get(idx, []), key=lambda t: t[0])
        photo["naam_pdf"] = " ".join(t[1] for t in stukken) if stukken else None

    return photos


def match_photos_to_students(students, imgs):
    """
    Koppelt foto's aan leerlingen van één klas. Voorkeur: op de leerlingnaam
    die uit de PDF gehaald werd (uniek matchen tegen 'achternaam voornaam'
    uit de CSV). Foto's/leerlingen die niet via naam gekoppeld raken vallen
    terug op positie (oude gedrag) als vangnet.

    Retourneert:
      matches    — lijst (student, img_of_None, via_naam_bool) in CSV-volgorde
      extra_imgs — foto's die overblijven nadat alle leerlingen gekoppeld zijn
    """
    naam_index = {}
    for s in students:
        key = normalize_naam(f"{s['achternaam']} {s['voornaam']}")
        naam_index.setdefault(key, []).append(s)

    student_to_img = {}
    matched_by_naam = set()
    gebruikte_img_idx = set()

    for idx, img in enumerate(imgs):
        key = normalize_naam(img.get("naam_pdf"))
        kandidaten = naam_index.get(key) if key else None
        if kandidaten:
            student = kandidaten.pop(0)
            student_to_img[id(student)] = img
            matched_by_naam.add(id(student))
            gebruikte_img_idx.add(idx)
            if not kandidaten:
                del naam_index[key]

    # Vangnet: resterende leerlingen/foto's op volgorde koppelen
    resterende_studenten = [s for s in students if id(s) not in student_to_img]
    resterende_imgs = [img for idx, img in enumerate(imgs) if idx not in gebruikte_img_idx]

    for student, img in zip(resterende_studenten, resterende_imgs):
        student_to_img[id(student)] = img

    matches = [(s, student_to_img.get(id(s)), id(s) in matched_by_naam) for s in students]
    extra_imgs = resterende_imgs[len(resterende_studenten):]  # geen leerling meer voor deze fotos
    return matches, extra_imgs


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

    print(f"PDF heeft {doc.page_count} pagina's. Klas per pagina wordt automatisch herkend.\n")

    # ── Stap 1: klas herkennen + fotos extraheren per pagina, accumuleren per klas ──
    images_by_class = {}

    for page_idx in range(doc.page_count):
        page = doc[page_idx]
        code = get_class_code(page)

        if not code:
            print(f"  Pagina {page_idx + 1:2d}  : geen 'Klaslijst (...)'-titel gevonden, overgeslagen")
            continue

        klas_id = klas_prefix_from_code(code)
        if not klas_id:
            print(f"  Pagina {page_idx + 1:2d}  ({code!r:14s}) : geen cijfer-klascode, overgeslagen")
            continue

        imgs = get_images_sorted(page, doc)
        imgs = assign_names_to_photos(page, imgs)
        images_by_class.setdefault(klas_id, []).extend(imgs)

        onbekend = "" if klas_id in students_by_class else "  ⚠  klas niet in students.csv"
        print(f"  Pagina {page_idx + 1:2d}  ({code:14s}) → klas {klas_id:4s} : {len(imgs):2d} foto's gevonden{onbekend}")

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

        matches, extra_imgs = match_photos_to_students(students, imgs)
        n_naam = sum(1 for _, _, via_naam in matches if via_naam)

        print(f"\n  ── Klas {klas_id.upper():4s}  "
              f"({len(students)} leerlingen  /  {len(imgs)} foto's  /  {n_naam} via naam-herkenning)"
              + ("  ⚠  AANTAL KLOPT NIET!" if mismatch else ""))

        for i, (student, img, via_naam) in enumerate(matches):
            sid  = student["student_id"]
            naam = f"{student['voornaam']} {student['achternaam']}"

            if img is not None:
                ext = img["data"]["ext"]
                pos = format_bbox(img["bbox"])
                tag = "naam   " if via_naam else "positie"
                print(f"    Foto {i + 1:2d}  ({pos})  [{tag}]  →  {sid}.{ext:<5}  {naam}")
                all_pairs.append((student, img))
            else:
                print(f"    !!  GEEN foto beschikbaar voor  {sid}  {naam}")
                has_warning = True

        # Overtollige foto's (meer foto's dan leerlingen, of naam niet herkend in CSV)
        for img in extra_imgs:
            pos = format_bbox(img["bbox"])
            pdf_naam = img.get("naam_pdf") or "?"
            print(f"    ??  EXTRA foto ({pos}) — geen leerling meer (PDF-naam: {pdf_naam})")
            has_warning = True

    # Klassen met foto's maar zonder leerlingen in de CSV: apart signaleren
    voor_onbekende_klassen = set(images_by_class) - set(students_by_class)
    for klas_id in sorted(voor_onbekende_klassen):
        n = len(images_by_class[klas_id])
        print(f"\n  ⚠  Klas {klas_id.upper()} heeft {n} foto's, maar staat niet in students.csv — overgeslagen.")
        has_warning = True

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
