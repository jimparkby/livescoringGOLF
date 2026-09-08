import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TOURNAMENTS, isTournamentUpcoming, tournamentStartDate, type Tournament } from "@/lib/tournaments";
import { getTournamentData } from "@/lib/tournament-data";
import { api } from "@/lib/api";

type ResultRow = { place: number; name: string; value: string };
type LatestResults = { tournament: Tournament; name: string; rows: ResultRow[] };

const ROTATE_MS = 6000;
const MAX_TOURNAMENTS = 8;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Every past tournament that has results, newest first — checked against the
 *  hand-curated TOURNAMENT_DATA first (older events), falling back to the DB
 *  (`tournament_results`, populated via the admin panel / bot auto-import)
 *  for anything more recent. Mirrors the source-merging TournamentInfo already
 *  does per-tournament, just collecting every match instead of stopping at
 *  the first one. */
async function findAllResults(): Promise<LatestResults[]> {
  const past = TOURNAMENTS.filter((t) => !isTournamentUpcoming(t)).sort(
    (a, b) => tournamentStartDate(b).getTime() - tournamentStartDate(a).getTime()
  );

  let dbResultIds: Set<string> | null = null;
  const found: LatestResults[] = [];

  for (const t of past) {
    if (found.length >= MAX_TOURNAMENTS) break;

    const staticData = getTournamentData(t.id);
    const topGroup = staticData?.groups[0];
    if (topGroup?.results?.length) {
      found.push({
        tournament: t,
        name: staticData!.name,
        rows: topGroup.results.slice(0, 5).map((r) => ({
          place: r.place,
          name: r.player,
          value: String(r.total ?? r.net ?? r.score ?? r.gross ?? ""),
        })),
      });
      continue;
    }

    if (dbResultIds === null) {
      dbResultIds = await api
        .get<{ tournaments: string[] }>("/api/tournaments/list/with-results")
        .then((data) => new Set(data.tournaments))
        .catch(() => new Set<string>());
    }
    if (!dbResultIds.has(t.id)) continue;

    try {
      const data = await api.get<{
        tournament: { name: string };
        groups: { name: string; results: { place: number; player_name: string; score: number }[] }[];
      }>(`/api/tournaments/${t.id}/results`);
      const group = data.groups[0];
      if (group?.results?.length) {
        found.push({
          tournament: t,
          name: data.tournament.name,
          rows: group.results.slice(0, 5).map((r) => ({ place: r.place, name: r.player_name, value: String(r.score) })),
        });
      }
    } catch {
      // no results for this one after all — keep walking back
    }
  }

  return found;
}

/** PGA Tour-style "latest leaderboard" card. Rotates through every past
 *  tournament that has results (auto-advance + manual arrows/dots) so the
 *  winners on display actually change instead of freezing on whichever
 *  event happens to be the most recent with data. */
export const LatestResultsCard = () => {
  const navigate = useNavigate();
  const [all, setAll] = useState<LatestResults[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    findAllResults().then((results) => {
      if (!cancelled) {
        setAll(results);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (all.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % all.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [all.length]);

  if (loading || all.length === 0) return null;

  const data = all[index];

  return (
    <Card className="p-5 shadow-soft space-y-1">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "#c9a24b" }}>
          <Trophy className="h-3 w-3" /> Результаты
        </div>
        {all.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Предыдущий турнир"
              onClick={() => setIndex((i) => (i - 1 + all.length) % all.length)}
              className="h-6 w-6 grid place-items-center rounded-full hover:bg-accent/50"
            >
              <ChevronLeft className="h-3.5 w-3.5" style={{ color: "#93a598" }} />
            </button>
            <button
              type="button"
              aria-label="Следующий турнир"
              onClick={() => setIndex((i) => (i + 1) % all.length)}
              className="h-6 w-6 grid place-items-center rounded-full hover:bg-accent/50"
            >
              <ChevronRight className="h-3.5 w-3.5" style={{ color: "#93a598" }} />
            </button>
          </div>
        )}
      </div>

      <h3 key={`${data.tournament.id}-name`} className="font-display text-xl font-semibold leading-tight mb-2 animate-in fade-in duration-300">
        {data.name}
      </h3>

      <div key={`${data.tournament.id}-rows`} className="divide-y divide-border animate-in fade-in duration-300">
        {data.rows.map((r) => {
          const isLeader = r.place === 1;
          return (
            <div
              key={r.place}
              className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg"
              style={isLeader ? { background: "rgba(201,162,75,0.1)" } : undefined}
            >
              <div className="font-display w-5 text-center font-bold tabular-nums text-sm shrink-0" style={{ color: isLeader ? "#c9a24b" : "#93a598" }}>
                {r.place}
              </div>
              <div
                className="h-9 w-9 rounded-full grid place-items-center text-xs font-bold shrink-0"
                style={isLeader ? { background: "#15361f", color: "#fff" } : { background: "#eef1ec", color: "#15361f" }}
              >
                {initials(r.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{r.name}</div>
              </div>
              <div className="font-display text-lg font-bold tabular-nums shrink-0">{r.value}</div>
            </div>
          );
        })}
      </div>

      {all.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {all.map((t, i) => (
            <button
              key={t.tournament.id}
              type="button"
              aria-label={t.name}
              onClick={() => setIndex(i)}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === index ? 16 : 6, background: i === index ? "#c9a24b" : "#dfe4de" }}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => navigate(`/tournament-info/${data.tournament.id}`)}
        className="w-full h-11 text-sm font-bold border-t border-border mt-2 pt-3"
        style={{ color: "#2c6b3d" }}
      >
        Все результаты →
      </button>
    </Card>
  );
};
