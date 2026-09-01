/**
 * PDF-import — matcht een Smartschool-klaslijst-PDF (namen + foto's) tegen de
 * leerlingen die al in Dexie staan (ingevoerd via de CSV-import hierboven) en
 * toont een preview vóór er iets weggeschreven wordt.
 *
 * Badge "naam" (groen) = gekoppeld via de naam die Smartschool onder de foto
 * afdrukt. Badge "positie" (amber) = kon niet via naam gekoppeld worden,
 * teruggevallen op volgorde (vangnet, net als het Python-script).
 *
 * Dubbele namen binnen 1 klas worden NOOIT stilzwijgend opgelost: ze komen
 * als apart, prominent (rood) twijfelgeval bovenaan die klas te staan.
 */
import { useState, useRef, useEffect } from 'react'

export default function PdfImport() {
  const [status, setStatus] = useState(null)     // null | 'bezig' | 'klaar' | 'fout'
  const [progress, setProgress] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [importStatus, setImportStatus] = useState(null) // null | 'bezig' | 'klaar' | 'fout'
  const [importResultaat, setImportResultaat] = useState(null)
  const [importError, setImportError] = useState(null)
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('bezig')
    setError(null)
    setPreview(null)
    setImportStatus(null)
    setImportResultaat(null)
    try {
      const { bouwVolledigePreview } = await import('../utils/pdfMatching')
      const result = await bouwVolledigePreview(file, {
        onProgress: p => setProgress(p),
      })
      setPreview(result)
      setStatus('klaar')
    } catch (err) {
      setError(err.message)
      setStatus('fout')
    }
    e.target.value = ''
  }

  async function handleImporteer() {
    setImportStatus('bezig')
    setImportError(null)
    try {
      const { importeerPreview } = await import('../utils/pdfMatching')
      const resultaat = await importeerPreview(preview)
      setImportResultaat(resultaat)
      setImportStatus('klaar')
    } catch (err) {
      setImportError(err.message)
      setImportStatus('fout')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4 mb-4">
      <h2 className="font-semibold mb-0.5" style={{ color: '#2C3E50' }}>
        Importeer klaslijst-PDF
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Matcht namen en foto's uit een Smartschool-klaslijst-PDF tegen de leerlingen die nu al in
        Dexie staan. Er wordt pas geschreven na je bevestiging hieronder — tot dan is dit enkel een preview.
      </p>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === 'bezig'}
        className="px-4 py-3 rounded-xl font-semibold text-white text-base w-full disabled:opacity-50"
        style={{ background: '#8e44ad' }}
      >
        {status === 'bezig' ? '⏳ Bezig met matchen…' : 'Kies Klaslijst.pdf'}
      </button>
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />

      {status === 'bezig' && progress && (
        <p className="mt-2 text-sm text-gray-500">
          Pagina {progress.page}/{progress.numPages} verwerkt…
        </p>
      )}

      {status === 'fout' && (
        <p className="mt-2 text-sm text-red-500">Fout: {error}</p>
      )}

      {status === 'klaar' && preview && (
        <div className="mt-3 space-y-4">
          {Object.entries(preview.perKlas).sort(([a], [b]) => a.localeCompare(b)).map(([klasId, info]) => (
            <KlasMatchingKaart key={klasId} klasId={klasId} info={info} />
          ))}

          {preview.overgeslagenPaginas.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-xs text-yellow-700">
              {preview.overgeslagenPaginas.length} pagina('s) overgeslagen (geen cijfer-klascode herkend):{' '}
              {preview.overgeslagenPaginas.map(p => `#${p.pageNum} (${p.code ?? 'geen titel'})`).join(', ')}
            </div>
          )}

          {importStatus === 'klaar' && importResultaat ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl px-3 py-3 text-sm text-green-700">
              <p className="font-bold mb-1">✓ Import voltooid</p>
              <p>{importResultaat.nieuweKlassen} klas(sen) aangemaakt</p>
              <p>{importResultaat.nieuweLeerlingen} nieuwe leerling(en) aangemaakt</p>
              <p>{importResultaat.bijgewerkteFotos} foto('s) bijgewerkt bij bestaande leerlingen</p>
              {importResultaat.genegeerd > 0 && (
                <p className="text-yellow-700 mt-1">
                  ⚠ {importResultaat.genegeerd} foto('s) genegeerd — geen herkenbare naam, dus geen leerling aangemaakt.
                </p>
              )}
            </div>
          ) : (
            <div className="border-t border-dashed border-gray-200 pt-3">
              <button
                onClick={handleImporteer}
                disabled={importStatus === 'bezig'}
                className="px-4 py-3 rounded-xl font-semibold text-white text-base w-full disabled:opacity-50"
                style={{ background: '#27AE60' }}
              >
                {importStatus === 'bezig' ? '⏳ Bezig met opslaan…' : '✅ Bevestig en importeer in Dexie'}
              </button>
              {importStatus === 'fout' && (
                <p className="mt-2 text-sm text-red-500">Fout bij opslaan: {importError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KlasMatchingKaart({ klasId, info }) {
  const { leerlingenAantal, fotosAantal, aantalViaNaam, mismatch, matches, extraFotos, dubbeleNamen, geenLeerlingenInDexie } = info

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <p className="text-sm font-bold mb-1" style={{ color: '#2C3E50' }}>
        Klas {klasId}{' '}
        <span className="text-xs font-normal text-gray-400">
          ({leerlingenAantal} leerlingen / {fotosAantal} foto's / {aantalViaNaam} via naam)
        </span>
        {mismatch && <span className="ml-2 text-xs font-bold" style={{ color: '#C0392B' }}>⚠ AANTAL KLOPT NIET</span>}
      </p>

      {geenLeerlingenInDexie && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-2 text-xs text-yellow-700">
          Geen leerlingen gevonden in Dexie voor klas {klasId} (nog niet geïmporteerd via students.csv?) —
          er kan dus niets gematcht worden voor deze klas.
        </div>
      )}

      {dubbeleNamen.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2 mb-2 text-xs text-red-700">
          <p className="font-bold mb-1">⚠ TWIJFELGEVAL — manueel controleren</p>
          <p>
            {dubbeleNamen.length === 1 ? 'Deze naam komt' : 'Deze namen komen'} meer dan 1 keer voor in klas {klasId}.
            De koppeling naam→foto is dan niet 100% zeker af te leiden en valt (deels) terug op volgorde:
          </p>
          <ul className="list-disc list-inside mt-1">
            {dubbeleNamen.map(d => (
              <li key={d.key}>
                {d.leerlingen.map(l => `${l.voornaam} ${l.achternaam}`).join(' & ')} ({d.leerlingen.length}x)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5 mt-2">
        {matches.map(({ leerling, foto, viaNaam }) => (
          <div key={leerling.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
            <FotoThumbnail foto={foto} size={12} />
            <span className="flex-1 text-sm" style={{ color: '#2C3E50' }}>
              {leerling.voornaam} {leerling.achternaam}
            </span>
            {foto ? (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={viaNaam ? { background: '#e8f8ef', color: '#27AE60' } : { background: '#fdf2e3', color: '#E67E22' }}
              >
                {viaNaam ? '✓ naam' : '◐ positie'}
              </span>
            ) : null}
            {!foto && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#fdecea', color: '#C0392B' }}>
                ✕ geen foto
              </span>
            )}
          </div>
        ))}
      </div>

      {extraFotos.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-semibold text-gray-400">Extra foto's (geen leerling meer beschikbaar):</p>
          {extraFotos.map((foto, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-orange-50 rounded-lg px-2 py-1.5">
              <FotoThumbnail foto={foto} size={12} />
              <span className="flex-1 text-xs text-orange-700">
                PDF-naam: {foto.naamPdf ?? '(niet herkend)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FotoThumbnail({ foto, size = 16 }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!foto) return
    const url = URL.createObjectURL(foto.blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  const sizeClass = size === 12 ? 'w-12 h-12' : 'w-16 h-16'
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0 flex items-center justify-center`}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-xl">👤</span>}
    </div>
  )
}
