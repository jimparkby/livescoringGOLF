import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, Users, Search, RefreshCw, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import NominationsCard from "@/components/NominationsCard";

type RankPlayer = { rank: number; name: string; tournaments: number; hcp: number; rating: number };

type TournamentResult = {
  date: string;
  name: string;
  group: string;
  tournament: string;
  gender: string;
  hcp: number;
  grossRank: number;
  grossScore: number;
  netRank: number;
  netScore: number;
};

type LeaderboardData = {
  overall: RankPlayer[];
  male: RankPlayer[];
  female: RankPlayer[];
  tournaments: TournamentResult[];
  stats: {
    totalPlayers: number;
    malePlayers: number;
    femalePlayers: number;
    totalTournaments: number;
    tournamentNames: string[];
  };
  lastUpdated: string;
};

type MainTab = "rating" | "tournaments";
type RatingTab = "overall" | "male" | "female";

// "25.04.2026" -> sortable timestamp
const parseRuDate = (d: string) => {
  const [day, month, year] = d.split(".").map(Number);
  return day && month && year ? new Date(year, month - 1, day).getTime() : 0;
};

const StatisticsPage = () => {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("rating");

  const [ratingTab, setRatingTab] = useState<RatingTab>("overall");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);

  const fetchData = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      const result = force
        ? await api.post<LeaderboardData>("/api/leaderboard/refresh", {})
        : await api.get<LeaderboardData>("/api/leaderboard");
      setData(result);
    } catch (error) {
      console.error("[statistics] Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tournaments ordered by most recent first
  const tournamentsByRecency = useMemo(() => {
    if (!data) return [];
    const latestDate = new Map<string, number>();
    data.tournaments.forEach((r) => {
      const ts = parseRuDate(r.date);
      const cur = latestDate.get(r.tournament) ?? 0;
      if (ts > cur) latestDate.set(r.tournament, ts);
    });
    return [...data.stats.tournamentNames].sort((a, b) => (latestDate.get(b) ?? 0) - (latestDate.get(a) ?? 0));
  }, [data]);

  useEffect(() => {
    if (!selectedTournament && tournamentsByRecency.length > 0) {
      setSelectedTournament(tournamentsByRecency[0]);
    }
  }, [tournamentsByRecency, selectedTournament]);

  const tournamentResults = useMemo(() => {
    if (!data || !selectedTournament) return [];
    const rows = data.tournaments.filter((r) => r.tournament === selectedTournament);
    // Not every event in the sheet tracks net scores (some are gross/Stableford-points
    // only) — fall back to gross rank so the table still sorts meaningfully.
    const hasNet = rows.some((r) => r.netRank > 0);
    const rankOf = (r: TournamentResult) => (hasNet ? r.netRank : r.grossRank) || 999;
    return [...rows].sort((a, b) => rankOf(a) - rankOf(b));
  }, [data, selectedTournament]);

  const tournamentHasNet = tournamentResults.some((r) => r.netRank > 0);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    const players = data[ratingTab];
    if (!searchQuery.trim()) return players;
    const query = searchQuery.toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(query));
  }, [data, ratingTab, searchQuery]);

  const visiblePlayers = showAll || searchQuery ? filteredPlayers : filteredPlayers.slice(0, 20);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Загрузка статистики...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const allPlayers = data[ratingTab];
  const hasMore = filteredPlayers.length > 20;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-semibold">Statistics</div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Статистика 2026</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.stats.totalPlayers} игроков · {data.stats.totalTournaments} турниров
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="h-10 w-10 rounded-full hover:bg-accent grid place-items-center transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* Main tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMainTab("rating")}
          className={cn(
            "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all",
            mainTab === "rating" ? "bg-action text-action-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80",
          )}
        >
          <Trophy className="h-4 w-4" /> Рейтинг
        </button>
        <button
          onClick={() => setMainTab("tournaments")}
          className={cn(
            "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all",
            mainTab === "tournaments" ? "bg-action text-action-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80",
          )}
        >
          <Calendar className="h-4 w-4" /> Турнирный
        </button>
      </div>

      {mainTab === "rating" ? (
        <>
          <Card className="overflow-hidden shadow-soft">
            <div className="p-5 border-b border-border">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg py-3">
                  <div className="text-2xl font-bold">{data.stats.totalPlayers}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Игроков</div>
                </div>
                <div className="bg-muted/50 rounded-lg py-3">
                  <div className="text-2xl font-bold">{data.stats.totalTournaments}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Турниров</div>
                </div>
                <div className="bg-muted/50 rounded-lg py-3">
                  <div className="text-2xl font-bold">{data.tournaments.length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Результатов</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-5 border-b border-border">
              <TabButton active={ratingTab === "overall"} onClick={() => { setRatingTab("overall"); setSearchQuery(""); setShowAll(false); }} icon={<Users className="h-3.5 w-3.5" />} label="Общий" count={data.stats.totalPlayers} />
              <TabButton active={ratingTab === "male"} onClick={() => { setRatingTab("male"); setSearchQuery(""); setShowAll(false); }} label="Мужчины" count={data.stats.malePlayers} />
              <TabButton active={ratingTab === "female"} onClick={() => { setRatingTab("female"); setSearchQuery(""); setShowAll(false); }} label="Женщины" count={data.stats.femalePlayers} />
            </div>

            <div className="px-5 py-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск по имени..." className="pl-10 h-10" />
              </div>
            </div>

            <div className={cn("divide-y divide-border overflow-y-auto", showAll ? "max-h-[70vh]" : "max-h-[50vh]")}>
              {visiblePlayers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{searchQuery ? "Игроки не найдены" : "Нет данных"}</div>
              ) : (
                visiblePlayers.map((player, idx) => (
                  <div key={`${player.name}-${idx}`} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      player.rank === 1 ? "bg-yellow-500/20 text-yellow-600 border-2 border-yellow-500/40"
                        : player.rank === 2 ? "bg-slate-400/20 text-slate-600 border-2 border-slate-400/40"
                        : player.rank === 3 ? "bg-orange-600/20 text-orange-700 border-2 border-orange-600/40"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {player.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.tournaments} турниров • HCP {player.hcp.toFixed(1)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black tabular-nums">{player.rating.toLocaleString()}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">рейтинг</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!searchQuery && hasMore && (
              <button onClick={() => setShowAll(!showAll)} className="w-full py-3 text-sm font-semibold text-action hover:bg-accent/50 transition-colors border-t border-border">
                {showAll ? "Свернуть" : `Показать всех (еще ${filteredPlayers.length - 20})`}
              </button>
            )}

            <div className="px-5 py-3 bg-muted/30 text-xs text-muted-foreground border-t border-border space-y-1">
              <div>Показано: {visiblePlayers.length} из {allPlayers.length}</div>
              <div>Обновлено: {new Date(data.lastUpdated).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </Card>

          <NominationsCard />
        </>
      ) : (
        <Card className="overflow-hidden shadow-soft">
          <div className="p-5 border-b border-border">
            <select
              value={selectedTournament ?? ""}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm font-semibold focus:outline-none focus:border-action"
            >
              {tournamentsByRecency.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2.5 w-14">Место</th>
                  <th className="px-3 py-2.5">Игрок</th>
                  <th className="px-3 py-2.5">Группа</th>
                  <th className="px-3 py-2.5 text-right">HCP</th>
                  <th className="px-3 py-2.5 text-right">Gross</th>
                  <th className="px-3 py-2.5 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tournamentResults.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">Нет данных</td></tr>
                ) : (
                  tournamentResults.map((r, idx) => {
                    const place = (tournamentHasNet ? r.netRank : r.grossRank) || 0;
                    return (
                    <tr key={idx} className={cn(place === 1 && "bg-action/5")}>
                      <td className="px-4 py-2.5 font-bold">
                        {place >= 1 && place <= 3 ? (
                          <span className={cn(
                            "inline-flex items-center justify-center h-6 min-w-6 px-1 rounded-full text-xs font-bold",
                            place === 1 && "bg-yellow-500 text-black",
                            place === 2 && "bg-gray-400 text-white",
                            place === 3 && "bg-orange-600 text-white",
                          )}>
                            {place}
                          </span>
                        ) : (place || "—")}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.group}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.hcp.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.grossScore || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">{r.netScore || "—"}</td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 bg-muted/30 text-xs text-muted-foreground border-t border-border">
            {tournamentResults.length} участников · обновлено {new Date(data.lastUpdated).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </Card>
      )}
    </div>
  );
};

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all",
        active ? "bg-action text-action-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80",
      )}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", active ? "bg-action-foreground/20" : "bg-muted-foreground/20")}>
          {count}
        </span>
      )}
    </button>
  );
}

export default StatisticsPage;
