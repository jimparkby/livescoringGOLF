import express from 'express'
import https from 'https'
import crypto from 'crypto'
import { db } from '../db.js'
import { buildRound } from './rounds.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { getHcpGroup } from '../utils/hcpGroups.js'

const router = express.Router()

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Marker pairing derived purely from position within the group — no extra
// column needed. Even-sized groups pair up mutually (0↔1, 2↔3 …), odd-sized
// groups chain (0→1→2→0). Group order is always `hcp ASC, user_id ASC` so
// every caller (build, live link, scores) derives the same pairing.
function markerPartnerIndex(size, i) {
  if (size <= 1) return null
  if (size % 2 === 1) return (i + 1) % size
  const pairStart = i - (i % 2)
  return pairStart === i ? i + 1 : pairStart
}

/**
 * GET /api/tournaments/live/:token
 * Public, no login — resolves a player's personal live-scoring link (handed
 * out once groups are built, e.g. as a QR code) to their group, marker, and
 * current scores. Same idea as a scorecard QR at the tee: whoever has the
 * link can score, no account needed.
 */
router.get('/live/:token', async (req, res, next) => {
  try {
    const { rows: [reg] } = await db.query(
      `SELECT tr.*, u.first_name, u.last_name
       FROM tournament_registrations tr JOIN users u ON u.id = tr.user_id
       WHERE tr.access_token = $1`,
      [req.params.token]
    )
    if (!reg || !reg.round_id) return res.status(404).json({ error: 'Link not found' })

    const { rows: [round] } = await db.query('SELECT * FROM rounds WHERE id = $1', [reg.round_id])
    const { rows: players } = await db.query(
      `SELECT rp.player_id, rp.name, rp.hcp
       FROM round_players rp WHERE rp.round_id = $1
       ORDER BY rp.hcp ASC, rp.player_id ASC`,
      [reg.round_id]
    )
    const myIndex = players.findIndex((p) => p.player_id === reg.user_id)
    const markerIdx = myIndex >= 0 ? markerPartnerIndex(players.length, myIndex) : null
    const marker = markerIdx !== null ? players[markerIdx] : null

    res.json({
      tournamentId: reg.tournament_id,
      tournamentName: round?.course_name ?? reg.tournament_id,
      courseId: round?.course_id ?? null,
      format: round?.format ?? 'stableford',
      holesMode: round?.holes_mode ?? '18',
      tee: round?.tee ?? 'yellow',
      rating: round?.rating != null ? Number(round.rating) : null,
      slope: round?.slope ?? null,
      roundId: reg.round_id,
      myId: reg.user_id,
      myName: [reg.first_name, reg.last_name].filter(Boolean).join(' ').trim(),
      flightLabel: reg.flight_label,
      group: { players: players.map((p) => ({ id: p.player_id, name: p.name, hcp: Number(p.hcp) })) },
      marker: marker ? { id: marker.player_id, name: marker.name, hcp: Number(marker.hcp) } : null,
    })
  } catch (error) {
    console.error('Error resolving live-scoring link:', error)
    res.status(500).json({ error: 'Failed to load link' })
  }
})

/**
 * POST /api/tournaments/live/:token/scores
 * Body: { hole, myScore, markerScore }. Same write rule as before — only the
 * caller's own score and their (server-recomputed) marker's score, never
 * anyone else's — just identified by the link token instead of a session.
 */
