import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'

const router = Router()

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '365d' })
const normalizeEmail = (email) => (email || '').trim().toLowerCase()

// Normalize name for fuzzy matching (uppercase, trim)
function normalizeName(name) {
  return (name || '').trim().toUpperCase()
}

// Find member in HDID whitelist with fuzzy matching
async function findHDIDMember(firstName, lastName) {
  const normFirst = normalizeName(firstName)
  const normLast = normalizeName(lastName)

  if (!normFirst || !normLast) return null

  try {
    // Try exact match first
    const { rows: exactMatch } = await db.query(
      `SELECT * FROM hdid_members
       WHERE UPPER(first_name) = $1 AND UPPER(last_name) = $2`,
      [normFirst, normLast]
    )
    if (exactMatch.length > 0) return exactMatch[0]

    // Try fuzzy match (similar names, e.g., ANDREI vs ANDREY)
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

    return fuzzyMatch.length > 0 ? fuzzyMatch[0] : null
  } catch (err) {
    // If pg_trgm extension is not installed, fall back to exact match only
    console.warn('[auth] Fuzzy matching not available, using exact match only:', err.message)
    return null
  }
}

// ── POST /api/auth/register ─────────────────────────────────────────────────
// Email/password signup, still gated by the club's HDID member whitelist —
// same eligibility rule as the old Telegram flow, just a different identity.
router.post('/register', async (req, res, next) => {
  const { email, password, firstName, lastName } = req.body

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Заполните email, пароль, имя и фамилию' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 8 символов' })
  }

  const normEmail = normalizeEmail(email)

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = $1', [normEmail]
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Аккаунт с этим email уже существует' })
    }

    const hdidMember = await findHDIDMember(firstName, lastName)
    if (!hdidMember) {
      return res.status(403).json({
        error: 'Доступ запрещён. Вы не являетесь членом Golf Club Minsk.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const { rows: [user] } = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, hcp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [normEmail, passwordHash, firstName.trim(), lastName.trim(), hdidMember.hcp ?? 36.0]
    )

    res.json({ jwt: signToken(user.id) })
  } catch (err) { next(err) }
})

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' })
  }

  try {
    const { rows: [user] } = await db.query(
      'SELECT id, password_hash FROM users WHERE LOWER(email) = $1', [normalizeEmail(email)]
    )
    if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Неверный email или пароль' })
    }

    res.json({ jwt: signToken(user.id) })
  } catch (err) { next(err) }
})

export default router
