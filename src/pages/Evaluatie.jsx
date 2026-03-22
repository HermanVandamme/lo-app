import { useState, useEffect, useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { useKlassen, useStudentsByKlas } from '../hooks/useStudents'
import { graadFromKlasId, GRAAD_LABEL } from '../utils/graad'
import { NIVEAU_SCORE, kledijScore, berekenEindScore, scoreKleur } from '../utils/scoring'
import sportsData from '../data/sports.json'
import lessonsData from '../data/lessons.json'
import ZelfevalQR from './ZelfevalQR'

const DEFAULT_SCORE = 10

const NIVEAU_LABELS  = { zwak: 'Zwak', voldoende: 'Vold.', goed: 'Goed', uitstekend: 'Uitst.' }
const NIVEAU_KLEUR   = { zwak: '#E74C3C', voldoende: '#F39C12', goed: '#E67E22', uitstekend: '#27AE60' }

// ── Lessen voor een graad ─────────────────────────────────────────────────────
function getLessenVoorGraad(graad) {
  const result = []
  for (const sport of sportsData.sports) {
    const gradeData = lessonsData[sport.id]?.[graad]
    if (!gradeData) continue
    for (const [lesKey, les] of Object.entries(gradeData)) {
      result.push({ sportId: sport.id, sportNaam: sport.name, lesKey, lesNr: lesKey.replace('les_', ''), titel: les.titel })
    }
  }
  return result
}

// ── Stap-indicator ────────────────────────────────────────────────────────────
function StapBalk({ stappen, huidig }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {stappen.map((label, i) => {
        const done = i < huidig, active = i === huidig
        return (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div
              className={`flex items-center gap-1.5 flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold ${active ? 'text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
              style={active ? { background: '#E67E22' } : {}}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : active ? 'bg-white' : 'bg-gray-300 text-gray-500'}`}
                style={active ? { color: '#E67E22' } : {}}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className="truncate">{label}</span>
            </div>
            {i < stappen.length - 1 && <div className={`w-2 h-0.5 flex-shrink-0 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Klas-kiezer ───────────────────────────────────────────────────────────────
function KlasPicker({ klassen, graadFilter, onKies, prefillInfo }) {
  const gefilterd = graadFilter ? klassen.filter(k => graadFromKlasId(k.id) === graadFilter) : klassen

  if (klassen.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">📂</div>
        <p className="text-gray-500 mb-1">Nog geen klassen geïmporteerd.</p>
        <Link to="/admin" className="text-sm font-semibold underline" style={{ color: '#E67E22' }}>Ga naar Admin</Link>
      </div>
    )
  }

  const lijst = gefilterd.length ? gefilterd : klassen   // fallback: toon alle klassen

  return (
    <div>
      {prefillInfo && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 text-sm">
          <p className="font-semibold" style={{ color: '#E67E22' }}>{prefillInfo.sportNaam} — Les {prefillInfo.lesNr}</p>
          <p className="text-gray-500 text-xs mt-0.5">{prefillInfo.titel}</p>
        </div>
      )}
      <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Kies een klas</p>
      <div className="grid grid-cols-2 gap-2">
        {lijst.map(k => (
          <button
            key={k.id}
            onClick={() => onKies(k)}
            className="bg-white rounded-2xl shadow py-5 text-center font-bold text-xl active:scale-95 transition-transform border-2 border-transparent hover:border-orange-200"
            style={{ color: '#2C3E50' }}
          >
            {k.naam}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Les-kiezer ────────────────────────────────────────────────────────────────
function LessenPicker({ graad, onKies }) {
  const lessen = getLessenVoorGraad(graad)
  const perSport = useMemo(() => {
    const map = {}
    for (const les of lessen) {
      if (!map[les.sportId]) map[les.sportId] = { sportNaam: les.sportNaam, lessen: [] }
      map[les.sportId].lessen.push(les)
    }
    return Object.entries(map)
  }, [graad])

  if (perSport.length === 0) return <p className="text-gray-400 italic text-sm">Geen lessen gevonden voor deze klas.</p>

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Kies een les</p>
      {perSport.map(([sportId, { sportNaam, lessen }]) => (
        <div key={sportId} className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-bold text-base mb-3" style={{ color: '#2C3E50' }}>{sportNaam}</h3>
          <div className="flex gap-2">
            {lessen.map(les => (
              <button key={les.lesKey} onClick={() => onKies(les)}
                className="flex-1 rounded-xl py-4 px-3 text-center active:scale-95 transition-transform"
                style={{ background: '#E67E22' }}>
                <span className="block text-white font-bold text-base">Les {les.lesNr}</span>
                <span className="block text-white/80 text-xs mt-0.5 leading-tight">{les.titel}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── LPD-rij ───────────────────────────────────────────────────────────────────
function LpdRij({ lpdKey, lpd, huidig, onKies }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs text-gray-500 font-medium">{lpdKey.replace('lpd_', 'LPD ').toUpperCase()}</span>
        <span className="text-xs text-gray-400">— {lpd.naam}</span>
        {lpd.type === 'zelfevaluatie' && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">zelf</span>}
      </div>
      <div className="space-y-1.5">
        {Object.entries(lpd.niveaus).map(([key, omschrijving]) => {
          const actief = huidig === key
          return (
            <button key={key} onClick={() => onKies(huidig === key ? null : key)}
              className="w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors active:scale-[0.99]"
              style={actief ? { borderColor: '#E67E22', background: '#FFF8F0' } : { borderColor: '#e5e7eb', background: 'white' }}>
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: actief ? '#E67E22' : '#2C3E50' }}>
                  {NIVEAU_LABELS[key] ?? key}{actief && <span className="ml-1.5 normal-case font-normal">✓</span>}
                </p>
                <span className="text-xs font-semibold text-gray-400">{NIVEAU_SCORE[key]}/10</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{omschrijving}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// KLEDIJ-STROOM (volledig los van sport/les)
// ══════════════════════════════════════════════════════════════════════════════

function KledijScreen({ klas, onTerug }) {
  const leerlingen = useStudentsByKlas(klas.id)

  const alleKledij = useLiveQuery(
    () => db.kledij.toArray(),
    [],
    []
  )

  const kledijMap = useMemo(() => {
    const map = {}
    for (const k of alleKledij ?? []) map[k.leerlingId] = k.count ?? 0
    return map
  }, [alleKledij])

  async function slaKledij(leerlingId, count) {
    await db.kledij.put({ leerlingId, count, datum: new Date().toISOString() })
  }

  function exportKledijCsv() {
    if (!leerlingen?.length) return
    const header = 'student_id,voornaam,achternaam,kledij_count,kledij_score'
    const rows = leerlingen.map(l => {
      const count = kledijMap[l.id] ?? 0
      return `${l.id},${l.voornaam},${l.achternaam},${count},${kledijScore(count)}`
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kledij_${klas.id}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Context-balk */}
      <div className="bg-white rounded-2xl shadow px-4 py-3 mb-4 flex items-center justify-between">
        <div>
          <p className="font-bold text-base" style={{ color: '#2C3E50' }}>👕 Kledij — {klas.naam}</p>
          <p className="text-xs text-gray-400 mt-0.5">0× = 10pt · 1× = 8pt · 2× = 6pt · 3× = 4pt · 4× = 2pt · 5×+ = 0pt</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportKledijCsv}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#2C3E50' }}>⬇ CSV</button>
          <button onClick={onTerug}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Terug</button>
        </div>
      </div>

      {!leerlingen?.length ? (
        <div className="text-center py-10 text-gray-400">
          <p>Geen leerlingen in {klas.naam}.</p>
          <Link to="/admin" className="text-sm underline mt-1 block" style={{ color: '#E67E22' }}>Importeer via Admin</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {leerlingen.map(l => (
            <KledijRij
              key={l.id}
              leerling={l}
              count={kledijMap[l.id] ?? 0}
              onPlus={() => slaKledij(l.id, (kledijMap[l.id] ?? 0) + 1)}
              onMin={() => slaKledij(l.id, Math.max(0, (kledijMap[l.id] ?? 0) - 1))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function KledijRij({ leerling, count, onPlus, onMin }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  const score = kledijScore(count)

  return (
    <div className="bg-white rounded-2xl shadow flex items-center gap-3 px-4 py-3">
      <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
        {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover" /> : <span className="text-xl text-gray-400">👤</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight truncate" style={{ color: '#2C3E50' }}>
          {leerling.voornaam} {leerling.achternaam}
        </p>
        <p className="text-xs" style={{ color: scoreKleur(score) }}>
          {count}× niet in orde · <strong>{score}/10</strong>
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onMin} disabled={count === 0}
          className="w-9 h-9 rounded-full flex items-center justify-center text-xl font-bold disabled:opacity-30"
          style={{ background: '#FEE2E2', color: '#E74C3C' }}>−</button>
        <span className="w-7 text-center font-bold text-base" style={{ color: '#2C3E50' }}>{count}</span>
        <button onClick={onPlus}
          className="w-9 h-9 rounded-full flex items-center justify-center text-xl font-bold"
          style={{ background: '#DCFCE7', color: '#27AE60' }}>+</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCORES-STROOM
// ══════════════════════════════════════════════════════════════════════════════

function ScoringScreen({ klas, sportId, graad, les, onTerug }) {
  const [popupLeerling, setPopup]   = useState(null)
  const [rubricOpen, setRubricOpen] = useState(true)
  const [zelfevalOpen, setZelfeval] = useState(false)

  const sportNaam     = sportsData.sports.find(s => s.id === sportId)?.name ?? sportId
  const lesData       = lessonsData[sportId]?.[graad]?.[les]
  const lesNr         = les.replace('les_', '')
  const rubricEntries = Object.entries(lesData?.rubrics ?? {})
  const rubricKeys    = rubricEntries.map(([k]) => k)
  const heeftZelfeval = rubricEntries.some(([, lpd]) => lpd.type === 'zelfevaluatie')

  const leerlingen = useStudentsByKlas(klas.id)

  const alleScores = useLiveQuery(
    () => db.scores.where('sportId').equals(sportId).and(s => s.graad === graad && s.les === les).toArray(),
    [sportId, graad, les], []
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
    if (existing) await db.scores.update(existing.id, { score, datum })
    else await db.scores.add({ leerlingId, sportId, graad, les, lpd, score, datum })
  }

  function exportCsv() {
    if (!leerlingen?.length) return
    const lpdCols = rubricEntries.flatMap(([k]) => [`${k}_niveau`, `${k}_score`])
    const cols    = ['student_id', 'voornaam', 'achternaam', ...lpdCols, 'numeriek', 'rubric_gemiddelde', 'eindscore']
    const header  = cols.join(',')
    const rows = leerlingen.map(l => {
      const s = scoreMap[l.id] ?? {}
      const lpdVals = rubricEntries.flatMap(([k]) => {
        const niveau = s[k] ?? ''
        return [niveau, niveau ? (NIVEAU_SCORE[niveau] ?? '') : '']
      })
      const num = s['numeriek'] !== undefined ? s['numeriek'] : ''
      const rubricGem = (() => {
        const vals = rubricKeys.map(k => s[k]).filter(v => v && NIVEAU_SCORE[v] !== undefined).map(v => NIVEAU_SCORE[v])
        return vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length * 10) / 10 : ''
      })()
      const eind = berekenEindScore(s, rubricKeys) ?? ''
      return [l.id, l.voornaam, l.achternaam, ...lpdVals, num, rubricGem, eind].join(',')
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `scores_${klas.id}_${sportId}_${graad}_${les}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Context-balk */}
      <div className="bg-white rounded-2xl shadow px-4 py-3 mb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-bold text-base" style={{ color: '#2C3E50' }}>{klas.naam} · {sportNaam} · Les {lesNr}</p>
          {lesData && <p className="text-xs text-gray-400 mt-0.5">{lesData.titel}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {heeftZelfeval && (
            <button onClick={() => setZelfeval(true)} className="px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#8E44AD' }}>
              📱 Zelfevaluatie
            </button>
          )}
          <button onClick={exportCsv} className="px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#2C3E50' }}>⬇ CSV</button>
          <button onClick={onTerug} className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Terug</button>
        </div>
      </div>

      {/* Rubric-info accordion */}
      <button onClick={() => setRubricOpen(o => !o)}
        className="w-full flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3 text-left">
        <span className="text-sm font-semibold text-blue-700">📖 Rubric-info</span>
        <span className="text-blue-400 text-sm">{rubricOpen ? '▲' : '▼'}</span>
      </button>
      {rubricOpen && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 mb-3 space-y-2">
          {rubricEntries.length === 0 ? (
            <p className="text-xs text-blue-800">Geen rubrics voor deze les.</p>
          ) : rubricEntries.map(([lpdKey, lpd]) => (
            <div key={lpdKey} className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-800">{lpdKey.replace('lpd_', 'LPD ').toUpperCase()}</span>
              <span className="text-xs text-blue-700">— {lpd.naam}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${lpd.type === 'zelfevaluatie' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                {lpd.type === 'zelfevaluatie' ? 'zelfevaluatie' : 'leerkracht'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Leerlingenraster */}
      {!leerlingen?.length ? (
        <div className="text-center py-10 text-gray-400">
          <div className="text-4xl mb-2">👤</div>
          <p>Geen leerlingen in {klas.naam}.</p>
          <Link to="/admin" className="text-sm underline mt-1 block" style={{ color: '#E67E22' }}>Importeer via Admin</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {leerlingen.map(l => (
            <StudentCard
              key={l.id}
              leerling={l}
              scores={scoreMap[l.id] ?? {}}
              rubricEntries={rubricEntries}
              rubricKeys={rubricKeys}
              onNumericScore={delta => {
                const huidig = (scoreMap[l.id] ?? {})['numeriek'] ?? DEFAULT_SCORE
                slaScore(l.id, 'numeriek', Math.max(0, Math.min(10, huidig + delta)))
              }}
              onTap={() => setPopup(l)}
            />
          ))}
        </div>
      )}

      {popupLeerling && (
        <RubricPopup
          leerling={popupLeerling}
          scores={scoreMap[popupLeerling.id] ?? {}}
          rubricEntries={rubricEntries}
          rubricKeys={rubricKeys}
          onScore={(lpd, score) => slaScore(popupLeerling.id, lpd, score)}
          onClose={() => setPopup(null)}
        />
      )}

      {zelfevalOpen && (
        <ZelfevalQR klas={klas} sportId={sportId} sportNaam={sportNaam} graad={graad} les={les}
          lesData={lesData} rubrics={lesData?.rubrics ?? {}} onSluiten={() => setZelfeval(false)} />
      )}
    </div>
  )
}

// ── Student-kaart ─────────────────────────────────────────────────────────────
function StudentCard({ leerling, scores, rubricEntries, rubricKeys, onNumericScore, onTap }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  const numScore  = scores['numeriek'] ?? DEFAULT_SCORE
  const eindscore = berekenEindScore(scores, rubricKeys)

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
      <button onClick={onTap} className="flex-1 flex flex-col items-center pt-4 pb-2 active:bg-gray-50 w-full relative">
        {eindscore !== null && (
          <span className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: scoreKleur(eindscore) }}>
            {eindscore}
          </span>
        )}
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 mb-2 flex items-center justify-center">
          {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl text-gray-400">👤</span>}
        </div>
        <p className="text-sm font-semibold text-center px-2 leading-tight" style={{ color: '#2C3E50' }}>{leerling.voornaam}</p>
        <p className="text-xs text-gray-500 text-center px-2">{leerling.achternaam}</p>
        {rubricEntries.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mt-1.5 px-1">
            {rubricEntries.map(([lpdKey]) => {
              const niveau = scores[lpdKey]
              return (
                <span key={lpdKey} className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={niveau
                    ? { background: NIVEAU_KLEUR[niveau] + '22', color: NIVEAU_KLEUR[niveau], border: `1px solid ${NIVEAU_KLEUR[niveau]}44` }
                    : { background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }
                  }>
                  {niveau ? NIVEAU_LABELS[niveau] : '—'}
                </span>
              )
            })}
          </div>
        )}
      </button>
      <div className="flex items-center border-t border-gray-100">
        <button onClick={() => onNumericScore(-1)} className="flex-1 py-3 text-2xl font-bold text-red-500 active:bg-red-50" aria-label="min 1">−</button>
        <span className="flex-1 text-center text-xl font-bold" style={{ color: scoreKleur(numScore) }}>{numScore}</span>
        <button onClick={() => onNumericScore(+1)} className="flex-1 py-3 text-2xl font-bold text-green-500 active:bg-green-50" aria-label="plus 1">+</button>
      </div>
    </div>
  )
}

// ── Rubric-popup ──────────────────────────────────────────────────────────────
function RubricPopup({ leerling, scores, rubricEntries, rubricKeys, onScore, onClose }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  const numScore  = scores['numeriek'] ?? DEFAULT_SCORE
  const eindscore = berekenEindScore(scores, rubricKeys)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
            {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover" /> : <span className="text-xl text-gray-400">👤</span>}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold leading-tight" style={{ color: '#2C3E50' }}>{leerling.voornaam} {leerling.achternaam}</h2>
            <p className="text-xs text-gray-400">{leerling.klasId}</p>
          </div>
          {eindscore !== null && (
            <div className="text-center">
              <span className="block text-xl font-bold" style={{ color: scoreKleur(eindscore) }}>{eindscore}</span>
              <span className="text-xs text-gray-400">eindscore</span>
            </div>
          )}
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Manuele score</p>
        <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 mb-4 overflow-hidden">
          <button onClick={() => onScore('numeriek', Math.max(0, numScore - 1))} className="flex-1 py-3 text-2xl font-bold text-red-500 active:bg-red-50">−</button>
          <span className="w-14 text-center text-2xl font-bold" style={{ color: scoreKleur(numScore) }}>{numScore}</span>
          <button onClick={() => onScore('numeriek', Math.min(10, numScore + 1))} className="flex-1 py-3 text-2xl font-bold text-green-500 active:bg-green-50">+</button>
        </div>

        {rubricEntries.length > 0 ? (
          <div className="space-y-1">
            {rubricEntries.map(([lpdKey, lpd]) => (
              <LpdRij key={lpdKey} lpdKey={lpdKey} lpd={lpd} huidig={scores[lpdKey] ?? null} onKies={niveau => onScore(lpdKey, niveau)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic text-center py-3">Geen LPD-rubrics voor deze les.</p>
        )}

        <button onClick={onClose} className="mt-5 w-full py-3 rounded-xl font-semibold text-white" style={{ background: '#2C3E50' }}>Sluiten</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOFD-COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function Evaluatie() {
  const location = useLocation()
  const prefill  = location.state ?? {}

  const klassen = useKlassen()

  // Globale modus: null = keuze, 'scores' = scoreflow, 'kledij' = kledijflow
  const [modus,   setModus]   = useState(prefill.sportId ? 'scores' : null)
  const [klas,    setKlas]    = useState(null)
  const [sportId, setSportId] = useState(prefill.sportId ?? null)
  const [graad,   setGraad]   = useState(prefill.graad   ?? null)
  const [les,     setLes]     = useState(prefill.les     ?? null)

  const heeftPrefill  = !!(prefill.sportId && prefill.graad && prefill.les)
  const afgeleidGraad = klas ? graadFromKlasId(klas.id) : (prefill.graad ?? null)

  const sport   = sportsData.sports.find(s => s.id === sportId)
  const lesData = lessonsData[sportId]?.[graad]?.[les]
  const prefillInfo = heeftPrefill ? { sportNaam: sport?.name ?? sportId, lesNr: les?.replace('les_', ''), titel: lesData?.titel ?? '' } : null

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
            <span className="text-xs text-gray-400 text-center">Rubrics, LPD's en manuele score per les</span>
          </button>
          <button
            onClick={() => setModus('kledij')}
            className="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform border-2 border-transparent hover:border-orange-200"
          >
            <span className="text-4xl">👕</span>
            <span className="font-bold text-base" style={{ color: '#2C3E50' }}>Kledij</span>
            <span className="text-xs text-gray-400 text-center">Kledijscore bijhouden per klas</span>
          </button>
        </div>
      </div>
    )
  }

  // ── Kledij-stroom ─────────────────────────────────────────────────────────
  if (modus === 'kledij') {
    if (!klas) {
      return (
        <div>
          {title}
          <StapBalk stappen={['Klas kiezen', 'Kledij']} huidig={0} />
          <KlasPicker klassen={klassen} onKies={setKlas} />
        </div>
      )
    }
    return (
      <div>
        {title}
        <StapBalk stappen={['Klas kiezen', 'Kledij']} huidig={1} />
        <KledijScreen klas={klas} onTerug={() => setKlas(null)} />
      </div>
    )
  }

  // ── Scores-stroom ─────────────────────────────────────────────────────────

  // Route A: prefill vanuit les-detail (klas → scoren)
  if (heeftPrefill) {
    if (!klas) {
      return (
        <div>
          {title}
          <StapBalk stappen={['Klas kiezen', 'Scoren']} huidig={0} />
          <KlasPicker klassen={klassen} graadFilter={prefill.graad} onKies={setKlas} prefillInfo={prefillInfo} />
        </div>
      )
    }
    return (
      <div>
        {title}
        <StapBalk stappen={['Klas kiezen', 'Scoren']} huidig={1} />
        <ScoringScreen klas={klas} sportId={sportId} graad={graad} les={les} onTerug={() => setKlas(null)} />
      </div>
    )
  }

  // Route B: vrije keuze (klas → les → scoren)
  if (!klas) {
    return (
      <div>
        {title}
        <StapBalk stappen={['Klas', 'Les', 'Scoren']} huidig={0} />
        <KlasPicker klassen={klassen} onKies={k => { setKlas(k); setGraad(graadFromKlasId(k.id)) }} />
      </div>
    )
  }

  if (!sportId || !les) {
    return (
      <div>
        {title}
        <StapBalk stappen={['Klas', 'Les', 'Scoren']} huidig={1} />
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => { setKlas(null); setGraad(null) }}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">← Terug</button>
          <span className="text-sm text-gray-500">Klas: <strong style={{ color: '#2C3E50' }}>{klas.naam}</strong></span>
        </div>
        <LessenPicker graad={afgeleidGraad} onKies={les => { setSportId(les.sportId); setLes(les.lesKey) }} />
      </div>
    )
  }

  return (
    <div>
      {title}
      <StapBalk stappen={['Klas', 'Les', 'Scoren']} huidig={2} />
      <ScoringScreen klas={klas} sportId={sportId} graad={graad} les={les}
        onTerug={() => { setSportId(null); setLes(null) }} />
    </div>
  )
}