router.post('/live/:token/scores', async (req, res, next) => {
  try {
    const { hole, myScore, markerScore } = req.body
    if (!hole) return res.status(400).json({ error: 'hole is required' })

    const { rows: [reg] } = await db.query(
      'SELECT round_id, user_id FROM tournament_registrations WHERE access_token = $1',
      [req.params.token]
    )
    if (!reg?.round_id) return res.status(404).json({ error: 'Link not found' })

    const { rows: players } = await db.query(
      `SELECT player_id FROM round_players WHERE round_id = $1 ORDER BY hcp ASC, player_id ASC`,
      [reg.round_id]
    )
    const myIndex = players.findIndex((p) => p.player_id === reg.user_id)
    if (myIndex === -1) return res.status(403).json({ error: 'Not in this group' })
    const markerIdx = markerPartnerIndex(players.length, myIndex)
    const markerId = markerIdx !== null ? players[markerIdx].player_id : null

    const writes = [[reg.user_id, myScore]]
    if (markerId && markerScore != null) writes.push([markerId, markerScore])

    for (const [playerId, score] of writes) {
      if (score == null) continue
      await db.query(
        `INSERT INTO hole_scores (round_id, player_id, hole, score, putts, driving, gir, bunker, penalties)
         VALUES ($1,$2,$3,$4,0,false,false,0,0)
         ON CONFLICT (round_id, player_id, hole) DO UPDATE SET score = EXCLUDED.score`,
        [reg.round_id, playerId, hole, score]
      )
    }
    await db.query('UPDATE rounds SET updated_at = NOW() WHERE id = $1', [reg.round_id])
    await db.query(
      'UPDATE tournament_registrations SET checked_in = true WHERE access_token = $1 AND checked_in = false',
      [req.params.token]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('Error saving tournament score:', error)
    res.status(500).json({ error: 'Failed to save score' })
  }
})

/**
 * GET /api/tournaments/list/with-results
 * Get list of tournament IDs/slugs that have results
 */
router.get('/list/with-results', async (req, res) => {
  try {
    const { rows: tournaments } = await db.query(`
      SELECT DISTINCT t.id, t.slug
      FROM tournaments t
      INNER JOIN tournament_results tr ON t.id = tr.tournament_id
    `)

    const tournamentIds = tournaments.map(t => t.slug || t.id.toString())

    res.json({ tournaments: tournamentIds })
  } catch (error) {
    console.error('Error getting tournaments with results:', error)
    res.status(500).json({ error: 'Failed to get tournaments with results' })
  }
})

/**
 * GET /api/tournaments/my-active-round
 * For the "continue your round" banner on the homepage — the caller's most
 * recently updated tournament round that's flighted (access_token set) and
 * not yet finished, across every tournament, so the homepage doesn't need
 * to know which tournament to ask about. Registered before /:id so it
 * doesn't get swallowed by that catch-all.
 */
router.get('/my-active-round', requireAuth, async (req, res, next) => {
  try {
    const { rows: [row] } = await db.query(
      `SELECT tr.access_token, tr.flight_label, t.name AS tournament_name
       FROM tournament_registrations tr
       JOIN rounds r ON r.id = tr.round_id
       JOIN tournaments t ON (t.slug = tr.tournament_id OR t.id::text = tr.tournament_id)
       WHERE tr.user_id = $1 AND tr.access_token IS NOT NULL AND r.completed = false
       ORDER BY r.updated_at DESC
       LIMIT 1`,
      [req.user.userId]
    )
    if (!row) return res.json({ active: false })
    res.json({
      active: true,
      accessToken: row.access_token,
      tournamentName: row.tournament_name,
      flightLabel: row.flight_label,
    })
  } catch (error) {
    console.error('Error getting active round:', error)
    res.status(500).json({ error: 'Failed to get active round' })
  }
})

/**
 * GET /api/tournaments/:id
 * Get tournament details (accepts both numeric ID and slug)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Try to get by slug first, then by numeric ID
    const { rows: [tournament] } = await db.query(
      'SELECT * FROM tournaments WHERE slug = $1 OR id::text = $1',
      [id]
    )

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' })
    }

    res.json(tournament)
  } catch (error) {
    console.error('Error getting tournament:', error)
    res.status(500).json({ error: 'Failed to get tournament' })
  }
})

/**
 * GET /api/tournaments/:id/results
 * Get tournament results (accepts both numeric ID and slug)
 */
router.get('/:id/results', async (req, res) => {
  try {
    const { id } = req.params

    // Get tournament first
    const { rows: [tournament] } = await db.query(
      'SELECT id, name, date FROM tournaments WHERE slug = $1 OR id::text = $1',
      [id]
    )

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' })
    }

    // Get results grouped by group_name
    const { rows: results } = await db.query(
      `SELECT * FROM tournament_results
       WHERE tournament_id = $1
       ORDER BY COALESCE(group_name, ''), place ASC`,
      [tournament.id]
    )

    // Group results by group_name
    const groupedResults = {}
    results.forEach(result => {
      const groupName = result.group_name || 'Общий зачет'
      if (!groupedResults[groupName]) {
        groupedResults[groupName] = []
      }
      groupedResults[groupName].push({
        place: result.place,
        player_name: result.player_name,
        score: result.score,
      })
    })

    res.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        date: tournament.date,
      },
      groups: Object.entries(groupedResults).map(([groupName, results]) => ({
        name: groupName,
        results,
      })),
      hasResults: results.length > 0,
    })
  } catch (error) {
    console.error('Error getting tournament results:', error)
    res.status(500).json({ error: 'Failed to get tournament results' })
  }
})

