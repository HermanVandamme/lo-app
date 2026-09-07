/**
 * Berekent de eindscore van één evaluatie-item op basis van de ingevulde
 * klikcriteria (`waarden`), voor elk van de 11 types in evaluatie.json.
 *
 * `waarden` is een plat object van sub-sleutel → waarde, gescoped op dit ene
 * item (zie EvaluatieScherm voor hoe dit uit Dexie-scores wordt opgebouwd:
 * sleutel in de db = `${item.id}::${subKey}`).
 */
/**
 * Schaalt een opgetelde score naar de eindschaal van het item, op basis van
 * ENKEL de onderdelen die effectief ingevuld zijn.
 *
 * Een niet-ingevuld criterium telt dus niet mee: wie 4 van de 5 criteria
 * ingevuld krijgt, wordt beoordeeld op die 4 en verliest geen punten voor het
 * vijfde. Is alles ingevuld, dan komt dit exact op hetzelfde neer als vroeger
 * (de som van de maxima is in alle rubrics gelijk aan max_score_ruw/max_score).
 *
 * @param somIngevuld  opgetelde punten van de ingevulde onderdelen
 * @param maxIngevuld  opgetelde maxima van diezelfde onderdelen
 * @param maxScore     eindschaal van het item (bv. 10)
 */
function schaalNaarIngevuld(somIngevuld, maxIngevuld, maxScore) {
  if (!maxIngevuld) return null
  if (!maxScore) return Math.round(somIngevuld * 10) / 10
  return Math.round((somIngevuld / maxIngevuld) * maxScore * 10) / 10
}

/** Maximum van één checklist-item: eigen max_punten, anders de hoogste optie. */
function maxVanChecklistItem(subItem, optiesPerItem) {
  if (typeof subItem?.max_punten === 'number') return subItem.max_punten
  const opties = optiesPerItem ?? [0, 1]
  return Math.max(...opties)
}

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
      let som = 0, maxIngevuld = 0, aantal = 0
      items.forEach((subItem, idx) => {
        const v = waarden[`i${idx}`]
        if (v === undefined || v === null) return
        som += Number(v)
        maxIngevuld += maxVanChecklistItem(subItem, item.opties_per_item)
        aantal++
      })
      if (!aantal) return null
      return schaalNaarIngevuld(som, maxIngevuld, item.max_score)
    }

    case 'dropdown_score': {
      const v = waarden.score
      return v === undefined || v === null ? null : Number(v)
    }

    case 'dropdown_meerdere': {
      let som = 0, maxIngevuld = 0, aantal = 0
      ;(item.items ?? []).forEach((subItem, idx) => {
        const v = waarden[`i${idx}`]
        if (v === undefined || v === null) return
        som += Number(v)
        maxIngevuld += subItem.max_score ?? Math.max(...(subItem.opties ?? [0]))
        aantal++
      })
      if (!aantal) return null
      return schaalNaarIngevuld(som, maxIngevuld, item.max_score)
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
      if (v !== undefined && v !== null) return Number(v)
      // Enkel bij een permanente evaluatie (bv. Kledij) staat de tracker altijd
      // actief op start_score. Andere trackers (bv. Boulderen) tellen pas mee
      // vanaf de eerste + of - klik van de leerkracht.
      return item.type_globaal === 'permanente_evaluatie' ? (item.start_score ?? null) : null
    }

    case 'video_upload_score': {
      if (item.onderdelen) {
        let som = 0, maxIngevuld = 0, aantal = 0
        item.onderdelen.forEach((sub, idx) => {
          const v = waarden[`o${idx}`]
          if (v === undefined || v === null) return
          som += Number(v)
          maxIngevuld += sub.max_score ?? 0
          aantal++
        })
        if (!aantal) return null
        // Geen eigen max_score? Dan is de som van alle onderdelen de eindschaal.
        const eindschaal = item.max_score ?? item.onderdelen.reduce((t, sub) => t + (sub.max_score ?? 0), 0)
        return schaalNaarIngevuld(som, maxIngevuld, eindschaal)
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
      let som = 0, maxIngevuld = 0, aantal = 0
      subScores.forEach((score, idx) => {
        if (score === null || score === undefined) return
        som += score
        maxIngevuld += (item.onderdelen ?? [])[idx]?.max_score ?? 0
        aantal++
      })
      if (!aantal) return null
      const eindschaal = item.max_score ?? (item.onderdelen ?? []).reduce((t, sub) => t + (sub.max_score ?? 0), 0)
      return schaalNaarIngevuld(som, maxIngevuld, eindschaal)
    }

    default:
      return null
  }
}

/**
 * Telt het aantal losse klikbare scoreveldjes dat een evaluatie-item bevat.
 * Gebruikt om te bepalen of een item met precies 1 veld meteen inline in de
 * klaslijst getoond kan worden (zie EvaluatieScherm), i.p.v. via foto-klik
 * naar een detailscherm.
 */
export function telScoreVelden(item) {
  if (!item) return 0
  switch (item.type) {
    case 'rubric_klikcriteria':
      return item.criteria?.length ?? 0
    case 'checklist_punten':
      if (item.scenario_varianten) {
        // scenario-keuze is een extra stap bovenop de items zelf
        return (item.scenario_varianten[0]?.items?.length ?? 0) + 1
      }
      return item.items?.length ?? 0
    case 'dropdown_meerdere':
      return item.items?.length ?? 0
    case 'video_upload_score':
      return item.onderdelen ? item.onderdelen.length : 1
    case 'samengesteld':
      return (item.onderdelen ?? []).reduce((som, sub) => som + telScoreVelden(sub), 0)
    default:
      return 1
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
