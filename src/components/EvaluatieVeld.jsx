/**
 * Rendert de klik-UI voor één evaluatie-item, op basis van het "type"-veld
 * uit evaluatie.json. Dispatcher + één sub-component per type.
 *
 * `waarden`  — sub-sleutel → waarde, al gescoped op dit item.
 * `onSet(subKey, waarde)` — schrijft één sub-sleutel weg (waarde=null wist ze).
 */
import PlusMinKnop from './PlusMinKnop'

// ── KeuzeRij — herbruikbare rij klikbare knoppen i.p.v. een dropdown ──────────
function KeuzeRij({ opties, huidig, onKies, renderLabel, compact = false }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opties.map(o => {
        const actief = huidig === o
        return (
          <button key={o} type="button" onClick={() => onKies(actief ? null : o)}
            className={compact
              ? 'px-2.5 py-2 rounded-lg text-xs font-bold flex-shrink-0'
              : 'min-w-[2.75rem] h-11 px-2 rounded-lg text-sm font-bold flex-shrink-0'}
            style={actief ? { background: '#E67E22', color: 'white' } : { background: 'white', border: '1px solid #e5e7eb', color: '#2C3E50' }}>
            {renderLabel ? renderLabel(o) : o}
          </button>
        )
      })}
    </div>
  )
}

/** Haalt de vermenigvuldigingsfactor uit een formule-string zoals "score = invoer x 0.5". */
function parseFormuleFactor(formule) {
  if (!formule) return 1
  const match = formule.match(/x\s*([\d.,]+)/i)
  if (!match) return 1
  return parseFloat(match[1].replace(',', '.'))
}

export default function EvaluatieVeld({ item, waarden, onSet }) {
  switch (item.type) {
    case 'rubric_klikcriteria':
      return <RubricKlikcriteria item={item} waarden={waarden} onSet={onSet} />
    case 'checklist_punten':
      return <ChecklistPunten item={item} waarden={waarden} onSet={onSet} />
    case 'dropdown_score':
      return <DropdownScore item={item} waarden={waarden} onSet={onSet} />
    case 'dropdown_meerdere':
      return <DropdownMeerdere item={item} waarden={waarden} onSet={onSet} />
    case 'direct_score_test':
      return <DirectScoreTest item={item} waarden={waarden} onSet={onSet} />
    case 'dropdown_tijd_lookup':
      return <DropdownTijdLookup item={item} waarden={waarden} onSet={onSet} />
    case 'plus_min_tracker':
      return <PlusMinTracker item={item} waarden={waarden} onSet={onSet} />
    case 'samengesteld':
      return <Samengesteld item={item} waarden={waarden} onSet={onSet} />
    case 'video_upload_score':
      return <VideoUploadScore item={item} waarden={waarden} onSet={onSet} />
    case 'vrije_score':
      return <VrijeScore item={item} waarden={waarden} onSet={onSet} optioneel={false} />
    case 'vrije_score_optioneel':
      return <VrijeScore item={item} waarden={waarden} onSet={onSet} optioneel />
    default:
      return <p className="text-xs text-red-500">Onbekend evaluatietype: {item.type}</p>
  }
}

