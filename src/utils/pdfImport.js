/**
 * PDF-import — stap 1: klas- en tekstherkenning uit de Smartschool-
 * klaslijst-PDF, via pdf.js. Draait volledig client-side (geen upload).
 *
 * Dit bestand doet NOG GEEN foto-extractie en schrijft NIET naar Dexie —
 * enkel parsing, bedoeld om te verifiëren dat klas- en naamherkenning
 * betrouwbaar werkt vóór de volgende stappen (foto-extractie, matching,
 * Dexie-integratie) gebouwd worden.
 *
 * Regex-patronen zijn bewust identiek aan extract_photos.py (get_class_code /
 * klas_prefix_from_code), zodat klasherkenning hetzelfde gedrag oplevert.
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// "Klaslijst (4eLa)" -> code "4eLa"; klas_id = leidend cijfer+kleine letters ("4e").
const CODE_PATTERN = /Klaslijst\s*\(([^)]+)\)/
const KLAS_PREFIX_PATTERN = /^(\d+[a-z]+)/

export function getClassCode(pageText) {
  const m = CODE_PATTERN.exec(pageText)
  return m ? m[1].trim() : null
}

export function klasIdFromCode(code) {
  if (!code) return null
  const m = KLAS_PREFIX_PATTERN.exec(code)
  return m ? m[1] : null
}

/**
 * Filtert pdf.js-tekstitems die geen naam-kandidaat kunnen zijn (titel,
 * footer, paginanummer, lege spatie-items tussen kolommen).
 */
export function isNaamKandidaat(text) {
  if (!text || !text.trim()) return false
  const t = text.trim()
  if (/^Klaslijst/.test(t)) return false
  if (/^Afdrukdatum/.test(t)) return false
  if (/SMARTSCHOOL/.test(t)) return false
  if (/^\d+$/.test(t)) return false
  return true
}

/**
 * Parseert de volledige PDF: per pagina klascode/klas_id + kandidaat-
 * naam-items (tekst + positie). Elk item komt overeen met 1 tekstregel
 * die Smartschool onder een foto plaatst; bij een lange (gewrapte)
 * achternaam levert dat 2 items voor dezelfde leerling op — dat wordt pas
 * opgelost in stap 3 (foto-nabijheid), niet hier.
 *
 * @param {File} file
 * @param {{ onProgress?: (p: { page: number, numPages: number }) => void }} [opts]
 */
export async function parseKlaslijstPdf(file, { onProgress } = {}) {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const fullText = textContent.items.map(it => it.str).join(' ')
    const code = getClassCode(fullText)
    const klasId = klasIdFromCode(code)

    const items = textContent.items
      .filter(it => isNaamKandidaat(it.str))
      .map(it => ({ text: it.str.trim(), x0: it.transform[4], y0: it.transform[5] }))

    pages.push({ pageNum: i, code, klasId, items })
    onProgress?.({ page: i, numPages: doc.numPages })
  }

  return { numPages: doc.numPages, pages }
}

/** Groepeert het resultaat van parseKlaslijstPdf per klas_id (pagina's genegeerd zonder cijfer-klascode). */
export function groepeerPerKlas(pages) {
  const perKlas = {}
  for (const p of pages) {
    if (!p.klasId) continue
    perKlas[p.klasId] ??= { pageNums: [], items: [] }
    perKlas[p.klasId].pageNums.push(p.pageNum)
    perKlas[p.klasId].items.push(...p.items)
  }
  return perKlas
}

// ── Stap 2: foto-extractie (bbox + pixels) ─────────────────────────────────
//
// pdf.js heeft geen kant-en-klare "geef alle afbeeldingen met bbox"-functie
// (zoals PyMuPDF's get_image_info). We lezen daarom zelf de operator-list
// (page.getOperatorList()) uit en houden de CTM (current transformation
// matrix) bij via een save/restore-stack, exact zoals pdf.js' eigen
// CanvasGraphics-renderer dat intern doet. Bij elke paintImageXObject is de
// bbox van de afbeelding de huidige CTM toegepast op het eenheidsvierkant
// [0,1]x[0,1] — hiervoor gebruiken we pdf.js' eigen, publiek geëxporteerde
// Util.transform/Util.axialAlignedBoundingBox (dezelfde functies die de
// interne renderer gebruikt), i.p.v. zelf matrixwiskunde te herschrijven.
//
// Geverifieerd tegen het echte Klaslijst.pdf: de berekende bboxes komen tot
// op 2 decimalen overeen met PyMuPDF's get_image_info() voor dezelfde PDF.
const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0]
const MIN_FOTO_BREEDTE = 30  // punten — filtert decoratieve/kleine afbeeldingen (zelfde als extract_photos.py)
const MIN_FOTO_HOOGTE = 30

