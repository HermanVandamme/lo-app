/**
 * Leid het lessenjaarniveau af uit een klas-ID op basis van het eerste cijfer.
 *   jaar_4 = 4e jaar  (klas start met 4)
 *   jaar_5 = 5e jaar  (klas start met 5)
 *   jaar_6 = 6e jaar  (klas start met 6 of iets anders)
 */
export function graadFromKlasId(klasId) {
  const year = parseInt(klasId?.charAt(0) ?? '0', 10)
  if (year === 4) return 'jaar_4'
  if (year === 5) return 'jaar_5'
  return 'jaar_6'
}

export const GRAAD_LABEL = {
  jaar_4: '4e jaar',
  jaar_5: '5e jaar',
  jaar_6: '6e jaar',
}
