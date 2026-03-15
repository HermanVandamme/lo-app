/**
 * Supabase-client voor zelfevaluatie-antwoorden.
 * Config wordt bewaard in localStorage (ingesteld via Admin).
 *
 * Benodigde Supabase SQL (run eenmalig in SQL-editor):
 * ─────────────────────────────────────────────────────
 * create table zelfeval_sessies (
 *   token        text primary key,
 *   sport_id     text not null,
 *   graad        text not null,
 *   les          text not null,
 *   vragen       jsonb not null,
 *   aangemaakt   timestamptz default now()
 * );
 * create table zelfeval_antwoorden (
 *   id           uuid default gen_random_uuid() primary key,
 *   token        text not null,
 *   vraag_nr     int  not null,
 *   antwoord     int  not null check (antwoord between 1 and 4),
 *   ingevuld_op  timestamptz default now(),
 *   unique(token, vraag_nr)
 * );
 * alter table zelfeval_sessies   enable row level security;
 * alter table zelfeval_antwoorden enable row level security;
 * create policy "anon_read"   on zelfeval_sessies    for select using (true);
 * create policy "anon_insert" on zelfeval_sessies    for insert with check (true);
 * create policy "anon_insert" on zelfeval_antwoorden for insert with check (true);
 * create policy "anon_read"   on zelfeval_antwoorden for select using (true);
 */
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL_KEY = 'sb_url'
export const SUPABASE_KEY_KEY = 'sb_anon_key'

export function getSupabaseConfig() {
  return {
    url: localStorage.getItem(SUPABASE_URL_KEY) ?? '',
    key: localStorage.getItem(SUPABASE_KEY_KEY) ?? '',
  }
}

export function saveSupabaseConfig(url, key) {
  localStorage.setItem(SUPABASE_URL_KEY, url.trim())
  localStorage.setItem(SUPABASE_KEY_KEY, key.trim())
}

export function makeSupabaseClient() {
  const { url, key } = getSupabaseConfig()
  if (!url || !key) return null
  try {
    return createClient(url, key)
  } catch {
    return null
  }
}

/** Push een sessie-record naar Supabase (zonder leerlingId — enkel token). */
export async function pushSessie(client, { token, sportId, graad, les, vragen }) {
  if (!client) return { error: 'geen supabase' }
  return client.from('zelfeval_sessies').upsert({
    token,
    sport_id: sportId,
    graad,
    les,
    vragen,
  })
}

/** Haal een sessie op via token. */
export async function fetchSessie(client, token) {
  if (!client) return { data: null, error: 'geen supabase' }
  return client.from('zelfeval_sessies').select('*').eq('token', token).single()
}

/** Bewaar antwoorden van een leerling. */
export async function pushAntwoorden(client, token, antwoorden) {
  if (!client) return { error: 'geen supabase' }
  const rows = antwoorden.map((a, i) => ({
    token,
    vraag_nr: i,
    antwoord: a,
  }))
  return client.from('zelfeval_antwoorden').upsert(rows, { onConflict: 'token,vraag_nr' })
}

/** Tel hoeveel tokens al antwoorden hebben (voor de teller). */
export async function countIngevuld(client, tokens) {
  if (!client || !tokens.length) return 0
  const { data } = await client
    .from('zelfeval_antwoorden')
    .select('token')
    .in('token', tokens)
  if (!data) return 0
  return new Set(data.map(r => r.token)).size
}
