import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { TOURNAMENTS, TIER_LABELS, isTournamentUpcoming, tournamentStartDate, type Tournament } from "@/lib/tournaments";
import { COURSES } from "@/lib/courses";
import { api } from "@/lib/api";

const TIER_GLOW: Record<Tournament["tier"], string> = {
  gold: "#eab308",
  platinum: "#a8a29e",
  diamond: "#60a5fa",
  closed: "#2dd4bf",
};

function findNextTournament(): Tournament | null {
  const upcoming = TOURNAMENTS
    .filter(isTournamentUpcoming)
    .sort((a, b) => tournamentStartDate(a).getTime() - tournamentStartDate(b).getTime());
  return upcoming[0] ?? null;
}

/** PGA Tour-style promo banner for the next tournament on the calendar — the
 *  entry point into the existing registration flow on TournamentInfo. */
export const NextTournamentHero = () => {
  const navigate = useNavigate();
  const tournament = findNextTournament();
  const [registered, setRegistered] = useState<number | null>(null);

  useEffect(() => {
    if (!tournament) return;
    api
      .get<unknown[]>(`/api/tournament-registrations/${tournament.id}`)
      .then((rows) => setRegistered(rows.length))
      .catch(() => setRegistered(null));
  }, [tournament?.id]);

  if (!tournament) return null;

  const course = COURSES.find((c) => c.id === tournament.courseId);
  const daysUntil = Math.max(
    0,
    Math.ceil((tournamentStartDate(tournament).getTime() - Date.now()) / 86_400_000)
  );
  const glow = TIER_GLOW[tournament.tier];

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #161616 100%)", border: `1px solid ${glow}33` }}
    >
      <div
        className="absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: glow }}
      />

      <div className="relative space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest"
            style={{ background: glow, color: "#000" }}
          >
            {daysUntil === 0 ? "Сегодня" : daysUntil === 1 ? "Завтра" : `Через ${daysUntil} дн.`}
          </span>
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: glow }}>
            {TIER_LABELS[tournament.tier]}
          </span>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-semibold mb-1">
            Следующий турнир
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{tournament.name}</h2>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/60">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {tournament.date} {tournament.month} · {tournament.day}
          </span>
          {course && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {course.name}
            </span>
          )}
          {!!registered && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {registered} записал{registered === 1 ? "ся" : "ись"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => navigate(`/tournament-info/${tournament.id}`)}
            className="inline-flex items-center gap-1.5 h-11 px-5 rounded-xl font-bold text-sm"
            style={{ background: "#22c55e", color: "#000" }}
          >
            Записаться <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => navigate(`/tournament-info/${tournament.id}`)}
            className="inline-flex items-center h-11 px-5 rounded-xl font-bold text-sm text-white/80 border border-white/15 hover:bg-white/5 transition-colors"
          >
            Подробнее
          </button>
        </div>
      </div>
    </div>
  );
};
