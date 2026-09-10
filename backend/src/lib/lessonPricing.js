// Matches the club's published lesson pricing: golf pros charge more than
// coaches, and a full on-course playthrough more than a range lesson.
// Shared by the admin single/bulk training endpoints (routes/admin.js) and
// the nightly auto-generator (services/slotAutoGenerator.js) so both default
// a slot's price the same way.
export const DEFAULT_LESSON_PRICE = {
  individual: { trainer: 145, golf_pro: 175 },
  on_course: { trainer: 260, golf_pro: 310 },
}
