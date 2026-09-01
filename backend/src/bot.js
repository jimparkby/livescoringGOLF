import TelegramBot from 'node-telegram-bot-api'
import { createRequire } from 'module'
import https from 'https'
import { db } from './db.js'
import { parseScorecardPhoto } from './services/scoreParser.js'

const require = createRequire(import.meta.url)

const normalizeName = (name) => (name || '').trim().toUpperCase()

// Find a member in the HDID whitelist by name — gates account creation for
// people signing in with Telegram for the first time (see /start's auth_
// handler below). Mirrors the matching that used to live in routes/auth.js
// before login moved to Telegram-only.
async function findHDIDMember(firstName, lastName) {
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
    console.warn('[bot] HDID fuzzy matching unavailable, exact match only:', err.message)
    return null
  }
}

function createProxyAgent() {
  const proxyUrl = process.env.TELEGRAM_PROXY_URL
  if (!proxyUrl) return null
  try {
    if (/^socks/i.test(proxyUrl)) {
      const { SocksProxyAgent } = require('socks-proxy-agent')
      return new SocksProxyAgent(proxyUrl)
    }
    const { HttpsProxyAgent } = require('https-proxy-agent')
    return new HttpsProxyAgent(proxyUrl)
  } catch (err) {
    console.warn('[bot] Proxy agent not created (install package):', err.message)
    return null
  }
}

function botOptions(extra = {}) {
  const agent = createProxyAgent()
  return agent ? { ...extra, request: { agent } } : extra
}

// ── Download a photo from Telegram servers ────────────────────────────────────
async function downloadTelegramPhoto(botInstance, fileId) {
  const agent = createProxyAgent()
  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const fileLink = await botInstance.getFileLink(fileId)
      const buffer = await new Promise((resolve, reject) => {
        const url = new URL(fileLink)
        const options = { hostname: url.hostname, port: 443, path: url.pathname + url.search, method: 'GET' }
        if (agent) options.agent = agent
        const req = https.request(options, (res) => {
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
        })
        req.setTimeout(30000, () => req.destroy(new Error('Download timeout')))
        req.on('error', reject)
        req.end()
      })
      return buffer
    } catch (err) {
      console.warn(`[bot] downloadTelegramPhoto attempt ${attempt}/${MAX_ATTEMPTS}:`, err.message)
      if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  return null
}

const token = process.env.TELEGRAM_BOT_TOKEN
const webAppUrl = process.env.FRONTEND_URL || 'https://your-app-url.com'

let bot = null

const enablePolling = process.env.BOT_POLLING === 'true'

