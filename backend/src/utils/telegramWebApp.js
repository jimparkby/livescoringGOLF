import crypto from 'crypto'

// Validates the initData string the Telegram Mini App bridge exposes as
// window.Telegram.WebApp.initData, per Telegram's documented check:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Returns the embedded Telegram user, or null if the signature is missing,
// wrong, or older than a day (replay protection).
export function verifyTelegramWebAppInitData(initData, botToken) {
  if (!initData || !botToken) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (computedHash !== hash) return null

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null

  try {
    return JSON.parse(params.get('user') || 'null')
  } catch {
    return null
  }
}
