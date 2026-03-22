/**
 * EvaluatiePanel — inline scoren vanuit het les-accordion
 *
 * Sectie 1: inklapbare rubric-samenvatting (welke LPDs, welk type)
 * Sectie 2: klas kiezen → leerlingkaarten met numerieke score + LPD-niveaukaarten
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { useKlassen, useStudentsByKlas } from '../hooks/useStudents'
import { graadFromKlasId } from '../utils/graad'
import { NIVEAU_SCORE, berekenEindScore, scoreKleur } from '../utils/scoring'

const NIVEAU_LABELS = {
  zwak:       'Zwak',
  voldoende:  'Vold.',
  goed:       'Goed',
  uitstekend: 'Uitst.',
}

const DEFAULT_SCORE = 10

// ── Hoofd-component ───────────────────────────────────────────────────────────
export default function EvaluatiePanel({ sportId, graad, les, rubrics }) {
  const [rubricOpen, setRubricOpen]     = useState(false)
  const [selectedKlas, setSelectedKlas] = useState(null)

  const klassen   = useKlassen()
  const gefilterd = useMemo(
    () => klassen.filter(k => graadFromKlasId(k.id) === graad),
    [klassen, graad]
  )

  const rubricEntries = Object.entries(rubrics ?? {})

  return (
    <div className="mt-1">

      {/* ── Sectie 1: Rubric-info (samenvatting) ───────────────────────── */}
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

      {/* ── Sectie 2: Scoren ───────────────────────────────────────────── */}
      {gefilterd.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-3 text-xs text-yellow-700">
          Geen klassen gevonden voor deze graad.
          Importeer klassen via <strong>Admin</strong>.
        </div>
      ) : !selectedKlas ? (
        <KlasPicker klassen={gefilterd} onKies={setSelectedKlas} />
      ) : (
        <ScoringRaster
          klas={selectedKlas}
          sportId={sportId}
          graad={graad}
          les={les}
          rubricEntries={rubricEntries}
          onWisselKlas={() => setSelectedKlas(null)}
        />
      )}
    </div>
  )
}

// ── Klas-kiezer ───────────────────────────────────────────────────────────────
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

// ── Scoring-raster ────────────────────────────────────────────────────────────
function ScoringRaster({ klas, sportId, graad, les, rubricEntries, onWisselKlas }) {
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base" style={{ color: '#2C3E50' }}>{klas.naam}</span>
          <span className="text-xs text-gray-400">{leerlingen?.length ?? 0} leerlingen</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: '#2C3E50' }}
          >⬇ CSV</button>
          <button
            onClick={onWisselKlas}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600"
          >Klas ↩</button>
        </div>
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
              onScore={(lpd, score) => slaScore(l.id, lpd, score)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Leerling-kaart ────────────────────────────────────────────────────────────
function LeerlingKaart({ leerling, scores, rubricEntries, onScore }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  const rubricKeys = rubricEntries.map(([k]) => k)
  const numScore   = scores['numeriek'] ?? DEFAULT_SCORE
  const eindscore  = berekenEindScore(scores, rubricKeys)

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3">
      {/* Naam + foto + eindscore */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
          {imgSrc
            ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
            : <span className="text-xl text-gray-400">👤</span>
          }
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm leading-tight" style={{ color: '#2C3E50' }}>
            {leerling.voornaam} {leerling.achternaam}
          </p>
          <p className="text-xs text-gray-400">{leerling.klasId}</p>
        </div>
        {eindscore !== null && (
          <div className="text-right">
            <span className="block text-lg font-bold" style={{ color: scoreKleur(eindscore) }}>{eindscore}</span>
            <span className="text-xs text-gray-400">eindscr.</span>
          </div>
        )}
      </div>

      {/* Numerieke score /10 */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Manuele score</p>
      <div className="flex items-center bg-white rounded-xl border border-gray-200 mb-2.5 overflow-hidden">
        <button
          onClick={() => onScore('numeriek', Math.max(0, numScore - 1))}
          className="flex-1 py-3 text-2xl font-bold text-red-500 active:bg-red-50"
          aria-label="min 1"
        >−</button>
        <span className="w-12 text-center text-xl font-bold" style={{ color: scoreKleur(numScore) }}>
          {numScore}
        </span>
        <button
          onClick={() => onScore('numeriek', Math.min(10, numScore + 1))}
          className="flex-1 py-3 text-2xl font-bold text-green-500 active:bg-green-50"
          aria-label="plus 1"
        >+</button>
      </div>

      {/* LPD rubric-rijen */}
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
  )
}

// ── LPD-rij ───────────────────────────────────────────────────────────────────
// Compact: 4 knoppen naast elkaar — tik = selecteer, lang drukken of ⓘ = uitklappen
// Uitgeklapt: 4 kaarten onder elkaar met volledige omschrijving — tik = selecteer + inklappen
function LpdRij({ lpdKey, lpd, huidig, onKies }) {
  const [uitgeklapt, setUitgeklapt] = useState(true)
  const longPressTimer = useRef(null)
  const didLongPress   = useRef(false)

  const niveauEntries = Object.entries(lpd.niveaus)  // [["zwak", "..."], ...]

  function startLongPress() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setUitgeklapt(true)
    }, 500)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current)
  }

  function handleCompactClick(key) {
    if (didLongPress.current) return
    onKies(huidig === key ? null : key)
  }

  function handleKaartKlik(key) {
    onKies(huidig === key ? null : key)
    setUitgeklapt(false)
  }

  return (
    <div className="mb-2 last:mb-0">

      {/* LPD-label + info-knop */}
      <div className="flex items-center gap-1 mb-1">
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

      {!uitgeklapt ? (
        /* ── Compact: 4 knoppen ── */
        <div className="flex gap-1">
          {niveauEntries.map(([key]) => {
            const actief = huidig === key
            return (
              <button
                key={key}
                onPointerDown={startLongPress}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onClick={() => handleCompactClick(key)}
                onContextMenu={e => e.preventDefault()}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors active:scale-95"
                style={actief
                  ? { background: '#E67E22', color: 'white' }
                  : { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }
                }
              >
                {NIVEAU_LABELS[key] ?? key}
              </button>
            )
          })}
        </div>
      ) : (
        /* ── Uitgeklapt: kaarten met omschrijving ── */
        <div className="space-y-1.5">
          {niveauEntries.map(([key, omschrijving]) => {
            const actief = huidig === key
            const punten = NIVEAU_SCORE[key]
            return (
              <button
                key={key}
                onClick={() => handleKaartKlik(key)}
                className="w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors active:scale-[0.99]"
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
                <p className="text-xs text-gray-600 leading-relaxed">{omschrijving}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
