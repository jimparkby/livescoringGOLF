import { Fragment, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { TOURNAMENTS } from "@/lib/tournaments";
import { COURSES } from "@/lib/courses";
import type { Round } from "@/store/golfStore";
import { computeTournamentLeaderboard, type FlightGroup } from "@/lib/tournamentLiveScoring";
import { cn } from "@/lib/utils";

const REFRESH_MS = 15000;

const placeOf = (pos: string) => parseInt(pos.replace("T", ""), 10);

const PublicLeaderboardPage = () => {
  const { id } = useParams<{ id: string }>();
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const tournament = TOURNAMENTS.find((t) => t.id === id);
  const course = tournament ? COURSES.find((c) => c.id === tournament.courseId) : undefined;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = () => {
      api
        .get<Round[]>(`/api/tournaments/${id}/rounds`)
        .then((data) => {
          if (cancelled) return;
          setRounds(data);
          setUpdatedAt(new Date());
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id]);

  if (!tournament) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6 text-center">
        <div>
          <div className="text-4xl mb-3">⛳</div>
          <div className="font-bold">Турнир не найден</div>
        </div>
      </div>
    );
  }

  const flights: FlightGroup[] = rounds ? computeTournamentLeaderboard(rounds, tournament.id, tournament.format) : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-semibold">
              Golf Club Minsk · Leaderboard
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">{tournament.name}</h1>
            <div className="text-sm text-muted-foreground mt-0.5">
              {course?.name} Course · {tournament.date} {tournament.month}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-action">
              <span className="h-1.5 w-1.5 rounded-full bg-action animate-pulse" />
              LIVE
            </span>
            {updatedAt && (
              <span className="text-[11px] text-muted-foreground">
                Обновлено {updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {rounds === null ? (
          <div className="py-16 text-center text-muted-foreground text-sm">Загрузка...</div>
        ) : flights.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">⛳</div>
            <div className="font-semibold mb-1">Live-scoring ещё не начался</div>
            <div className="text-sm text-muted-foreground">
              Таблица появится, как только участники начнут вводить счёт
            </div>
          </div>
        ) : (
          flights.map((flight) => (
            <section key={flight.key} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 sm:px-5 py-3 bg-muted/50 border-b border-border">
                <div className="font-bold text-sm">{flight.label}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="px-4 sm:px-5 py-2.5 w-14">Pos</th>
                      <th className="px-3 py-2.5">Player</th>
                      <th className="px-3 py-2.5 text-right w-20">Pts</th>
                      <th className="px-3 py-2.5 text-right w-16">Thru</th>
                      <th className="px-3 py-2.5 text-right w-20">Today</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {flight.entries.map((e) => {
                      const place = placeOf(e.pos);
                      const rowKey = `${flight.key}:${e.key}`;
                      const isOpen = !!expanded[rowKey];
                      const canExpand = e.todayHoles.length > 0;
                      return (
                        <Fragment key={rowKey}>
                          <tr
                            className={cn(place === 1 && "bg-action/5", canExpand && "cursor-pointer")}
                            onClick={() => canExpand && setExpanded((p) => ({ ...p, [rowKey]: !p[rowKey] }))}
                          >
                            <td className="px-4 sm:px-5 py-3 font-bold">
                              {place <= 3 ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center h-6 min-w-6 px-1 rounded-full text-xs font-bold",
                                    place === 1 && "bg-yellow-500 text-black",
                                    place === 2 && "bg-gray-400 text-white",
                                    place === 3 && "bg-orange-600 text-white",
                                  )}
                                >
                                  {e.pos}
                                </span>
                              ) : (
                                e.pos
                              )}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {e.name}
                                {canExpand && (isOpen ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ))}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-bold tabular-nums">{e.totalPoints}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                              {e.thru > 0 ? `${e.thru}${!e.todayCompleted && e.thru < e.totalHoles ? "*" : ""}` : "—"}
                            </td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums">{e.todayPoints}</td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={5} className="px-4 sm:px-5 pb-4 pt-0">
                                <div className="flex gap-3 overflow-x-auto pt-1">
                                  {e.todayHoles.map((h) => (
                                    <div key={h.hole} className="flex flex-col items-center shrink-0 w-7">
                                      <div className="text-[9px] text-muted-foreground leading-none">{h.hole}</div>
                                      <div
                                        className={cn(
                                          "text-xs font-bold tabular-nums leading-none mt-1",
                                          h.score === null && "text-muted-foreground/40 font-normal",
                                        )}
                                      >
                                        {h.score ?? "–"}
                                      </div>
                                      <div
                                        className={cn("h-1 w-1 rounded-full mt-1", h.strokes > 0 ? "bg-action" : "bg-transparent")}
                                        title={h.strokes > 0 ? `Фора: ${h.strokes} удар(а)` : undefined}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}

        <div className="text-center text-xs text-muted-foreground pt-2">
          <Link to="/" className="underline underline-offset-2">Golf Club Minsk</Link> · обновляется автоматически каждые 15 сек
        </div>
      </main>
    </div>
  );
};

export default PublicLeaderboardPage;
