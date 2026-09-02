import { useState } from 'react'
import jaarplanData from '../data/jaarplan.json'
import lpdData from '../data/lpd.json'

const KLEUR = { donker: '#2C3E50', evaluatie: '#27AE60' }

const LOCATIE_KLEUR = {
  SPORTHAL:    '#2980B9',
  TURNZAAL:    '#8E44AD',
  ALTERNATIEF: '#16A085',
}

function lpdNummer(code) {
  const match = String(code).match(/\d+/)
  return match ? match[0] : null
}

function JaarTabel({ jaar, rijen, onLpdClick }) {
  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden mb-5">
      <h2 className="font-bold text-base px-4 pt-4 pb-2" style={{ color: KLEUR.donker }}>
        Jaar {jaar}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <th className="text-left font-semibold px-4 py-2">Thema</th>
              <th className="text-left font-semibold px-4 py-2">Locatie</th>
              <th className="text-left font-semibold px-4 py-2">LPD</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((rij, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2 text-gray-700">{rij.thema}</td>
                <td className="px-4 py-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ background: LOCATIE_KLEUR[rij.locatie] ?? '#7F8C8D' }}
                  >
                    {rij.locatie}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {rij.lpd.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {rij.lpd.map(code => {
                        const nr = lpdNummer(code)
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => onLpdClick(nr)}
                            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white transition-transform hover:scale-105 active:scale-95"
                            style={{ background: KLEUR.evaluatie }}
                          >
                            {code}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Jaarplan() {
  const jaren = ['4', '5', '6']
  const [gemarkeerd, setGemarkeerd] = useState(null)

  const springNaarLpd = nr => {
    if (!nr) return
    const el = document.getElementById(`lpd-${nr}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setGemarkeerd(nr)
    window.setTimeout(() => {
      setGemarkeerd(huidig => (huidig === nr ? null : huidig))
    }, 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 px-1" style={{ color: KLEUR.donker }}>Jaarplan</h1>

      {jaren.map(jaar => (
        <JaarTabel key={jaar} jaar={jaar} rijen={jaarplanData[jaar] ?? []} onLpdClick={springNaarLpd} />
      ))}

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <h2 className="font-bold text-base px-4 pt-4 pb-2" style={{ color: KLEUR.donker }}>
          LPD's — volledige omschrijving
        </h2>
        <div className="px-4 pb-4 space-y-2">
          {Object.entries(lpdData).map(([nr, omschrijving]) => (
            <div
              key={nr}
              id={`lpd-${nr}`}
              className="rounded-xl px-3 py-2 border-l-4 text-gray-700 scroll-mt-20 transition-colors duration-500"
              style={{
                background: gemarkeerd === nr ? '#D5F5E3' : '#F4F6F7',
                borderColor: gemarkeerd === nr ? KLEUR.evaluatie : '#7F8C8D',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#566573' }}>
                LPD {nr}
              </p>
              <p className="text-sm leading-snug">{omschrijving}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
