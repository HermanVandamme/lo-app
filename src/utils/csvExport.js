/**
 * Eén gedeeld CSV-exportformaat voor alle scoreoverzichten in de app
 * (was voorheen 3 losse, onderling verschillende implementaties).
 */
function csvVeld(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map(r => r.map(csvVeld).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const SCORE_HEADER = ['leerling_naam', 'leerling_id', 'klas', 'sport', 'lpd', 'score', 'max_score', 'datum']

export function scoreRij({ leerling, klasNaam, sportNaam, item, score, datum }) {
  return [
    `${leerling.voornaam} ${leerling.achternaam}`,
    leerling.id,
    klasNaam,
    sportNaam,
    item.titel ?? item.lpd,
    score ?? '',
    item.max_score ?? '',
    datum,
  ]
}

export const KLEDIJ_HEADER = ['leerling_naam', 'leerling_id', 'klas', 'score', 'max_score', 'datum']

export function kledijRij({ leerling, klasNaam, score, cfg, datum }) {
  return [`${leerling.voornaam} ${leerling.achternaam}`, leerling.id, klasNaam, score, cfg.max_score, datum]
}

/** Kledijrij in SCORE_HEADER-formaat, zodat kledij mee kan in de algemene scores-export. */
export function kledijScoreRij({ leerling, klasNaam, score, cfg, datum }) {
  return [
    `${leerling.voornaam} ${leerling.achternaam}`,
    leerling.id,
    klasNaam,
    'Kledij',
    'Kledij',
    score,
    cfg.max_score,
    datum,
  ]
}
