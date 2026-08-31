/**
 * PDF-import — stap 3: naam↔foto-matching (preview, read-only).
 *
 * Poort van assign_names_to_photos() + match_photos_to_students() uit
 * extract_photos.py naar de browser: koppelt elke foto aan de leerlingnaam
 * die Smartschool er in de PDF vlak onder afdrukt (nabijheid + x-overlap),
 * en matcht die naam tegen de bestaande leerlingen in Dexie (ingevoerd via
 * de huidige CSV-import — die blijft voorlopig de bron van waarheid).
 * Enkel wanneer een naam niet uniek gematcht kan worden, valt de koppeling
 * terug op positie — exact zoals het Python-script.
 *
 * Schrijft NIETS naar Dexie (enkel db.leerlingen.where(...).toArray() —
 * een leesquery). De echte Dexie-integratie volgt pas in stap 4.
 *
 * We werken hier in top-down coördinaten (y neemt toe naar onderen), net als
 * PyMuPDF, zodat deze poort 1-op-1 leesbaar blijft t.o.v. het origineel.
 */
import db from '../db/db'
import {
  openDocument,
  getClassCode,
  klasIdFromCode,
  extractNaamRegelsVanPagina,
  extractFotoBboxenVanPagina,
  renderEnCropFotos,
  fotoBboxNaarTopDown,
  sorteerFotosOpPositie,
} from './pdfImport'

