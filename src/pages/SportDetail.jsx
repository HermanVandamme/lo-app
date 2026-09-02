import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import sportsData from '../data/sports.json'
import { oefeningenVoor, extraKnoppenVoor } from '../utils/oefeningen'
import { afbeeldingenVoor } from '../utils/afbeeldingen'
import { evaluatieLabel } from '../utils/evaluatieLabel'
import EvaluatieScherm from '../components/EvaluatieScherm'
import FormattedText from '../components/FormattedText'

const JAAR_LABEL = { 4: '4e jaar', 5: '5e jaar', 6: '6e jaar' }

const KLEUR = {
  donker:     '#2C3E50',
  oefening:   '#E67E22',
  evaluatie:  '#27AE60',
  afbeelding: '#2980B9',
}

/** Klikbare balk met uitklapbare inhoud. */
function Balk({ kleur, titel, icoon, open, onToggle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0"
            style={{ background: kleur }}
          >
            {icoon}
          </span>
          <span className="font-semibold text-base truncate" style={{ color: KLEUR.donker }}>
            {titel}
          </span>
        </div>
        <span
          className="text-xl font-light flex-shrink-0"
          style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', color: kleur }}
        >
          ›
        </span>
      </button>
      {open && (
        <div className="px-4 pb-5 border-t border-gray-100 pt-3">{children}</div>
      )}
    </div>
  )
}

/** Inhoud van een oefening. */
function OefeningInhoud({ oefening }) {
  if (!oefening || typeof oefening !== 'object') {
    return <p className="text-sm text-gray-400 italic">Geen inhoud beschikbaar.</p>
  }
  const { opstelling, beschrijving, cues, makkelijker, moeilijker } = oefening

  return (
    <div className="space-y-3 text-sm">
      {opstelling && (
        <div className="rounded-xl px-3 py-2 border-l-4 text-gray-700" style={{ background: '#FEF9E7', borderColor: '#F39C12' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#D68910' }}>Opstelling</p>
          <FormattedText text={opstelling} accent="#D68910" />
        </div>
      )}
      {beschrijving && (
        <div className="rounded-xl px-3 py-2 border-l-4 text-gray-700" style={{ background: '#F4F6F7', borderColor: '#7F8C8D' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#566573' }}>Beschrijving</p>
          <FormattedText text={beschrijving} accent="#566573" />
        </div>
      )}
      {cues && (
        <div className="rounded-xl px-3 py-2 border-l-4 text-gray-700" style={{ background: '#EBF5FB', borderColor: '#3498DB' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#2980B9' }}>Cues</p>
          <FormattedText text={cues} accent="#2980B9" />
        </div>
      )}
      {(makkelijker || moeilijker) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl px-3 py-2 border-l-4" style={{ background: '#EAFAF1', borderColor: '#27AE60' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#1E8449' }}>Makkelijker</p>
            <p className="text-gray-700 whitespace-pre-line leading-snug text-xs">{makkelijker || '—'}</p>
          </div>
          <div className="rounded-xl px-3 py-2 border-l-4" style={{ background: '#FDEDEC', borderColor: '#E74C3C' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#C0392B' }}>Moeilijker</p>
            <p className="text-gray-700 whitespace-pre-line leading-snug text-xs">{moeilijker || '—'}</p>
          </div>
        </div>
      )}

    </div>
  )
}

export default function SportDetail() {
  const { sportId } = useParams()
  const sport = sportsData[sportId]
  const [open, setOpen] = useState(null)

  if (!sport) return <p className="text-red-500 p-4">Sport niet gevonden.</p>

  const jaren = (sport.jaren ?? []).map(nr => ({
    nr,
    key: `jaar_${nr}`,
    label: JAAR_LABEL[nr] ?? `jaar ${nr}`,
  }))
  const afbeeldingen = afbeeldingenVoor(sportId)
  const toggle = id => setOpen(vorige => (vorige === id ? null : id))

  return (
    <div>
      {/* Header */}
      <div className="relative h-36 rounded-2xl overflow-hidden mb-4 shadow" style={{ background: KLEUR.donker }}>
        <img
          src={`${import.meta.env.BASE_URL}images/${sportId}.jpg`}
          alt={sport.naam}
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <Link to="/" className="text-white/70 text-xs hover:text-white">← Terug</Link>
          <h1 className="text-2xl font-bold text-white">{sport.naam}</h1>
        </div>
      </div>


      {/* Per jaar: evaluatie bovenaan, daarna de oefeningen */}
      {jaren.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-1">Geen jaren ingesteld voor dit thema.</p>
      ) : (
        <div className="space-y-5">
          {jaren.map(({ nr, key, label }) => {
            const oefeningen = oefeningenVoor(sportId, key)
            const extras = extraKnoppenVoor(sportId, key)

            return (
              <div key={key}>
                <h2 className="font-bold text-base mb-2 px-1" style={{ color: KLEUR.donker }}>{label}</h2>

                <div className="space-y-2">
                  {/* Evaluatie staat altijd bovenaan */}
                  <Balk
                    kleur={KLEUR.evaluatie}
                    icoon="📋"
                    titel={evaluatieLabel(sportId, nr)}
                    open={open === `${key}:evaluatie`}
                    onToggle={() => toggle(`${key}:evaluatie`)}
                  >
                    <EvaluatieScherm sportId={sportId} graadFilter={key} />
                  </Balk>

                  {/* Oefeningen */}
                  {oefeningen.map((oefening, i) => (
                    <Balk
                      key={`${key}-oef-${i}`}
                      kleur={KLEUR.oefening}
                      icoon={i + 1}
                      titel={oefening.titel}
                      open={open === `${key}:oef${i}`}
                      onToggle={() => toggle(`${key}:oef${i}`)}
                    >
                      <OefeningInhoud oefening={oefening} />
                    </Balk>
                  ))}

                  {/* Extra knoppen, bv. spelregels voor de leerling-scheidsrechter */}
                  {extras.map((extra, i) => (
                    <Balk
                      key={`${key}-extra-${i}`}
                      kleur={extra.kleur ?? '#8E44AD'}
                      icoon="📖"
                      titel={extra.titel}
                      open={open === `${key}:extra${i}`}
                      onToggle={() => toggle(`${key}:extra${i}`)}
                    >
                      <div className="text-sm text-gray-700">
                        <FormattedText text={extra.tekst} accent={extra.kleur ?? '#8E44AD'} />
                      </div>
                    </Balk>
                  ))}

                  {oefeningen.length === 0 && extras.length === 0 && (
                    <p className="text-xs text-gray-400 italic px-1">Geen oefeningen voor dit thema.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Afbeeldingen — onderaan, enkel als er foto's in src/assets/afbeeldingen/<sportId>/ staan */}
      {afbeeldingen.length > 0 && (
        <div className="mt-5">
          <Balk
            kleur={KLEUR.afbeelding}
            icoon="🖼"
            titel={`Afbeeldingen (${afbeeldingen.length})`}
            open={open === 'afbeeldingen'}
            onToggle={() => toggle('afbeeldingen')}
          >
            <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1 space-y-4">
              {afbeeldingen.map(afb => (
                <figure key={afb.bestand}>
                  <img
                    src={afb.url}
                    alt={afb.bijschrift}
                    loading="lazy"
                    className="w-full rounded-xl border border-gray-100"
                  />
                  {afb.bijschrift && (
                    <figcaption className="text-xs text-gray-500 mt-1 px-0.5">{afb.bijschrift}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </Balk>
        </div>
      )}
    </div>
  )
}
