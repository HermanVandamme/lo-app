import lpdData from '../data/lpd.json'

/** Geeft de volledige omschrijving van 1 LPD-nummer terug (of null als onbekend). */
export function lpdOmschrijving(nr) {
  return lpdData[String(nr)] ?? null
}

/** Geeft [{nr, omschrijving}] terug voor een lijst LPD-nummers, in oplopende volgorde. */
export function lpdOmschrijvingen(nummers) {
  return [...nummers]
    .sort((a, b) => a - b)
    .map(nr => ({ nr, omschrijving: lpdOmschrijving(nr) }))
    .filter(item => item.omschrijving)
}

export default lpdData
