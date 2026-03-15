/**
 * ZelfevalQR — Leerkrachtkant
 * Toont per leerling een groot blok met naam + unieke QR-code.
 * Token → leerlingId koppeling blijft in lokale IndexedDB.
 */
import { useState, useEffect, useCallback } from 'react'
import QRCode from 'react-qr-code'
import db from '../db/db'
import { useStudentsByKlas } from '../hooks/useStudents'
import { makeSupabaseClient, pushSessie, countIngevuld } from '../lib/supabase'

const SMILEYS = ['😞', '😐', '🙂', '😄']

/** Genereer vragen uit zelfevaluatie-rubrics. */
function vragenUitRubrics(rubrics) {
  const vragen = []
  for (const [lpdKey, lpd] of Object.entries(rubrics ?? {})) {
    if (lpd.type !== 'zelfevaluatie') continue
    if (lpd.niveaus) {
      vragen.push({
        lpdKey,
        tekst: `Hoe zou je jezelf beoordelen voor "${lpd.naam}"?`,
        type: 'niveaus',
        labels: Object.values(lpd.niveaus),
      })
    } else if (lpd.vragen) {
      lpd.vragen.slice(0, 4).forEach(tekst =>
        vragen.push({ lpdKey, tekst, type: 'smiley' })
      )
    }
  }
  if (vragen.length === 0) {
    vragen.push(
      { tekst: 'Hoe goed deed ik het vandaag?',  type: 'smiley' },
      { tekst: 'Heb ik mijn best gedaan?',         type: 'smiley' },
      { tekst: 'Werkte ik goed samen met anderen?', type: 'smiley' }
    )
  }
  return vragen.slice(0, 5)
}

