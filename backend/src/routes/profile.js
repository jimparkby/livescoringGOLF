import { Router } from 'express'
import crypto from 'crypto'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { getBotUsername } from '../bot.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows: [user] } = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.userId]
    )
    if (!user) return res.status(404).json({ error: 'not found' })
    res.json(user)
  } catch (err) { next(err) }
})

router.put('/', requireAuth, async (req, res, next) => {
  const { first_name, last_name, username, hcp, home_club, city, default_tee, gender } = req.body
  try {
    const { rows: [user] } = await db.query(
      `UPDATE users SET
         first_name  = COALESCE($2, first_name),
         last_name   = COALESCE($3, last_name),
         username    = COALESCE($4, username),
         hcp         = COALESCE($5, hcp),
         home_club   = COALESCE($6, home_club),
         city        = COALESCE($7, city),
         default_tee = COALESCE($8, default_tee),
         gender      = COALESCE($9, gender),
         updated_at  = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.user.userId,
        first_name?.trim() || null,
        last_name?.trim() || null,
        username?.trim() || null,
        hcp !== undefined ? Number(hcp) : null,
        home_club?.trim() || null,
        city?.trim() || null,
        default_tee?.trim() || null,
        (gender === 'man' || gender === 'woman') ? gender : null,
      ]
    )
    res.json(user)
  } catch (err) { next(err) }
})

// Generate a one-time code + t.me deep link for "Подключить Telegram" in
// Profile — the bot's /start handler consumes it and sets users.telegram_id,
// which is what every bot.sendMessage(...) notification is addressed to.
router.post('/telegram-link-code', requireAuth, async (req, res, next) => {
  try {
    const code = crypto.randomBytes(6).toString('hex')
    await db.query(
      `INSERT INTO telegram_link_codes (code, user_id) VALUES ($1, $2)`,
      [code, req.user.userId]
    )
    const botUsername = await getBotUsername()
    res.json({
      code,
      botUsername,
      deepLink: botUsername ? `https://t.me/${botUsername}?start=link_${code}` : null,
    })
  } catch (err) { next(err) }
})

// Sync HCP from HDID
router.post('/sync-hdid', requireAuth, async (req, res, next) => {
  try {
    // Get current user
    const { rows: [user] } = await db.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [req.user.userId]
    )

    if (!user || !user.first_name || !user.last_name) {
      return res.status(400).json({
        error: 'First name and last name required for HDID sync',
        errorRu: 'Для синхронизации с HDID необходимо указать имя и фамилию в профиле'
      })
    }

    // Find in HDID whitelist (exact match first)
    const normFirst = user.first_name.trim().toUpperCase()
    const normLast = user.last_name.trim().toUpperCase()

    let hdidMember = null

    // Try exact match
    const { rows: exactMatch } = await db.query(
      `SELECT * FROM hdid_members
       WHERE UPPER(first_name) = $1 AND UPPER(last_name) = $2`,
      [normFirst, normLast]
    )
    if (exactMatch.length > 0) {
      hdidMember = exactMatch[0]
    } else {
      // Try fuzzy match
      try {
        const { rows: fuzzyMatch } = await db.query(
          `SELECT *,
                  similarity(UPPER(first_name), $1) + similarity(UPPER(last_name), $2) as score
           FROM hdid_members
           WHERE similarity(UPPER(first_name), $1) > 0.6
             AND similarity(UPPER(last_name), $2) > 0.6
           ORDER BY score DESC
           LIMIT 1`,
          [normFirst, normLast]
        )
        if (fuzzyMatch.length > 0) {
          hdidMember = fuzzyMatch[0]
        }
      } catch {
        // pg_trgm not available, skip fuzzy match
      }
    }

    if (!hdidMember) {
      return res.status(404).json({
        error: 'Not found in HDID members list',
        errorRu: 'Игрок не найден в списке HDID. Проверьте правильность имени и фамилии на английском.'
      })
    }

    // Update user HCP and sync timestamp
    const { rows: [updated] } = await db.query(
      `UPDATE users SET
         hcp = $2,
         last_hdid_sync = NOW(),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.user.userId, hdidMember.hcp]
    )

    res.json({
      hcp: updated.hcp,
      last_hdid_sync: updated.last_hdid_sync,
      hdid_name: `${hdidMember.first_name} ${hdidMember.last_name}`
    })
  } catch (err) { next(err) }
})

export default router
