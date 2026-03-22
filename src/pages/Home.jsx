import { useState } from 'react'
import { Link } from 'react-router-dom'
import sportsData from '../data/sports.json'

// Fallback achtergrondkleuren per sport
const SPORT_KLEUR = {
  basketbal: '#E67E22',
  volleybal:  '#2980B9',
  badminton:  '#27AE60',
  handbal:    '#C0392B',
  voetbal:    '#16A085',
  judo:       '#8E44AD',
  klimmen:    '#D35400',
  ehbo:       '#E74C3C',
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
  const [imgFailed, setImgFailed] = useState(false)
  const fallbackKleur = SPORT_KLEUR[sport.id] ?? '#7F8C8D'

  return (
    <Link
      to={`/sport/${sport.id}`}
      className="block rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform"
    >
      <div
        className="relative h-32"
        style={{ background: imgFailed ? fallbackKleur : '#d1d5db' }}
      >
        {!imgFailed && (
          <img
            src={`${import.meta.env.BASE_URL}images/${sport.image}`}
            alt={sport.name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}

        {/* Gradient overlay (ook bij fallback-kleur) */}
        <div
          className="absolute inset-0"
          style={{
            background: imgFailed
              ? 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 60%)'
              : 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 60%)',
          }}
        />

        <span className="absolute bottom-2 left-3 right-3 text-white font-bold text-base leading-tight drop-shadow">
          {sport.name}
        </span>
      </div>
    </Link>
  )
}
