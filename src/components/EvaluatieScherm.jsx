/**
 * Eén werkend evaluatiepad — gebruikt zowel vanuit een thema (met graadFilter
 * vast) als vanuit het losse /evaluatie-menu (vrije themakeuze).
 *
 * Klas-keuze filtert op sports.json "jaren" (of, indien graadFilter gezet,
 * exact op die graad). Scores/CSV-export: zie exportCsv.
 *
 * Invoer gebeurt op twee manieren:
 *  - Eén enkel scoreveld  -> meteen naast de leerling in de lijst.
 *  - Volledige rubric     -> klik een leerling aan en je komt in de snelinvoer:
 *                            één leerling per scherm, met vorige/volgende.
 *                            Terug naar de lijst blijft altijd mogelijk, zodat
 *                            je ook rechtstreeks één leerling kan opzoeken.
 */
import { useState, useMemo, useEffect } from 'react'
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

  const zelfevalHints = useMemo(() => (
    [...new Set(items.filter(it => it.zelfevaluatie_hint).map(it => it.zelfevaluatie_hint))]
  ), [items])

  const leerlingen = useStudentsByKlas(klas.id)

  // Index van de leerling in de snelinvoer; null = gewone (scrollbare) lijst.
  const [focusIdx, setFocusIdx] = useState(null)

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

  /** Totaal over alle evaluatie-items van deze leerling, of null als niets ingevuld is. */
  function totaalVoor(leerlingId) {
    let som = 0, max = 0, gevuld = false
    for (const item of items) {
      const s = berekenEvaluatieScore(item, waardenVoorItem(leerlingId, item.id))
      max += item.max_score ?? 0
      if (s !== null && s !== undefined) { som += s; gevuld = true }
    }
    return gevuld ? { som: Math.round(som * 10) / 10, max } : null
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

  // ── Snelinvoer: één leerling per scherm ────────────────────────────────────
  if (focusIdx !== null && leerlingen?.[focusIdx]) {
    const leerling = leerlingen[focusIdx]
    return (
      <LeerlingFocus
        leerling={leerling}
        index={focusIdx}
        aantal={leerlingen.length}
        items={items}
        totaal={totaalVoor(leerling.id)}
        waardenVoorItem={evalId => waardenVoorItem(leerling.id, evalId)}
        onSet={(evalId, subKey, waarde) => slaOp(leerling.id, `${evalId}::${subKey}`, waarde)}
        onVorige={() => setFocusIdx(i => Math.max(0, i - 1))}
        onVolgende={() => setFocusIdx(i => Math.min(leerlingen.length - 1, i + 1))}
        onTerug={() => setFocusIdx(null)}
      />
    )
  }

  const nogLeeg = (!enkelItem && leerlingen?.length)
    ? leerlingen.map((l, i) => ({ l, i })).filter(({ l }) => !totaalVoor(l.id))
    : []

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

      {zelfevalHints.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3 text-xs text-blue-700 flex items-start gap-2">
          <span>📱</span>
          <span>{zelfevalHints.join(' · ')}</span>
        </div>
      )}

      {nogLeeg.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs font-bold text-yellow-800 mb-1.5">
            Nog geen score ({nogLeeg.length} van {leerlingen.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nogLeeg.map(({ l, i }) => (
              <button key={l.id} onClick={() => setFocusIdx(i)}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-yellow-300 text-yellow-800">
                {l.voornaam}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-4">Geen evaluatie-items voor dit thema/jaar.</p>
      ) : !leerlingen?.length ? (
        <p className="text-gray-400 text-sm italic text-center py-4">Geen leerlingen in {klas.naam}. Importeer via Admin.</p>
      ) : (
        <div className="space-y-2">
          {leerlingen.map((l, i) => enkelItem ? (
            <LeerlingEnkelVeldRij
              key={l.id}
              leerling={l}
              item={enkelItem}
              waarden={waardenVoorItem(l.id, enkelItem.id)}
              onSet={(subKey, waarde) => slaOp(l.id, `${enkelItem.id}::${subKey}`, waarde)}
            />
          ) : (
            <LeerlingRij
              key={l.id}
              leerling={l}
              totaal={totaalVoor(l.id)}
              onOpen={() => setFocusIdx(i)}
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

/** Rij in de klaslijst: aanklikken opent de snelinvoer voor die leerling. */
function LeerlingRij({ leerling, totaal, onOpen }) {
  return (
    <button onClick={onOpen}
      className="w-full flex items-center gap-3 text-left bg-gray-50 border border-gray-200 rounded-2xl p-3 active:scale-[0.99] transition-transform">
      <LeerlingFoto leerling={leerling} size={10} />
      <p className="flex-1 min-w-0 font-bold text-sm leading-tight truncate" style={{ color: '#2C3E50' }}>
        {leerling.voornaam} {leerling.achternaam}
      </p>
      {totaal ? (
        <span className="text-sm font-bold flex-shrink-0" style={{ color: scoreKleurGenormaliseerd(totaal.som, totaal.max) }}>
          {totaal.som}/{totaal.max}
        </span>
      ) : (
        <span className="text-xs text-gray-300 flex-shrink-0">—</span>
      )}
      <span className="text-gray-400 text-sm flex-shrink-0">›</span>
    </button>
  )
}

/** Snelinvoer: één leerling vult het scherm, met vorige/volgende onderaan. */
function LeerlingFocus({
  leerling, index, aantal, items, totaal,
  waardenVoorItem, onSet, onVorige, onVolgende, onTerug,
}) {
  // Bij het wisselen van leerling weer bovenaan beginnen.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [index])

  const laatste = index >= aantal - 1

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onTerug} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">
          ↩ Lijst
        </button>
        <span className="text-xs font-semibold text-gray-400">{index + 1} / {aantal}</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <LeerlingFoto leerling={leerling} size={16} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg leading-tight" style={{ color: '#2C3E50' }}>
            {leerling.voornaam} {leerling.achternaam}
          </p>
          {totaal ? (
            <p className="text-sm font-bold" style={{ color: scoreKleurGenormaliseerd(totaal.som, totaal.max) }}>
              {totaal.som}/{totaal.max}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">Nog geen score</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id}>
            <p className="text-xs font-bold text-gray-600 mb-1.5">
              {item.titel ?? item.lpd} <span className="text-gray-400 font-normal">(/{item.max_score})</span>
            </p>
            <EvaluatieVeld item={item} waarden={waardenVoorItem(item.id)} onSet={(k, v) => onSet(item.id, k, v)} />
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-5 sticky bottom-3">
        <button onClick={onVorige} disabled={index === 0}
          className="flex-1 py-3 rounded-xl font-bold text-sm shadow disabled:opacity-40"
          style={{ background: 'white', border: '1px solid #e5e7eb', color: '#2C3E50' }}>
          ← Vorige
        </button>
        <button onClick={laatste ? onTerug : onVolgende}
          className="flex-1 py-3 rounded-xl font-bold text-sm text-white shadow"
          style={{ background: '#E67E22' }}>
          {laatste ? 'Klaar ↩' : 'Volgende →'}
        </button>
      </div>
    </div>
  )
}
