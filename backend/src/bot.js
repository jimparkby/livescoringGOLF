import TelegramBot from 'node-telegram-bot-api'
import { createRequire } from 'module'
import https from 'https'
import { db } from './db.js'
import { parseScorecardPhoto } from './services/scoreParser.js'
import { parseTournamentResultsPhoto } from './services/adminPhotoParser.js'
import { matchTournament } from './services/tournamentMatcher.js'
import { ADMIN_IDS } from './utils/adminAccess.js'

const require = createRequire(import.meta.url)

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
  bot.onText(/\/start/, async (msg) => {
    console.log('[bot] /start from', msg.from?.id)
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
            [{ text: '⛳ Открыть GolfMinsk Live', web_app: { url: webAppUrl } }],
          ],
        },
      })
    } catch (err) {
      console.error('[bot] /start sendMessage error:', err.message)
    }
  })

  // Logs the chat id of any group message from a group we haven't wired up
  // yet, so RESULTS_GROUP_CHAT_ID can be read off the Railway logs once the
  // bot is added to the club's results group — no separate lookup bot needed.
  bot.on('message', (msg) => {
    if (msg.chat.type === 'private') return
    if (String(msg.chat.id) === String(process.env.RESULTS_GROUP_CHAT_ID)) return
    console.log('[bot] message from unconfigured group:', msg.chat.id, msg.chat.title)
  })

  // ── Photo: results table posted in the club's results group ────────────────
  async function handleGroupResultsPhoto(msg) {
    try {
      const photo = msg.photo[msg.photo.length - 1]
      const buffer = await downloadTelegramPhoto(bot, photo.file_id)
      if (!buffer) return

      const { results } = await parseTournamentResultsPhoto(buffer)
      // Fewer than 3 rows almost certainly means this wasn't a results table
      // (event photo, flyer, regulations page, etc.) — ignore it silently
      // rather than pinging admins about every unrelated photo in the group.
      if (results.length < 3) return

      const messageDate = new Date(msg.date * 1000)
      const { tournamentId, confidence } = await matchTournament({ caption: msg.caption || null, messageDate })

      const { rows: [pending] } = await db.query(
        `INSERT INTO pending_tournament_results
           (tournament_id, match_confidence, rows, source_chat_id, source_message_id, photo_file_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [tournamentId, confidence, JSON.stringify(results), msg.chat.id, msg.message_id, photo.file_id]
      )

      let tournamentName = 'не определён — выберите вручную'
      if (tournamentId) {
        const { rows: [t] } = await db.query('SELECT name FROM tournaments WHERE id = $1', [tournamentId])
        if (t) tournamentName = t.name
      }

      const text = [
        '📊 Похоже на результаты турнира из группы клуба.',
        `Турнир: <b>${tournamentName}</b>`,
        `Распознано строк: ${results.length}`,
        '',
        'Проверьте и сохраните в панели.',
      ].join('\n')

      for (const adminId of ADMIN_IDS) {
        bot.sendMessage(adminId, text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Проверить и сохранить', url: `${webAppUrl}/admin?pendingResults=${pending.id}` },
            ]],
          },
        }).catch((err) => console.error('[bot] group-results notify failed:', adminId, err.message))
      }
    } catch (err) {
      console.error('[bot] handleGroupResultsPhoto error:', err.message)
    }
  }

  // ── Photo: scorecard processing ───────────────────────────────────────────
  bot.on('photo', async (msg) => {
    if (process.env.RESULTS_GROUP_CHAT_ID && String(msg.chat.id) === String(process.env.RESULTS_GROUP_CHAT_ID)) {
      return handleGroupResultsPhoto(msg)
    }

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
            { text: '✅ Подтвердить счёт', web_app: { url: `${webAppUrl}?confirm=${sc.id}` } },
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

export { bot }
export default null
