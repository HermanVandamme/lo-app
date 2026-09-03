/**
 * Vangnet tegen een wit scherm.
 *
 * Als er ergens tijdens het tekenen een onverwachte fout optreedt, haalt React
 * standaard de hele app onderuit en blijft er een blanco pagina over — lastig
 * middenin een les. Deze grens vangt die fout op, toont een leesbare melding
 * en laat de rest van de app (navigatie) gewoon werken.
 *
 * Scores lopen hierbij geen gevaar: elke klik wordt meteen naar de lokale
 * database geschreven, er staat dus nooit werk "open".
 */
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { fout: null }
  }

  static getDerivedStateFromError(fout) {
    return { fout }
  }

  componentDidCatch(fout, info) {
    // Blijft in de console staan voor als we achteraf willen weten wat er misging.
    console.error('Onverwachte fout in de app:', fout, info)
  }

  render() {
    if (!this.state.fout) return this.props.children

    return (
      <div className="bg-white rounded-2xl shadow p-5">
        <h1 className="text-lg font-bold mb-1" style={{ color: '#C0392B' }}>
          Er ging iets mis
        </h1>
        <p className="text-sm text-gray-600 mb-1">
          Dit scherm kon niet geladen worden. Je ingevulde scores zijn wel bewaard —
          die worden bij elke klik meteen opgeslagen.
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Probeer het opnieuw, of ga terug naar het overzicht via de knoppen bovenaan.
        </p>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => this.setState({ fout: null })}
            className="px-4 py-2.5 rounded-xl font-semibold text-white text-sm"
            style={{ background: '#E67E22' }}
          >
            Probeer opnieuw
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700"
          >
            App herladen
          </button>
        </div>

        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer">Technische details</summary>
          <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap break-words">
            {String(this.state.fout?.message ?? this.state.fout)}
          </pre>
        </details>
      </div>
    )
  }
}
