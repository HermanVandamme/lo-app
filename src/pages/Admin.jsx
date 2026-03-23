import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'
import { parseStudentsCsv, importStudentsToDb, importPhotoForStudent } from '../utils/csvImport'
import { useKlassen } from '../hooks/useStudents'
import { getSupabaseConfig, saveSupabaseConfig, makeSupabaseClient } from '../lib/supabase'

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

  async function exportScores() {
    const [scores, leerlingen, alleKledij] = await Promise.all([
      db.scores.toArray(),
      db.leerlingen.toArray(),
      db.kledij.toArray(),
    ])
    if (!scores.length && !alleKledij.length) { setMsg('export', 'Geen scores om te exporteren.'); return }

    const leerlingMap = Object.fromEntries(leerlingen.map(l => [l.id, l]))
    const kledijMap   = Object.fromEntries(alleKledij.map(k => [k.leerlingId, k.count ?? 0]))

    // Groepeer scores per leerling per sport+graad+les
    const scoresByCtx = {}
    for (const s of scores) {
      const ctxKey = `${s.leerlingId}|${s.sportId}|${s.graad}|${s.les}`
      if (!scoresByCtx[ctxKey]) scoresByCtx[ctxKey] = {}
      scoresByCtx[ctxKey][s.lpd] = s.score
    }

    // Rij per score-record (gedetailleerd) + eindscore per context
    const NIVEAU_SCORE = { zwak: 2.5, voldoende: 5, goed: 7.5, uitstekend: 10 }
    function scoreVal(v) {
      if (v === undefined || v === null) return ''
      if (typeof v === 'string' && NIVEAU_SCORE[v] !== undefined) return NIVEAU_SCORE[v]
      return v
    }

    const rows = [
      ['student_id', 'voornaam', 'achternaam', 'klas', 'sport', 'graad', 'les', 'lpd', 'score_waarde', 'score_numeriek', 'kledij_teller', 'kledij_score', 'datum'].join(','),
      ...scores.map(s => {
        const l = leerlingMap[s.leerlingId] ?? {}
        const kCount = kledijMap[s.leerlingId] ?? ''
        const kScore = kCount !== '' ? Math.max(0, 10 - kCount * 2) : ''
        return [
          s.leerlingId,
          l.voornaam ?? '',
          l.achternaam ?? '',
          l.klasId ?? '',
          s.sportId,
          s.graad.replace('graad_', ''),
          s.les.replace('les_', ''),
          s.lpd,
          s.score,
          scoreVal(s.score),
          kCount,
          kScore,
          s.datum?.slice(0, 10) ?? '',
        ].join(',')
      })
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lo_scores_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
        <p className="text-xs text-gray-400 mb-3">Download alle scores als CSV-bestand.</p>
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

      {/* Supabase configuratie */}
      <SupabaseConfig />

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

/* ── Supabase-configuratie ── */
function SupabaseConfig() {
  const cfg = getSupabaseConfig()
  const [url, setUrl]       = useState(cfg.url)
  const [key, setKey]       = useState(cfg.key)
  const [status, setStatus] = useState('')

  function sla() {
    saveSupabaseConfig(url, key)
    const client = makeSupabaseClient()
    setStatus(client ? '✓ Opgeslagen en verbinding OK' : url || key ? '⚠ Opgeslagen (controleer URL/key)' : 'Gewist.')
  }

  const geconfigureerd = !!(cfg.url && cfg.key)

  return (
    <div className="bg-white rounded-2xl shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold" style={{ color: '#8E44AD' }}>Supabase (zelfevaluatie)</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${geconfigureerd ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {geconfigureerd ? '✓ Ingesteld' : 'Niet ingesteld'}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Nodig voor zelfevaluatie via QR. Antwoorden van leerlingen worden hier opgeslagen (anoniem via token).
        Maak een gratis project op <strong>supabase.com</strong> en voer de URL + anon key in.
      </p>
      <div className="space-y-2 mb-3">
        <input
          type="url"
          placeholder="https://xxxx.supabase.co"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          placeholder="anon public key"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono"
        />
      </div>
      <button
        onClick={sla}
        className="w-full py-2.5 rounded-xl font-semibold text-white text-sm"
        style={{ background: '#8E44AD' }}
      >
        Opslaan
      </button>
      {status && <p className="mt-2 text-sm text-gray-600">{status}</p>}
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
