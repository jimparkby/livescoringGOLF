import { db } from '../db.js'

const normalizeName = (name) => (name || '').trim().toUpperCase()

// Find a member in the HDID whitelist by name — used to seed a known
// member's real starting HCP instead of the default 36.0 when their
// account is first created from a Telegram identity.
export async function findHDIDMember(firstName, lastName) {
  const normFirst = normalizeName(firstName)
  const normLast = normalizeName(lastName)
  if (!normFirst || !normLast) return null

  try {
    const { rows: exactMatch } = await db.query(
      `SELECT * FROM hdid_members WHERE UPPER(first_name) = $1 AND UPPER(last_name) = $2`,
      [normFirst, normLast]
    )
    if (exactMatch.length > 0) return exactMatch[0]

    const { rows: fuzzyMatch } = await db.query(
      `SELECT *, similarity(UPPER(first_name), $1) + similarity(UPPER(last_name), $2) as score
       FROM hdid_members
       WHERE similarity(UPPER(first_name), $1) > 0.6 AND similarity(UPPER(last_name), $2) > 0.6
       ORDER BY score DESC LIMIT 1`,
      [normFirst, normLast]
    )
    return fuzzyMatch.length > 0 ? fuzzyMatch[0] : null
  } catch (err) {
    console.warn('[telegramAccount] HDID fuzzy matching unavailable, exact match only:', err.message)
    return null
  }
}

// Shared by the bot's /start?auth_ deep link and the Mini App's initData
// auto-login — both need the same find-or-create-by-Telegram-identity
// logic so a user ends up with exactly one account either way. Finds an
// existing account by telegram_id, falls back to linking an existing
// account by name (e.g. someone created before Telegram-only login) to
// avoid duplicates, and only creates a new row if neither matches. Open
// signup — anyone can join; the HDID whitelist is only consulted to seed
// a known member's real starting HCP instead of the default 36.0.
export async function findOrCreateUserByTelegram({ telegramId, firstName, lastName, username }) {
  let { rows: [user] } = await db.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId])

  if (!user) {
    const { rows: [nameMatch] } = await db.query(
      `SELECT id FROM users WHERE telegram_id IS NULL AND UPPER(first_name) = UPPER($1) AND UPPER(last_name) = UPPER($2) LIMIT 1`,
      [firstName, lastName]
    )
    if (nameMatch) {
      user = nameMatch
      await db.query('UPDATE users SET telegram_id = $1, username = COALESCE($2, username) WHERE id = $3', [telegramId, username ?? null, user.id])
    }
  }

  if (!user) {
    const hdidMember = await findHDIDMember(firstName, lastName)
    const { rows: [newUser] } = await db.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, hcp) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [telegramId, username ?? null, firstName, lastName, hdidMember?.hcp ?? 36.0]
    )
    user = newUser
  }

  return user
}
