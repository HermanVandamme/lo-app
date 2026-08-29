/**
 * Berekent de eindscore van één evaluatie-item op basis van de ingevulde
 * klikcriteria (`waarden`), voor elk van de 11 types in evaluatie.json.
 *
 * `waarden` is een plat object van sub-sleutel → waarde, gescoped op dit ene
 * item (zie EvaluatieScherm voor hoe dit uit Dexie-scores wordt opgebouwd:
 * sleutel in de db = `${item.id}::${subKey}`).
 */
export function berekenEvaluatieScore(item, waarden) {
  if (!item || !waarden) return null

  switch (item.type) {
    case 'rubric_klikcriteria': {
      const vals = (item.criteria ?? [])
        .map((_, idx) => waarden[`c${idx}`])
        .filter(v => v !== undefined && v !== null)
      if (!vals.length) return null
      const gem = vals.reduce((a, b) => a + b, 0) / vals.length
      return Math.round(gem * 10) / 10
    }

    case 'checklist_punten': {
      const items = item.scenario_varianten
        ? (waarden.variant != null ? item.scenario_varianten[waarden.variant]?.items : null)
        : item.items
      if (!items) return null
      const vals = items.map((_, idx) => waarden[`i${idx}`]).filter(v => v !== undefined && v !== null)
      if (!vals.length) return null
      return vals.reduce((a, b) => a + b, 0)
    }

    case 'dropdown_score': {
      const v = waarden.score
      return v === undefined || v === null ? null : Number(v)
    }

    case 'dropdown_meerdere': {
      const vals = (item.items ?? []).map((_, idx) => waarden[`i${idx}`]).filter(v => v !== undefined && v !== null)
      if (!vals.length) return null
      const ruw = vals.reduce((a, b) => a + b, 0)
      if (item.max_score_ruw && item.max_score) {
        return Math.round((ruw / item.max_score_ruw) * item.max_score * 10) / 10
      }
      return ruw
    }

    case 'direct_score_test':
    case 'vrije_score':
    case 'vrije_score_optioneel':
    case 'dropdown_tijd_lookup': {
      const v = waarden.score
      return v === undefined || v === null ? null : Number(v)
    }

    case 'plus_min_tracker': {
      const v = waarden.score
      return v === undefined || v === null ? (item.start_score ?? null) : Number(v)
    }

    case 'video_upload_score': {
      if (item.onderdelen) {
        const vals = item.onderdelen.map((_, idx) => waarden[`o${idx}`]).filter(v => v !== undefined && v !== null)
        if (!vals.length) return null
        return vals.reduce((a, b) => a + b, 0)
      }
      const v = waarden.score
      return v === undefined || v === null ? null : Number(v)
    }

    case 'samengesteld': {
      const subScores = (item.onderdelen ?? []).map((sub, idx) => {
        const prefix = `o${idx}_`
        const subWaarden = {}
        for (const k in waarden) {
          if (k.startsWith(prefix)) subWaarden[k.slice(prefix.length)] = waarden[k]
        }
        return berekenEvaluatieScore(sub, subWaarden)
      })
      const gevuld = subScores.filter(v => v !== null && v !== undefined)
      if (!gevuld.length) return null
      const ruw = gevuld.reduce((a, b) => a + b, 0)
      if (item.max_score_ruw && item.max_score) {
        return Math.round((ruw / item.max_score_ruw) * item.max_score * 10) / 10
      }
      return ruw
    }

    default:
      return null
  }
}

/** Kleur op basis van score/maxScore, genormaliseerd naar een schaal op 10. */
export function scoreKleurGenormaliseerd(score, maxScore) {
  if (score === null || score === undefined || !maxScore) return '#9ca3af'
  const op10 = (score / maxScore) * 10
  if (op10 >= 7) return '#27AE60'
  if (op10 >= 5) return '#E67E22'
  return '#E74C3C'
}
