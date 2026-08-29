/**
 * Kledij — aparte, permanente evaluatie los van elk lesthema.
 * Vervangt de vroegere dubbele implementatie (KledijRaster in
 * EvaluatiePanel.jsx vs. KledijScreen in Evaluatie.jsx).
 *
 * Score start op 10/10, −aftrek_per_overtreding per keer niet in orde
 * (via +/- knop). Resetten gebeurt niet hier, maar via het Resultaten-scherm
 * (gecombineerd met het wissen van thema-scores, per klas).
 */
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { useKlassen, useStudentsByKlas } from '../hooks/useStudents'
import { getKledijConfig } from '../utils/evaluatieData'
import { downloadCsv, KLEDIJ_HEADER, kledijRij } from '../utils/csvExport'
import PlusMinKnop from './PlusMinKnop'
import LeerlingFoto from './LeerlingFoto'

export default function Kledij({ onTerug }) {
  const cfg = getKledijConfig()
  const klassen = useKlassen()
  const [klas, setKlas] = useState(null)

  if (klas) {
    return <KledijKlasScherm klas={klas} cfg={cfg} onTerug={() => setKlas(null)} />
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow px-4 py-3 mb-4 flex items-center justify-between">
        <p className="font-bold text-base" style={{ color: '#2C3E50' }}>👕 Kledij</p>
        <button onClick={onTerug} className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Terug</button>
      </div>

      <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Kies een klas</p>
      {klassen.length === 0 ? (
        <p className="text-gray-400 text-sm italic text-center py-4">Nog geen klassen geïmporteerd. Ga naar Admin.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {klassen.map(k => (
            <button key={k.id} onClick={() => setKlas(k)}
              className="bg-white rounded-2xl shadow py-5 text-center font-bold text-xl active:scale-95 transition-transform border-2 border-transparent hover:border-orange-200"
              style={{ color: '#2C3E50' }}>
              {k.naam}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function KledijKlasScherm({ klas, cfg, onTerug }) {
  const leerlingen = useStudentsByKlas(klas.id)
  const alleKledij = useLiveQuery(() => db.kledij.toArray(), [], [])

  const scoreMap = useMemo(() => {
    const map = {}
    for (const k of alleKledij ?? []) map[k.leerlingId] = k.score
    return map
  }, [alleKledij])

  async function setScore(leerlingId, score) {
    await db.kledij.put({ leerlingId, score, datum: new Date().toISOString() })
  }

  function exportCsv() {
    if (!leerlingen?.length) return
    const datum = new Date().toISOString().slice(0, 10)
    const rows = leerlingen.map(l => kledijRij({ leerling: l, klasNaam: klas.naam, score: scoreMap[l.id] ?? cfg.start_score, cfg, datum }))
    downloadCsv(`kledij_${klas.id}.csv`, KLEDIJ_HEADER, rows)
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-bold text-base" style={{ color: '#2C3E50' }}>👕 Kledij — {klas.naam}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Start op {cfg.start_score}/{cfg.max_score} · −{cfg.aftrek_per_overtreding} per keer niet in orde
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#2C3E50' }}>⬇ CSV</button>
          <button onClick={onTerug} className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Terug</button>
        </div>
      </div>

      {!leerlingen?.length ? (
        <div className="text-center py-10 text-gray-400">
          <p>Geen leerlingen in {klas.naam}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leerlingen.map(l => (
            <div key={l.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <LeerlingFoto leerling={l} size={11} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#2C3E50' }}>{l.voornaam} {l.achternaam}</p>
              </div>
              <PlusMinKnop
                value={scoreMap[l.id] ?? cfg.start_score}
                min={cfg.min_score}
                max={cfg.max_score}
                step={cfg.aftrek_per_overtreding ?? 1}
                onChange={v => setScore(l.id, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
