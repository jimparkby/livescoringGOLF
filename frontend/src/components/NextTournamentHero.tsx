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
      className="relative p-6 sm:p-8 rounded-2xl overflow-hidden"
      style={{ background: "#15361f", border: "1px solid #c9a24b" }}
    >
      <div className="relative space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="gm-eyebrow inline-flex items-center px-2.5 py-1 rounded-full" style={{ color: "#e9d9ad", border: "1px solid rgba(201,162,75,0.55)" }}>
            {daysUntil === 0 ? "Сегодня" : daysUntil === 1 ? "Завтра" : `Через ${daysUntil} дн.`}
          </span>
          <span className="gm-eyebrow inline-flex items-center px-2.5 py-1 rounded-full" style={{ color: "#15361f", background: glow }}>
            {TIER_LABELS[tournament.tier]}
          </span>
        </div>

        <div>
          <div className="gm-eyebrow mb-1" style={{ color: "#9fb6a3" }}>
            Следующий турнир
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white leading-tight">{tournament.name}</h2>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm" style={{ color: "#c8d3c9" }}>
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

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            onClick={() => navigate(`/tournament-info/${tournament.id}`)}
            className="inline-flex items-center gap-1.5 h-11 px-5 text-sm font-bold tracking-wide rounded-xl"
            style={{ background: "#c9a24b", color: "#15361f" }}
          >
            Записаться <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => navigate(`/tournament-info/${tournament.id}`)}
            className="inline-flex items-center h-11 px-5 text-sm font-bold tracking-wide text-white hover:bg-white/5 transition-colors rounded-xl"
            style={{ border: "1px solid rgba(201,162,75,0.55)" }}
          >
            Подробнее
          </button>
        </div>
      </div>
    </div>
  );
};
