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

export default function Home() {
  const sports = sportsData.sports ?? []

  return (
    <div>
      <h1 className="text-xl font-bold mb-4" style={{ color: '#2C3E50' }}>Kies een sport</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {sports.map(sport => (
          <SportTile key={sport.id} sport={sport} />
        ))}
      </div>
    </div>
  )
}

function SportTile({ sport }) {
  const imgUrl       = sport.image ? `${import.meta.env.BASE_URL}images/${sport.image}` : null
  const fallbackKleur = SPORT_KLEUR[sport.id] ?? '#7F8C8D'

  return (
    <Link
      to={`/sport/${sport.id}`}
      className="block rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform"
    >
      <div
        className="relative h-32"
        style={{ background: fallbackKleur }}
      >
        {imgUrl && (
          <img
            src={imgUrl}
            alt={sport.name}
            className="w-full h-full object-cover"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}

        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 60%)',
          }}
        />

        <span className="absolute bottom-2 left-3 right-3 text-white font-bold text-base leading-tight drop-shadow">
          {sport.name}
        </span>
      </div>
    </Link>
  )
}
