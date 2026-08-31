import { Link } from 'react-router-dom'
import sportsData from '../data/sports.json'

const SPORT_KLEUR = {
  basketbal:      '#E67E22',
  volleybal:      '#2980B9',
  badminton:      '#27AE60',
  handbal:        '#C0392B',
  voetbal:        '#16A085',
  judo:           '#8E44AD',
  klimmen:        '#D35400',
  ehbo:           '#E74C3C',
  duurloop:       '#1A5276',
  gaelic_football:'#117A65',
  baseball:       '#7D6608',
  gymnastiek:     '#6C3483',
  ritmiek:        '#1F618D',
}

const LOCATIE_VOLGORDE = ['SPORTHAL', 'TURNZAAL', 'ALTERNATIEF']
const LOCATIE_LABEL = { SPORTHAL: 'Sporthal', TURNZAAL: 'Turnzaal', ALTERNATIEF: 'Alternatief' }

export default function Home() {
  const sortNaam = ([, a], [, b]) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })
  const alleSporten = Object.entries(sportsData)

  const groepen = LOCATIE_VOLGORDE
    .map(locatie => ({
      locatie,
      sporten: alleSporten.filter(([, sport]) => sport.locatie === locatie).sort(sortNaam),
    }))
    .filter(g => g.sporten.length > 0)

  // Sporten zonder (herkend) locatie-veld toch tonen, als vangnet
  const overig = alleSporten.filter(([, sport]) => !LOCATIE_VOLGORDE.includes(sport.locatie)).sort(sortNaam)

  return (
    <div>
      <h1 className="text-xl font-bold mb-4" style={{ color: '#2C3E50' }}>Kies een sport</h1>
      {groepen.map(({ locatie, sporten }) => (
        <div key={locatie} className="mb-6">
          <p className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">{LOCATIE_LABEL[locatie]}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sporten.map(([id, sport]) => (
              <SportTile key={id} id={id} sport={sport} />
            ))}
          </div>
        </div>
      ))}
      {overig.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Overige</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {overig.map(([id, sport]) => (
              <SportTile key={id} id={id} sport={sport} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SportTile({ id, sport }) {
  const fallbackKleur = SPORT_KLEUR[id] ?? '#7F8C8D'
  const imgUrl = `${import.meta.env.BASE_URL}images/${id}.jpg`

  return (
    <Link
      to={`/sport/${id}`}
      className="block rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform"
    >
      <div
        className="relative h-32"
        style={{ background: fallbackKleur }}
      >
        <img
          src={imgUrl}
          alt={sport.naam}
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />

        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 60%)',
          }}
        />

        <span className="absolute bottom-2 left-3 right-3 text-white font-bold text-base leading-tight drop-shadow">
          {sport.naam}
        </span>
      </div>
    </Link>
  )
}
