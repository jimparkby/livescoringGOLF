import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TOURNAMENTS, isTournamentUpcoming, tournamentStartDate, type Tournament } from "@/lib/tournaments";
import { getTournamentData } from "@/lib/tournament-data";
import { api } from "@/lib/api";

type ResultRow = { place: number; name: string; value: string };
type LatestResults = { tournament: Tournament; name: string; rows: ResultRow[] };

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Most recently completed tournament that has results — checked against the
 *  hand-curated TOURNAMENT_DATA first (older events), falling back to the DB
 *  (`tournament_results`, populated via the admin panel / bot auto-import)
 *  for anything more recent. Mirrors the source-merging TournamentInfo already
 *  does per-tournament, just walking backwards from today to find one. */
async function findLatestResults(): Promise<LatestResults | null> {
  const past = TOURNAMENTS.filter((t) => !isTournamentUpcoming(t)).sort(
    (a, b) => tournamentStartDate(b).getTime() - tournamentStartDate(a).getTime()
  );

  let dbResultIds: Set<string> | null = null;

  for (const t of past) {
    const staticData = getTournamentData(t.id);
    const topGroup = staticData?.groups[0];
    if (topGroup?.results?.length) {
      return {
        tournament: t,
        name: staticData!.name,
        rows: topGroup.results.slice(0, 5).map((r) => ({
          place: r.place,
          name: r.player,
          value: String(r.total ?? r.net ?? r.score ?? r.gross ?? ""),
        })),
      };
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
        return {
          tournament: t,
          name: data.tournament.name,
          rows: group.results.slice(0, 5).map((r) => ({ place: r.place, name: r.player_name, value: String(r.score) })),
        };
      }
    } catch {
      // no results for this one after all — keep walking back
    }
  }

  return null;
}

/** PGA Tour-style "latest leaderboard" summary card for the most recent
 *  completed tournament. */
export const LatestResultsCard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<LatestResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    findLatestResults().then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) return null;

  return (
    <Card className="p-5 shadow-soft space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "#c9a24b" }}>
        <Trophy className="h-3 w-3" /> Результаты
      </div>

      <h3 className="text-xl font-black leading-tight mb-2">{data.name}</h3>

      <div className="divide-y divide-border">
        {data.rows.map((r) => {
          const isLeader = r.place === 1;
          return (
            <div
              key={r.place}
              className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg"
              style={isLeader ? { background: "rgba(201,162,75,0.08)" } : undefined}
            >
              <div className="w-5 text-center font-black tabular-nums text-sm shrink-0" style={{ color: isLeader ? "#c9a24b" : "#93a598" }}>
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
              <div className="text-lg font-black tabular-nums shrink-0">{r.value}</div>
            </div>
          );
        })}
      </div>

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
