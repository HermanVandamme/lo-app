import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import sportsData from '../data/sports.json'
import lessonsData from '../data/lessons.json'
import EvaluatiePanel from '../components/EvaluatiePanel'

const PANEL_KEY_MAP = {
  'Opwarming':    'opwarming',
  'Oefening 1':  'oefening_1',
  'Oefening 2':  'oefening_2',
  'Spelvorm':    'spelvorm',
  'Evaluatie':   'evaluatie',
  'Station 1':   'station_1',
  'Station 2':   'station_2',
  'Reeks':       'reeks',
  'Klimcircuit': 'klimcircuit',
  'Eindspel':    'eindspel',
}

const STRUCTURED_PANELS = new Set(['Oefening 1', 'Oefening 2', 'Station 1', 'Station 2'])

/**
 * Parse an oefening/station text into structured sections.
 * Strips "Bron:" lines everywhere.
 */
function parsePanelText(raw) {
  if (!raw) return null

  // Strip all Bron: lines
  const text = raw
    .split('\n')
    .filter(line => !/^Bron:/i.test(line.trim()))
    .join('\n')
    .trim()

  const result = { title: '', opstelling: '', beschrijving: '', cues: '', makkelijker: '', moeilijker: '' }

  // Split on section headers that appear at the start of a line
  const parts = text.split(/\n(?=(Opstelling|Beschrijving|Coachingwoorden|Cue|Makkelijker|Moeilijker):)/i)

  result.title = parts[0].trim()

  for (let i = 1; i < parts.length; i++) {
    const match = parts[i].match(/^(Opstelling|Beschrijving|Coachingwoorden|Cue|Makkelijker|Moeilijker):\s*([\s\S]*)/i)
    if (!match) continue
    const key = match[1].toLowerCase()
    const value = match[2].trim()
    if (key === 'coachingwoorden' || key === 'cue') {
      result.cues = value
    } else {
      result[key] = value
    }
  }

  return result
}

/** Render plain text without Bron: lines */
function stripBron(text) {
  if (!text) return ''
  return text
    .split('\n')
    .filter(line => !/^Bron:/i.test(line.trim()))
    .join('\n')
    .trim()
}

function StructuredPanelContent({ content }) {
  const p = parsePanelText(content)
  if (!p) return <p className="text-sm text-gray-400 italic">Geen inhoud beschikbaar.</p>

  return (
    <div className="space-y-3 text-sm">
      {/* Title + opstelling + beschrijving */}
      <div>
        {p.title && (
          <p className="font-bold text-base text-gray-800 mb-1 whitespace-pre-line">{p.title}</p>
        )}
        {p.opstelling && (
          <div className="rounded-xl px-3 py-2 border-l-4" style={{ background: '#FEF9E7', borderColor: '#F39C12' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#D68910' }}>Opstelling</p>
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{p.opstelling}</p>
          </div>
        )}
        {p.beschrijving && (
          <div className="mt-1 rounded-xl px-3 py-2 border-l-4" style={{ background: '#F4F6F7', borderColor: '#7F8C8D' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#566573' }}>Beschrijving</p>
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{p.beschrijving}</p>
          </div>
        )}
      </div>

      {/* Cues – blue box */}
      {p.cues && (
        <div className="rounded-xl px-3 py-2 border-l-4" style={{ background: '#EBF5FB', borderColor: '#3498DB' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#2980B9' }}>Cues</p>
          <p className="text-gray-700 whitespace-pre-line leading-relaxed">{p.cues}</p>
        </div>
      )}

      {/* Makkelijker / Moeilijker columns */}
      {(p.makkelijker || p.moeilijker) && (
        <div className="grid grid-cols-2 gap-2">
          {/* Makkelijker – green */}
          <div className="rounded-xl px-3 py-2 border-l-4" style={{ background: '#EAFAF1', borderColor: '#27AE60' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#1E8449' }}>Makkelijker</p>
            <p className="text-gray-700 whitespace-pre-line leading-snug text-xs">
              {p.makkelijker || '—'}
            </p>
          </div>
          {/* Moeilijker – red */}
          <div className="rounded-xl px-3 py-2 border-l-4" style={{ background: '#FDEDEC', borderColor: '#E74C3C' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#C0392B' }}>Moeilijker</p>
            <p className="text-gray-700 whitespace-pre-line leading-snug text-xs">
              {p.moeilijker || '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const JAAR_LABEL = { graad_1: '4e jaar', graad_2: '5e jaar', graad_3: '6e jaar' }

export default function LesDetail() {
  const { sportId, graad, les } = useParams()
  const [openPanel, setOpenPanel] = useState(null)

  const sport   = sportsData.sports.find(s => s.id === sportId)
  const lesData = lessonsData[sportId]?.[graad]?.[les]

  if (!sport || !lesData) {
    return <p className="text-red-500 p-4">Les niet gevonden.</p>
  }

  const panelEntries = (sport.panels ?? []).map(label => {
    const key = PANEL_KEY_MAP[label] ?? label.toLowerCase().replace(/\s+/g, '_')
    return { key, label, content: lesData.panels?.[key] ?? '' }
  })

  const jaarLabel = JAAR_LABEL[graad] ?? graad
  const lesNr     = les.replace('les_', '')

  function toggle(key) {
    setOpenPanel(prev => prev === key ? null : key)
  }

  return (
    <div>
      <Link to={`/sport/${sportId}`} className="text-sm mb-3 inline-block" style={{ color: '#E67E22' }}>
        ← {sport.name}
      </Link>
      <h1 className="text-xl font-bold mb-0.5" style={{ color: '#2C3E50' }}>{lesData.titel}</h1>
      <p className="text-sm text-gray-400 mb-4">{jaarLabel} · les {lesNr}</p>

      <div className="space-y-2">
        {panelEntries.map(({ key, label, content }, idx) => {
          const isEvaluatie  = label === 'Evaluatie'
          const isStructured = STRUCTURED_PANELS.has(label)
          const isOpen       = openPanel === key

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
                    <EvaluatiePanel
                      sportId={sportId}
                      graad={graad}
                      les={les}
                      rubrics={lesData.rubrics ?? {}}
                      evaluatieTekst={content}
                    />
                  ) : isStructured ? (
                    <StructuredPanelContent content={content} />
                  ) : content ? (
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                      {stripBron(content)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Geen inhoud beschikbaar.</p>
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
