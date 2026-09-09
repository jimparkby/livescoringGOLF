// True only when actually opened via the bot's web_app button/menu button —
// undefined initData means a plain browser tab, even at a mobile viewport.
export function isTelegramMiniApp(): boolean {
  try {
    return Boolean(
      (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData
    )
  } catch {
    return false
  }
}
