import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'

/**
 * Haal alle leerlingen van een klas op (reactief via Dexie live query).
 * @param {string|null} klasId
 */
export function useStudentsByKlas(klasId) {
  return useLiveQuery(
    () => klasId ? db.leerlingen.where('klasId').equals(klasId).sortBy('achternaam') : [],
    [klasId],
    []
  )
}

/**
 * Haal alle klassen op.
 */
export function useKlassen() {
  return useLiveQuery(() => db.klassen.orderBy('naam').toArray(), [], [])
}
