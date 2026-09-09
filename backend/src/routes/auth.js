import { Router } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { db } from '../db.js'
import { getBotUsername } from '../bot.js'
import { findOrCreateUserByTelegram } from '../services/telegramAccount.js'
import { verifyTelegramWebAppInitData } from '../utils/telegramWebApp.js'

const router = Router()

// ── POST /api/auth/telegram-webapp ──────────────────────────────────────────
// Opened as a Telegram Mini App (via the bot's web_app button/menu button),
// the frontend already carries a signed Telegram identity in
// window.Telegram.WebApp.initData — no separate /start deep link needed.
// Verifies that signature server-side, then finds/creates the account the
// same way the /start?auth_ flow does, so a user has exactly one account
// whether they log in from the site or the mini app.
router.post('/telegram-webapp', async (req, res, next) => {
  try {
    const tgUser = verifyTelegramWebAppInitData(req.body?.initData, process.env.TELEGRAM_BOT_TOKEN)
    if (!tgUser?.id) return res.status(401).json({ error: 'invalid_init_data' })

    const user = await findOrCreateUserByTelegram({
      telegramId: tgUser.id,
      firstName: tgUser.first_name || '',
      lastName: tgUser.last_name || '',
      username: tgUser.username || null,
    })

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '365d' })
    res.json({ jwt: token })
  } catch (err) { next(err) }
})

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
