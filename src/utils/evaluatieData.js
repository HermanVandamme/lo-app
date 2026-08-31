/**
 * Toegang tot evaluatie.json — evaluatie-items (LPD's) per sport/jaar.
 */
import evaluatieData from '../data/evaluatie.json'
import sportsData from '../data/sports.json'

/** Evaluatie-items voor een sport, gefilterd op jaar (4/5/6). */
export function getEvaluatiesVoorSport(sportId, jaarNr) {
  const sportEval = evaluatieData[sportId]
  if (sportEval?.evaluaties) {
    return sportEval.evaluaties.filter(item => item.jaren?.includes(jaarNr))
  }

  // Thema's zonder eigen LPD's (varia, fietsen, frisbee, ...) gebruiken de vrije-score-fallback
  const sport = sportsData[sportId]
  const fallback = evaluatieData.overige_themas_vrije_score
  if (sport && fallback?.toepassing?.includes(sport.naam) && sport.jaren?.includes(jaarNr)) {
    return [{
      id: `${sportId}_vrij`,
      lpd: 'Vrije score',
      titel: sport.naam,
      jaren: sport.jaren,
      type: fallback.type,
      scored_by: fallback.scored_by,
      max_score: fallback.max_score,
    }]
  }

  return []
}

export function getKledijConfig() {
  return evaluatieData.kledij?.evaluatie ?? {
    type: 'plus_min_tracker',
    scored_by: 'leerkracht',
    start_score: 10,
    max_score: 10,
    min_score: 0,
    aftrek_per_overtreding: 3,
  }
}
