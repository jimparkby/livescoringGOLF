import { Router } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { db } from '../db.js'
import { getBotUsername } from '../bot.js'

const router = Router()

// ── POST /api/auth/telegram-code ────────────────────────────────────────────
// Login/sign-up is Telegram-only: the Auth page calls this (no session yet),
// opens the returned deep link, and polls GET below. bot.js's /start handler
// resolves the code — finding or creating the account and setting user_id.
router.post('/telegram-code', async (req, res, next) => {
  try {
    const code = crypto.randomBytes(6).toString('hex')
    await db.query(`INSERT INTO telegram_auth_codes (code) VALUES ($1)`, [code])
    const botUsername = await getBotUsername()
    res.json({
      code,
      deepLink: botUsername ? `https://t.me/${botUsername}?start=auth_${code}` : null,
    })
  } catch (err) { next(err) }
})

// ── GET /api/auth/telegram-code/:code ───────────────────────────────────────
// Polled by the Auth page. Unauthenticated by design — codes are random,
// short-lived (10min) and single-use (deleted once consumed).
router.get('/telegram-code/:code', async (req, res, next) => {
  try {
    const { rows: [row] } = await db.query(
      `SELECT user_id FROM telegram_auth_codes WHERE code = $1 AND expires_at > NOW()`,
      [req.params.code]
    )
    if (!row) return res.status(404).json({ error: 'expired' })
    if (!row.user_id) return res.json({ pending: true })

    await db.query(`DELETE FROM telegram_auth_codes WHERE code = $1`, [req.params.code])
    const token = jwt.sign({ userId: row.user_id }, process.env.JWT_SECRET, { expiresIn: '365d' })
    res.json({ jwt: token })
  } catch (err) { next(err) }
})

export default router
