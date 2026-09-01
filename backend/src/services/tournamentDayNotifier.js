import { db } from '../db.js'
import { bot } from '../bot.js'

const webAppUrl = process.env.FRONTEND_URL || 'https://your-app-url.com'

// Runs once each tournament morning (see cron.schedule in index.js) — finds
// every registration whose flight/marker is already built (round_id +
// access_token set by build-groups) for a tournament happening today, and
// sends the player their personal /tlive/:token scoring link. notified_at
// makes this idempotent: safe to re-run, late sign-ups grouped later that
// day still get picked up on the next tick.
export async function runTournamentDayNotifications() {
  if (!bot) return

  try {
    const { rows } = await db.query(
      `SELECT tr.id AS reg_id, tr.access_token, tr.flight_label, u.telegram_id, t.name AS tournament_name
       FROM tournament_registrations tr
       JOIN tournaments t ON (t.slug = tr.tournament_id OR t.id::text = tr.tournament_id)
       JOIN users u ON u.id = tr.user_id
       WHERE tr.notified_at IS NULL
         AND tr.round_id IS NOT NULL
         AND tr.access_token IS NOT NULL
         AND t.date = (NOW() AT TIME ZONE 'Europe/Minsk')::date`
    )

    for (const row of rows) {
      if (row.telegram_id) {
        try {
          await bot.sendMessage(
            row.telegram_id,
            `⛳ <b>${row.tournament_name}</b> начинается сегодня!\n\n` +
              `Ваша группа: <b>${row.flight_label ?? '—'}</b>\n\n` +
              `Откройте свою карточку счёта — там ваш маркер и вся информация:`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '⛳ Открыть счёт', url: `${webAppUrl}/tlive/${row.access_token}` }]],
              },
            }
          )
        } catch (err) {
          console.error('[tournamentDayNotifier] sendMessage failed:', err.message)
        }
      }
      await db.query('UPDATE tournament_registrations SET notified_at = NOW() WHERE id = $1', [row.reg_id])
    }
  } catch (err) {
    console.error('[tournamentDayNotifier] job failed:', err.message)
  }
}
