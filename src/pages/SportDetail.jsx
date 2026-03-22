import { useParams, Link } from 'react-router-dom'
import sportsData from '../data/sports.json'
import lessonsData from '../data/lessons.json'

const JAAR_GRADEN = [
  { key: 'graad_1', label: '4e jaar' },
  { key: 'graad_2', label: '5e jaar' },
  { key: 'graad_3', label: '6e jaar' },
]

export default function SportDetail() {
  const { sportId } = useParams()
  const sport = sportsData.sports.find(s => s.id === sportId)
  const sportLessons = lessonsData[sportId] ?? {}

  if (!sport) return <p className="text-red-500 p-4">Sport niet gevonden.</p>

  // Only show jaren that have lessons in lessons.json
  const availableJaren = JAAR_GRADEN.filter(({ key }) => {
    const gradeData = sportLessons[key]
    return gradeData && Object.keys(gradeData).length > 0
  })

  return (
    <div>
      {/* Header */}
      <div className="relative h-36 rounded-2xl overflow-hidden mb-5 shadow">
        <img
          src={`/images/${sport.image}`}
          alt={sport.name}
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <Link to="/" className="text-white/70 text-xs hover:text-white">← Terug</Link>
          <h1 className="text-2xl font-bold text-white">{sport.name}</h1>
        </div>
      </div>

      {/* Jaren */}
      {availableJaren.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-1">Nog geen lessen beschikbaar.</p>
      ) : (
        <div className="space-y-3">
          {availableJaren.map(({ key, label }) => {
            const gradeData = sportLessons[key]
            const lesKeys = Object.keys(gradeData)

            return (
              <div key={key} className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-bold text-base mb-3" style={{ color: '#2C3E50' }}>{label}</h2>
                <div className="flex gap-2">
                  {lesKeys.map(lesKey => {
                    const les = gradeData[lesKey]
                    const lesNr = lesKey.replace('les_', '')
                    return (
                      <Link
                        key={lesKey}
                        to={`/sport/${sportId}/graad/${key}/les/${lesKey}`}
                        className="flex-1 rounded-xl py-3 px-2 text-center font-semibold text-sm transition-colors active:scale-95"
                        style={{ background: '#E67E22', color: 'white' }}
                      >
                        <span className="block text-lg font-bold">Les {lesNr}</span>
                        <span className="block text-xs opacity-80 mt-0.5 leading-tight line-clamp-2">{les.titel}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
