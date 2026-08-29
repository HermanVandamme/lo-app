/**
 * Los evaluatiemenu (/evaluatie): Scores of Kledij.
 * Scores: kies eerst een thema, dan (via EvaluatieScherm) een klas — de
 * klas-keuze wordt daar al gefilterd op sports.json "jaren" (stap 5).
 * Kledij: aparte, permanente evaluatie, los van elk lesthema.
 */
import { useState } from 'react'
import sportsData from '../data/sports.json'
import EvaluatieScherm from '../components/EvaluatieScherm'
import Kledij from '../components/Kledij'

export default function Evaluatie() {
  const [modus, setModus]     = useState(null) // null | 'scores' | 'kledij'
  const [sportId, setSportId] = useState(null)

  const title = <h1 className="text-xl font-bold mb-4" style={{ color: '#2C3E50' }}>Evaluatie</h1>

  // ── Stap 0: keuze Scores of Kledij ───────────────────────────────────────
  if (!modus) {
    return (
      <div>
        {title}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setModus('scores')}
            className="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform border-2 border-transparent hover:border-orange-200"
          >
            <span className="text-4xl">📊</span>
            <span className="font-bold text-base" style={{ color: '#2C3E50' }}>Scores</span>
            <span className="text-xs text-gray-400 text-center">Klikcriteria per thema</span>
          </button>
          <button
            onClick={() => setModus('kledij')}
            className="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform border-2 border-transparent hover:border-orange-200"
          >
            <span className="text-4xl">👕</span>
            <span className="font-bold text-base" style={{ color: '#2C3E50' }}>Kledij</span>
            <span className="text-xs text-gray-400 text-center">Permanente kledijscore per klas</span>
          </button>
        </div>
      </div>
    )
  }

  // ── Kledij-stroom ─────────────────────────────────────────────────────────
  if (modus === 'kledij') {
    return <Kledij onTerug={() => setModus(null)} />
  }

  // ── Scores-stroom: thema kiezen, dan klas + scoren via EvaluatieScherm ────
  if (!sportId) {
    return (
      <div>
        {title}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setModus(null)} className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Terug</button>
        </div>
        <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Kies een thema</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(sportsData).map(([id, sport]) => (
            <button key={id} onClick={() => setSportId(id)}
              className="bg-white rounded-2xl shadow py-4 px-2 text-center font-semibold text-sm active:scale-95 transition-transform border-2 border-transparent hover:border-orange-200"
              style={{ color: '#2C3E50' }}>
              {sport.naam}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {title}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setSportId(null)} className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Ander thema</button>
        <span className="text-sm text-gray-500">Thema: <strong style={{ color: '#2C3E50' }}>{sportsData[sportId]?.naam}</strong></span>
      </div>
      <EvaluatieScherm sportId={sportId} />
    </div>
  )
}
