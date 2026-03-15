import { useState, useEffect, useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { useKlassen, useStudentsByKlas } from '../hooks/useStudents'
import { graadFromKlasId, GRAAD_LABEL } from '../utils/graad'
import sportsData from '../data/sports.json'
import lessonsData from '../data/lessons.json'
import ZelfevalQR from './ZelfevalQR'

const DEFAULT_SCORE = 10

const NIVEAU_LABELS = {
  zwak:       'Zwak',
  voldoende:  'Vold.',
  goed:       'Goed',
  uitstekend: 'Uitst.',
}

const NIVEAU_KLEUR = {
  zwak:       '#E74C3C',
  voldoende:  '#F39C12',
  goed:       '#E67E22',
  uitstekend: '#27AE60',
}

// ── Alle beschikbare lessen voor een graad ────────────────────────────────────
function getLessenVoorGraad(graad) {
  const result = []
  for (const sport of sportsData.sports) {
    const gradeData = lessonsData[sport.id]?.[graad]
    if (!gradeData) continue
    for (const [lesKey, les] of Object.entries(gradeData)) {
      result.push({
        sportId:   sport.id,
        sportNaam: sport.name,
        lesKey,
        lesNr:     lesKey.replace('les_', ''),
        titel:     les.titel,
      })
    }
  }
  return result
}

// ── Stap-indicator ────────────────────────────────────────────────────────────
function StapBalk({ stappen, huidig }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {stappen.map((label, i) => {
        const done   = i < huidig
        const active = i === huidig
        const bgStyle = active ? { background: '#E67E22' } : {}
        const wrapCls = active ? 'text-white'
                       : done  ? 'bg-green-100 text-green-700'
                       :          'bg-gray-100 text-gray-400'
        const dotCls  = done   ? 'bg-green-500 text-white'
                       : active ? 'bg-white'
                       :          'bg-gray-300 text-gray-500'
        return (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div
              className={`flex items-center gap-1.5 flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold ${wrapCls}`}
              style={bgStyle}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${dotCls}`}
                style={active ? { color: '#E67E22' } : {}}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className="truncate">{label}</span>
            </div>
            {i < stappen.length - 1 && (
              <div className={done ? 'w-2 h-0.5 flex-shrink-0 bg-green-400' : 'w-2 h-0.5 flex-shrink-0 bg-gray-200'} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Klas-kiezer ───────────────────────────────────────────────────────────────
function KlasPicker({ klassen, graadFilter, onKies, prefillInfo }) {
  const gefilterd = graadFilter
    ? klassen.filter(k => graadFromKlasId(k.id) === graadFilter)
    : klassen

  if (klassen.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">📂</div>
        <p className="text-gray-500 mb-1">Nog geen klassen geïmporteerd.</p>
        <Link to="/admin" className="text-sm font-semibold underline" style={{ color: '#E67E22' }}>
          Ga naar Admin om klassen in te laden
        </Link>
      </div>
    )
  }

  return (
    <div>
      {prefillInfo && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 text-sm">
          <p className="font-semibold" style={{ color: '#E67E22' }}>
            {prefillInfo.sportNaam} — Les {prefillInfo.lesNr}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">{prefillInfo.titel}</p>
          {graadFilter && (
            <p className="text-gray-400 text-xs mt-0.5">
              {GRAAD_LABEL[graadFilter]}
            </p>
          )}
        </div>
      )}

      <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        Kies een klas
        {graadFilter && (
          <span className="ml-2 font-normal normal-case text-gray-400">
            ({GRAAD_LABEL[graadFilter]})
          </span>
        )}
      </p>

      {gefilterd.length === 0 ? (
        <p className="text-gray-400 text-sm italic">
          Geen klassen gevonden voor {GRAAD_LABEL[graadFilter]}.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {gefilterd.map(k => (
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
      )}
    </div>
  )
}

// ── Les-kiezer (Route B stap 2) ───────────────────────────────────────────────
function LessenPicker({ graad, onKies }) {
  const lessen = getLessenVoorGraad(graad)

  const perSport = useMemo(() => {
    const map = {}
    for (const les of lessen) {
      if (!map[les.sportId]) {
        map[les.sportId] = { sportNaam: les.sportNaam, lessen: [] }
      }
      map[les.sportId].lessen.push(les)
    }
    return Object.entries(map)
  }, [graad])

  if (perSport.length === 0) {
    return <p className="text-gray-400 italic text-sm">Geen lessen gevonden voor deze graad.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Kies een les  <span className="font-normal normal-case text-gray-400">({GRAAD_LABEL[graad]})</span>
      </p>
      {perSport.map(([sportId, { sportNaam, lessen }]) => (
        <div key={sportId} className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-bold text-base mb-3" style={{ color: '#2C3E50' }}>{sportNaam}</h3>
          <div className="flex gap-2">
            {lessen.map(les => (
              <button
                key={les.lesKey}
                onClick={() => onKies(les)}
                className="flex-1 rounded-xl py-4 px-3 text-center active:scale-95 transition-transform"
                style={{ background: '#E67E22' }}
              >
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

// ── LPD-rij (altijd uitgeklapte kaarten met omschrijving) ─────────────────────
function LpdRij({ lpdKey, lpd, huidig, onKies }) {
  const niveauEntries = Object.entries(lpd.niveaus)

  return (
    <div className="mb-3 last:mb-0">
      {/* LPD-label */}
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs text-gray-500 font-medium">
          {lpdKey.replace('lpd_', 'LPD ').toUpperCase()}
        </span>
        <span className="text-xs text-gray-400">— {lpd.naam}</span>
        {lpd.type === 'zelfevaluatie' && (
          <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
            zelf
          </span>
        )}
      </div>

      {/* Kaarten met omschrijving */}
      <div className="space-y-1.5">
        {niveauEntries.map(([key, omschrijving]) => {
          const actief = huidig === key
          return (
            <button
              key={key}
              onClick={() => onKies(huidig === key ? null : key)}
              className="w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors active:scale-[0.99]"
              style={actief
                ? { borderColor: '#E67E22', background: '#FFF8F0' }
                : { borderColor: '#e5e7eb', background: 'white' }
              }
            >
              <p
                className="text-xs font-bold uppercase tracking-wide mb-0.5"
                style={{ color: actief ? '#E67E22' : '#2C3E50' }}
              >
                {NIVEAU_LABELS[key] ?? key}
                {actief && <span className="ml-1.5 normal-case font-normal">✓</span>}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">{omschrijving}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Scoring-scherm ────────────────────────────────────────────────────────────
function ScoringScreen({ klas, sportId, graad, les, onTerug }) {
  const [popupLeerling, setPopupLeerling] = useState(null)
  const [rubricOpen, setRubricOpen]       = useState(false)
  const [zelfevalOpen, setZelfevalOpen]   = useState(false)

  const sportNaam     = sportsData.sports.find(s => s.id === sportId)?.name ?? sportId
  const lesData       = lessonsData[sportId]?.[graad]?.[les]
  const lesNr         = les.replace('les_', '')
  const rubricEntries = Object.entries(lesData?.rubrics ?? {})
  const heeftZelfeval = rubricEntries.some(([, lpd]) => lpd.type === 'zelfevaluatie')

  const leerlingen = useStudentsByKlas(klas.id)

  const alleScores = useLiveQuery(
    () => db.scores
      .where('sportId').equals(sportId)
      .and(s => s.graad === graad && s.les === les)
      .toArray(),
    [sportId, graad, les],
    []
  )

  // Geneste map: { leerlingId: { lpd_key: score } }
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

  function exportCsv() {
    if (!leerlingen?.length) return
    const lpdKeys = ['numeriek', ...rubricEntries.map(([k]) => k)]
    const header  = ['student_id', 'voornaam', 'achternaam', ...lpdKeys].join(',')
    const rows    = leerlingen.map(l => {
      const s    = scoreMap[l.id] ?? {}
      const vals = lpdKeys.map(k => s[k] ?? '')
      return [l.id, l.voornaam, l.achternaam, ...vals].join(',')
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `scores_${klas.id}_${sportId}_${graad}_${les}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Context-balk */}
      <div className="bg-white rounded-2xl shadow px-4 py-3 mb-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-base" style={{ color: '#2C3E50' }}>
            {klas.naam} · {sportNaam} · Les {lesNr}
          </p>
          {lesData && (
            <p className="text-xs text-gray-400 mt-0.5">{lesData.titel}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {heeftZelfeval && (
            <button
              onClick={() => setZelfevalOpen(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#8E44AD' }}
              title="Start zelfevaluatie met QR-codes"
            >
              📱 Zelfevaluatie
            </button>
          )}
          <button
            onClick={exportCsv}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#2C3E50' }}
            title="Exporteer scores als CSV"
          >
            ⬇ CSV
          </button>
          <button
            onClick={onTerug}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600"
          >
            ← Terug
          </button>
        </div>
      </div>

      {/* Rubric-info accordion */}
      <button
        onClick={() => setRubricOpen(o => !o)}
        className="w-full flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3 text-left"
      >
        <span className="text-sm font-semibold text-blue-700">📖 Rubric-info</span>
        <span className="text-blue-400 text-sm">{rubricOpen ? '▲' : '▼'}</span>
      </button>
      {rubricOpen && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 mb-3 space-y-2">
          {rubricEntries.length === 0 ? (
            <p className="text-xs text-blue-800">Geen rubrics voor deze les.</p>
          ) : rubricEntries.map(([lpdKey, lpd]) => (
            <div key={lpdKey} className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-800">
                {lpdKey.replace('lpd_', 'LPD ').toUpperCase()}
              </span>
              <span className="text-xs text-blue-700">— {lpd.naam}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                lpd.type === 'zelfevaluatie'
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
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
          <Link to="/admin" className="text-sm underline mt-1 block" style={{ color: '#E67E22' }}>
            Importeer via Admin
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {leerlingen.map(l => (
            <StudentCard
              key={l.id}
              leerling={l}
              scores={scoreMap[l.id] ?? {}}
              rubricEntries={rubricEntries}
              onNumericScore={delta => {
                const huidig = (scoreMap[l.id] ?? {})['numeriek'] ?? DEFAULT_SCORE
                slaScore(l.id, 'numeriek', Math.max(0, Math.min(20, huidig + delta)))
              }}
              onTap={() => setPopupLeerling(l)}
            />
          ))}
        </div>
      )}

      {popupLeerling && (
        <RubricPopup
          leerling={popupLeerling}
          scores={scoreMap[popupLeerling.id] ?? {}}
          rubricEntries={rubricEntries}
          onScore={(lpd, score) => slaScore(popupLeerling.id, lpd, score)}
          onClose={() => setPopupLeerling(null)}
        />
      )}

      {zelfevalOpen && (
        <ZelfevalQR
          klas={klas}
          sportId={sportId}
          sportNaam={sportNaam}
          graad={graad}
          les={les}
          lesData={lesData}
          rubrics={lesData?.rubrics ?? {}}
          onSluiten={() => setZelfevalOpen(false)}
        />
      )}
    </div>
  )
}

// ── Student-kaart (compact grid) ──────────────────────────────────────────────
function StudentCard({ leerling, scores, rubricEntries, onNumericScore, onTap }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  const numScore   = scores['numeriek'] ?? DEFAULT_SCORE
  const scoreColor = numScore >= 14 ? '#27AE60' : numScore >= 10 ? '#E67E22' : '#E74C3C'

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
      {/* Foto + naam (tik → popup) */}
      <button
        onClick={onTap}
        className="flex-1 flex flex-col items-center pt-4 pb-2 active:bg-gray-50 w-full"
      >
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 mb-2 flex items-center justify-center">
          {imgSrc
            ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
            : <span className="text-3xl text-gray-400">👤</span>
          }
        </div>
        <p className="text-sm font-semibold text-center px-2 leading-tight" style={{ color: '#2C3E50' }}>
          {leerling.voornaam}
        </p>
        <p className="text-xs text-gray-500 text-center px-2">{leerling.achternaam}</p>

        {/* LPD-status badges */}
        {rubricEntries.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mt-1.5 px-1">
            {rubricEntries.map(([lpdKey]) => {
              const niveau = scores[lpdKey]
              return (
                <span
                  key={lpdKey}
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={niveau
                    ? { background: NIVEAU_KLEUR[niveau] + '22', color: NIVEAU_KLEUR[niveau], border: `1px solid ${NIVEAU_KLEUR[niveau]}44` }
                    : { background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }
                  }
                >
                  {niveau ? NIVEAU_LABELS[niveau] : '—'}
                </span>
              )
            })}
          </div>
        )}
      </button>

      {/* Numerieke score +/- */}
      <div className="flex items-center border-t border-gray-100">
        <button
          onClick={() => onNumericScore(-1)}
          className="flex-1 py-3 text-2xl font-bold text-red-500 active:bg-red-50"
          aria-label="min 1"
        >−</button>
        <span className="flex-1 text-center text-xl font-bold" style={{ color: scoreColor }}>
          {numScore}
        </span>
        <button
          onClick={() => onNumericScore(+1)}
          className="flex-1 py-3 text-2xl font-bold text-green-500 active:bg-green-50"
          aria-label="plus 1"
        >+</button>
      </div>
    </div>
  )
}

// ── Rubric-popup (volledige LPD-scoring per leerling) ─────────────────────────
function RubricPopup({ leerling, scores, rubricEntries, onScore, onClose }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  const numScore   = scores['numeriek'] ?? DEFAULT_SCORE
  const scoreColor = numScore >= 14 ? '#27AE60' : numScore >= 10 ? '#E67E22' : '#E74C3C'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-4" />

        {/* Leerling-header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
            {imgSrc
              ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
              : <span className="text-xl text-gray-400">👤</span>
            }
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight" style={{ color: '#2C3E50' }}>
              {leerling.voornaam} {leerling.achternaam}
            </h2>
            <p className="text-xs text-gray-400">{leerling.klasId}</p>
          </div>
        </div>

        {/* Numerieke score */}
        <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 mb-4 overflow-hidden">
          <button
            onClick={() => onScore('numeriek', Math.max(0, numScore - 1))}
            className="flex-1 py-3 text-2xl font-bold text-red-500 active:bg-red-50"
            aria-label="min 1"
          >−</button>
          <span className="w-14 text-center text-2xl font-bold" style={{ color: scoreColor }}>
            {numScore}
          </span>
          <button
            onClick={() => onScore('numeriek', Math.min(20, numScore + 1))}
            className="flex-1 py-3 text-2xl font-bold text-green-500 active:bg-green-50"
            aria-label="plus 1"
          >+</button>
        </div>

        {/* LPD rubric-rijen */}
        {rubricEntries.length > 0 ? (
          <div className="space-y-1">
            {rubricEntries.map(([lpdKey, lpd]) => (
              <LpdRij
                key={lpdKey}
                lpdKey={lpdKey}
                lpd={lpd}
                huidig={scores[lpdKey] ?? null}
                onKies={niveau => onScore(lpdKey, niveau)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic text-center py-3">
            Geen LPD-rubrics voor deze les.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl font-semibold text-white"
          style={{ background: '#2C3E50' }}
        >Sluiten</button>
      </div>
    </div>
  )
}

// ── Hoofd-component ───────────────────────────────────────────────────────────
export default function Evaluatie() {
  const location = useLocation()
  const prefill  = location.state ?? {}   // { sportId, graad, les } van LesDetail

  const klassen = useKlassen()

  const [klas,     setKlas]     = useState(null)
  const [sportId,  setSportId]  = useState(prefill.sportId ?? null)
  const [graad,    setGraad]    = useState(prefill.graad   ?? null)
  const [les,      setLes]      = useState(prefill.les     ?? null)

  const heeftPrefill  = !!(prefill.sportId && prefill.graad && prefill.les)
  const afgeleidGraad = klas ? graadFromKlasId(klas.id) : (prefill.graad ?? null)

  const sport    = sportsData.sports.find(s => s.id === sportId)
  const lesData  = lessonsData[sportId]?.[graad]?.[les]
  const prefillInfo = heeftPrefill ? {
    sportNaam: sport?.name ?? sportId,
    lesNr:     les?.replace('les_', ''),
    titel:     lesData?.titel ?? '',
  } : null

  const heeftAlles = klas && sportId && graad && les

  function handleKiesKlas(k) {
    setKlas(k)
    if (!heeftPrefill) {
      setGraad(graadFromKlasId(k.id))
      setSportId(null)
      setLes(null)
    }
  }

  function handleKiesLes(lesObj) {
    setSportId(lesObj.sportId)
    setLes(lesObj.lesKey)
    setGraad(afgeleidGraad)
  }

  function handleTerug() {
    if (heeftPrefill) {
      setKlas(null)
    } else if (heeftAlles || (klas && sportId)) {
      setSportId(null)
      setLes(null)
    } else {
      setKlas(null)
      setGraad(null)
    }
  }

  const title = (
    <h1 className="text-xl font-bold mb-4" style={{ color: '#2C3E50' }}>Evaluatie</h1>
  )

  // ─ Route A ─
  if (heeftPrefill) {
    if (!klas) {
      return (
        <div>
          {title}
          <StapBalk stappen={['Klas kiezen', 'Scoren']} huidig={0} />
          <KlasPicker
            klassen={klassen}
            graadFilter={prefill.graad}
            onKies={handleKiesKlas}
            prefillInfo={prefillInfo}
          />
        </div>
      )
    }
    return (
      <div>
        {title}
        <StapBalk stappen={['Klas kiezen', 'Scoren']} huidig={1} />
        <ScoringScreen
          klas={klas}
          sportId={sportId}
          graad={graad}
          les={les}
          onTerug={handleTerug}
        />
      </div>
    )
  }

  // ─ Route B ─
  if (!klas) {
    return (
      <div>
        {title}
        <StapBalk stappen={['Klas', 'Les', 'Scoren']} huidig={0} />
        <KlasPicker klassen={klassen} onKies={handleKiesKlas} />
      </div>
    )
  }

  if (!sportId || !les) {
    return (
      <div>
        {title}
        <StapBalk stappen={['Klas', 'Les', 'Scoren']} huidig={1} />
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleTerug}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600"
          >← Terug</button>
          <span className="text-sm text-gray-500">
            Klas: <strong style={{ color: '#2C3E50' }}>{klas.naam}</strong>
          </span>
        </div>
        <LessenPicker graad={afgeleidGraad} onKies={handleKiesLes} />
      </div>
    )
  }

  return (
    <div>
      {title}
      <StapBalk stappen={['Klas', 'Les', 'Scoren']} huidig={2} />
      <ScoringScreen
        klas={klas}
        sportId={sportId}
        graad={graad}
        les={les}
        onTerug={handleTerug}
      />
    </div>
  )
}
