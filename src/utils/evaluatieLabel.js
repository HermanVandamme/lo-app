/**
 * Labels voor de groene evaluatieknoppen, bv. "Evaluatie LPD 4 les 1".
 * De LPD-nummers komen uit evaluatie.json — de inhoud daarvan blijft ongewijzigd.
 */
import { getEvaluatiesVoorSport } from './evaluatieData'

/** LPD-nummers van één evaluatie-item, oplopend en zonder dubbels. */
export function lpdNummersVanItem(item) {
  const codes = String(item?.lpd ?? '').match(/\d+/g) ?? []
  return [...new Set(codes.map(Number))].sort((a, b) => a - b)
}

/**
 * Label voor één knop. Een item mag een `knoplabel` meegeven om twee knoppen
 * van hetzelfde LPD uit elkaar te houden (bv. duurloop: "les 1" en "les 2").
 */
export function evaluatieItemLabel(item) {
  const nummers = lpdNummersVanItem(item)
  const basis = nummers.length ? `Evaluatie LPD ${nummers.join(' + ')}` : 'Evaluatie (vrije score)'
  return item?.knoplabel ? `${basis} ${item.knoplabel}` : basis
}

/** Alle LPD-nummers van een sport + jaar samen (voor overzichten). */
export function evaluatieLpdNummers(sportId, jaarNr) {
  const nummers = []
  for (const item of getEvaluatiesVoorSport(sportId, jaarNr)) {
    for (const nr of lpdNummersVanItem(item)) {
      if (!nummers.includes(nr)) nummers.push(nr)
    }
  }
  return nummers.sort((a, b) => a - b)
}

/** Samenvattend label wanneer alle evaluaties van een jaar onder één knop staan. */
export function evaluatieLabel(sportId, jaarNr) {
  const items = getEvaluatiesVoorSport(sportId, jaarNr)
  if (!items.length) return 'Evaluatie'
  const nummers = evaluatieLpdNummers(sportId, jaarNr)
  if (!nummers.length) return 'Evaluatie (vrije score)'
  return `Evaluatie LPD ${nummers.join(' + ')}`
}