/**
 * Leest de operator-list van 1 pagina uit en geeft de bbox (in PDF-space,
 * y-as omhoog — nog NIET omgezet naar canvas/viewport-coördinaten) van elke
 * ingebedde afbeelding terug.
 */
export async function extractFotoBboxenVanPagina(page) {
  const opList = await page.getOperatorList()
  const stack = []
  let ctm = IDENTITY_MATRIX
  const fotos = []
  const gezienObjIds = new Set()

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    const args = opList.argsArray[i]

    if (fn === pdfjsLib.OPS.save) {
      stack.push(ctm)
    } else if (fn === pdfjsLib.OPS.restore) {
      ctm = stack.pop() ?? IDENTITY_MATRIX
    } else if (fn === pdfjsLib.OPS.transform) {
      ctm = pdfjsLib.Util.transform(ctm, args)
    } else if (fn === pdfjsLib.OPS.paintImageXObject) {
      const objId = args[0]
      if (gezienObjIds.has(objId)) continue
      const out = [Infinity, Infinity, -Infinity, -Infinity]
      pdfjsLib.Util.axialAlignedBoundingBox([0, 0, 1, 1], ctm, out)
      const breedte = out[2] - out[0]
      const hoogte = out[3] - out[1]
      if (breedte < MIN_FOTO_BREEDTE || hoogte < MIN_FOTO_HOOGTE) continue
      gezienObjIds.add(objId)
      fotos.push({ objId, bboxPdf: out })
    }
  }

  return fotos
}

/**
 * Rendert de volledige pagina één keer naar een canvas en snijdt daaruit, per
 * gevonden bbox, de losse foto's — als JPEG-blob, klaar om te tonen of op te
 * slaan. De schaal bepaalt zowel de scherpte als de rekentijd; zie hieronder.
 */
// Schaal waarop een pagina getekend wordt vóór de pasfoto's eruit geknipt worden.
// De rekentijd stijgt met het KWADRAAT van deze waarde: schaal 3 is ruim twee
// keer zo duur als schaal 2. De foto's worden in de app getoond op 32 tot 64
// pixels; op schaal 2 is een uitgeknipte foto nog altijd ongeveer 200x260 pixels,
// dus ruim scherp genoeg. Zet dit op 1.5 als je nog sneller wil, of terug op 3
// als je de foto's scherper wil hebben.
const RENDER_SCALE = 2

export async function renderEnCropFotos(page, fotoBboxen) {
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const pageCanvas = document.createElement('canvas')
  pageCanvas.width = Math.ceil(viewport.width)
  pageCanvas.height = Math.ceil(viewport.height)
  const ctx = pageCanvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise

  const resultaten = []
  for (const foto of fotoBboxen) {
    const [x0, y0, x1, y1] = foto.bboxPdf
    const [px0, py0] = viewport.convertToViewportPoint(x0, y0)
    const [px1, py1] = viewport.convertToViewportPoint(x1, y1)
    const sx = Math.min(px0, px1)
    const sy = Math.min(py0, py1)
    const sw = Math.abs(px1 - px0)
    const sh = Math.abs(py1 - py0)

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = Math.max(1, Math.round(sw))
    cropCanvas.height = Math.max(1, Math.round(sh))
    cropCanvas.getContext('2d').drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height)

    // JPEG i.p.v. PNG: een pasfoto als PNG is al snel 200-400 kB en traag om te
    // coderen, als JPEG ongeveer 20 kB. Dat scheelt zowel tijd als plaats in de
    // lokale database.
    const blob = await new Promise(resolve => cropCanvas.toBlob(resolve, 'image/jpeg', 0.85))
    resultaten.push({
      objId: foto.objId,
      bboxPdf: foto.bboxPdf,
      blob,
      width: cropCanvas.width,
      height: cropCanvas.height,
    })
  }

  // Grote canvas expliciet vrijgeven — 18 pagina's na elkaar op schaal 3 kan anders behoorlijk geheugen opstapelen.
  pageCanvas.width = 0
  pageCanvas.height = 0

  return resultaten
}