if (!token) {
  console.warn('[bot] TELEGRAM_BOT_TOKEN not set — bot disabled')
} else {
  if (enablePolling) {
    // Local dev / Timeweb: incoming connections blocked — use polling.
    bot = new TelegramBot(token, botOptions({
      polling: { interval: 300, autoStart: false, params: { timeout: 10 } },
    }))
    bot.deleteWebHook()
      .then(() => bot.startPolling())
      .catch((err) => {
        console.warn('[bot] deleteWebHook failed, starting polling anyway:', err.message)
        bot.startPolling()
      })
  } else {
    // Railway / production: use webhook so multiple restarts don't cause 409 conflicts.
    bot = new TelegramBot(token, botOptions())
    const backendUrl = (process.env.BACKEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '')
    if (backendUrl) {
      const webhookUrl = `${backendUrl}/bot-webhook`
      bot.setWebHook(webhookUrl)
        .then(() => console.log('[bot] Webhook registered:', webhookUrl))
        .catch((err) => console.error('[bot] setWebHook failed:', err.message))
    } else {
      console.warn('[bot] BACKEND_URL not set — webhook not registered, bot will not receive updates')
    }
  }

  // ── /start ────────────────────────────────────────────────────────────────
  bot.onText(/\/start(?:\s+(\S+))?/, async (msg, match) => {
    console.log('[bot] /start from', msg.from?.id)

    // Deep link from Profile → "Подключить Telegram" (t.me/<bot>?start=link_<code>):
    // links this Telegram chat to the web account that generated the code, so
    // bot.sendMessage(user.telegram_id, ...) notifications reach them.
    const payload = match?.[1]
    if (payload?.startsWith('link_')) {
      const code = payload.slice(5)
      try {
        const { rows: [link] } = await db.query(
          `DELETE FROM telegram_link_codes WHERE code = $1 AND expires_at > NOW() RETURNING user_id`,
          [code]
        )
        if (!link) {
          await bot.sendMessage(msg.chat.id, '❌ Код недействителен или истёк. Сгенерируйте новый в приложении → Профиль.')
          return
        }
        await db.query(
          `UPDATE users SET telegram_id = $2, username = COALESCE($3, username) WHERE id = $1`,
          [link.user_id, msg.from.id, msg.from.username ?? null]
        )
        await bot.sendMessage(msg.chat.id, '✅ Telegram подключён! Теперь уведомления о записи на турниры, бронированиях и раундах будут приходить сюда.')
      } catch (err) {
        if (err.code === '23505') {
          await bot.sendMessage(msg.chat.id, '❌ Этот Telegram-аккаунт уже привязан к другому профилю GolfMinsk Live.')
        } else {
          console.error('[bot] link error:', err.message)
          await bot.sendMessage(msg.chat.id, '❌ Не удалось подключить Telegram. Попробуйте ещё раз.')
        }
      }
      return
    }

    // Deep link from the Auth page (t.me/<bot>?start=auth_<code>) — login and
    // sign-up both go through here now that email/password is gone. Finds an
    // existing account by telegram_id, falls back to linking an existing
    // account by name (e.g. someone created before Telegram-only login) to
    // avoid duplicates, and only creates a new row if neither matches. Open
    // signup — anyone can join; the HDID whitelist is only consulted to seed
    // a known member's real starting HCP instead of the default 36.0.
    if (payload?.startsWith('auth_')) {
      const code = payload.slice(5)
      const telegramId = msg.from.id
      const tgFirstName = msg.from.first_name || ''
      const tgLastName = msg.from.last_name || ''
      const tgUsername = msg.from.username || null

      try {
        const { rows: [codeRow] } = await db.query(
          `SELECT 1 FROM telegram_auth_codes WHERE code = $1 AND expires_at > NOW()`,
          [code]
        )
        if (!codeRow) {
          await bot.sendMessage(msg.chat.id, '❌ Ссылка для входа истекла. Вернитесь в приложение и попробуйте снова.')
          return
        }

        let { rows: [user] } = await db.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId])

        if (!user) {
          const { rows: [nameMatch] } = await db.query(
            `SELECT id FROM users WHERE telegram_id IS NULL AND UPPER(first_name) = UPPER($1) AND UPPER(last_name) = UPPER($2) LIMIT 1`,
            [tgFirstName, tgLastName]
          )
          if (nameMatch) {
            user = nameMatch
            await db.query('UPDATE users SET telegram_id = $1, username = COALESCE($2, username) WHERE id = $3', [telegramId, tgUsername, user.id])
          }
        }

        if (!user) {
          const hdidMember = await findHDIDMember(tgFirstName, tgLastName)
          const { rows: [newUser] } = await db.query(
            `INSERT INTO users (telegram_id, username, first_name, last_name, hcp) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [telegramId, tgUsername, tgFirstName, tgLastName, hdidMember?.hcp ?? 36.0]
          )
          user = newUser
        }

        await db.query('UPDATE telegram_auth_codes SET user_id = $1 WHERE code = $2', [user.id, code])
        await bot.sendMessage(msg.chat.id, '✅ Вход выполнен! Возвращайтесь в приложение — вы уже авторизованы.')
      } catch (err) {
        console.error('[bot] auth error:', err.message)
        await bot.sendMessage(msg.chat.id, '❌ Не удалось войти. Попробуйте ещё раз.')
      }
      return
    }

    const text = [
      `GolfMinsk Live — онлайн-счёт прямо в Telegram`,
      ``,
      `⛳ Ведите счёт в режиме реального времени`,
      `📊 Следите за своей статистикой и прогрессом`,
      `🏆 Участвуйте в турнирах Golf Club Minsk`,
      ``,
      `GolfMinsk Live. Ваш гольф-ассистент.`,
    ].join('\n')
    try {
      await bot.sendMessage(msg.chat.id, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⛳ Открыть GolfMinsk Live', url: webAppUrl }],
          ],
        },
      })
    } catch (err) {
      console.error('[bot] /start sendMessage error:', err.message)
    }
  })

  // ── Photo: scorecard processing ───────────────────────────────────────────
  bot.on('photo', async (msg) => {
    const telegramId = msg.from?.id
    if (!telegramId) return

    // Resolve user by telegram_id
    let user
    try {
      const { rows } = await db.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId])
      user = rows[0]
    } catch (err) {
      console.error('[bot] photo: db lookup error:', err.message)
      return
    }

    if (!user) {
      await bot.sendMessage(msg.chat.id, 'Сначала откройте GolfMinsk Live, чтобы зарегистрироваться.')
      return
    }

    const statusMsg = await bot.sendMessage(msg.chat.id, '⏳ Обработка...')

    try {
      // Take the highest-resolution photo
      const photo = msg.photo[msg.photo.length - 1]
      const buffer = await downloadTelegramPhoto(bot, photo.file_id)

      if (!buffer) {
        await bot.editMessageText('❌ Не удалось загрузить фото. Попробуйте ещё раз.', {
          chat_id: msg.chat.id, message_id: statusMsg.message_id,
        })
        return
      }

      const result = await parseScorecardPhoto(buffer)

      if (!result.players.length) {
        await bot.editMessageText('❌ Не удалось распознать скор-карту. Убедитесь, что фото чёткое и все лунки видны.', {
          chat_id: msg.chat.id, message_id: statusMsg.message_id,
        })
        return
      }

      // Use the player with the most holes recognised
      const bestPlayer = result.players.reduce((a, b) => a.holes.length >= b.holes.length ? a : b)
      const holesCount = Math.max(...result.players.map(p => p.holes.length))

      const { rows: [sc] } = await db.query(
        `INSERT INTO pending_scorecards (user_id, scores, course_name, holes_count)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [user.id, JSON.stringify({ players: result.players }), result.courseName, holesCount]
      )

      await bot.editMessageText('✅ Карта добавлена. Подтвердите счёт в приложении.', {
        chat_id: msg.chat.id,
        message_id: statusMsg.message_id,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить счёт', url: `${webAppUrl}?confirm=${sc.id}` },
          ]],
        },
      })
    } catch (err) {
      console.error('[bot] photo processing error:', err.message)
      await bot.editMessageText('❌ Ошибка обработки. Попробуйте ещё раз.', {
        chat_id: msg.chat.id, message_id: statusMsg.message_id,
      })
    }
  })

  if (enablePolling) {
    let consecutiveErrors = 0
    bot.on('polling_error', (err) => {
      consecutiveErrors++
      console.error(`[bot] Polling error (${consecutiveErrors}):`, err.message)
      if (consecutiveErrors >= 10) {
        console.warn('[bot] Too many polling errors — pausing 60s before retry')
        bot.stopPolling().catch(() => {})
        consecutiveErrors = 0
        setTimeout(() => {
          console.log('[bot] Restarting polling...')
          bot.startPolling().catch((e) => console.error('[bot] Restart failed:', e.message))
        }, 60000)
      }
    })
    bot.on('message', () => { consecutiveErrors = 0 })
    console.log('[bot] Bot initialized (polling)')
  } else {
    console.log('[bot] Bot initialized (webhook mode)')
    console.log('[bot] Webhook endpoint: POST /bot-webhook')
  }
}

export function processUpdate(update) {
  if (!bot) {
    console.warn('[bot] processUpdate called but bot is null')
    return
  }
  console.log('[bot] Processing update:', update.message?.text || update.callback_query?.data || 'photo/other')
  bot.processUpdate(update)
}

let cachedBotUsername = null

// Used to build the t.me/<bot>?start=link_<code> deep link for Profile's
// "Подключить Telegram" flow — fetched once and cached rather than requiring
// a separate TELEGRAM_BOT_USERNAME env var.
export async function getBotUsername() {
  if (cachedBotUsername) return cachedBotUsername
  if (!bot) return null
  try {
    const me = await bot.getMe()
    cachedBotUsername = me.username
    return cachedBotUsername
  } catch (err) {
    console.error('[bot] getMe failed:', err.message)
    return null
  }
}

export { bot }
export default null
