import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { parseStudentsCsv, importStudentsToDb, importPhotoForStudent } from '../utils/csvImport'
import { useKlassen } from '../hooks/useStudents'
import { jaarNummerFromGraad } from '../utils/graad'
import { getEvaluatiesVoorSport, getKledijConfig } from '../utils/evaluatieData'
import { berekenEvaluatieScore } from '../utils/evaluatieScoring'
import { downloadCsv, SCORE_HEADER, scoreRij, kledijScoreRij } from '../utils/csvExport'
import sportsData from '../data/sports.json'
import PdfImport from '../components/PdfImport'

export default function Admin() {
  const klassen = useKlassen()
  const [messages, setMessages] = useState({})
  const refs = { classes: useRef(), students: useRef(), photos: useRef() }

  const studentCount = useLiveQuery(() => db.leerlingen.count(), [], 0)
  const scoreCount = useLiveQuery(() => db.scores.count(), [], 0)

  function setMsg(key, text) {
    setMessages(m => ({ ...m, [key]: text }))
  }

  async function handleClassesCsv(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      // classes.csv: klas_id, naam (of enkel klas_id kolom)
      const lines = text.trim().split('\n')
      const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim())
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim())
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
      }).filter(r => r.klas_id)
      const klassen = rows.map(r => ({ id: r.klas_id.toLowerCase(), naam: (r.naam || r.klas_id).toUpperCase() }))
      await db.klassen.clear()
      await db.klassen.bulkPut(klassen)
      setMsg('classes', `✓ ${klassen.length} klassen geïmporteerd.`)
    } catch (err) {
      setMsg('classes', `Fout: ${err.message}`)
    }
    e.target.value = ''
  }

  async function handleStudentsCsv(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseStudentsCsv(text)
      // Clear before re-import to prevent duplicates
      await db.leerlingen.clear()
      const result = await importStudentsToDb(db, rows)
      setMsg('students', `✓ ${result.leerlingen} leerlingen in ${result.klassen} klassen geïmporteerd.`)
    } catch (err) {
      setMsg('students', `Fout: ${err.message}`)
    }
    e.target.value = ''
  }

  async function handlePhotoImport(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    let ok = 0, fail = 0
    for (const file of files) {
      const studentId = file.name.replace(/\.[^.]+$/, '')
      try {
        await importPhotoForStudent(db, studentId, file)
        ok++
      } catch {
        fail++
      }
    }
    setMsg('photos', `✓ ${ok} foto's gekoppeld${fail ? `, ${fail} niet gevonden` : ''}.`)
    e.target.value = ''
  }

  /** Eén CSV met alle scores van alle klassen/thema's samen, inclusief kledij (aparte, permanente evaluatie). */
  async function exportScores() {
    const [scores, alleKledij, leerlingen, klassen] = await Promise.all([
      db.scores.toArray(),
      db.kledij.toArray(),
      db.leerlingen.toArray(),
      db.klassen.toArray(),
    ])
    if (!scores.length && !leerlingen.length) { setMsg('export', 'Geen scores om te exporteren.'); return }

    const leerlingMap = Object.fromEntries(leerlingen.map(l => [l.id, l]))
    const klasNaamMap = Object.fromEntries(klassen.map(k => [k.id, k.naam]))

    // Groepeer scores per leerling+sport+graad+evaluatie-item (lpd-sleutel = `${evalId}::${subKey}`)
    const perItem = {}
    for (const s of scores) {
      const [evalId, subKey] = String(s.lpd).split('::')
      if (!subKey) continue
      const ctxKey = `${s.leerlingId}|${s.sportId}|${s.graad}|${evalId}`
      if (!perItem[ctxKey]) perItem[ctxKey] = { leerlingId: s.leerlingId, sportId: s.sportId, graad: s.graad, evalId, waarden: {}, datum: s.datum }
      perItem[ctxKey].waarden[subKey] = s.score
      if (s.datum > perItem[ctxKey].datum) perItem[ctxKey].datum = s.datum
    }

    const rows = []
    for (const { leerlingId, sportId, graad, evalId, waarden, datum } of Object.values(perItem)) {
      const leerling = leerlingMap[leerlingId]
      if (!leerling) continue
      const items = getEvaluatiesVoorSport(sportId, jaarNummerFromGraad(graad))
      const item = items.find(i => i.id === evalId)
      if (!item) continue
      const score = berekenEvaluatieScore(item, waarden)
      rows.push(scoreRij({
        leerling,
        klasNaam: klasNaamMap[leerling.klasId] ?? leerling.klasId,
        sportNaam: sportsData[sportId]?.naam ?? sportId,
        item, score,
        datum: datum?.slice(0, 10) ?? '',
      }))
    }

    // Kledij is een aparte, permanente evaluatie — komt als extra rij per leerling mee in dezelfde export.
    if (leerlingen.length) {
      const cfg = getKledijConfig()
      const kledijMap = Object.fromEntries(alleKledij.map(k => [k.leerlingId, k]))
      const datum = new Date().toISOString().slice(0, 10)
      for (const leerling of leerlingen) {
        rows.push(kledijScoreRij({
          leerling,
          klasNaam: klasNaamMap[leerling.klasId] ?? leerling.klasId,
          score: kledijMap[leerling.id]?.score ?? cfg.start_score,
          cfg, datum,
        }))
      }
    }

    if (!rows.length) { setMsg('export', 'Geen scores om te exporteren.'); return }
    downloadCsv(`lo_scores_${new Date().toISOString().slice(0, 10)}.csv`, SCORE_HEADER, rows)
    setMsg('export', `✓ ${rows.length} scorerijen geëxporteerd.`)
  }

  async function handleWisLegeKlassen() {
    const alleKlassen = await db.klassen.toArray()
    const legeIds = []
    for (const k of alleKlassen) {
      const count = await db.leerlingen.where('klasId').equals(k.id).count()
      if (count === 0) legeIds.push(k.id)
    }
    if (legeIds.length === 0) {
      setMsg('cleanup', 'Geen lege klassen gevonden.')
      return
    }
    await db.klassen.bulkDelete(legeIds)
    setMsg('cleanup', `${legeIds.length} lege klas(sen) verwijderd: ${legeIds.join(', ')}.`)
  }

  async function handleClearAll() {
    if (!confirm('Alle leerlingdata en scores wissen? Dit kan niet ongedaan worden.')) return
    await db.transaction('rw', db.klassen, db.leerlingen, db.scores, async () => {
      await db.klassen.clear()
      await db.leerlingen.clear()
      await db.scores.clear()
    })
    setMessages({ clear: 'Alle data gewist.' })
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2" style={{ color: '#2C3E50' }}>Admin</h1>

      {/* Privacy banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-xs text-yellow-800">
        <strong>Privacy:</strong> Alle leerlingdata wordt enkel lokaal opgeslagen (IndexedDB).
        Niets verlaat dit toestel.
      </div>

      {/* Status-overzicht */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Klassen', value: klassen.length },
          { label: 'Leerlingen', value: studentCount },
          { label: 'Scores', value: scoreCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl shadow text-center py-3">
            <div className="text-2xl font-bold" style={{ color: '#E67E22' }}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Klassen CSV */}
      <ImportSection
        title="Importeer classes.csv"
        description="Kolommen: klas_id, naam"
        buttonLabel="Kies classes.csv"
        accept=".csv"
        message={messages.classes}
        onFileChange={handleClassesCsv}
        inputRef={refs.classes}
      />

      {/* Leerlingen CSV */}
      <ImportSection
        title="Importeer students.csv"
        description="Kolommen: student_id, klas_id, voornaam, achternaam"
        buttonLabel="Kies students.csv"
        accept=".csv"
        message={messages.students}
        onFileChange={handleStudentsCsv}
        inputRef={refs.students}
      />

      {/* Foto's */}
      <ImportSection
        title="Importeer leerlingfoto's"
        description="Bestandsnaam = student_id (bv. 4e_01.png). Meerdere bestanden tegelijk."
        buttonLabel="Kies foto's"
        accept="image/*"
        multiple
        message={messages.photos}
        onFileChange={handlePhotoImport}
        inputRef={refs.photos}
      />

      {/* PDF-import — additief, vervangt de CSV-import hierboven niet */}
      <PdfImport />

      {/* Klassen-overzicht */}
      {klassen.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <h2 className="font-semibold mb-2" style={{ color: '#2C3E50' }}>Geïmporteerde klassen</h2>
          <div className="flex flex-wrap gap-2">
            {klassen.map(k => (
              <KlasChip key={k.id} klasId={k.id} naam={k.naam} />
            ))}
          </div>
        </div>
      )}

      {/* Export scores */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <h2 className="font-semibold mb-1" style={{ color: '#2C3E50' }}>Exporteer scores</h2>
        <p className="text-xs text-gray-400 mb-3">Download alle scores als CSV-bestand (alle klassen/thema's/kledij samen).</p>
        <button
          onClick={exportScores}
          className="px-4 py-3 rounded-xl font-semibold text-white text-base w-full"
          style={{ background: '#2C3E50' }}
        >
          ⬇ Exporteer alle scores
        </button>
        {messages.export && <p className="mt-2 text-sm text-gray-500">{messages.export}</p>}
      </div>

      {/* Wis lege klassen */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <h2 className="font-semibold mb-1" style={{ color: '#2C3E50' }}>Wis lege klassen</h2>
        <p className="text-xs text-gray-400 mb-3">
          Verwijdert klassen zonder leerlingen (bv. duplicaten na import).
        </p>
        <button
          onClick={handleWisLegeKlassen}
          className="w-full py-3 rounded-xl font-semibold text-white text-base"
          style={{ background: '#E67E22' }}
        >
          Wis lege klassen
        </button>
        {messages.cleanup && (
          <p className={`mt-2 text-sm ${messages.cleanup.startsWith('Geen') ? 'text-gray-500' : 'text-green-600'}`}>
            {messages.cleanup}
          </p>
        )}
      </div>

      {/* Wis alles */}
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-semibold text-red-600 mb-1">Data wissen</h2>
        <p className="text-xs text-gray-400 mb-3">
          Verwijdert alle lokaal opgeslagen leerlingdata, foto's en scores.
        </p>
        <button
          onClick={handleClearAll}
          className="w-full py-3 rounded-xl font-semibold text-white text-base bg-red-500 hover:bg-red-600 transition-colors"
        >
          Wis alle data
        </button>
        {messages.clear && <p className="mt-2 text-sm text-green-600">{messages.clear}</p>}
      </div>
    </div>
  )
}

/* ── ImportSection helper ── */
function ImportSection({ title, description, buttonLabel, accept, multiple, message, onFileChange, inputRef }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 mb-4">
      <h2 className="font-semibold mb-0.5" style={{ color: '#2C3E50' }}>{title}</h2>
      <p className="text-xs text-gray-400 mb-3">{description}</p>
      <button
        onClick={() => inputRef.current?.click()}
        className="px-4 py-3 rounded-xl font-semibold text-white text-base w-full"
        style={{ background: '#E67E22' }}
      >
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onFileChange}
      />
      {message && (
        <p className={`mt-2 text-sm ${message.startsWith('Fout') ? 'text-red-500' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

/* ── KlasChip met leerlingtelling ── */
function KlasChip({ klasId, naam }) {
  const count = useLiveQuery(
    () => db.leerlingen.where('klasId').equals(klasId).count(),
    [klasId],
    0
  )
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200">
      {naam}
      <span className="bg-orange-200 text-orange-800 rounded-full px-1.5 text-xs font-bold">{count}</span>
    </span>
  )
}
