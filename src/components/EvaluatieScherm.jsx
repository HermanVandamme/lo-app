/**
 * Eén werkend evaluatiepad — gebruikt zowel vanuit LesDetail (per les, met
 * graadFilter vast) als vanuit het losse /evaluatie-menu (vrije themakeuze).
 *
 * Klas-keuze filtert op sports.json "jaren" (of, indien graadFilter gezet,
 * exact op die graad) — zie stap 5. Scores/CSV-export: zie stap 7.
 */
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { useKlassen, useStudentsByKlas } from '../hooks/useStudents'
import { graadFromKlasId, jaarNummerFromGraad } from '../utils/graad'
import { getEvaluatiesVoorSport } from '../utils/evaluatieData'
import { berekenEvaluatieScore, scoreKleurGenormaliseerd, telScoreVelden } from '../utils/evaluatieScoring'
import { downloadCsv, SCORE_HEADER, scoreRij } from '../utils/csvExport'
import sportsData from '../data/sports.json'
import EvaluatieVeld from './EvaluatieVeld'
import LeerlingFoto from './LeerlingFoto'

export default function EvaluatieScherm({ sportId, graadFilter }) {
  const [klas, setKlas] = useState(null)
  const klassen = useKlassen()
  const sport = sportsData[sportId]

  const gefilterd = useMemo(() => klassen.filter(k => {
    const graad = graadFromKlasId(k.id)
    if (graadFilter) return graad === graadFilter
    return sport?.jaren?.includes(jaarNummerFromGraad(graad))
  }), [klassen, sport, graadFilter])

  if (klas) {
    return <EvaluatieKlasScherm sportId={sportId} sport={sport} klas={klas} onTerug={() => setKlas(null)} />
  }

  return (
    <div>
      {gefilterd.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-3 text-xs text-yellow-700">
          Geen klassen gevonden voor dit thema/jaar. Importeer klassen via <strong>Admin</strong>.
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-2">Kies een klas:</p>
          <div className="grid grid-cols-2 gap-2">
            {gefilterd.map(k => (
              <button key={k.id} onClick={() => setKlas(k)}
                className="bg-white border-2 border-gray-100 rounded-xl py-4 text-center font-bold text-xl active:scale-95 transition-transform hover:border-orange-300"
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

function EvaluatieKlasScherm({ sportId, sport, klas, onTerug }) {
  const graad  = graadFromKlasId(klas.id)
  const jaarNr = jaarNummerFromGraad(graad)
  const items  = useMemo(() => getEvaluatiesVoorSport(sportId, jaarNr), [sportId, jaarNr])
  // Eén enkel klikbaar scoreveld in totaal? Toon dat dan meteen in de klaslijst,
  // zonder eerst naar een detailscherm te moeten klikken.
  const enkelItem = useMemo(() => {
    if (items.length !== 1) return null
    return telScoreVelden(items[0]) === 1 ? items[0] : null
  }, [items])

  const leerlingen = useStudentsByKlas(klas.id)

  const alleScores = useLiveQuery(
    () => db.scores.where('sportId').equals(sportId).and(s => s.graad === graad).toArray(),
    [sportId, graad], []
  )

  const scoreMap = useMemo(() => {
    const map = {}
    for (const s of alleScores ?? []) {
      if (!map[s.leerlingId]) map[s.leerlingId] = {}
      map[s.leerlingId][s.lpd] = s.score
    }
    return map
  }, [alleScores])

  function waardenVoorItem(leerlingId, evalId) {
    const alle = scoreMap[leerlingId] ?? {}
    const prefix = `${evalId}::`
    const result = {}
    for (const k in alle) {
      if (k.startsWith(prefix)) result[k.slice(prefix.length)] = alle[k]
    }
    return result
  }

  async function slaOp(leerlingId, key, waarde) {
    const existing = await db.scores
      .where('leerlingId').equals(leerlingId)
      .and(s => s.sportId === sportId && s.graad === graad && s.les === '_thema' && s.lpd === key)
      .first()
    const datum = new Date().toISOString()
    if (waarde === null || waarde === undefined) {
      if (existing) await db.scores.delete(existing.id)
      return
    }
    if (existing) await db.scores.update(existing.id, { score: waarde, datum })
    else await db.scores.add({ leerlingId, sportId, graad, les: '_thema', lpd: key, score: waarde, datum })
  }

  function exportCsv() {
    if (!leerlingen?.length) return
    const datum = new Date().toISOString().slice(0, 10)
    const rows = []
    for (const l of leerlingen) {
      for (const item of items) {
        const score = berekenEvaluatieScore(item, waardenVoorItem(l.id, item.id))
        rows.push(scoreRij({ leerling: l, klasNaam: klas.naam, sportNaam: sport?.naam ?? sportId, item, score, datum }))
      }
    }
    downloadCsv(`scores_${klas.id}_${sportId}.csv`, SCORE_HEADER, rows)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="font-bold text-base" style={{ color: '#2C3E50' }}>
          {klas.naam} <span className="text-xs font-normal text-gray-400">({leerlingen?.length ?? 0})</span>
        </span>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#2C3E50' }}>⬇ CSV</button>
          <button onClick={onTerug} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">↩ Andere klas</button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-4">Geen evaluatie-items voor dit thema/jaar.</p>
      ) : !leerlingen?.length ? (
        <p className="text-gray-400 text-sm italic text-center py-4">Geen leerlingen in {klas.naam}. Importeer via Admin.</p>
      ) : (
        <div className="space-y-3">
          {leerlingen.map(l => enkelItem ? (
            <LeerlingEnkelVeldRij
              key={l.id}
              leerling={l}
              item={enkelItem}
              waarden={waardenVoorItem(l.id, enkelItem.id)}
              onSet={(subKey, waarde) => slaOp(l.id, `${enkelItem.id}::${subKey}`, waarde)}
            />
          ) : (
            <LeerlingEvaluatieKaart
              key={l.id}
              leerling={l}
              items={items}
              waardenVoorItem={evalId => waardenVoorItem(l.id, evalId)}
              onSet={(evalId, subKey, waarde) => slaOp(l.id, `${evalId}::${subKey}`, waarde)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Eén scoreveld, meteen naast de leerling in de lijst — geen foto-klik nodig. */
function LeerlingEnkelVeldRij({ leerling, item, waarden, onSet }) {
  const score = berekenEvaluatieScore(item, waarden)
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3">
      <div className="flex items-center gap-3 mb-2">
        <LeerlingFoto leerling={leerling} size={10} />
        <p className="flex-1 min-w-0 font-bold text-sm leading-tight truncate" style={{ color: '#2C3E50' }}>
          {leerling.voornaam} {leerling.achternaam}
        </p>
        {score !== null && score !== undefined && (
          <span className="text-sm font-bold flex-shrink-0" style={{ color: scoreKleurGenormaliseerd(score, item.max_score) }}>
            {score}/{item.max_score}
          </span>
        )}
      </div>
      <EvaluatieVeld item={item} waarden={waarden} onSet={onSet} />
    </div>
  )
}

function LeerlingEvaluatieKaart({ leerling, items, waardenVoorItem, onSet }) {
  const [open, setOpen] = useState(false)

  const totaal = useMemo(() => {
    let som = 0, max = 0, gevuld = false
    for (const item of items) {
      const s = berekenEvaluatieScore(item, waardenVoorItem(item.id))
      max += item.max_score ?? 0
      if (s !== null && s !== undefined) { som += s; gevuld = true }
    }
    return gevuld ? { som: Math.round(som * 10) / 10, max } : null
  }, [items, waardenVoorItem])

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 text-left">
        <LeerlingFoto leerling={leerling} size={10} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color: '#2C3E50' }}>
            {leerling.voornaam} {leerling.achternaam}
          </p>
        </div>
        {totaal && (
          <span className="text-sm font-bold flex-shrink-0" style={{ color: scoreKleurGenormaliseerd(totaal.som, totaal.max) }}>
            {totaal.som}/{totaal.max}
          </span>
        )}
        <span className="text-gray-400 text-sm flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {items.map(item => (
            <div key={item.id}>
              <p className="text-xs font-bold text-gray-600 mb-1.5">
                {item.titel ?? item.lpd} <span className="text-gray-400 font-normal">(/{item.max_score})</span>
              </p>
              <EvaluatieVeld item={item} waarden={waardenVoorItem(item.id)} onSet={(k, v) => onSet(item.id, k, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
