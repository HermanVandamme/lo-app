/**
 * Gedeelde scoring-hulpfuncties voor het evaluatiesysteem.
 */

/** Niveau-string → numerieke score (/10) */
export const NIVEAU_SCORE = {
  zwak:       2.5,
  voldoende:  5,
  goed:       7.5,
  uitstekend: 10,
}

/** Kledij-teller → score (/10). 0× = 10, 1× = 8, 2× = 6, … ≥5× = 0 */
export function kledijScore(count) {
  return Math.max(0, 10 - Math.floor(count ?? 0) * 2)
}

/**
 * Bereken eindscore per leerling per les (rubrics + manuele score).
 * Kledij wordt apart bijgehouden en niet meegenomen hier.
 * @param {object} scores       - { lpd_2: 'goed', numeriek: 8, ... }
 * @param {string[]} rubricKeys - LPD-sleutels die meegenomen worden als rubric
 * @returns {number|null}       - Gemiddelde van alle ingevulde deelscores, of null
 */
export function berekenEindScore(scores, rubricKeys) {
  const deelscores = []

  // Rubric-scores (niveau-string) en numerieke scores (testprotocol/upload)
  for (const key of rubricKeys ?? []) {
    const v = scores?.[key]
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && NIVEAU_SCORE[v] !== undefined) {
      deelscores.push(NIVEAU_SCORE[v])
    } else if (typeof v === 'number' && !isNaN(v)) {
      deelscores.push(v)
    }
  }

  // Manuele numerieke score (legacy key)
  if (scores?.numeriek !== undefined && scores.numeriek !== null) {
    deelscores.push(Number(scores.numeriek))
  }

  if (deelscores.length === 0) return null
  const gem = deelscores.reduce((a, b) => a + b, 0) / deelscores.length
  return Math.round(gem * 10) / 10
}

/** Kleur op basis van score /10 */
export function scoreKleur(score) {
  if (score === null || score === undefined) return '#9ca3af'
  if (score >= 7) return '#27AE60'
  if (score >= 5) return '#E67E22'
  return '#E74C3C'
}
