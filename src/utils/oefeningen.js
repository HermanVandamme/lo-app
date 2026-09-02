/**
 * Oefeningen per thema en per jaar.
 *
 * src/data/oefeningen.json:
 *   "<themaId>": {
 *     "alle_jaren": [ ... ]        // zelfde inhoud voor jaar 4, 5 en 6
 *     "jaar_4": [ ... ]            // of per jaar, dit heeft voorrang
 *     "extra": { "jaar_6": [ { titel, kleur, tekst } ] }
 *   }
 * Een oefening: { titel, opstelling, beschrijving, cues, makkelijker, moeilijker }
 */
import data from '../data/oefeningen.json'

export function oefeningenVoor(themaId, jaarKey) {
  const thema = data[themaId]
  if (!thema) return []
  return thema[jaarKey] ?? thema.alle_jaren ?? []
}

export function extraKnoppenVoor(themaId, jaarKey) {
  const extra = data[themaId]?.extra
  if (!extra) return []
  return extra[jaarKey] ?? extra.alle_jaren ?? []
}
