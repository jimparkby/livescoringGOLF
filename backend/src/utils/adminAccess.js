// Telegram IDs allowed into the web admin panel (backend/src/routes/admin.js
// via middleware/auth.js requireAdmin). Same whitelist historically used by
// the Telegram bot's /admin command, before that flow was superseded by the
// in-app admin panel.
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id))

console.log('[adminAccess] Loaded admin IDs:', ADMIN_IDS.length > 0 ? ADMIN_IDS : 'none')

export function isAdmin(telegramId) {
  return ADMIN_IDS.includes(telegramId)
}