function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function ZelfevalQR({ klas, sportId, sportNaam, graad, les, lesData, rubrics, onSluiten }) {
  const leerlingen  = useStudentsByKlas(klas.id)
  const [tokenMap, setTokenMap]   = useState({})   // leerlingId → token
  const [ingevuld, setIngevuld]   = useState(0)
  const [klaar, setKlaar]         = useState(false) // sessies aangemaakt
  const [sbClient]                = useState(() => makeSupabaseClient())
  const baseUrl                   = window.location.origin
  const isLocalhost               = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

  const vragen = vragenUitRubrics(rubrics)

  // ── Maak tokens aan voor alle leerlingen ──────────────────────────────────
  useEffect(() => {
    if (!leerlingen?.length) return
    let cancelled = false

    async function init() {
      // Kijk of er al tokens zijn voor deze sessie
      const bestaand = await db.zelfevalSessies
        .where('klasId').equals(klas.id)
        .and(s => s.sportId === sportId && s.graad === graad && s.les === les)
        .toArray()

      const bestaandMap = {}
      for (const s of bestaand) bestaandMap[s.leerlingId] = s.token

      // Genereer tokens voor ontbrekende leerlingen
      const nieuw = []
      for (const l of leerlingen) {
        if (!bestaandMap[l.id]) {
          const token = generateToken()
          bestaandMap[l.id] = token
          nieuw.push({ token, leerlingId: l.id, klasId: klas.id, sportId, graad, les, aangemaakt: new Date().toISOString() })
        }
      }
      if (nieuw.length) await db.zelfevalSessies.bulkAdd(nieuw)
      if (cancelled) return

      setTokenMap(bestaandMap)

      // Push sessies naar Supabase (zonder leerlingId)
      if (sbClient) {
        for (const entry of nieuw) {
          await pushSessie(sbClient, { token: entry.token, sportId, graad, les, vragen })
        }
        // Push ook bestaande die misschien nog niet in Supabase staan
        for (const [leerlingId, token] of Object.entries(bestaandMap)) {
          if (!nieuw.find(n => n.token === token)) {
            await pushSessie(sbClient, { token, sportId, graad, les, vragen })
          }
        }
      }

      setKlaar(true)
    }

    init()
    return () => { cancelled = true }
  }, [leerlingen?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll Supabase voor ingevuld-teller ────────────────────────────────────
  const peilIngevuld = useCallback(async () => {
    const tokens = Object.values(tokenMap)
    if (!tokens.length || !sbClient) return
    const n = await countIngevuld(sbClient, tokens)
    setIngevuld(n)
  }, [tokenMap, sbClient])

  useEffect(() => {
    if (!klaar) return
    peilIngevuld()
    const interval = setInterval(peilIngevuld, 8000)
    return () => clearInterval(interval)
  }, [klaar, peilIngevuld])

  const totaal = leerlingen?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col" style={{ overscrollBehavior: 'contain' }}>

      {/* ── Header ── */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="font-bold text-base" style={{ color: '#2C3E50' }}>
            Zelfevaluatie — {klas.naam}
          </p>
          <p className="text-xs text-gray-400">{sportNaam} · Les {les.replace('les_', '')} · {lesData?.titel}</p>
        </div>
        <button
          onClick={onSluiten}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600"
        >✕ Sluiten</button>
      </div>

      {/* ── Teller + waarschuwing ── */}
      <div className="px-4 py-3 flex-shrink-0 space-y-2">
        {/* Teller */}
        <div className="bg-white rounded-2xl shadow px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold" style={{ color: '#27AE60' }}>{ingevuld}</span>
            <span className="text-gray-400 text-sm">/ {totaal} ingevuld</span>
          </div>
          <div className="flex gap-1 flex-wrap justify-end max-w-[60%]">
            {leerlingen?.map(l => (
              <span
                key={l.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                style={
                  tokenMap[l.id] && ingevuld > 0 /* optimistic: not per-student */
                    ? {} : { background: '#f3f4f6' }
                }
              >
                {/* We tonen alleen groene vinkjes als we per-student weten wie klaar is.
                    Voor nu: simpele totaal-teller volstaat. */}
              </span>
            ))}
          </div>
          {!sbClient && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">
              Geen Supabase — teller onbekend
            </span>
          )}
        </div>

        {/* LAN-waarschuwing */}
        {isLocalhost && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-xs text-yellow-700">
            ⚠ Je gebruikt <strong>localhost</strong>. Leerlingen op andere toestellen kunnen de QR niet openen.
            Open de app via je netwerk-IP (bijv. <code>http://192.168.x.x:5173</code>) zodat de QR-link werkt.
          </div>
        )}

        {!klaar && (
          <p className="text-xs text-gray-400 text-center">QR-codes worden aangemaakt…</p>
        )}
      </div>

      {/* ── Scroll-lijst: 1 leerling per scherm ── */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {leerlingen?.map((l, idx) => {
          const token = tokenMap[l.id]
          const url   = token ? `${baseUrl}/zelfeval?token=${token}` : null

          return (
            <div
              key={l.id}
              className="bg-white rounded-3xl shadow-lg p-6 flex flex-col items-center"
              style={{ scrollSnapAlign: 'start', minHeight: '70vh' }}
            >
              {/* Leerling-naam */}
              <p className="text-xs text-gray-400 mb-1">{idx + 1} / {totaal}</p>
              <h2 className="text-2xl font-bold mb-1 text-center" style={{ color: '#2C3E50' }}>
                {l.voornaam}
              </h2>
              <p className="text-sm text-gray-500 mb-6">{l.achternaam}</p>

              {/* QR-code */}
              {url ? (
                <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100">
                  <QRCode value={url} size={220} />
                </div>
              ) : (
                <div className="w-[228px] h-[228px] bg-gray-100 rounded-2xl flex items-center justify-center">
                  <span className="text-gray-400 text-sm">Laden…</span>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-4 text-center">Scan met je telefoon</p>
              {url && (
                <p className="text-xs text-gray-300 mt-1 break-all text-center max-w-xs">{url}</p>
              )}

              {/* Vragen-preview */}
              <div className="mt-5 w-full bg-gray-50 rounded-2xl p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Vragen ({vragen.length})
                </p>
                <ol className="space-y-1">
                  {vragen.map((v, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-2">
                      <span className="font-bold text-gray-400 flex-shrink-0">{i + 1}.</span>
                      <span>{v.tekst}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
