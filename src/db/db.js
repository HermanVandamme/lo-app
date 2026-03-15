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
  // Zelfevaluatie-sessies: token → leerlingId koppeling (PRIVE, verlaat dit toestel nooit)
  zelfevalSessies:   'token, leerlingId, klasId, sportId, graad, les, aangemaakt',
})

export default db