// ── rubric_klikcriteria ──────────────────────────────────────────────────────
function RubricKlikcriteria({ item, waarden, onSet }) {
  return (
    <div className="space-y-2">
      {(item.criteria ?? []).map((c, idx) => {
        const key = `c${idx}`
        const huidig = waarden[key] ?? null
        return (
          <div key={idx}>
            <p className="text-xs text-gray-500 font-medium mb-1 italic">{c.naam}</p>
            <div className="space-y-1">
              {c.niveaus.map((n, ni) => {
                const actief = huidig === n.punten
                return (
                  <button key={ni} onClick={() => onSet(key, actief ? null : n.punten)}
                    className="w-full text-left rounded-xl border-2 px-3 py-2 transition-colors active:scale-[0.99]"
                    style={actief ? { borderColor: '#E67E22', background: '#FFF8F0' } : { borderColor: '#e5e7eb', background: 'white' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: actief ? '#E67E22' : '#2C3E50' }}>
                        {n.label}{actief && <span className="ml-1.5 normal-case font-normal">✓</span>}
                      </p>
                      <span className="text-xs font-semibold text-gray-400">{n.punten}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{n.omschrijving}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── checklist_punten ──────────────────────────────────────────────────────────
function ChecklistPunten({ item, waarden, onSet }) {
  const varianten = item.scenario_varianten
  const variantIdx = waarden.variant ?? null
  const items = varianten ? (variantIdx != null ? varianten[variantIdx].items : null) : item.items
  const opties = item.opties_per_item ?? [0, 1]

  return (
    <div className="space-y-1.5">
      {varianten && (
        <div className="flex gap-2 flex-wrap mb-1">
          {varianten.map((v, vi) => (
            <button key={vi} onClick={() => onSet('variant', vi)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={variantIdx === vi ? { background: '#E67E22', color: 'white' } : { background: '#F0F3F4', color: '#2C3E50' }}>
              {v.naam}
            </button>
          ))}
        </div>
      )}
      {!items ? (
        <p className="text-xs text-gray-400 italic">Kies eerst een scenario.</p>
      ) : items.map((it, idx) => {
        const key = `i${idx}`
        const huidig = waarden[key] ?? null
        return (
          <div key={idx} className="flex items-center justify-between gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2">
            <span className="text-xs text-gray-700 flex-1">{it.naam}</span>
            <div className="flex gap-1 flex-shrink-0">
              {opties.map(o => (
                <button key={o} onClick={() => onSet(key, huidig === o ? null : o)}
                  className="w-8 h-8 rounded-lg text-xs font-bold"
                  style={huidig === o ? { background: '#E67E22', color: 'white' } : { background: 'white', border: '1px solid #e5e7eb', color: '#2C3E50' }}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── dropdown_score ────────────────────────────────────────────────────────────
function DropdownScore({ item, waarden, onSet }) {
  const val = waarden.score ?? null
  const opties = item.opties ?? Array.from({ length: (item.max_score ?? 0) + 1 }, (_, i) => i)
  return <KeuzeRij opties={opties} huidig={val} onKies={v => onSet('score', v)} />
}

// ── dropdown_meerdere ─────────────────────────────────────────────────────────
function DropdownMeerdere({ item, waarden, onSet }) {
  return (
    <div className="space-y-2">
      {(item.items ?? []).map((it, idx) => {
        const key = `i${idx}`
        const val = waarden[key] ?? null
        const opties = it.opties ?? Array.from({ length: (it.max_score ?? 0) + 1 }, (_, i) => i)
        return (
          <div key={idx}>
            <p className="text-xs text-gray-700 mb-1">{it.naam}</p>
            <KeuzeRij opties={opties} huidig={val} onKies={v => onSet(key, v)} />
          </div>
        )
      })}
    </div>
  )
}

// ── direct_score_test ─────────────────────────────────────────────────────────
function DirectScoreTest({ item, waarden, onSet }) {
  const uitleg = (item.instructie || item.formule) && (
    <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-2 text-xs text-blue-700">
      {item.instructie && <p>{item.instructie}</p>}
      {item.formule && <p className="mt-0.5 font-mono">{item.formule}</p>}
    </div>
  )

  // Sommige testen geven een RUW aantal in (bv. balcontacten), waarna de
  // score via de formule berekend wordt — i.p.v. dat de leerkracht de score
  // rechtstreeks intikt.
  const heeftInvoer = item.invoer_min !== undefined && item.invoer_max !== undefined
  if (heeftInvoer) {
    const factor = parseFormuleFactor(item.formule)
    const invoer = waarden.invoer ?? 0
    function wijzigInvoer(v) {
      onSet('invoer', v)
      onSet('score', Math.round(v * factor * 10) / 10)
    }
    return (
      <div>
        {uitleg}
        {item.invoer_label && <p className="text-xs text-gray-500 mb-1">{item.invoer_label}</p>}
        <PlusMinKnop value={invoer} min={item.invoer_min} max={item.invoer_max} step={1} onChange={wijzigInvoer} />
        <p className="text-xs text-gray-500 mt-1.5">
          Score: <span className="font-bold" style={{ color: '#E67E22' }}>{waarden.score ?? 0}</span> / {item.max_score}
        </p>
      </div>
    )
  }

  const val = waarden.score ?? 0
  return (
    <div>
      {uitleg}
      <PlusMinKnop value={val} min={0} max={item.max_score} step={0.5} onChange={v => onSet('score', v)} />
    </div>
  )
}

// ── dropdown_tijd_lookup ──────────────────────────────────────────────────────
function parseTijdKey(str) {
  return str.replace(' min', '').replace(',', '.')
}

function DropdownTijdLookup({ item, waarden, onSet }) {
  const geslacht = waarden.geslacht ?? 'jongens'
  const tijden = geslacht === 'jongens' ? item.dropdown_jongens : item.dropdown_meisjes
  const tabel  = geslacht === 'jongens' ? item.tabel_jongens : item.tabel_meisjes
  const gekozenTijd = waarden.tijd ?? null

  function kiesTijd(tijd) {
    onSet('tijd', tijd)
    onSet('score', tijd ? (tabel[parseTijdKey(tijd)] ?? null) : null)
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        {['jongens', 'meisjes'].map(g => (
          <button key={g} onClick={() => onSet('geslacht', g)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize"
            style={geslacht === g ? { background: '#E67E22', color: 'white' } : { background: '#F0F3F4', color: '#2C3E50' }}>
            {g}
          </button>
        ))}
      </div>
      <KeuzeRij compact opties={tijden} huidig={gekozenTijd} onKies={kiesTijd} />
    </div>
  )
}

// ── plus_min_tracker ──────────────────────────────────────────────────────────
function PlusMinTracker({ item, waarden, onSet }) {
  const val = waarden.score ?? item.start_score ?? 0
  return <PlusMinKnop value={val} min={item.min_score ?? 0} max={item.max_score} step={1} onChange={v => onSet('score', v)} />
}

// ── samengesteld (recursief) ──────────────────────────────────────────────────
function Samengesteld({ item, waarden, onSet }) {
  return (
    <div className="space-y-3">
      {(item.onderdelen ?? []).map((sub, idx) => {
        const prefix = `o${idx}_`
        const subWaarden = {}
        for (const k in waarden) {
          if (k.startsWith(prefix)) subWaarden[k.slice(prefix.length)] = waarden[k]
        }
        return (
          <div key={idx} className="border-l-2 pl-3" style={{ borderColor: '#E67E22' }}>
            <p className="text-xs font-bold text-gray-600 mb-1.5">
              {sub.naam} <span className="text-gray-400 font-normal">(/{sub.max_score})</span>
            </p>
            <EvaluatieVeld item={sub} waarden={subWaarden} onSet={(k, v) => onSet(prefix + k, v)} />
          </div>
        )
      })}
    </div>
  )
}

// ── video_upload_score ────────────────────────────────────────────────────────
function VideoUploadScore({ item, waarden, onSet }) {
  return (
    <div>
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-2 text-xs text-orange-700">
        📤 {item.instructie || 'Filmpje indienen via Smartschool. Geen klikcriteria — leerkracht beoordeelt na bekijken.'}
      </div>
      {item.onderdelen ? (
        <div className="space-y-2">
          {item.onderdelen.map((sub, idx) => {
            const key = `o${idx}`
            const val = waarden[key] ?? 0
            return (
              <div key={idx}>
                <p className="text-xs text-gray-500 mb-1">{sub.naam}</p>
                <PlusMinKnop value={val} min={0} max={sub.max_score} step={0.5} onChange={v => onSet(key, v)} />
              </div>
            )
          })}
        </div>
      ) : (
        <PlusMinKnop value={waarden.score ?? 0} min={0} max={item.max_score} step={0.5} onChange={v => onSet('score', v)} />
      )}
    </div>
  )
}

// ── vrije_score / vrije_score_optioneel ───────────────────────────────────────
function VrijeScore({ item, waarden, onSet, optioneel }) {
  const val = waarden.score
  return (
    <div>
      {optioneel && <p className="text-xs text-gray-400 mb-1 italic">Optioneel — telt niet mee bij het rapport indien leeg.</p>}
      <div className="flex items-center gap-2">
        <input
          type="number" min={0} max={item.max_score} step="0.5"
          value={val ?? ''} placeholder={optioneel ? 'leeg = niet meegeteld' : '0'}
          onChange={e => onSet('score', e.target.value === '' ? null : Number(e.target.value))}
          className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center font-bold"
        />
        <span className="text-xs text-gray-400">/ {item.max_score}</span>
      </div>
    </div>
  )
}
