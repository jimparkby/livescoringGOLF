import { Fragment, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Round } from "@/store/golfStore";
import type { FormatId } from "@/lib/formats";
import { computeTournamentLeaderboard } from "@/lib/tournamentLiveScoring";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

const parSign = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
const placeOf = (pos: string) => parseInt(pos.replace("T", ""), 10);

export const TournamentLiveLeaderboard = ({
  tournamentId,
  format,
}: {
  tournamentId: string;
  format: FormatId;
}) => {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get<Round[]>(`/api/tournaments/${tournamentId}/rounds`)
        .then((data) => { if (!cancelled) setRounds(data); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [tournamentId]);

  if (rounds === null) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Загрузка...</div>;
  }

  const isStableford = format === "stableford";
  const flights = computeTournamentLeaderboard(rounds, tournamentId, format);

  if (flights.length === 0) {
    return (
      <Card className="p-6 text-center shadow-none">
        <div className="text-4xl mb-3">⛳</div>
        <div className="text-sm font-semibold text-foreground mb-1">Live-scoring ещё не начался</div>
        <div className="text-xs text-muted-foreground">
          Здесь появится турнирная таблица, как только участники начнут вводить счёт
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {flights.map((flight) => (
        <Card key={flight.key} className="overflow-hidden shadow-none">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <div className="font-display font-semibold text-sm text-foreground">{flight.label}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 gm-eyebrow w-12">Pos</th>
                  <th className="text-left px-3 py-2 gm-eyebrow">Игрок</th>
                  <th className="text-right px-3 py-2 gm-eyebrow w-20">
                    {isStableford ? "Total Pts" : "Net"}
                  </th>
                  <th className="text-right px-3 py-2 gm-eyebrow w-16">Thru</th>
                  <th className="text-right px-3 py-2 gm-eyebrow w-20">
                    {isStableford ? "Today Pts" : "Today"}
                  </th>
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
                        className={cn(place <= 3 && "bg-action/5", e.isMe && "bg-action/10", canExpand && "cursor-pointer")}
                        onClick={() => canExpand && setExpanded((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                      >
                        <td className="px-3 py-2.5 font-bold text-foreground">
                          {place <= 3 ? (
                            <span
                              className={cn(
                                "inline-flex items-center justify-center h-6 min-w-6 px-1 rounded-full text-xs font-bold",
                                place === 1 && "bg-yellow-500 text-black",
                                place === 2 && "bg-gray-400 text-white",
                                place === 3 && "bg-orange-600 text-white"
                              )}
                            >
                              {e.pos}
                            </span>
                          ) : (
                            e.pos
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-foreground font-medium truncate max-w-[140px]">
                          <span className="inline-flex items-center gap-1">
                            {e.name}
                            {e.isMe && <span className="text-action">•</span>}
                            {canExpand && (isOpen ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ))}
                          </span>
                        </td>
                        <td className="font-display px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                          {isStableford ? e.totalPoints : parSign(e.totalNetVsPar)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                          {e.thru > 0 ? `${e.thru}${!e.todayCompleted && e.thru < e.totalHoles ? "*" : ""}` : "—"}
                        </td>
                        <td className="font-display px-3 py-2.5 text-right font-semibold text-foreground tabular-nums">
                          {isStableford ? e.todayPoints : parSign(e.todayNetVsPar)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className={cn(e.isMe && "bg-action/10")}>
                          <td colSpan={5} className="px-3 pb-3 pt-0">
                            <div className="flex gap-2.5 overflow-x-auto pt-1">
                              {e.todayHoles.map((h) => (
                                <div key={h.hole} className="flex flex-col items-center shrink-0 w-7">
                                  <div className="text-[9px] text-muted-foreground leading-none">{h.hole}</div>
                                  <div
                                    className={cn(
                                      "text-xs font-bold tabular-nums leading-none mt-1",
                                      h.score === null && "text-muted-foreground/40 font-normal"
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
                            <div className="text-[10px] text-muted-foreground mt-1">
                              • — лунка с форой (гандикап-удар)
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
        </Card>
      ))}
    </div>
  );
};
