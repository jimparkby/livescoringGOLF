import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { bot } from '../bot.js'

const router = Router()
router.use(requireAuth)

const TYPES = ['tee_time', 'training']
const TYPE_LABEL = { tee_time: 'Ти-тайм', training: 'Тренировка' }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidType(type) {
  return TYPES.includes(type)
}

// Same shape as the GET /slots row mapping below, so callers can merge this
// straight into frontend state without a follow-up fetch.
async function loadSlot(slotId, requesterId) {
  const { rows: [s] } = await db.query(
    `SELECT s.id, s.type, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.time, 'HH24:MI') AS time,
            s.duration_minutes, s.capacity, s.trainer_name, s.notes,
            s.start_hole, s.holes_count, s.training_type, s.trainer_tier, s.price_from,
            COALESCE(SUM(b.players_count), 0) AS booked,
            BOOL_OR(b.user_id = $2) AS booked_by_me
     FROM booking_slots s
     LEFT JOIN slot_bookings b ON b.slot_id = s.id
     WHERE s.id = $1
     GROUP BY s.id`,
    [slotId, requesterId]
  )
  if (!s) return null
  return {
    id: s.id,
    type: s.type,
    date: s.date,
    time: s.time,
    durationMinutes: s.duration_minutes,
    capacity: s.capacity,
    trainerName: s.trainer_name,
    notes: s.notes,
    startHole: s.start_hole,
    holesCount: s.holes_count,
    trainingType: s.training_type,
    trainerTier: s.trainer_tier,
    priceFrom: s.price_from,
    available: Math.max(0, s.capacity - Number(s.booked)),
    bookedByMe: s.booked_by_me,
  }
}

// ── GET /api/booking/slots?type=&date= ──────────────────────────────────────

router.get('/slots', async (req, res, next) => {
  try {
    const { type, date } = req.query
    if (!isValidType(type) || !DATE_RE.test(date || '')) {
      return res.status(400).json({ error: 'type and date (YYYY-MM-DD) required' })
    }

    const { rows: slots } = await db.query(
      `SELECT s.id, s.type, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.time, 'HH24:MI') AS time,
              s.duration_minutes, s.capacity, s.trainer_name, s.notes,
              s.start_hole, s.holes_count, s.training_type, s.trainer_tier, s.price_from,
              COALESCE(SUM(b.players_count), 0) AS booked,
              BOOL_OR(b.user_id = $3) AS booked_by_me
       FROM booking_slots s
       LEFT JOIN slot_bookings b ON b.slot_id = s.id
       WHERE s.type = $1 AND s.date = $2
       GROUP BY s.id
       ORDER BY s.time ASC`,
      [type, date, req.user.userId]
    )

    res.json(slots.map((s) => ({
      id: s.id,
      type: s.type,
      date: s.date,
      time: s.time,
      durationMinutes: s.duration_minutes,
      capacity: s.capacity,
      trainerName: s.trainer_name,
      notes: s.notes,
      startHole: s.start_hole,
      holesCount: s.holes_count,
      trainingType: s.training_type,
      trainerTier: s.trainer_tier,
      priceFrom: s.price_from,
      available: Math.max(0, s.capacity - Number(s.booked)),
      bookedByMe: s.booked_by_me,
    })))
  } catch (err) { next(err) }
})

// ── POST /api/booking/slots/:id/book ────────────────────────────────────────

router.post('/slots/:id/book', async (req, res, next) => {
  const slotId = parseInt(req.params.id, 10)
  const playersCount = Math.min(4, Math.max(1, parseInt(req.body.playersCount, 10) || 1))

  try {
    await db.query('BEGIN')

    const { rows: [slot] } = await db.query(
      `SELECT id, type, to_char(date, 'YYYY-MM-DD') AS date, to_char(time, 'HH24:MI') AS time,
              capacity, trainer_name
       FROM booking_slots WHERE id = $1 FOR UPDATE`,
      [slotId]
    )
    if (!slot) {
      await db.query('ROLLBACK')
      return res.status(404).json({ error: 'Slot not found' })
    }

    const { rows: [existing] } = await db.query(
      'SELECT id FROM slot_bookings WHERE slot_id = $1 AND user_id = $2',
      [slotId, req.user.userId]
    )
    if (existing) {
      await db.query('ROLLBACK')
      return res.status(400).json({ error: 'Already booked' })
    }

    const effectivePlayers = slot.type === 'training' ? 1 : playersCount
    const { rows: [{ booked }] } = await db.query(
      'SELECT COALESCE(SUM(players_count), 0) AS booked FROM slot_bookings WHERE slot_id = $1',
      [slotId]
    )
    if (Number(booked) + effectivePlayers > slot.capacity) {
      await db.query('ROLLBACK')
      return res.status(400).json({ error: 'Not enough spots available' })
    }

    const { rows: [booking] } = await db.query(
      'INSERT INTO slot_bookings (slot_id, user_id, players_count) VALUES ($1, $2, $3) RETURNING id',
      [slotId, req.user.userId, effectivePlayers]
    )

    await db.query('COMMIT')

    const { rows: [user] } = await db.query('SELECT telegram_id FROM users WHERE id = $1', [req.user.userId])
    if (bot && user?.telegram_id) {
      const label = TYPE_LABEL[slot.type]
      const trainerLine = slot.trainer_name ? `\n👤 Тренер: ${slot.trainer_name}` : ''
      const dateLabel = new Date(`${slot.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      bot.sendMessage(
        user.telegram_id,
        `✅ <b>${label} забронирован</b>\n\n📅 ${dateLabel} в ${slot.time}${trainerLine}`,
        { parse_mode: 'HTML' }
      ).catch((err) => console.error('[booking] confirmation sendMessage failed:', err.message))
    }

    const updated = await loadSlot(slotId, req.user.userId)
    res.json({ ...updated, bookingId: booking.id, playersCount: effectivePlayers })
  } catch (err) {
    await db.query('ROLLBACK')
    next(err)
  }
})

// ── DELETE /api/booking/bookings/:id ─────────────────────────────────────────

router.delete('/bookings/:id', async (req, res, next) => {
  try {
    const { rows: [deleted] } = await db.query(
      'DELETE FROM slot_bookings WHERE id = $1 AND user_id = $2 RETURNING slot_id',
      [req.params.id, req.user.userId]
    )
    if (!deleted) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── GET /api/booking/my ───────────────────────────────────────────────────────

router.get('/my', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT b.id AS booking_id, b.players_count,
              s.id AS slot_id, s.type, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.time, 'HH24:MI') AS time,
              s.duration_minutes, s.trainer_name, s.notes
       FROM slot_bookings b
       JOIN booking_slots s ON s.id = b.slot_id
       WHERE b.user_id = $1 AND (s.date + s.time) >= NOW() - INTERVAL '2 hours'
       ORDER BY s.date ASC, s.time ASC`,
      [req.user.userId]
    )
    res.json(rows.map((r) => ({
      bookingId: r.booking_id,
      playersCount: r.players_count,
      slotId: r.slot_id,
      type: r.type,
      date: r.date,
      time: r.time,
      durationMinutes: r.duration_minutes,
      trainerName: r.trainer_name,
      notes: r.notes,
    })))
  } catch (err) { next(err) }
})

export default router
