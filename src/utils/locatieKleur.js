/**
 * Eén bron voor de locatiekleuren, gebruikt op de starttegels (Home) en in het
 * Jaarplan, zodat sporthal/turnzaal/alternatief overal dezelfde kleur hebben.
 */
export const LOCATIE_VOLGORDE = ['SPORTHAL', 'TURNZAAL', 'ALTERNATIEF']

export const LOCATIE_KLEUR = {
  SPORTHAL:    '#2980B9',
  TURNZAAL:    '#8E44AD',
  ALTERNATIEF: '#16A085',
}

export const LOCATIE_LABEL = {
  SPORTHAL:    'Sporthal',
  TURNZAAL:    'Turnzaal',
  ALTERNATIEF: 'Alternatief',
}

export function locatieKleur(locatie, fallback = '#7F8C8D') {
  return LOCATIE_KLEUR[locatie] ?? fallback
}
