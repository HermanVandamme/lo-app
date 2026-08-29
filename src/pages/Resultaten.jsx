/**
 * Resultaten — overzicht per klas: alle leerlingen × alle relevante thema's
 * (samengevatte score per thema) + kledij, naast elkaar in een tabel.
 * Gecombineerde reset (thema-scores + kledijpunten) voor de hele klas.
 */
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { useKlassen, useStudentsByKlas } from '../hooks/useStudents'
import { graadFromKlasId, jaarNummerFromGraad } from '../utils/graad'
import { getEvaluatiesVoorSport, getKledijConfig } from '../utils/evaluatieData'
import { berekenEvaluatieScore, scoreKleurGenormaliseerd } from '../utils/evaluatieScoring'
import sportsData from '../data/sports.json'
import LeerlingFoto from '../components/LeerlingFoto'

export default function Resultaten() {
  const klassen = useKlassen()
  const [klas, setKlas] = useState(null)

  const title = <h1 className="text-xl font-bold mb-4" style={{ color: '#2C3E50' }}>Resultaten</h1>

  if (klas) {
    return (
      <div>
        {title}
        <ResultatenKlas klas={klas} onTerug={() => setKlas(null)} />
      </div>
    )
  }

  return (
    <div>
      {title}
      {klassen.length === 0 ? (
        <p className="text-gray-400 text-sm italic text-center py-8">Nog geen klassen geïmporteerd. Ga naar Admin.</p>
      ) : (
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Kies een klas</p>
          <div className="grid grid-cols-2 gap-2">
            {klassen.map(k => (
              <button key={k.id} onClick={() => setKlas(k)}
                className="bg-white rounded-2xl shadow py-5 text-center font-bold text-xl active:scale-95 transition-transform border-2 border-transparent hover:border-orange-200"
                style={{ color: '#2C3E50' }}>
                {k.naam}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultatenKlas({ klas, onTerug }) {
  const graad  = graadFromKlasId(klas.id)
  const jaarNr = jaarNummerFromGraad(graad)
  const cfg    = getKledijConfig()
  const leerlingen = useStudentsByKlas(klas.id)
  const [bezig, setBezig] = useState(false)

  const sportKolommen = useMemo(() => (
    Object.entries(sportsData)
      .filter(([id, sport]) => sport.jaren?.includes(jaarNr) && getEvaluatiesVoorSport(id, jaarNr).length > 0)
      .map(([id, sport]) => ({ id, naam: sport.naam }))
  ), [jaarNr])

  const leerlingIds = useMemo(() => (leerlingen ?? []).map(l => l.id), [leerlingen])
  const idsKey = leerlingIds.join(',')

  const alleScores = useLiveQuery(
    () => leerlingIds.length ? db.scores.where('leerlingId').anyOf(leerlingIds).toArray() : [],
    [idsKey], []
  )
  const alleKledij = useLiveQuery(
    () => leerlingIds.length ? db.kledij.where('leerlingId').anyOf(leerlingIds).toArray() : [],
    [idsKey], []
  )

  // leerlingId -> sportId -> evalId -> { subKey: waarde }
  const scoreMap = useMemo(() => {
    const map = {}
    for (const s of alleScores ?? []) {
      const [evalId, subKey] = String(s.lpd).split('::')
      if (!subKey) continue
      map[s.leerlingId] ??= {}
      map[s.leerlingId][s.sportId] ??= {}
      map[s.leerlingId][s.sportId][evalId] ??= {}
      map[s.leerlingId][s.sportId][evalId][subKey] = s.score
    }
    return map
  }, [alleScores])

  const kledijMap = useMemo(() => {
    const map = {}
    for (const k of alleKledij ?? []) map[k.leerlingId] = k.score
    return map
  }, [alleKledij])

  function celScore(leerlingId, sportId) {
    const items = getEvaluatiesVoorSport(sportId, jaarNr)
    let som = 0, max = 0, gevuld = false
    for (const item of items) {
      const waarden = scoreMap[leerlingId]?.[sportId]?.[item.id] ?? {}
      const s = berekenEvaluatieScore(item, waarden)
      max += item.max_score ?? 0
      if (s !== null && s !== undefined) { som += s; gevuld = true }
    }
    return gevuld ? { som: Math.round(som * 10) / 10, max } : null
  }

  async function resetResultaten() {
    const ok = confirm(
      `Dit verwijdert alle ingevulde thema-scores én zet de kledijpunten terug naar 10/10 voor klas ${klas.naam}. Dit kan niet ongedaan gemaakt worden. Doorgaan?`
    )
    if (!ok) return
    setBezig(true)
    const datum = new Date().toISOString()
    await db.transaction('rw', db.scores, db.kledij, async () => {
      const teVerwijderen = await db.scores.where('leerlingId').anyOf(leerlingIds).toArray()
      await db.scores.bulkDelete(teVerwijderen.map(s => s.id))
      await db.kledij.bulkPut(leerlingIds.map(id => ({ leerlingId: id, score: cfg.start_score, datum })))
    })
    setBezig(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="font-bold text-base" style={{ color: '#2C3E50' }}>
          {klas.naam} <span className="text-xs font-normal text-gray-400">({leerlingen?.length ?? 0})</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={resetResultaten}
            disabled={bezig || !leerlingen?.length}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#C0392B' }}
          >
            ↺ Reset resultaten voor deze klas
          </button>
          <button onClick={onTerug} className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Andere klas</button>
        </div>
      </div>

      {!leerlingen?.length ? (
        <p className="text-gray-400 text-sm italic text-center py-8">Geen leerlingen in {klas.naam}.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl shadow">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-3 py-2 sticky left-0 bg-white z-10">Leerling</th>
                {sportKolommen.map(s => (
                  <th key={s.id} className="text-center px-3 py-2 whitespace-nowrap font-semibold" style={{ color: '#2C3E50' }}>
                    {s.naam}
                  </th>
                ))}
                <th className="text-center px-3 py-2 whitespace-nowrap font-semibold" style={{ color: '#C0392B' }}>👕 Kledij</th>
              </tr>
            </thead>
            <tbody>
              {leerlingen.map(l => (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <LeerlingFoto leerling={l} size={8} />
                      <span className="font-medium truncate" style={{ color: '#2C3E50' }}>{l.voornaam} {l.achternaam}</span>
                    </div>
                  </td>
                  {sportKolommen.map(s => {
                    const cel = celScore(l.id, s.id)
                    return (
                      <td key={s.id} className="text-center px-3 py-2 font-semibold"
                        style={{ color: cel ? scoreKleurGenormaliseerd(cel.som, cel.max) : '#d1d5db' }}>
                        {cel ? `${cel.som}/${cel.max}` : '-'}
                      </td>
                    )
                  })}
                  <td className="text-center px-3 py-2 font-semibold"
                    style={{ color: scoreKleurGenormaliseerd(kledijMap[l.id] ?? cfg.start_score, cfg.max_score) }}>
                    {kledijMap[l.id] ?? cfg.start_score}/{cfg.max_score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
