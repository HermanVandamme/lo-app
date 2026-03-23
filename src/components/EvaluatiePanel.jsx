/**
 * EvaluatiePanel — inline scoren vanuit het les-accordion
 *
 * Ondersteunt 3 evaluatietypes (uit evaluatie.json):
 *   rubric            → criteria-kaarten per LPD
 *   testprotocol_score_10 → +/- score op 10 (duurloop, volleybal LPD 1)
 *   upload_score_10   → +/- score op 10 + Smartschool upload-tekst (gymnastiek)
 *
 * Kledij-tracking: apart tabblad per klas (0× = 10, 1× = 8, … 5× = 0)
 */
import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { useKlassen, useStudentsByKlas } from '../hooks/useStudents'
import { graadFromKlasId } from '../utils/graad'
import { NIVEAU_SCORE, berekenEindScore, scoreKleur, kledijScore } from '../utils/scoring'
import evaluatieData from '../data/evaluatie.json'

const NIVEAU_LABELS = {
  zwak:       'Zwak',
  voldoende:  'Vold.',
  goed:       'Goed',
  uitstekend: 'Uitst.',
}

const DEFAULT_SCORE = 0
const MAX_SCORE     = 10
const STEP          = 0.5

function getEvalType(sportId, lpdKey) {
  return evaluatieData[sportId]?.[lpdKey]?.evaluatie_type ?? 'rubric'
}

function getCriteria(sportId, lpdKey, graad) {
  return evaluatieData[sportId]?.[lpdKey]?.rubrics?.[graad] ?? null
}

