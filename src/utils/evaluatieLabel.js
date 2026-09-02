/**
 * Label voor de evaluatieknop, bv. "Evaluatie LPD 5 + 6".
 * De LPD-nummers komen uit evaluatie.json — de inhoud daarvan blijft ongewijzigd.
 */
import { getEvaluatiesVoorSport } from './evaluatieData'

/** Geeft de LPD-nummers (oplopend, uniek) voor een sport + jaar terug, bv. [5, 6]. */
export function evaluatieLpdNummers(sportId, jaarNr) {
  const items = getEvaluatiesVoorSport(sportId, jaarNr)
  const nummers = []
  for (const item of items) {
    const codes = String(item.lpd ?? '').match(/\d+/g)
    if (!codes) continue
    for (const code of codes) {
      const nr = Number(code)
      if (!nummers.includes(nr)) nummers.push(nr)
    }
  }
  return nummers.sort((a, b) => a - b)
}

export function evaluatieLabel(sportId, jaarNr) {
  const items = getEvaluatiesVoorSport(sportId, jaarNr)
  if (!items.length) return 'Evaluatie'

  const nummers = evaluatieLpdNummers(sportId, jaarNr)
  if (!nummers.length) return 'Evaluatie (vrije score)'
  return `Evaluatie LPD ${nummers.join(' + ')}`
}
