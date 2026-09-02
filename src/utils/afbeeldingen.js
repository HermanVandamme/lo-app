/**
 * Afbeeldingen per thema.
 *
 * Bestanden komen uit src/assets/afbeeldingen/<themaId>/<bestand>.
 * Vite leest die map bij het bouwen automatisch uit: een nieuwe map of
 * een nieuw bestand toevoegen volstaat, er moet niets geregistreerd worden.
 */
const modules = import.meta.glob(
  '../assets/afbeeldingen/**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, query: '?url', import: 'default' }
)

function bijschriftUit(bestandsnaam) {
  return bestandsnaam
    .replace(/\.[^.]+$/, '')      // extensie weg
    .replace(/^\d+[\s._-]*/, '')  // volgnummer weg
    .replace(/[_-]+/g, ' ')
    .trim()
}

const perThema = {}
for (const [pad, url] of Object.entries(modules)) {
  const match = pad.match(/afbeeldingen\/([^/]+)\/([^/]+)$/)
  if (!match) continue
  const [, themaId, bestand] = match
  if (!perThema[themaId]) perThema[themaId] = []
  perThema[themaId].push({ url, bestand, bijschrift: bijschriftUit(bestand) })
}
for (const lijst of Object.values(perThema)) {
  lijst.sort((a, b) => a.bestand.localeCompare(b.bestand, 'nl', { numeric: true }))
}

export function afbeeldingenVoor(themaId) {
  return perThema[themaId] ?? []
}
