import { Link } from 'react-router-dom'

export default function SportCard({ sport }) {
  return (
    <Link
      to={`/sport/${sport.id}`}
      className="block rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow bg-white"
    >
      <div className="relative h-40 bg-gray-200">
        <img
          src={`/images/${sport.image}`}
          alt={sport.name}
          className="w-full h-full object-cover"
          onError={e => { e.target.style.display = 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <h2 className="absolute bottom-3 left-4 text-white font-bold text-xl drop-shadow">
          {sport.name}
        </h2>
      </div>
      <div className="px-4 py-2 text-sm text-gray-500">
        {sport.panels?.length} panels per les
      </div>
    </Link>
  )
}
