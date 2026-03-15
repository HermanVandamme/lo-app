import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import sportsData from '../data/sports.json'
import lessonsData from '../data/lessons.json'
import EvaluatiePanel from '../components/EvaluatiePanel'

const PANEL_LABELS = {
  opwarming:  'Opwarming',
  oefening_1: 'Oefening 1',
  oefening_2: 'Oefening 2',
  spelvorm:   'Spelvorm',
  evaluatie:  'Evaluatie',
  station_1:  'Station 1',
  station_2:  'Station 2',
  reeks:      'Reeks',
}

export default function LesDetail() {
  const { sportId, graad, les } = useParams()
  const [openPanel, setOpenPanel] = useState(null)

  const sport   = sportsData.sports.find(s => s.id === sportId)
  const lesData = lessonsData[sportId]?.[graad]?.[les]

  if (!sport || !lesData) {
    return <p className="text-red-500 p-4">Les niet gevonden.</p>
  }

  const panelEntries = (sport.panels ?? []).map(label => {
    const key = Object.keys(PANEL_LABELS).find(k => PANEL_LABELS[k] === label) ?? label.toLowerCase()
    return { key, label, content: lesData.panels?.[key] ?? '' }
  })

  const graadNr = graad.replace('graad_', '')
  const lesNr   = les.replace('les_', '')

  function toggle(key) {
    setOpenPanel(prev => prev === key ? null : key)
  }

  return (
    <div>
      <Link to={`/sport/${sportId}`} className="text-sm mb-3 inline-block" style={{ color: '#E67E22' }}>
        ← {sport.name}
      </Link>
      <h1 className="text-xl font-bold mb-0.5" style={{ color: '#2C3E50' }}>{lesData.titel}</h1>
      <p className="text-sm text-gray-400 mb-4">{graadNr}e graad · les {lesNr}</p>

      <div className="space-y-2">
        {panelEntries.map(({ key, label, content }, idx) => {
          const isEvaluatie = label === 'Evaluatie'
          const isOpen      = openPanel === key

          return (
            <div key={key} className="bg-white rounded-2xl shadow overflow-hidden">

              {/* Accordion-header */}
              <button
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between px-4 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: isEvaluatie ? '#27AE60' : '#E67E22' }}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-base" style={{ color: '#2C3E50' }}>
                    {label}
                  </span>
                </div>
                <span
                  className="text-xl font-light"
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', color: '#E67E22' }}
                >
                  ›
                </span>
              </button>

              {/* Accordion-inhoud */}
              {isOpen && (
                <div className="px-4 pb-5 border-t border-gray-100 pt-3">
                  {isEvaluatie ? (
                    /* ── Interactief evaluatie-panel ── */
                    <EvaluatiePanel
                      sportId={sportId}
                      graad={graad}
                      les={les}
                      rubrics={lesData.rubrics ?? {}}
                      evaluatieTekst={content}
                    />
                  ) : (
                    /* ── Gewone tekst-panelen ── */
                    content
                      ? <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{content}</p>
                      : <p className="text-sm text-gray-400 italic">Geen inhoud beschikbaar.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