/**
 * Stap 2 (debug): leest de PDF opnieuw in en extraheert, enkel voor
 * pagina's met een geldige klas_id, de foto's (bbox + pixels als PNG-blob).
 * Nog GEEN naam-koppeling (stap 3) en GEEN Dexie-writes (stap 4).
 *
 * @param {File} file
 * @param {{ onProgress?: (p: { page: number, numPages: number }) => void }} [opts]
 */
export async function extractFotosPerPagina(file, { onProgress } = {}) {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const fullText = textContent.items.map(it => it.str).join(' ')
    const code = getClassCode(fullText)
    const klasId = klasIdFromCode(code)

    let fotos = []
    if (klasId) {
      const bboxen = await extractFotoBboxenVanPagina(page)
      fotos = await renderEnCropFotos(page, bboxen)
    }

    pages.push({ pageNum: i, code, klasId, fotos })
    onProgress?.({ page: i, numPages: doc.numPages })
  }

  return { numPages: doc.numPages, pages }
}

/** Groepeert het resultaat van extractFotosPerPagina per klas_id. */
export function groepeerFotosPerKlas(pages) {
  const perKlas = {}
  for (const p of pages) {
    if (!p.klasId) continue
    perKlas[p.klasId] ??= { pageNums: [], fotos: [] }
    perKlas[p.klasId].pageNums.push(p.pageNum)
    perKlas[p.klasId].fotos.push(...p.fotos)
  }
  return perKlas
}

// ── Stap 3: naam↔foto-matching — voorbereidende primitieven ────────────────
//
// Vanaf hier werken we, net als extract_photos.py, in top-down coördinaten
// (y neemt toe naar onderen, oorsprong linksboven) — dat maakt de poort van
// assign_names_to_photos/match_photos_to_students 1-op-1 leesbaar t.o.v. het
// origineel. pdf.js zelf werkt intern in PDF-space (y omhoog), dus we
// flippen expliciet met de pagina-hoogte.

/** Zet een PDF-space bbox (y omhoog, van extractFotoBboxenVanPagina) om naar top-down [x0,y0boven,x1,y1onder]. */
export function fotoBboxNaarTopDown(bboxPdf, pageHeight) {
  const [x0, y0, x1, y1] = bboxPdf
  return [x0, pageHeight - y1, x1, pageHeight - y0]
}

/**
 * Leest alle kandidaat-naamregels van 1 pagina met hun VOLLEDIGE bbox
 * (top-down [x0,y0boven,x1,y1onder]) — het equivalent van PyMuPDF's
 * `lines.append((line["bbox"], text))` in assign_names_to_photos.
 */
export async function extractNaamRegelsVanPagina(page) {
  const textContent = await page.getTextContent()
  const pageHeight = page.getViewport({ scale: 1 }).height

  return textContent.items
    .filter(it => isNaamKandidaat(it.str))
    .map(it => {
      const x0 = it.transform[4]
      const yBottomYUp = it.transform[5]
      const yTopYUp = yBottomYUp + (it.height ?? 0)
      const x1 = x0 + (it.width ?? 0)
      return {
        text: it.str.trim(),
        bbox: [x0, pageHeight - yTopYUp, x1, pageHeight - yBottomYUp],
      }
    })
}

/**
 * Sorteert foto's in leesvolgorde (boven->onder, links->rechts) o.b.v. hun
 * top-down bbox — het equivalent van PyMuPDF's get_images_sorted-sortering.
 * Nodig vóór matching, want match_photos_to_students koppelt resterende
 * (niet via naam gematchte) foto's/leerlingen op deze volgorde.
 */
const ROW_TOLERANCE = 25

export function sorteerFotosOpPositie(fotos) {
  return [...fotos].sort((a, b) => {
    const rijA = Math.round(a.bboxTopDown[1] / ROW_TOLERANCE)
    const rijB = Math.round(b.bboxTopDown[1] / ROW_TOLERANCE)
    if (rijA !== rijB) return rijA - rijB
    return a.bboxTopDown[0] - b.bboxTopDown[0]
  })
}

/** Opent een PDF-bestand (herbruikt de reeds geconfigureerde worker van dit module). */
export async function openDocument(file) {
  const buffer = await file.arrayBuffer()
  return pdfjsLib.getDocument({ data: buffer }).promise
}
