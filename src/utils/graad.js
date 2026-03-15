/**
 * Leid de graad af uit een klas-ID op basis van het eerste cijfer (= jaarnummer).
 *   graad_1 = 1e–2e jaar   (klas start met 1 of 2)
 *   graad_2 = 3e–4e jaar   (klas start met 3 of 4)
 *   graad_3 = 5e–6e jaar   (klas start met 5 of 6)
 */
export function graadFromKlasId(klasId) {
  const year = parseInt(klasId?.charAt(0) ?? '0', 10)
  if (year <= 2) return 'graad_1'
  if (year <= 4) return 'graad_2'
  return 'graad_3'
}

export const GRAAD_LABEL = {
  graad_1: '1e graad  (1e–2e jaar)',
  graad_2: '2e graad  (3e–4e jaar)',
  graad_3: '3e graad  (5e–6e jaar)',
}