// ── Hoofd-component ────────────────────────────────────────────────────────────
export default function EvaluatiePanel({ sportId, graad, les, evaluatieTekst }) {
  const [rubricOpen, setRubricOpen]     = useState(true)   // standaard open
  const [selectedKlas, setSelectedKlas] = useState(null)
  const [tab, setTab]                   = useState('scores') // 'scores' | 'kledij'

  const klassen   = useKlassen()
  const gefilterd = useMemo(
    () => klassen.filter(k => graadFromKlasId(k.id) === graad),
    [klassen, graad]
  )

  // Derive LPDs from evaluatie.json for this sport + year
  const rubricEntries = useMemo(() => {
    const sportEval = evaluatieData[sportId]
    if (!sportEval) return []
    return Object.entries(sportEval)
      .filter(([lpdKey, lpd]) => {
        if (lpdKey.startsWith('_')) return false
        const et = lpd.evaluatie_type ?? 'rubric'
        if (et !== 'rubric') return true
        return lpd.rubrics?.[graad] != null
      })
      .map(([lpdKey, lpd]) => [lpdKey, { naam: lpd.naam, type: 'leerkracht' }])
  }, [sportId, graad])

  return (
    <div className="mt-1">

      {/* ── Evaluatie instructietekst ──────────────────────────────────── */}
      {evaluatieTekst && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 mb-3 text-sm text-blue-800 whitespace-pre-line leading-relaxed">
          {evaluatieTekst}
        </div>
      )}

      {/* ── Rubric-info (standaard open) ──────────────────────────────── */}
      <button
        onClick={() => setRubricOpen(o => !o)}
        className="w-full flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-1 text-left"
      >
        <span className="text-sm font-semibold text-blue-700">📖 Rubric-info</span>
        <span className="text-blue-400 text-sm">{rubricOpen ? '▲' : '▼'}</span>
      </button>
      {rubricOpen && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 mb-3 space-y-1.5">
          {rubricEntries.length === 0 ? (
            <p className="text-xs text-blue-800">Geen rubrics voor deze les.</p>
          ) : rubricEntries.map(([lpdKey, lpd]) => {
            const et = getEvalType(sportId, lpdKey)
            const criteria = getCriteria(sportId, lpdKey, graad)
            return (
              <div key={lpdKey}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-blue-800">
                    {lpd.naam}
                  </span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                    lpd.type === 'zelfevaluatie' ? 'bg-purple-100 text-purple-600'
                    : et === 'testprotocol_score_10' ? 'bg-green-100 text-green-600'
                    : et === 'upload_score_10' ? 'bg-orange-100 text-orange-600'
                    : 'bg-blue-100 text-blue-600'
                  }`}>
                    {lpd.type === 'zelfevaluatie' ? 'zelfevaluatie'
                      : et === 'testprotocol_score_10' ? 'testprotocol'
                      : et === 'upload_score_10' ? 'upload'
                      : 'leerkracht'}
                  </span>
                </div>
                {criteria && criteria.map((c, i) => (
                  <p key={i} className="text-xs text-blue-600 ml-2 mt-0.5">• {c.criterium}</p>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Klas-kiezer ────────────────────────────────────────────────── */}
      {gefilterd.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-3 text-xs text-yellow-700">
          Geen klassen gevonden voor deze graad.
          Importeer klassen via <strong>Admin</strong>.
        </div>
      ) : !selectedKlas ? (
        <KlasPicker klassen={gefilterd} onKies={setSelectedKlas} />
      ) : (
        <>
          {/* Tabs: scores / kledij */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTab('scores')}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={tab === 'scores'
                ? { background: '#E67E22', color: 'white' }
                : { background: '#F0F3F4', color: '#2C3E50' }
              }
            >
              📋 Scores
            </button>
            <button
              onClick={() => setTab('kledij')}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={tab === 'kledij'
                ? { background: '#C0392B', color: 'white' }
                : { background: '#F0F3F4', color: '#2C3E50' }
              }
            >
              👕 Kledij
            </button>
            <button
              onClick={() => setSelectedKlas(null)}
              className="px-3 py-2 rounded-xl text-sm bg-gray-100 text-gray-600 font-semibold"
            >
              ↩
            </button>
          </div>

          {tab === 'scores' ? (
            <ScoringRaster
              klas={selectedKlas}
              sportId={sportId}
              graad={graad}
              les={les}
              rubricEntries={rubricEntries}
            />
          ) : (
            <KledijRaster klas={selectedKlas} />
          )}
        </>
      )}
    </div>
  )
}

// ── Klas-kiezer ────────────────────────────────────────────────────────────────
function KlasPicker({ klassen, onKies }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-500 mb-2">Kies een klas:</p>
      <div className="grid grid-cols-2 gap-2">
        {klassen.map(k => (
          <button
            key={k.id}
            onClick={() => onKies(k)}
            className="bg-white border-2 border-gray-100 rounded-xl py-4 text-center font-bold text-xl active:scale-95 transition-transform hover:border-orange-300"
            style={{ color: '#2C3E50' }}
          >
            {k.naam}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Kledij-raster ─────────────────────────────────────────────────────────────
function KledijRaster({ klas }) {
  const leerlingen = useStudentsByKlas(klas.id)

  const alleKledij = useLiveQuery(
    () => db.kledij.toArray(),
    [],
    []
  )

  const kledijMap = useMemo(() => {
    const map = {}
    for (const k of alleKledij ?? []) {
      map[k.leerlingId] = k.count ?? 0
    }
    return map
  }, [alleKledij])

  async function incrementKledij(leerlingId) {
    const existing = await db.kledij.get(leerlingId)
    if (existing) {
      await db.kledij.update(leerlingId, { count: existing.count + 1, datum: new Date().toISOString() })
    } else {
      await db.kledij.put({ leerlingId, count: 1, datum: new Date().toISOString() })
    }
  }

  async function decrementKledij(leerlingId) {
    const existing = await db.kledij.get(leerlingId)
    if (!existing || existing.count <= 0) return
    await db.kledij.update(leerlingId, { count: Math.max(0, existing.count - 1), datum: new Date().toISOString() })
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        <strong>{klas.naam}</strong> — tik + bij elke keer niet in orde.
        Score: 0×=10 · 1×=8 · 2×=6 · 3×=4 · 4×=2 · 5×+=0
      </p>
      <div className="space-y-2">
        {(leerlingen ?? []).map(l => {
          const count = kledijMap[l.id] ?? 0
          const score = kledijScore(count)
          return (
            <div key={l.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <LeerlingFoto leerling={l} size={10} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#2C3E50' }}>
                  {l.voornaam} {l.achternaam}
                </p>
                <p className="text-xs text-gray-400">{count}× niet in orde</p>
              </div>
              <span className="text-base font-bold w-8 text-center" style={{ color: scoreKleur(score) }}>
                {score}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => decrementKledij(l.id)}
                  className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center active:scale-95"
                >
                  −
                </button>
                <button
                  onClick={() => incrementKledij(l.id)}
                  className="w-8 h-8 rounded-lg font-bold text-lg flex items-center justify-center active:scale-95"
                  style={{ background: '#E74C3C', color: 'white' }}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Scoring-raster ────────────────────────────────────────────────────────────
function ScoringRaster({ klas, sportId, graad, les, rubricEntries }) {
  const leerlingen = useStudentsByKlas(klas.id)

  const alleScores = useLiveQuery(
    () => db.scores
      .where('sportId').equals(sportId)
      .and(s => s.graad === graad && s.les === les)
      .toArray(),
    [sportId, graad, les],
    []
  )

  const scoreMap = useMemo(() => {
    const map = {}
    for (const s of alleScores ?? []) {
      if (!map[s.leerlingId]) map[s.leerlingId] = {}
      map[s.leerlingId][s.lpd] = s.score
    }
    return map
  }, [alleScores])

  async function slaScore(leerlingId, lpd, score) {
    const existing = await db.scores
      .where('leerlingId').equals(leerlingId)
      .and(s => s.sportId === sportId && s.graad === graad && s.les === les && s.lpd === lpd)
      .first()
    const datum = new Date().toISOString()
    if (existing) {
      await db.scores.update(existing.id, { score, datum })
    } else {
      await db.scores.add({ leerlingId, sportId, graad, les, lpd, score, datum })
    }
  }

  // Verzamel alle score-sleutels per leerling (voor eindscore + CSV export)
  function getAllScoreKeys(leerlingId) {
    const keys = []
    for (const [lpdKey] of rubricEntries) {
      const et = getEvalType(sportId, lpdKey)
      if (et === 'testprotocol_score_10' || et === 'upload_score_10') {
        keys.push(`${lpdKey}_score`)
      } else {
        const criteria = getCriteria(sportId, lpdKey, graad)
        if (criteria) {
          criteria.forEach((_, idx) => keys.push(`${lpdKey}_c${idx}`))
        } else {
          keys.push(lpdKey)
        }
      }
    }
    return keys
  }

  function exportCsv() {
    if (!leerlingen?.length) return
    const alleKeys = getAllScoreKeys(null)
    const header = ['student_id', 'voornaam', 'achternaam', ...alleKeys, 'kledij', 'eindscore'].join(',')
    const rows = leerlingen.map(l => {
      const s = scoreMap[l.id] ?? {}
      const deelVals = alleKeys.map(k => {
        const v = s[k]
        if (v === undefined || v === null) return ''
        if (typeof v === 'string' && NIVEAU_SCORE[v] !== undefined) return NIVEAU_SCORE[v]
        return v
      })
      const eindscore = berekenEindScore(s, alleKeys) ?? ''
      return [l.id, l.voornaam, l.achternaam, ...deelVals, '', eindscore].join(',')
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scores_${klas.id}_${sportId}_${graad}_${les}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-base" style={{ color: '#2C3E50' }}>
          {klas.naam} <span className="text-xs font-normal text-gray-400">({leerlingen?.length ?? 0})</span>
        </span>
        <button
          onClick={exportCsv}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: '#2C3E50' }}
        >
          ⬇ CSV
        </button>
      </div>

      {!leerlingen?.length ? (
        <p className="text-gray-400 text-sm italic text-center py-4">
          Geen leerlingen in {klas.naam}. Importeer via Admin.
        </p>
      ) : (
        <div className="space-y-3">
          {leerlingen.map(l => (
            <LeerlingKaart
              key={l.id}
              leerling={l}
              scores={scoreMap[l.id] ?? {}}
              rubricEntries={rubricEntries}
              sportId={sportId}
              graad={graad}
              onScore={(lpd, score) => slaScore(l.id, lpd, score)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Leerling-foto helper ───────────────────────────────────────────────────────
function LeerlingFoto({ leerling, size = 12 }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  const cls = `w-${size} h-${size} rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center`
  return (
    <div className={cls}>
      {imgSrc
        ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
        : <span className="text-xl text-gray-400">👤</span>
      }
    </div>
  )
}

// ── Leerling-kaart ────────────────────────────────────────────────────────────
function LeerlingKaart({ leerling, scores, rubricEntries, sportId, graad, onScore }) {
  // Verzamel alle relevante sleutels voor eindscore
  const allScoreKeys = []
  for (const [lpdKey] of rubricEntries) {
    const et = getEvalType(sportId, lpdKey)
    if (et === 'testprotocol_score_10' || et === 'upload_score_10') {
      allScoreKeys.push(`${lpdKey}_score`)
    } else {
      const criteria = getCriteria(sportId, lpdKey, graad)
      if (criteria) {
        criteria.forEach((_, idx) => allScoreKeys.push(`${lpdKey}_c${idx}`))
      } else {
        allScoreKeys.push(lpdKey)
      }
    }
  }

  const eindscore = berekenEindScore(scores, allScoreKeys)

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3">
      {/* Naam + foto + eindscore */}
      <div className="flex items-center gap-3 mb-3">
        <LeerlingFoto leerling={leerling} size={12} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight truncate" style={{ color: '#2C3E50' }}>
            {leerling.voornaam} {leerling.achternaam}
          </p>
          <p className="text-xs text-gray-400">{leerling.klasId}</p>
        </div>
        {eindscore !== null && (
          <div className="text-right flex-shrink-0">
            <span className="block text-lg font-bold" style={{ color: scoreKleur(eindscore) }}>{eindscore}</span>
            <span className="text-xs text-gray-400">eindscr.</span>
          </div>
        )}
      </div>

      {/* LPD-rijen */}
      {rubricEntries.map(([lpdKey, lpd]) => (
        <LpdRij
          key={lpdKey}
          lpdKey={lpdKey}
          lpd={lpd}
          sportId={sportId}
          graad={graad}
          scores={scores}
          onScore={onScore}
        />
      ))}
    </div>
  )
}

// ── LPD-rij ───────────────────────────────────────────────────────────────────
function LpdRij({ lpdKey, lpd, sportId, graad, scores, onScore }) {
  const evalType = getEvalType(sportId, lpdKey)
  const criteria = getCriteria(sportId, lpdKey, graad)

  const lpdLabel = (
    <div className="flex items-center gap-1 mb-1.5">
      <span className="text-xs font-bold text-gray-600">{lpd.naam}</span>
      {lpd.type === 'zelfevaluatie' && (
        <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">zelf</span>
      )}
    </div>
  )

  // ── Testprotocol: +/- score ──
  if (evalType === 'testprotocol_score_10') {
    const scoreKey = `${lpdKey}_score`
    const val = scores[scoreKey] ?? DEFAULT_SCORE
    return (
      <div className="mb-2 last:mb-0">
        {lpdLabel}
        <ScoreKnop
          value={val}
          onChange={v => onScore(scoreKey, v)}
          label="Score /10"
        />
      </div>
    )
  }

  // ── Upload: +/- score + Smartschool ──
  if (evalType === 'upload_score_10') {
    const scoreKey = `${lpdKey}_score`
    const val = scores[scoreKey] ?? DEFAULT_SCORE
    return (
      <div className="mb-2 last:mb-0">
        {lpdLabel}
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-1.5 text-xs text-orange-700">
          📤 Filmpje indienen via Smartschool (uploadzone)
        </div>
        <ScoreKnop
          value={val}
          onChange={v => onScore(scoreKey, v)}
          label="Score /10"
        />
      </div>
    )
  }

  // ── Rubric: criteria-kaarten ──
  if (criteria) {
    return (
      <div className="mb-2 last:mb-0">
        {lpdLabel}
        {criteria.map((c, idx) => {
          const scoreKey = `${lpdKey}_c${idx}`
          const huidig = scores[scoreKey] ?? null
          return (
            <CriteriumRij
              key={idx}
              criterium={c.criterium}
              niveaus={c.niveaus}
              huidig={huidig}
              onKies={niveau => onScore(scoreKey, huidig === niveau ? null : niveau)}
            />
          )
        })}
      </div>
    )
  }

  // ── Fallback: lessons.json niveaus (enkele rubric) ──
  const huidig = scores[lpdKey] ?? null
  return (
    <div className="mb-2 last:mb-0">
      {lpdLabel}
      <CriteriumRij
        criterium={null}
        niveaus={lpd.niveaus ?? {}}
        huidig={huidig}
        onKies={niveau => onScore(lpdKey, huidig === niveau ? null : niveau)}
      />
    </div>
  )
}

// ── Score-knop (+/-) ──────────────────────────────────────────────────────────
function ScoreKnop({ value, onChange, label }) {
  function plus()  { onChange(Math.min(MAX_SCORE, Math.round((value + STEP) * 10) / 10)) }
  function minus() { onChange(Math.max(0,         Math.round((value - STEP) * 10) / 10)) }

  return (
    <div>
      {label && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>}
      <div className="flex items-center bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={minus}
          className="flex-1 py-3 text-2xl font-bold text-red-500 active:bg-red-50"
          aria-label="min"
        >−</button>
        <span className="w-14 text-center text-xl font-bold" style={{ color: scoreKleur(value) }}>
          {value % 1 === 0 ? value : value.toFixed(1)}
        </span>
        <button
          onClick={plus}
          className="flex-1 py-3 text-2xl font-bold text-green-500 active:bg-green-50"
          aria-label="plus"
        >+</button>
      </div>
    </div>
  )
}

// ── Criterium-rij (rubric-kaarten) ───────────────────────────────────────────
function CriteriumRij({ criterium, niveaus, huidig, onKies }) {
  const niveauEntries = Object.entries(niveaus ?? {})

  return (
    <div className="mb-2">
      {criterium && (
        <p className="text-xs text-gray-500 font-medium mb-1 italic">{criterium}</p>
      )}
      <div className="space-y-1">
        {niveauEntries.map(([key, omschrijving]) => {
          const actief  = huidig === key
          const punten  = NIVEAU_SCORE[key]
          return (
            <button
              key={key}
              onClick={() => onKies(key)}
              className="w-full text-left rounded-xl border-2 px-3 py-2 transition-colors active:scale-[0.99]"
              style={actief
                ? { borderColor: '#E67E22', background: '#FFF8F0' }
                : { borderColor: '#e5e7eb', background: 'white' }
              }
            >
              <div className="flex items-center justify-between mb-0.5">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: actief ? '#E67E22' : '#2C3E50' }}
                >
                  {NIVEAU_LABELS[key] ?? key}
                  {actief && <span className="ml-1.5 normal-case font-normal">✓</span>}
                </p>
                <span className="text-xs font-semibold text-gray-400">{punten}/10</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{omschrijving}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