/** Normaliseert een naam voor vergelijking (hoofdletters/spaties/unicode) — zelfde als extract_photos.py. */
export function normalizeerNaam(s) {
  if (!s) return ''
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Maximale afstand tussen de onderkant van een foto en een naamregel eronder
// om ze nog als bij elkaar horend te beschouwen (in punten) — zelfde als extract_photos.py.
const NAME_MAX_GAP = 40

/**
 * Koppelt aan elke foto de leerlingnaam die Smartschool er in de PDF vlak
 * onder afdrukt. Voor elke naamregel wordt de dichtstbijzijnde foto erboven
 * gezocht (x-overlap + y-afstand binnen NAME_MAX_GAP). Namen die over 2
 * regels wrappen (lange achternamen) wijzen naar dezelfde foto en worden
 * automatisch samengevoegd (gesorteerd op y).
 */
export function wijsNamenToeAanFotos(naamRegels, fotosGesorteerd) {
  const toegewezen = new Map() // foto-index -> [{ y0, text }]

  for (const regel of naamRegels) {
    const [lx0, ly0, lx1] = regel.bbox
    let besteIdx = null
    let besteAfstand = null

    fotosGesorteerd.forEach((foto, idx) => {
      const [px0, , px1, py1] = foto.bboxTopDown
      if (lx1 <= px0 || lx0 >= px1) return // geen x-overlap: andere kolom
      const afstand = ly0 - py1
      if (afstand < -2 || afstand > NAME_MAX_GAP) return // regel niet (net) onder deze foto
      if (besteAfstand === null || afstand < besteAfstand) {
        besteAfstand = afstand
        besteIdx = idx
      }
    })

    if (besteIdx !== null) {
      if (!toegewezen.has(besteIdx)) toegewezen.set(besteIdx, [])
      toegewezen.get(besteIdx).push({ y0: ly0, text: regel.text })
    }
  }

  return fotosGesorteerd.map((foto, idx) => {
    const stukken = (toegewezen.get(idx) ?? []).sort((a, b) => a.y0 - b.y0)
    return { ...foto, naamPdf: stukken.length ? stukken.map(s => s.text).join(' ') : null }
  })
}

/**
 * Koppelt foto's aan bestaande leerlingen van 1 klas (uit Dexie).
 * Voorkeur: op de leerlingnaam die uit de PDF gehaald werd (uniek matchen
 * tegen "achternaam voornaam"). Foto's/leerlingen die niet via naam
 * gekoppeld raken vallen terug op positie (vangnet, net als het Python-script).
 *
 * `dubbeleNamen` — namen die MEER DAN 1 keer voorkomen in deze klas: hierbij
 * is de koppeling per definitie niet 100% zeker af te leiden uit de naam
 * alleen (welke van de 2 gelijknamige leerlingen hoort bij welke foto?) — dit
 * wordt als apart, prominent twijfelgeval teruggegeven, nooit stilzwijgend opgelost.
 */
export function matchFotosMetLeerlingen(leerlingen, fotosMetNaam) {
  const naamIndex = new Map()
  for (const s of leerlingen) {
    const key = normalizeerNaam(`${s.achternaam} ${s.voornaam}`)
    if (!naamIndex.has(key)) naamIndex.set(key, [])
    naamIndex.get(key).push(s)
  }
  const dubbeleNamen = [...naamIndex.entries()].filter(([, l]) => l.length > 1).map(([key, l]) => ({ key, leerlingen: l }))

  const fotoVoorLeerling = new Map()   // leerling.id -> foto
  const matchedViaNaam = new Set()     // leerling.id
  const gebruikteFotoIdx = new Set()

  fotosMetNaam.forEach((foto, idx) => {
    const key = normalizeerNaam(foto.naamPdf)
    const kandidaten = key ? naamIndex.get(key) : null
    if (kandidaten && kandidaten.length) {
      const student = kandidaten.shift()
      fotoVoorLeerling.set(student.id, foto)
      matchedViaNaam.add(student.id)
      gebruikteFotoIdx.add(idx)
      if (!kandidaten.length) naamIndex.delete(key)
    }
  })

  const resterendeLeerlingen = leerlingen.filter(s => !fotoVoorLeerling.has(s.id))
  const resterendeFotos = fotosMetNaam.filter((_, idx) => !gebruikteFotoIdx.has(idx))

  resterendeLeerlingen.forEach((s, i) => {
    if (i < resterendeFotos.length) fotoVoorLeerling.set(s.id, resterendeFotos[i])
  })

  const matches = leerlingen.map(s => ({
    leerling: s,
    foto: fotoVoorLeerling.get(s.id) ?? null,
    viaNaam: matchedViaNaam.has(s.id),
  }))
  const extraFotos = resterendeFotos.slice(resterendeLeerlingen.length)

  return { matches, extraFotos, dubbeleNamen }
}

/**
 * Splitst de ruwe PDF-naam ("Achternaam Voornaam", Smartschool-conventie —
 * achternaam kan meerdere woorden bevatten) in voornaam/achternaam.
 * Heuristiek: laatste woord = voornaam, de rest = achternaam. Gevalideerd
 * tegen alle 148 echte leerlingen in students.csv: 148/148 exacte match.
 */
export function splitsNaamPdf(naamPdf) {
  const woorden = (naamPdf ?? '').trim().split(/\s+/).filter(Boolean)
  if (!woorden.length) return { voornaam: '', achternaam: '' }
  const voornaam = woorden[woorden.length - 1]
  const achternaam = woorden.slice(0, -1).join(' ')
  return { voornaam, achternaam }
}

/**
 * Eerstvolgende vrije volgnummer voor een klas, o.b.v. de student_id's
 * (`${klasId}_NN`) van reeds bestaande leerlingen — nooit een nummer
 * hergebruiken, ook niet als een tussenliggend nummer ooit vrijkwam.
 */
function volgendVolgnummer(klasId, bestaandeLeerlingen) {
  const prefix = `${klasId}_`
  let max = 0
  for (const l of bestaandeLeerlingen) {
    if (!l.id.startsWith(prefix)) continue
    const n = parseInt(l.id.slice(prefix.length), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return max + 1
}

/**
 * Stap 4: schrijft de (door de leerkracht bevestigde) preview weg naar
 * Dexie:
 *  - klas aanmaken indien nog niet aanwezig
 *  - bestaande leerling (matches[].foto niet-null) -> enkel fotoBlob bijwerken,
 *    ID en dus scores blijven behouden
 *  - nieuwe leerling (extraFotos) -> student_id = `${klasId}_NN` (FIFO op
 *    PDF-volgorde), fotoBlob rechtstreeks weggeschreven
 *  - foto's zonder herkenbare naam (naamPdf null) worden NOOIT gebruikt om
 *    een leerling aan te maken — die tellen als "genegeerd", niet als fout.
 *
 * BELANGRIJK: `blob.arrayBuffer()` is GEEN Dexie-operatie. Awaiten van een
 * niet-Dexie-promise binnen `db.transaction()` breekt Dexie's eigen
 * transactie-tracking en kan de onderliggende IndexedDB-transactie
 * voortijdig laten committen ("PrematureCommitError: Transaction committed
 * too early") — dat overkwam een eerdere versie van deze functie. Daarom:
 * ALLE blob-verwerking gebeurt hier in een aparte fase, vóór de transactie
 * geopend wordt; de transactie zelf bevat enkel kale db.klassen/db.leerlingen
 * put/add/update-calls op reeds klaargezette data.
 */
export async function importeerPreview(preview) {
  // ── Fase 1: alle niet-Dexie async-verwerking (blob -> ArrayBuffer) vooraf. ──
  const acties = []
  let genegeerd = 0

  for (const [klasId, info] of Object.entries(preview.perKlas)) {
    const bestaandeKlas = await db.klassen.get(klasId)
    if (!bestaandeKlas) {
      acties.push({ type: 'klas', id: klasId, naam: klasId.toUpperCase() })
    }

    for (const { leerling, foto } of info.matches) {
      if (!foto) continue
      const buffer = await foto.blob.arrayBuffer()
      acties.push({ type: 'update', leerlingId: leerling.id, buffer })
    }

    let volgnummer = volgendVolgnummer(klasId, info.matches.map(m => m.leerling))
    for (const foto of info.extraFotos) {
      const { voornaam, achternaam } = splitsNaamPdf(foto.naamPdf)
      if (!voornaam || !achternaam) { genegeerd++; continue }
      const id = `${klasId}_${String(volgnummer).padStart(2, '0')}`
      const buffer = await foto.blob.arrayBuffer()
      acties.push({ type: 'nieuw', id, klasId, voornaam, achternaam, buffer })
      volgnummer++
    }
  }

  // ── Fase 2: transactie bevat uitsluitend kale Dexie-calls, geen andere awaits. ──
  let nieuweKlassen = 0
  let nieuweLeerlingen = 0
  let bijgewerkteFotos = 0

  await db.transaction('rw', db.klassen, db.leerlingen, async () => {
    for (const actie of acties) {
      if (actie.type === 'klas') {
        await db.klassen.put({ id: actie.id, naam: actie.naam })
        nieuweKlassen++
      } else if (actie.type === 'update') {
        await db.leerlingen.update(actie.leerlingId, { fotoBlob: actie.buffer })
        bijgewerkteFotos++
      } else if (actie.type === 'nieuw') {
        await db.leerlingen.add({
          id: actie.id, klasId: actie.klasId, voornaam: actie.voornaam, achternaam: actie.achternaam, fotoBlob: actie.buffer,
        })
        nieuweLeerlingen++
      }
    }
  })

  return { nieuweKlassen, nieuweLeerlingen, bijgewerkteFotos, genegeerd }
}

async function bouwPreviewVoorKlas(klasId, fotosMetNaam) {
  const leerlingen = await db.leerlingen.where('klasId').equals(klasId).toArray()
  const { matches, extraFotos, dubbeleNamen } = matchFotosMetLeerlingen(leerlingen, fotosMetNaam)

  return {
    klasId,
    leerlingenAantal: leerlingen.length,
    fotosAantal: fotosMetNaam.length,
    aantalViaNaam: matches.filter(m => m.viaNaam).length,
    mismatch: leerlingen.length !== fotosMetNaam.length,
    matches,
    extraFotos,
    dubbeleNamen,
    geenLeerlingenInDexie: leerlingen.length === 0,
  }
}

/**
 * Bouwt de volledige preview (per klas: leerlingen<->foto's) voor de hele
 * PDF. Read-only — schrijft niets naar Dexie.
 *
 * @param {File} file
 * @param {{ onProgress?: (p: { page: number, numPages: number }) => void }} [opts]
 */
export async function bouwVolledigePreview(file, { onProgress } = {}) {
  const doc = await openDocument(file)
  const perKlasRuw = {}
  const overgeslagenPaginas = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const fullText = textContent.items.map(it => it.str).join(' ')
    const code = getClassCode(fullText)
    const klasId = klasIdFromCode(code)

    if (!klasId) {
      overgeslagenPaginas.push({ pageNum: i, code })
      onProgress?.({ page: i, numPages: doc.numPages })
      continue
    }

    const pageHeight = page.getViewport({ scale: 1 }).height
    const naamRegels = await extractNaamRegelsVanPagina(page)
    const fotoBboxen = await extractFotoBboxenVanPagina(page)
    const fotosRuw = await renderEnCropFotos(page, fotoBboxen)
    const fotos = fotosRuw.map(f => ({ ...f, bboxTopDown: fotoBboxNaarTopDown(f.bboxPdf, pageHeight) }))

    // BELANGRIJK: de naam-koppeling gebeurt hier, PER PAGINA — elke pagina
    // heeft haar eigen lokale coördinatensysteem, dus namen/foto's van
    // verschillende pagina's van dezelfde klas (bv. "4eLa" + "4eLaSt")
    // mogen nooit vóór de koppeling samengevoegd worden, anders kan een
    // naam van pagina 2 aan een foto van pagina 1 toegewezen worden.
    const fotosGesorteerd = sorteerFotosOpPositie(fotos)
    const fotosMetNaam = wijsNamenToeAanFotos(naamRegels, fotosGesorteerd)

    perKlasRuw[klasId] ??= []
    perKlasRuw[klasId].push(...fotosMetNaam)

    onProgress?.({ page: i, numPages: doc.numPages })
  }

  const perKlas = {}
  for (const [klasId, fotosMetNaam] of Object.entries(perKlasRuw)) {
    perKlas[klasId] = await bouwPreviewVoorKlas(klasId, fotosMetNaam)
  }

  return { perKlas, overgeslagenPaginas }
}
