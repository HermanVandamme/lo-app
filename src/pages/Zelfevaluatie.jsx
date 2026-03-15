/**
 * Zelfevaluatie — Leerlingkant (publieke pagina)
 * Route: /zelfeval?token=<token>
 *
 * Geen NavBar. Geen naam zichtbaar. Enkel token in URL.
 * Antwoorden → Supabase. Sessie-data opgehaald via token.
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { makeSupabaseClient, fetchSessie, pushAntwoorden } from '../lib/supabase'

const SMILEYS = [
  { value: 1, emoji: '😞', label: 'Niet goed' },
  { value: 2, emoji: '😐', label: 'Matig'     },
  { value: 3, emoji: '🙂', label: 'Goed'      },
  { value: 4, emoji: '😄', label: 'Super!'    },
]

// ── Smiley-kiezer per vraag ────────────────────────────────────────────────
function SmileyKiezer({ waarde, onChange }) {
  return (
    <div className="flex justify-around gap-2 mt-3">
      {SMILEYS.map(s => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className="flex flex-col items-center gap-1 flex-1 py-3 rounded-2xl transition-all active:scale-95"
          style={waarde === s.value
            ? { background: '#E67E22', color: 'white' }
            : { background: '#f3f4f6', color: '#6b7280' }
          }
        >
          <span className="text-3xl">{s.emoji}</span>
          <span className="text-xs font-semibold">{s.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Hoofd-component ────────────────────────────────────────────────────────
export default function Zelfevaluatie() {
  const [params]     = useSearchParams()
  const token        = params.get('token')

  const [fase, setFase]       = useState('laden')   // laden | invullen | verzenden | bedankt | fout
  const [sessie, setSessie]   = useState(null)
  const [antwoorden, setAntwoorden] = useState([])
  const [foutMsg, setFoutMsg] = useState('')
  const sbClient = makeSupabaseClient()

  // ── Haal sessie op ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setFoutMsg('Ongeldige link — geen token gevonden.')
      setFase('fout')
      return
    }

    async function laadSessie() {
      if (!sbClient) {
        setFoutMsg('Deze app is nog niet verbonden met een server. Vraag je leerkracht om Supabase in te stellen in de Admin-pagina.')
        setFase('fout')
        return
      }

      const { data, error } = await fetchSessie(sbClient, token)
      if (error || !data) {
        setFoutMsg('Link niet gevonden of verlopen. Vraag een nieuwe QR aan je leerkracht.')
        setFase('fout')
        return
      }

      setSessie(data)
      setAntwoorden(new Array(data.vragen.length).fill(null))
      setFase('invullen')
    }

    laadSessie()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Verstuur ──────────────────────────────────────────────────────────────
  async function verstuur() {
    if (antwoorden.some(a => a === null)) return
    setFase('verzenden')

    const { error } = await pushAntwoorden(sbClient, token, antwoorden)
    if (error && error !== 'geen supabase') {
      setFoutMsg('Er ging iets mis bij het versturen. Probeer opnieuw.')
      setFase('invullen')
      return
    }
    setFase('bedankt')
  }

  const alleIngevuld = antwoorden.length > 0 && antwoorden.every(a => a !== null)

  // ── UI ────────────────────────────────────────────────────────────────────
  if (fase === 'laden') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">⏳</div>
          <p className="text-gray-500">Laden…</p>
        </div>
      </div>
    )
  }

  if (fase === 'fout') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white rounded-3xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-lg font-bold mb-2" style={{ color: '#2C3E50' }}>Oeps!</h1>
          <p className="text-gray-500 text-sm">{foutMsg}</p>
        </div>
      </div>
    )
  }

  if (fase === 'bedankt') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white rounded-3xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#2C3E50' }}>Bedankt!</h1>
          <p className="text-gray-500">Je antwoorden zijn verstuurd. Goed gedaan!</p>
        </div>
      </div>
    )
  }

  const vragen = sessie?.vragen ?? []
  const sportLabel = sessie ? `${sessie.sport_id} — Les ${sessie.les?.replace('les_', '')}` : ''

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 max-w-lg mx-auto">

      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-1">
          Zelfevaluatie
        </p>
        <h1 className="text-xl font-bold" style={{ color: '#2C3E50' }}>
          {sportLabel}
        </h1>
      </div>

      {/* Vragen */}
      <div className="space-y-4 mb-8">
        {vragen.map((v, i) => (
          <div key={i} className="bg-white rounded-2xl shadow p-4">
            <p className="font-semibold text-sm leading-snug mb-1" style={{ color: '#2C3E50' }}>
              <span className="text-gray-400 font-normal mr-1">{i + 1}.</span>
              {v.tekst}
            </p>
            <SmileyKiezer
              waarde={antwoorden[i]}
              onChange={val => setAntwoorden(prev => {
                const next = [...prev]
                next[i] = val
                return next
              })}
            />
          </div>
        ))}
      </div>

      {/* Verstuur-knop */}
      <button
        onClick={verstuur}
        disabled={!alleIngevuld || fase === 'verzenden'}
        className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95 disabled:opacity-40"
        style={{ background: alleIngevuld ? '#E67E22' : '#d1d5db' }}
      >
        {fase === 'verzenden' ? 'Versturen…' : 'Versturen ✓'}
      </button>

      {!alleIngevuld && (
        <p className="text-center text-xs text-gray-400 mt-3">
          Beantwoord alle vragen om te versturen.
        </p>
      )}
    </div>
  )
}
