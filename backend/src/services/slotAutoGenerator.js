import { db } from '../db.js'
import { DEFAULT_LESSON_PRICE } from '../lib/lessonPricing.js'

// Keeps the booking calendar filled a rolling DAYS_AHEAD out so members
// always see open tee times/trainings without an admin generating each day
// by hand. Matches the club's default tee sheet (08:00-18:00, every 10min,
// 4 players, from the 1st) and default lesson slate (08:00-18:00, every
// 30min, individual lessons) — an admin can still add hole-10 starts,
// on-course sessions, or edit/delete anything this creates from
// Профиль → Admin → Расписание, same as slots created by hand.
//
// Idempotent by design: a date is only touched if it has zero slots of that
// kind yet, so re-running never duplicates rows and never fights an admin's
// edits (including deleting everything for a date to close it — leave it
// alone once it's been touched at all).
const DAYS_AHEAD = 14
const TEE_TIME_DEFAULTS = { startTime: '08:00', endTime: '18:00', intervalMinutes: 10, capacity: 4, startHole: 1, holesCount: 18 }
const TRAINING_DEFAULTS = { startTime: '08:00', endTime: '18:00', intervalMinutes: 30, durationMinutes: 50, trainingType: 'individual' }

function dateKeyDaysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function minutesRange(startTime, endTime, intervalMinutes, durationMinutes) {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  const starts = []
  for (let m = startMinutes; m + durationMinutes <= endMinutes; m += intervalMinutes) {
    starts.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return starts
}

async function generateTeeTimesForDate(dateKey) {
  const { rows: [{ count }] } = await db.query(
    `SELECT COUNT(*) FROM booking_slots WHERE type = 'tee_time' AND date = $1`,
    [dateKey]
  )
  if (Number(count) > 0) return 0

  const { startTime, endTime, intervalMinutes, capacity, startHole, holesCount } = TEE_TIME_DEFAULTS
  let created = 0
  for (const time of minutesRange(startTime, endTime, intervalMinutes, intervalMinutes)) {
    await db.query(
      `INSERT INTO booking_slots (type, date, time, duration_minutes, capacity, start_hole, holes_count)
       VALUES ('tee_time', $1, $2, $3, $4, $5, $6)`,
      [dateKey, time, intervalMinutes, capacity, startHole, holesCount]
    )
    created++
  }
  return created
}

async function generateTrainingsForDate(dateKey) {
  const { rows: trainers } = await db.query(`SELECT id, name, role FROM trainers WHERE active`)
  const { startTime, endTime, intervalMinutes, durationMinutes, trainingType } = TRAINING_DEFAULTS
  let created = 0

  for (const trainer of trainers) {
    const { rows: [{ count }] } = await db.query(
      `SELECT COUNT(*) FROM booking_slots WHERE type = 'training' AND date = $1 AND trainer_id = $2`,
      [dateKey, trainer.id]
    )
    if (Number(count) > 0) continue

    const tier = trainer.role === 'golf_pro' ? 'pro' : 'coach'
    const price = DEFAULT_LESSON_PRICE[trainingType][trainer.role] ?? null
    for (const time of minutesRange(startTime, endTime, intervalMinutes, durationMinutes)) {
      await db.query(
        `INSERT INTO booking_slots (type, date, time, duration_minutes, capacity, trainer_id, trainer_name, training_type, trainer_tier, price_from)
         VALUES ('training', $1, $2, $3, 1, $4, $5, $6, $7, $8)`,
        [dateKey, time, durationMinutes, trainer.id, trainer.name, trainingType, tier, price]
      )
      created++
    }
  }
  return created
}

export async function runSlotAutoGeneration() {
  let teeTimesCreated = 0
  let trainingsCreated = 0
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const dateKey = dateKeyDaysFromNow(i)
    try {
      teeTimesCreated += await generateTeeTimesForDate(dateKey)
      trainingsCreated += await generateTrainingsForDate(dateKey)
    } catch (err) {
      console.error(`[slotAutoGenerator] failed for ${dateKey}:`, err.message)
    }
  }
  if (teeTimesCreated || trainingsCreated) {
    console.log(`[slotAutoGenerator] created ${teeTimesCreated} tee-time slot(s), ${trainingsCreated} training slot(s)`)
  }
}
