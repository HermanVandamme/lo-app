/**
 * Persistente opslag aanvragen.
 *
 * IndexedDB is standaard "best effort": bij plaatsgebrek mag de browser ze
 * weggooien. Met navigator.storage.persist() vragen we de browser om dat niet
 * te doen. Chrome en Android geven dit meestal bij een geïnstalleerde app;
 * Safari kent de garantie niet — daar helpt de app op het beginscherm zetten.
 * Alles is defensief: een browser die dit niet ondersteunt, mag niets breken.
 */

/** Vraagt persistente opslag aan. Geeft true/false terug, of null als het niet kan. */
export async function vraagPersistenteOpslag() {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

/** Huidige status, voor het statuslijntje in Admin. */
export async function opslagStatus() {
  try {
    if (!navigator.storage?.persisted) return { ondersteund: false }
    const persistent = await navigator.storage.persisted()
    let gebruiktMb = null
    if (navigator.storage.estimate) {
      const { usage } = await navigator.storage.estimate()
      if (typeof usage === 'number') gebruiktMb = Math.round((usage / 1048576) * 10) / 10
    }
    return { ondersteund: true, persistent, gebruiktMb }
  } catch {
    return { ondersteund: false }
  }
}