/**
 * GET /api/tournaments/:id/rounds
 * Public, no-auth: every round (playing group) tagged with this tournament id
 * (the static tournament slug, e.g. "pets-day"), for the live flighted
 * leaderboard. Mirrors the /api/live/:code public-read pattern.
 */
router.get('/:id/rounds', async (req, res, next) => {
  try {
    const { id } = req.params

    const { rows } = await db.query(
      'SELECT * FROM rounds WHERE tournament_id = $1 ORDER BY date ASC',
      [id]
    )

    const roundsWithData = await Promise.all(rows.map((r) => buildRound(r, null)))
    res.json(roundsWithData)
  } catch (error) {
    console.error('Error getting tournament rounds:', error)
    res.status(500).json({ error: 'Failed to get tournament rounds' })
  }
})

/**
 * POST /api/tournaments/:id/build-groups
 * Admin only. Flights every *paid* registration that isn't grouped yet (by
 * HCP + gender, same convention as the live leaderboard) and chunks each
 * flight into groups of `groupSize`, each group backed by one shared `rounds`
 * row the group's members will enter scores into. Safe to re-run — only
 * touches registrations with round_id still NULL, so it can be used to fold
 * in late sign-ups without reshuffling groups that already started playing.
 */
router.post('/:id/build-groups', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params
    const { courseId, courseName, tee, rating, slope, format, holesMode, groupSize } = req.body
    const size = Number(groupSize) || 4

    const { rows: regs } = await db.query(
      `SELECT tr.id AS reg_id, tr.user_id, u.first_name, u.last_name, u.hcp, u.gender
       FROM tournament_registrations tr
       JOIN users u ON u.id = tr.user_id
       WHERE tr.tournament_id = $1 AND tr.status = 'paid' AND tr.round_id IS NULL`,
      [id]
    )
    if (regs.length === 0) return res.json({ groupsCreated: 0, playersGrouped: 0 })

    const byFlight = new Map()
    for (const r of regs) {
      const flight = getHcpGroup(Number(r.hcp) || 0, r.gender === 'woman' ? 'woman' : 'man')
      if (!byFlight.has(flight)) byFlight.set(flight, [])
      byFlight.get(flight).push(r)
    }

    let groupsCreated = 0
    await db.query('BEGIN')
    try {
      for (const [flightLabel, players] of byFlight) {
        players.sort((a, b) => (Number(a.hcp) || 0) - (Number(b.hcp) || 0))
        for (let i = 0; i < players.length; i += size) {
          const chunk = players.slice(i, i + size)
          const { rows: [round] } = await db.query(
            `INSERT INTO rounds (id, user_id, date, course_id, course_name, tee, rating, slope, completed, tournament_id, format, holes_mode, updated_at)
             VALUES (gen_random_uuid(), $1, NOW(), $2, $3, $4, $5, $6, false, $7, $8, $9, NOW())
             RETURNING id`,
            [chunk[0].user_id, courseId ?? null, courseName ?? id, tee ?? 'yellow', rating ?? 72, slope ?? 113, id, format ?? 'stableford', holesMode ?? '18']
          )
          for (const p of chunk) {
            const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Player'
            const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || 'P'
            await db.query(
              `INSERT INTO round_players (round_id, player_id, name, initials, hcp, is_me, user_id)
               VALUES ($1,$2,$3,$4,$5,false,$6)`,
              [round.id, p.user_id, name, initials, p.hcp, p.user_id]
            )
            const accessToken = crypto.randomBytes(6).toString('base64url')
            await db.query(
              `UPDATE tournament_registrations SET round_id = $1, flight_label = $2, access_token = $3, updated_at = NOW() WHERE id = $4`,
              [round.id, flightLabel, accessToken, p.reg_id]
            )
          }
          groupsCreated++
        }
      }
      await db.query('COMMIT')
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

    res.json({ groupsCreated, playersGrouped: regs.length })
  } catch (error) {
    console.error('Error building tournament groups:', error)
    res.status(500).json({ error: 'Failed to build groups' })
  }
})

