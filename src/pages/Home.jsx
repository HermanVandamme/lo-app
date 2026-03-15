import { Link } from 'react-router-dom'
import sportsData from '../data/sports.json'

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
  return (
    <Link
      to={`/sport/${sport.id}`}
      className="block rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform bg-white"
    >
      <div className="relative h-32 bg-gray-300">
        <img
          src={`/images/${sport.image}`}
          alt={sport.name}
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
        <span className="absolute bottom-2 left-3 right-3 text-white font-bold text-base leading-tight drop-shadow">
          {sport.name}
        </span>
      </div>
    </Link>
  )
}
