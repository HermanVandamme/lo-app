/**
 * CSV-import hulpfuncties voor leerlingdata.
 * Data blijft lokaal — nooit verzenden naar externe servers.
 */

/**
 * Parseer een CSV-string naar een array van objecten.
 * Verwacht headerrij: student_id, klas_id, voornaam, achternaam
 */
export function parseStudentsCsv(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim())

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  }).filter(row => row.student_id)
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
