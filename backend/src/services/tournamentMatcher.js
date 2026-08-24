import { db } from '../db.js'

const NAME_SIMILARITY_THRESHOLD = 0.25
const DATE_PROXIMITY_DAYS = 5

/**
 * Best-effort match of a results photo (caption + message date) to a
 * tournament, so the admin doesn't have to pick one by hand when confirming.
 * Falls back to `{ tournamentId: null, confidence: 'none' }` when unsure —
 * the admin picks from the dropdown in that case.
 */
export async function matchTournament({ caption, messageDate }) {
  if (caption && caption.trim()) {
    const { rows } = await db.query(
      `SELECT id, similarity(name, $1) AS sim
       FROM tournaments
       ORDER BY sim DESC
       LIMIT 1`,
      [caption.trim()]
    )
    if (rows[0] && rows[0].sim >= NAME_SIMILARITY_THRESHOLD) {
      return { tournamentId: rows[0].id, confidence: 'name' }
    }
  }

  const { rows } = await db.query(
    `SELECT id, ABS(date - $1::date) AS days_away
     FROM tournaments
     WHERE date IS NOT NULL
     ORDER BY days_away ASC
     LIMIT 1`,
    [messageDate]
  )
  if (rows[0] && Number(rows[0].days_away) <= DATE_PROXIMITY_DAYS) {
    return { tournamentId: rows[0].id, confidence: 'date' }
  }

  return { tournamentId: null, confidence: 'none' }
}
