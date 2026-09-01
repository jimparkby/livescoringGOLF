import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import cron from 'node-cron'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { runBookingReminders } from './services/bookingReminders.js'
import { runTournamentDayNotifications } from './services/tournamentDayNotifier.js'
import authRouter from './routes/auth.js'
import profileRouter from './routes/profile.js'
import roundsRouter from './routes/rounds.js'
import usersRouter from './routes/users.js'
import scorecardsRouter from './routes/scorecards.js'
import aiRouter from './routes/ai.js'
import statisticsRouter from './routes/statistics.js'
import tournamentsRouter from './routes/tournaments.js'
import predictionsRouter from './routes/predictions.js'
import leaderboardRouter from './routes/leaderboard.js'
import tournamentRegistrationsRouter from './routes/tournament-registrations.js'
import liveRouter from './routes/live.js'
import adminRouter from './routes/admin.js'
import bookingRouter from './routes/booking.js'
import { processUpdate } from './bot.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '10mb' }))

// Telegram webhook — must be before other routes
app.post('/bot-webhook', (req, res) => {
  console.log('[webhook] Received update:', JSON.stringify(req.body).slice(0, 200))
  res.sendStatus(200)
  try {
    processUpdate(req.body)
  } catch (err) {
    console.error('[webhook] Error processing update:', err.message)
  }
})

app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/rounds', roundsRouter)
app.use('/api/users', usersRouter)
app.use('/api/scorecards', scorecardsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/statistics', statisticsRouter)
app.use('/api/tournaments', tournamentsRouter)
app.use('/api/predictions', predictionsRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/tournament-registrations', tournamentRegistrationsRouter)
app.use('/api/live', liveRouter)
app.use('/api/admin', adminRouter)
app.use('/api/booking', bookingRouter)
console.log('[boot] /api/auth, /api/profile, /api/rounds, /api/users, /api/scorecards, /api/ai, /api/statistics, /api/tournaments, /api/predictions, /api/leaderboard, /api/tournament-registrations, /api/live, /api/admin, /api/booking registered')

app.get('/api/ping', (_req, res) => res.json({ ok: true }))

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// Try to find the built frontend in several possible locations
const distCandidates = [
  path.join(__dirname, '../../dist'),               // Docker: /app/dist  (vite outDir: ../dist from frontend/)
  path.join(__dirname, '../../../dist'),             // Nixpacks from /app/backend/src → /app/dist
  path.join(__dirname, '../../../frontend/dist'),   // vite default outDir
  path.join(__dirname, '../../../../dist'),          // one level higher
  path.join(process.cwd(), '../dist'),              // relative to cwd
  path.join(process.cwd(), 'dist'),                 // cwd/dist
]
const distPath = distCandidates.find(p => existsSync(p)) ?? null
console.log('[boot] distPath:', distPath ?? 'NOT FOUND — api-only mode')
if (!distPath) {
  console.log('[boot] Searched:', distCandidates)
}

if (distPath) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
} else {
  app.get('*', (_req, res) => res.json({ status: 'api-only' }))
}

cron.schedule('*/10 * * * *', () => runBookingReminders())
// Once each tournament morning, 7:00 Minsk time — sends each flighted player
// their personal /tlive/:token link (see services/tournamentDayNotifier.js).
cron.schedule('0 7 * * *', () => runTournamentDayNotifications(), { timezone: 'Europe/Minsk' })

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
