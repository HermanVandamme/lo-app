/**
 * Lichte "markdown-lite" weergave voor lestekst: bullets, nummering en
 * subkopjes, zodat een oefening niet als één blok tekst aan elkaar plakt.
 *
 * Ondersteund in de tekst (elk op een eigen regel):
 *   - item            -> opsomming
 *   1. item           -> genummerde stap
 *   ### Kopje         -> subkopje (kleine, vette, gekleurde titel)
 *   (lege regel)      -> nieuwe alinea
 *   gewone tekst      -> alinea
 */
export default function FormattedText({ text, accent = '#566573' }) {
  if (!text) return null

  const lines = text.split('\n')
  const blocks = []
  let lijst = null // { type: 'ul' | 'ol', items: [] }
  let alinea = []

  function sluitAlinea() {
    if (alinea.length) {
      blocks.push({ type: 'p', text: alinea.join(' ') })
      alinea = []
    }
  }
  function sluitLijst() {
    if (lijst) {
      blocks.push(lijst)
      lijst = null
    }
  }

  for (const ruw of lines) {
    const regel = ruw.trim()

    if (regel === '') {
      sluitLijst()
      sluitAlinea()
      continue
    }

    const kopMatch = regel.match(/^###\s+(.*)$/)
    if (kopMatch) {
      sluitLijst()
      sluitAlinea()
      blocks.push({ type: 'kop', text: kopMatch[1] })
      continue
    }

    const bulletMatch = regel.match(/^[-•]\s+(.*)$/)
    if (bulletMatch) {
      sluitAlinea()
      if (!lijst || lijst.type !== 'ul') { sluitLijst(); lijst = { type: 'ul', items: [] } }
      lijst.items.push(bulletMatch[1])
      continue
    }

    const nummerMatch = regel.match(/^\d+[.)]\s+(.*)$/)
    if (nummerMatch) {
      sluitAlinea()
      if (!lijst || lijst.type !== 'ol') { sluitLijst(); lijst = { type: 'ol', items: [] } }
      lijst.items.push(nummerMatch[1])
      continue
    }

    sluitLijst()
    alinea.push(regel)
  }
  sluitLijst()
  sluitAlinea()

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.type === 'kop') {
          return (
            <p key={i} className="text-xs font-bold uppercase tracking-wide mt-2 first:mt-0" style={{ color: accent }}>
              {block.text}
            </p>
          )
        }
        if (block.type === 'p') {
          return <p key={i} className="leading-relaxed">{block.text}</p>
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="space-y-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 leading-relaxed">
                  <span className="flex-shrink-0" style={{ color: accent }}>•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 leading-relaxed">
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5"
                    style={{ background: accent }}
                  >
                    {j + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          )
        }
        return null
      })}
    </div>
  )
}
