/**
 * PRIVE LEERLINGDATA — lokale IndexedDB opslag via Dexie.js
 * Deze data verlaat het toestel nooit. Nooit in /public plaatsen.
 */
import Dexie from 'dexie'

export const db = new Dexie('LOmasterDB')

db.version(1).stores({
  klassen:    'id, naam',
  leerlingen: 'id, klasId, voornaam, achternaam',
  scores:     '++id, leerlingId, [leerlingId+sportId+graad+les+lpd], sportId, graad, les, datum',
})

db.version(2).stores({
  klassen:           'id, naam',
  leerlingen:        'id, klasId, voornaam, achternaam',
  scores:            '++id, leerlingId, [leerlingId+sportId+graad+les+lpd], sportId, graad, les, datum',
  zelfevalSessies:   'token, leerlingId, klasId, sportId, graad, les, aangemaakt',
})

// v3: extra index op lpd
db.version(3).stores({
  klassen:           'id, naam',
  leerlingen:        'id, klasId, voornaam, achternaam',
  scores:            '++id, leerlingId, [leerlingId+sportId+graad+les+lpd], sportId, graad, les, lpd, datum',
  zelfevalSessies:   'token, leerlingId, klasId, sportId, graad, les, aangemaakt',
})

// v4: kledij in eigen tabel — los van les/sport
db.version(4).stores({
  klassen:           'id, naam',
  leerlingen:        'id, klasId, voornaam, achternaam',
  scores:            '++id, leerlingId, [leerlingId+sportId+graad+les+lpd], sportId, graad, les, lpd, datum',
  zelfevalSessies:   'token, leerlingId, klasId, sportId, graad, les, aangemaakt',
  kledij:            'leerlingId',   // { leerlingId, count, datum }
})

export default db
