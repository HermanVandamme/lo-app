/**
 * Streefwaarden voor een duurlooptest, berekend uit de tijdentabel.
 *
 * Leerlingen vragen vóór de test wat ze moeten halen. Deze functie leidt uit
 * de tijdentabel af, voor score 10 en score 5, en apart voor jongens en
 * meisjes: de snelheid (km/u), de tijd per rondje en de tijd per kilometer.
 *
 * Werkt enkel voor items die een tijdentabel én afstand/rondjes meegeven; voor
 * alle andere evaluaties geeft het null terug (dan verschijnt er geen kader).
 * Zo blijven de waarden automatisch juist als de tijden of het aantal rondjes
 * ooit wijzigen — er wordt niets hardgecodeerd.
 */

/** Zet een tijdstring om naar seconden. Ondersteunt "mm:ss" en "14 min" / "17,5 min". */
function tijdNaarSeconden(tijd) {
  const s = String(tijd).trim()
  if (s.includes(':')) {
    const [m, sec] = s.split(':')
    return Number(m) * 60 + Number(sec)
  }
  const minuten = parseFloat(s.replace(' min', '').replace(',', '.'))
  return Math.round(minuten * 60)
}

/** Sleutel waarmee een dropdown-optie in de tabel opgezocht wordt (zie EvaluatieVeld). */
function tabelSleutel(optie) {
  return String(optie).replace(' min', '').replace(',', '.')
}

/** Seconden -> "m:ss". */
function secNaarMMSS(totaal) {
  const m = Math.floor(totaal / 60)
  const s = Math.round(totaal - m * 60)
  // afronding kan 60 opleveren
  if (s === 60) return `${m + 1}:00`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** km/u met 1 decimaal, komma als scheidingsteken. */
function kmuTekst(afstandKm, seconden) {
  const kmu = (afstandKm * 3600) / seconden
  return `${kmu.toFixed(1).replace('.', ',')} km/u`
}

/** Zoekt de tijdstring die exact `score` oplevert, voor jongens of meisjes. */
function tijdVoorScore(item, geslacht, score) {
  const dropdown = geslacht === 'jongens' ? item.dropdown_jongens : item.dropdown_meisjes
  const tabel = geslacht === 'jongens' ? item.tabel_jongens : item.tabel_meisjes
  if (!dropdown || !tabel) return null
  for (const optie of dropdown) {
    if (tabel[tabelSleutel(optie)] === score) return optie
  }
  return null
}

function regelsVoor(item, geslacht) {
  const uit = {}
  for (const score of [10, 5]) {
    const tijd = tijdVoorScore(item, geslacht, score)
    if (tijd == null) return null
    const sec = tijdNaarSeconden(tijd)
    uit[score] = {
      snelheid: kmuTekst(item.afstand_km, sec),
      perRondje: secNaarMMSS(sec / item.aantal_rondjes),
      perKm: secNaarMMSS(sec / item.afstand_km),
    }
  }
  return uit
}

/**
 * Geeft de streefinfo voor een evaluatie-item terug, of null als het item geen
 * duurlooptest met tijdentabel + afstand + rondjes is.
 */
export function duurloopInfo(item) {
  if (
    !item ||
    item.type !== 'dropdown_tijd_lookup' ||
    !item.afstand_km ||
    !item.aantal_rondjes
  ) return null

  const jongens = regelsVoor(item, 'jongens')
  const meisjes = regelsVoor(item, 'meisjes')
  if (!jongens || !meisjes) return null

  return {
    afstandKm: item.afstand_km,
    aantalRondjes: item.aantal_rondjes,
    jongens,
    meisjes,
  }
}
