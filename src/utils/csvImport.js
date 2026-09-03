/**
 * CSV-import hulpfuncties voor leerlingdata.
 * Data blijft lokaal — nooit verzenden naar externe servers.
 *
 * De parser is bewust tolerant: exports uit Excel of Smartschool zetten velden
 * vaak tussen aanhalingstekens, gebruiken Windows-regeleindes, of bevatten een
 * komma binnen een naam. Die gevallen mogen niet stil de kolommen doen
 * verschuiven, want dan komen er verkeerde namen in de app terecht.
 */

/**
 * Splitst één CSV-regel in velden, met respect voor aanhalingstekens.
 * - "De Smet, Jan"  -> één veld met een komma erin
 * - "hij zei ""ja"""-> dubbele aanhalingstekens zijn één letterlijk teken
 */
export function splitsCsvRegel(regel) {
  const velden = []
  let huidig = ''
  let inQuotes = false

  for (let i = 0; i < regel.length; i++) {
    const teken = regel[i]
    if (inQuotes) {
      if (teken === '"') {
        if (regel[i + 1] === '"') { huidig += '"'; i++ }   // ontsnapt aanhalingsteken
        else inQuotes = false
      } else {
        huidig += teken
      }
    } else if (teken === '"') {
      inQuotes = true
    } else if (teken === ',') {
      velden.push(huidig); huidig = ''
    } else {
      huidig += teken
    }
  }
  velden.push(huidig)
  return velden.map(v => v.trim())
}

/**
 * Parseert een CSV-tekst naar rijen, en meldt wat er mis is in plaats van het
 * stil te laten passeren.
 *
 * @returns {{ rows: object[], waarschuwingen: string[] }}
 * @throws  als een verplichte kolom ontbreekt of het bestand leeg is
 */
export function parseCsv(text, verplichteKolommen = [], sleutelKolom = null) {
  const regels = String(text ?? '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter(r => r.trim() !== '')

  if (!regels.length) throw new Error('Het bestand is leeg.')

  const headers = splitsCsvRegel(regels[0]).map(h => h.toLowerCase())
  const ontbreekt = verplichteKolommen.filter(k => !headers.includes(k))
  if (ontbreekt.length) {
    throw new Error(
      `Kolom${ontbreekt.length > 1 ? 'men' : ''} ontbreek${ontbreekt.length > 1 ? 'en' : 't'}: ` +
      `${ontbreekt.join(', ')}. Verwacht: ${verplichteKolommen.join(', ')}.`
    )
  }

  const rows = []
  const waarschuwingen = []

  regels.slice(1).forEach((regel, i) => {
    const nummer = i + 2   // +1 voor de headerrij, +1 omdat mensen vanaf 1 tellen
    const waarden = splitsCsvRegel(regel)
    if (waarden.length !== headers.length) {
      waarschuwingen.push(`rij ${nummer}: ${waarden.length} kolommen i.p.v. ${headers.length}`)
    }
    const row = Object.fromEntries(headers.map((h, idx) => [h, waarden[idx] ?? '']))
    if (sleutelKolom && !row[sleutelKolom]) {
      waarschuwingen.push(`rij ${nummer}: geen ${sleutelKolom}, overgeslagen`)
      return
    }
    rows.push(row)
  })

  return { rows, waarschuwingen }
}

/** students.csv — kolommen: student_id, klas_id, voornaam, achternaam */
export function parseStudentsCsv(text) {
  return parseCsv(text, ['student_id', 'klas_id', 'voornaam', 'achternaam'], 'student_id')
}

/** classes.csv — kolommen: klas_id (naam is optioneel) */
export function parseKlassenCsv(text) {
  return parseCsv(text, ['klas_id'], 'klas_id')
}

/**
 * Importeer leerlingen en klassen in Dexie vanuit geparseerde CSV-rijen.
 */
export async function importStudentsToDb(db, rows) {
  const klassenSet = new Set(rows.map(r => r.klas_id.toLowerCase()))
  const klassen = [...klassenSet].map(id => ({ id, naam: id.toUpperCase() }))

  const leerlingen = rows.map(r => ({
    id: r.student_id,
    klasId: r.klas_id.toLowerCase(),
    voornaam: r.voornaam,
    achternaam: r.achternaam,
  }))

  await db.transaction('rw', db.klassen, db.leerlingen, async () => {
    await db.leerlingen.clear()
    await db.klassen.clear()
    await db.klassen.bulkPut(klassen)
    await db.leerlingen.bulkPut(leerlingen)
  })

  return { klassen: klassen.length, leerlingen: leerlingen.length }
}

/**
 * Koppel een foto-blob aan een leerling op basis van student_id.
 * Bestandsnaam moet overeenkomen met student_id (bv. 4e_01.png).
 */
export async function importPhotoForStudent(db, studentId, file) {
  const buffer = await file.arrayBuffer()
  const updated = await db.leerlingen.update(studentId, { fotoBlob: buffer })
  if (!updated) throw new Error(`Leerling ${studentId} niet gevonden`)
}
