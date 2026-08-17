import pg from 'pg'
const { Pool, types } = pg

// node-postgres returns NUMERIC (OID 1700) as a string by default, to avoid
// silent precision loss on large values. Our NUMERIC columns are all small
// decimals (handicaps, ratings, probabilities) where that precision doesn't
// matter, but callers throughout the app assume real numbers (e.g. hcp.toFixed()) —
// parse them as floats here instead of patching every call site.
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)))

export const db = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if no connection available
  query_timeout: 30000, // Query timeout 30 seconds
})

// Run migrations sequentially to avoid overwhelming the connection pool
async function runMigrations() {
  const migrations = [
    { name: 'pg_trgm', query: `CREATE EXTENSION IF NOT EXISTS pg_trgm` },
    { name: 'current_hole', query: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS current_hole INTEGER` },
    { name: 'photo_url', query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT` },
    { name: 'made_by', query: `ALTER TABLE hole_scores ADD COLUMN IF NOT EXISTS made_by TEXT` },
    { name: 'teams', query: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS teams JSONB` },
    { name: 'hole_scores_index', query: `CREATE UNIQUE INDEX IF NOT EXISTS hole_scores_unique_idx ON hole_scores (round_id, player_id, hole)` },
    { name: 'format', query: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS format TEXT` },
    { name: 'holes_mode', query: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS holes_mode TEXT` },
    { name: 'pending_scorecards', query: `CREATE TABLE IF NOT EXISTS pending_scorecards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scores JSONB NOT NULL,
      course_name TEXT,
      holes_count INTEGER DEFAULT 18,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
      status TEXT DEFAULT 'pending'
    )` },
    { name: 'hcp_group', query: `ALTER TABLE tournament_predictions ADD COLUMN IF NOT EXISTS hcp_group TEXT` },
    { name: 'player_hcp', query: `ALTER TABLE tournament_predictions ADD COLUMN IF NOT EXISTS player_hcp NUMERIC` },
    { name: 'tournament_results', query: `CREATE TABLE IF NOT EXISTS tournament_results (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      player_name TEXT NOT NULL,
      place INTEGER NOT NULL,
      score INTEGER NOT NULL,
      group_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(tournament_id, player_name, group_name)
    )` },
    { name: 'hdid_members', query: `CREATE TABLE IF NOT EXISTS hdid_members (
      id SERIAL PRIMARY KEY,
      last_name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      hcp NUMERIC NOT NULL,
      gender TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(last_name, first_name)
    )` },
    { name: 'last_hdid_sync', query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_hdid_sync TIMESTAMP WITH TIME ZONE` },
    { name: 'tournament_registrations', query: `CREATE TABLE IF NOT EXISTS tournament_registrations (
      id SERIAL PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending_review',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(tournament_id, user_id)
    )` },
    { name: 'tournament_slug', query: `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS slug TEXT` },
    { name: 'populate_tournament_slugs', query: `
      UPDATE tournaments SET slug = CASE
        WHEN name = 'III Весенний Кубок им. Н. Ермашова by БСБК' THEN 'spring-cup-ermashov'
        WHEN name = 'Hole in One Challenge (Академическое поле)' THEN 'hole-in-one-challenge'
        WHEN name = 'Whitebird Spring Open Cup' THEN 'whitebird-spring-open'
        WHEN name = 'Международные соревнования / Minsk Golf Invitational 2026' THEN 'minsk-golf-invitational'
        WHEN name = 'Международный детский гольф-турнир «Луч»' THEN 'luch-kids'
        WHEN name = 'XVIII Rookie Cup 2026' THEN 'rookie-cup-18'
        WHEN name = 'Hardy Cup' THEN 'hardy-cup'
        WHEN name = 'Pets Day' THEN 'pets-day'
        WHEN name = 'PRIME LINE CUP' THEN 'prime-line-cup'
        WHEN name = 'BELAVIA Golf Open 2026' THEN 'belavia-open'
        WHEN name = 'XIX Rookie Cup 2026' THEN 'rookie-cup-19'
        WHEN name = 'VIII Кубок Гольф-клуба Минск' THEN 'club-cup-8'
        WHEN name = 'ФУТГОЛЬФ. Belarus Open' THEN 'futgolf-belarus-open'
        WHEN name = 'II Кубок Братства: Беларусь — Россия by WhiteBird' THEN 'bratstvo-cup-2'
        WHEN name = 'Лига Гольфа (РФ) 3 этап, Минск' THEN 'liga-rf-3'
        WHEN name = 'X Time to Golf 2026 (три клюшки)' THEN 'time-to-golf-10'
        WHEN name = 'Ladies Golf Open' THEN 'ladies-open'
        WHEN name = 'AVATR Golf Cup (Belarus-China)' THEN 'avatr-cup'
        WHEN name = 'Тур «Золотые 50»' THEN 'golden-50'
        WHEN name = 'Активлизинг Investment Cup' THEN 'activleasing-cup'
        WHEN name = 'Infinity Golf Cup 2026' THEN 'infinity-cup'
        WHEN name = 'Лига гольфа (РФ) 4 этап и финал (Москва)' THEN 'liga-rf-4'
        WHEN name = 'XX Rookie Cup' THEN 'rookie-cup-20'
        WHEN name = 'XX Belarus Golf Open Cup' THEN 'belarus-open-20'
        WHEN name = '«Привет» от Гринкипера by Technogym' THEN 'greenkeeper'
        WHEN name = 'Отбор BMW Golf Cup World Final' THEN 'bmw-qualifier'
        WHEN name = 'BMW Challenge Cup 2026' THEN 'bmw-challenge'
        WHEN name = 'Этап Евразийской Лиги Гольфа' THEN 'eurasian-league'
        WHEN name = 'Minsk Golf InterClub 2026 by Kaspersky' THEN 'interclub-kaspersky'
        WHEN name = 'Футгольф' THEN 'futgolf-oct'
        WHEN name = 'Благотворительный турнир БСБК' THEN 'bsbk-charity'
        WHEN name = 'XXI Rookie Cup' THEN 'rookie-cup-21'
        WHEN name = 'XXII SUPER Rookie Cup' THEN 'super-rookie-22'
        ELSE slug
      END
      WHERE slug IS NULL
    ` },
    // Cleanup for the removed official-tournaments feature (reverted in 5d761d0) —
    // drop children before the parent table to satisfy FK constraints.
    { name: 'drop_official_tournament_groups', query: `DROP TABLE IF EXISTS official_tournament_groups` },
    { name: 'drop_official_registrations', query: `DROP TABLE IF EXISTS official_registrations` },
    { name: 'drop_official_tournaments', query: `DROP TABLE IF EXISTS official_tournaments` },
    { name: 'drop_is_admin', query: `ALTER TABLE users DROP COLUMN IF EXISTS is_admin` },
    { name: 'round_share_code', query: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS share_code TEXT` },
    { name: 'round_share_code_index', query: `CREATE UNIQUE INDEX IF NOT EXISTS rounds_share_code_idx ON rounds (share_code) WHERE share_code IS NOT NULL` },
    { name: 'booking_slots', query: `CREATE TABLE IF NOT EXISTS booking_slots (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('tee_time', 'training')),
      date DATE NOT NULL,
      time TIME NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 10,
      capacity INTEGER NOT NULL DEFAULT 4,
      trainer_name TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )` },
    { name: 'booking_slots_index', query: `CREATE INDEX IF NOT EXISTS booking_slots_date_idx ON booking_slots (type, date, time)` },
    { name: 'slot_bookings', query: `CREATE TABLE IF NOT EXISTS slot_bookings (
      id SERIAL PRIMARY KEY,
      slot_id INTEGER NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      players_count INTEGER NOT NULL DEFAULT 1,
      reminded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(slot_id, user_id)
    )` },
    { name: 'user_gender', query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT` },
    // Flighting for the registration-based live-scoring flow: once a registration
    // is paid, the admin groups paid registrants into flights/groups, each group
    // backed by one shared `rounds` row (round_id) that group members enter
    // scores into (own + marker's, see /api/tournaments/:id/scores).
    { name: 'tournament_reg_round', query: `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES rounds(id) ON DELETE SET NULL` },
    { name: 'tournament_reg_flight', query: `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS flight_label TEXT` },
    { name: 'tournament_reg_checked_in', query: `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS checked_in BOOLEAN NOT NULL DEFAULT false` },
  ]

  for (const migration of migrations) {
    try {
      await db.query(migration.query)
      console.log(`[db] Migration '${migration.name}' completed`)
    } catch (err) {
      console.error(`[db] Migration '${migration.name}' error:`, err.message)
    }
  }
}

// Run migrations in background without blocking
runMigrations().catch(err => console.error('[db] Migrations failed:', err))
