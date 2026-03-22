import { Link } from 'react-router-dom'
import sportsData from '../data/sports.json'

import imgBasketbal  from '../assets/images/basketbal.jpg'
import imgVolleybal  from '../assets/images/volleybal.jpg'
import imgBadminton  from '../assets/images/badminton.jpg'
import imgHandbal    from '../assets/images/handbal.jpg'
import imgVoetbal    from '../assets/images/voetbal.jpg'
import imgJudo       from '../assets/images/judo.jpg'
import imgKlimmen    from '../assets/images/klimmen.jpg'
import imgEhbo       from '../assets/images/ehbo.jpg'

const SPORT_AFBEELDING = {
  basketbal: imgBasketbal,
  volleybal: imgVolleybal,
  badminton: imgBadminton,
  handbal:   imgHandbal,
  voetbal:   imgVoetbal,
  judo:      imgJudo,
  klimmen:   imgKlimmen,
  ehbo:      imgEhbo,
}

const SPORT_KLEUR = {
  basketbal: '#E67E22',
  volleybal:  '#2980B9',
  badminton:  '#27AE60',
  handbal:    '#C0392B',
  voetbal:    '#16A085',
  judo:       '#8E44AD',
  klimmen:    '#D35400',
  ehbo:       '#E74C3C',
}

export default function Home() {
  const sports = sportsData.sports ?? []

  return (
    <div>
      <h1 className="text-xl font-bold mb-4" style={{ color: '#2C3E50' }}>Kies een sport</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {sports.map(sport => (
          <SportTile key={sport.id} sport={sport} />
        ))}
      </div>
    </div>
  )
}

function SportTile({ sport }) {
  const imgSrc      = SPORT_AFBEELDING[sport.id]
  const fallbackKleur = SPORT_KLEUR[sport.id] ?? '#7F8C8D'

  return (
    <Link
      to={`/sport/${sport.id}`}
      className="block rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform"
    >
      <div
        className="relative h-32"
        style={{ background: imgSrc ? '#d1d5db' : fallbackKleur }}
      >
        {imgSrc && (
          <img
            src={imgSrc}
            alt={sport.name}
            className="w-full h-full object-cover"
          />
        )}

        <div
          className="absolute inset-0"
          style={{
            background: imgSrc
              ? 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 60%)'
              : 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 60%)',
          }}
        />

        <span className="absolute bottom-2 left-3 right-3 text-white font-bold text-base leading-tight drop-shadow">
          {sport.name}
        </span>
      </div>
    </Link>
  )
}
