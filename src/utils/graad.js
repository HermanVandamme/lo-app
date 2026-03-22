/**
 * Leid het lessenjaarniveau af uit een klas-ID op basis van het eerste cijfer.
 *   graad_1 = 4e jaar  (klas start met 4)
 *   graad_2 = 5e jaar  (klas start met 5)
 *   graad_3 = 6e jaar  (klas start met 6 of iets anders)
 */
export function graadFromKlasId(klasId) {
  const year = parseInt(klasId?.charAt(0) ?? '0', 10)
  if (year === 4) return 'graad_1'
  if (year === 5) return 'graad_2'
  return 'graad_3'
}

export const GRAAD_LABEL = {
  graad_1: '4e jaar',
  graad_2: '5e jaar',
  graad_3: '6e jaar',
}
