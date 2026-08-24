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
    <Card className="p-5 shadow-soft space-y-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-action/20 text-action">
          <Trophy className="h-3 w-3" /> Результаты
        </span>
      </div>

      <h3 className="text-xl font-black leading-tight">{data.name}</h3>

      <div className="divide-y divide-border">
        {data.rows.map((r) => (
          <div key={r.place} className="flex items-center gap-3 py-2.5">
            <div
              className="h-9 w-9 rounded-full grid place-items-center text-xs font-bold shrink-0"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
            >
              {initials(r.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">Место {r.place}</div>
            </div>
            <div className="text-lg font-black tabular-nums shrink-0">{r.value}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate(`/tournament-info/${data.tournament.id}`)}
        className="w-full h-10 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        Все результаты
      </button>
    </Card>
  );
};
