/**
 * Evaluatie voor een sport/jaar, los van elke specifieke les — bereikbaar
 * ongeacht of er lesinhoud bestaat (zie bug: gym_loopoverslag heeft bewust
 * geen lesinhoud, maar moet wél evalueerbaar zijn).
 */
import { useParams, Link } from 'react-router-dom'
import sportsData from '../data/sports.json'
import { GRAAD_LABEL } from '../utils/graad'
import EvaluatieScherm from '../components/EvaluatieScherm'

export default function SportEvaluatie() {
  const { sportId, graad } = useParams()
  const sport = sportsData[sportId]

  if (!sport) return <p className="text-red-500 p-4">Sport niet gevonden.</p>

  return (
    <div>
      <Link to={`/sport/${sportId}`} className="text-sm mb-3 inline-block" style={{ color: '#E67E22' }}>
        ← {sport.naam}
      </Link>
      <h1 className="text-xl font-bold mb-0.5" style={{ color: '#2C3E50' }}>Evaluatie</h1>
      <p className="text-sm text-gray-400 mb-4">{GRAAD_LABEL[graad] ?? graad}</p>
      <EvaluatieScherm sportId={sportId} graadFilter={graad} />
    </div>
  )
}
