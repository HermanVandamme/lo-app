import { useParams, Link } from 'react-router-dom'
import sportsData from '../data/sports.json'
import lessonsData from '../data/lessons.json'

const JAAR_LABEL = { 4: '4e jaar', 5: '5e jaar', 6: '6e jaar' }

export default function SportDetail() {
  const { sportId } = useParams()
  const sport = sportsData[sportId]
  const sportLessons = lessonsData[sportId] ?? {}

  if (!sport) return <p className="text-red-500 p-4">Sport niet gevonden.</p>

  // Jaren komen uit sports.json (ground truth voor welke jaren dit thema aanbiedt),
  // NIET uit lessons.json — anders is Evaluatie onbereikbaar voor thema's zonder
  // lesinhoud (bv. gym_loopoverslag heeft bewust geen lessen, wel evaluatie).
  const jaren = (sport.jaren ?? []).map(nr => ({ key: `jaar_${nr}`, label: JAAR_LABEL[nr] ?? `jaar ${nr}` }))

  return (
    <div>
      {/* Header */}
      <div className="relative h-36 rounded-2xl overflow-hidden mb-5 shadow" style={{ background: '#2C3E50' }}>
        <img
          src={`${import.meta.env.BASE_URL}images/${sportId}.jpg`}
          alt={sport.naam}
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <Link to="/" className="text-white/70 text-xs hover:text-white">← Terug</Link>
          <h1 className="text-2xl font-bold text-white">{sport.naam}</h1>
        </div>
      </div>

      {/* Jaren */}
      {jaren.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-1">Geen jaren ingesteld voor dit thema.</p>
      ) : (
        <div className="space-y-3">
          {jaren.map(({ key, label }) => {
            const gradeData = sportLessons[key]
            // Lege ("null") lesplaatsen negeren — komen voor in lessons.json als placeholder.
            const lesKeys = gradeData ? Object.keys(gradeData).filter(k => gradeData[k] != null) : []

            return (
              <div key={key} className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-bold text-base mb-3" style={{ color: '#2C3E50' }}>{label}</h2>

                {lesKeys.length > 0 && (
                  <div className="flex gap-2 mb-2">
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
                )}

                {/* Evaluatie is altijd bereikbaar, los van of er lesinhoud bestaat */}
                <Link
                  to={`/sport/${sportId}/graad/${key}/evaluatie`}
                  className="block rounded-xl py-2.5 px-2 text-center font-semibold text-sm transition-colors active:scale-95"
                  style={{ background: '#27AE60', color: 'white' }}
                >
                  📋 Evaluatie
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