/**
 * GET /api/tournaments/:id/my-group
 * The caller's own registration status plus (once grouped) their group's
 * player list and who they mark for.
 */
router.get('/:id/my-group', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { rows: [reg] } = await db.query(
      'SELECT * FROM tournament_registrations WHERE tournament_id = $1 AND user_id = $2',
      [id, req.userId]
    )
    if (!reg) return res.json({ registered: false })

    if (!reg.round_id) {
      return res.json({ registered: true, status: reg.status, flightLabel: null, group: null })
    }

    const { rows: players } = await db.query(
      `SELECT rp.player_id, rp.name, rp.hcp
       FROM round_players rp WHERE rp.round_id = $1
       ORDER BY rp.hcp ASC, rp.player_id ASC`,
      [reg.round_id]
    )
    const myIndex = players.findIndex((p) => p.player_id === req.userId)
    const markerIdx = myIndex >= 0 ? markerPartnerIndex(players.length, myIndex) : null
    const marker = markerIdx !== null ? players[markerIdx] : null

    res.json({
      registered: true,
      status: reg.status,
      checkedIn: reg.checked_in,
      flightLabel: reg.flight_label,
      roundId: reg.round_id,
      accessToken: reg.access_token,
      group: { players: players.map((p) => ({ id: p.player_id, name: p.name, hcp: Number(p.hcp) })) },
      marker: marker ? { id: marker.player_id, name: marker.name, hcp: Number(marker.hcp) } : null,
    })
  } catch (error) {
    console.error('Error getting my tournament group:', error)
    res.status(500).json({ error: 'Failed to get group' })
  }
})

// Score entry moved to the public /live/:token endpoints above — a player's
// personal link replaces the login + check-in step entirely.

/**
 * GET /api/tournaments/:id/flights-photos
 * Get flights photos for a tournament (accepts both numeric ID and slug)
 */
router.get('/:id/flights-photos', async (req, res) => {
  try {
    const { id } = req.params

    // Try to get by slug first, then by numeric ID
    const { rows: [tournament] } = await db.query(
      'SELECT flights_photos FROM tournaments WHERE slug = $1 OR id::text = $1',
      [id]
    )

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' })
    }

    res.json({
      photos: tournament.flights_photos || []
    })
  } catch (error) {
    console.error('Error getting flights photos:', error)
    res.status(500).json({ error: 'Failed to get flights photos' })
  }
})

/**
 * DELETE /api/tournaments/:id/flights-photos/:fileId
 * Delete a specific flight photo from tournament (accepts both numeric ID and slug)
 */
router.delete('/:id/flights-photos/:fileId', async (req, res) => {
  try {
    const { id, fileId } = req.params

    // Remove the file_id from the JSON array
    await db.query(
      `UPDATE tournaments
       SET flights_photos = (
         SELECT jsonb_agg(elem)
         FROM jsonb_array_elements(flights_photos) elem
         WHERE elem::text != $1::text
       )
       WHERE slug = $2 OR id::text = $2`,
      [JSON.stringify(fileId), id]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting flight photo:', error)
    res.status(500).json({ error: 'Failed to delete flight photo' })
  }
})

/**
 * GET /api/tournaments/telegram-photo/:fileId
 * Proxy Telegram photo to frontend
 */
router.get('/telegram-photo/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params

    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: 'Telegram bot token not configured' })
    }

    // Get file path from Telegram
    const fileInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`

    const fileInfo = await new Promise((resolve, reject) => {
      https.get(fileInfoUrl, (response) => {
        let data = ''
        response.on('data', chunk => { data += chunk })
        response.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
        response.on('error', reject)
      })
    })

    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Download and stream the file
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`

    https.get(fileUrl, (photoResponse) => {
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Cache-Control', 'public, max-age=86400') // Cache for 1 day
      photoResponse.pipe(res)
    }).on('error', (error) => {
      console.error('Error downloading photo:', error)
      res.status(500).json({ error: 'Failed to download photo' })
    })
  } catch (error) {
    console.error('Error proxying telegram photo:', error)
    res.status(500).json({ error: 'Failed to proxy photo' })
  }
})

export default router
