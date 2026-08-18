import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Avatar } from "@/components/PlayerAvatar";
import { TournamentLeaderboard } from "@/components/TournamentLeaderboard";
import { COURSES } from "@/lib/courses";
import { getFormat, stablefordPoints, type FormatId } from "@/lib/formats";
import { api } from "@/lib/api";
import type { Round, Player } from "@/store/golfStore";
import { Plus, X, Trophy, Flag, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { HoleGridNav } from "@/components/HoleGridNav";

const scoreLabel = (score: number, par: number) => {
  const d = score - par;
  if (d <= -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  return `+${d}`;
};
const scoreLabelColor = (score: number, par: number) => {
  const d = score - par;
  if (d <= -2) return "text-yellow-400";
  if (d === -1) return "text-action";
  if (d === 0) return "text-primary-foreground";
  if (d === 1) return "text-orange-400";
  return "text-red-400";
};

const LiveScoringPage = () => {
  const { code } = useParams<{ code: string }>();
  const [round, setRound] = useState<Round | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<"scoring" | "leaderboard">("scoring");
  const [holeIdx, setHoleIdx] = useState(0);
  const [sheetPlayer, setSheetPlayer] = useState<Player | null>(null);
  const [sheetTeamMembers, setSheetTeamMembers] = useState<Player[]>([]);
  const [hole, setHole] = useState({ score: 4, putts: 2, madeBy: undefined as string | undefined });
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHcp, setNewHcp] = useState("18");

  const load = () => {
    if (!code) return;
    api
      .get<Round>(`/api/live/${code}`)
      .then(setRound)
      .catch(() => setNotFound(true));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (notFound) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ background: "#0a0a0a" }}>
        <div className="text-4xl mb-2">⛳</div>
        <div className="text-white font-bold text-lg">Ссылка недействительна</div>
        <div className="text-white/40 text-sm">Раунд не найден или QR устарел</div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="h-8 w-8 rounded-full border-2 border-action border-t-transparent animate-spin" />
      </div>
    );
  }

  const course = COURSES.find((c) => c.id === round.courseId);
  const format: FormatId = round.format ?? "stroke_play";
  const isScramble = format === "scramble";
  const isStableford = format === "stableford";
  const fmt = getFormat(format);

  if (!course) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6 text-center text-white/50" style={{ background: "#0a0a0a" }}>
        Поле не найдено
      </div>
    );
  }

  const _mode = round.holesMode ?? "18";
  const playHoles = _mode === "front9"
    ? course.holes.filter((h) => h.number <= 9)
    : _mode === "back9"
    ? course.holes.filter((h) => h.number > 9)
    : course.holes;
  const currentHole = playHoles[holeIdx];
  const totalHoles = playHoles.length;

  const teams = round.teams;
  const teamAIds = teams?.[0] ?? [];
  const teamBIds = teams?.[1] ?? [];
  const teamAPlayers = round.players.filter((p) => teamAIds.includes(p.id));
  const teamBPlayers = round.players.filter((p) => teamBIds.includes(p.id));

  const scoringPlayers = isScramble
    ? [teamAPlayers[0], teamBPlayers[0]].filter(Boolean)
    : round.players;

  const totalVsPar = (p: Player) => {
    const played = round.scores[p.id] ?? [];
    return played.reduce((a, s) => {
      const h = course.holes.find((h) => h.number === s.hole);
      return a + (s.score - (h?.par ?? 0));
    }, 0);
  };
  const totalPoints = (p: Player) =>
    (round.scores[p.id] ?? []).reduce((a, s) => {
      const h = course.holes.find((h) => h.number === s.hole);
      return a + stablefordPoints(s.score, h?.par ?? 4);
    }, 0);
  const parSign = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
  const parColor = (v: number) => (v < 0 ? "#22c55e" : v === 0 ? "rgba(255,255,255,0.9)" : "#f87171");

  const openSheet = (p: Player, teamMembers: Player[] = []) => {
    const existing = round.scores[p.id]?.find((x) => x.hole === currentHole.number);
    setHole({
      score: existing?.score ?? currentHole.par,
      putts: existing?.putts ?? 2,
      madeBy: existing?.madeBy ?? teamMembers[0]?.id,
    });
    setSheetPlayer(p);
    setSheetTeamMembers(teamMembers);
  };

  const submit = async () => {
    if (!sheetPlayer || !code) return;
    try {
      const updated = await api.post<Round>(`/api/live/${code}/score`, {
        playerId: sheetPlayer.id,
        hole: currentHole.number,
        score: hole.score,
        putts: hole.putts,
        madeBy: isScramble ? hole.madeBy : undefined,
      });
      setRound(updated);
    } catch {
      toast.error("Не удалось сохранить счёт");
    }
    setSheetPlayer(null);
    setSheetTeamMembers([]);
  };

  const addPlayer = async () => {
    if (!newName.trim() || !code) return;
    try {
      const updated = await api.post<Round>(`/api/live/${code}/players`, {
        name: newName.trim(),
        hcp: Number(newHcp) || 0,
      });
      setRound(updated);
      setShowAddPlayer(false);
      setNewName("");
      setNewHcp("18");
    } catch {
      toast.error("Не удалось добавить игрока");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(var(--tg-safe-top) + 16px)", paddingBottom: 10 }}>
        <div className="flex items-center gap-1.5 text-white/60 text-xs font-semibold">
          <span>{fmt.emoji}</span> {fmt.name}
        </div>
        <div className="text-white/30 text-xs">{course.name} · {course.club}</div>
        <button onClick={() => setShowAddPlayer(true)} className="h-9 w-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,0.1)" }} title="Добавить игрока">
          <UserPlus className="h-4 w-4 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {round.completed && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-xl text-xs text-center" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
          Раунд завершён — счёт доступен только для просмотра
        </div>
      )}

      {view === "scoring" && (
        <div className="px-5 pb-3">
          <HoleGridNav
            holes={playHoles.map((h) => h.number)}
            currentHole={currentHole.number}
            playedHoles={new Set(playHoles.filter((h) => scoringPlayers.some((p) => p && round.scores[p.id]?.some((s) => s.hole === h.number))).map((h) => h.number))}
            onSelect={(h) => setHoleIdx(playHoles.findIndex((x) => x.number === h))}
          />
        </div>
      )}

      {/* Content */}
      {view === "leaderboard" ? (
        <div className="flex-1 overflow-y-auto">
          <TournamentLeaderboard activeRound={round} course={course} format={format} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-5 pb-4 gap-3 overflow-y-auto">
          {isScramble ? (
            [
              { captain: teamAPlayers[0], members: teamAPlayers, label: "Team A" },
              { captain: teamBPlayers[0], members: teamBPlayers, label: "Team B" },
            ].filter((t) => t.captain).map(({ captain, members, label }) => {
              const has = round.scores[captain.id]?.find((x) => x.hole === currentHole.number);
              const madeByPlayer = has?.madeBy ? members.find((p) => p.id === has.madeBy) : null;
              const tp = totalVsPar(captain);
              return (
                <button
                  key={captain.id}
                  onClick={() => openSheet(captain, members)}
                  className="w-full rounded-2xl p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform"
                  style={{ background: "#1a1a1a" }}
                >
                  <div className="text-left min-w-0">
                    <div className="text-white font-bold text-sm">{label}</div>
                    <div className="text-white/50 text-xs mt-0.5">
                      {members.map((p) => p.name.split(" ")[0]).join(" & ")}
                    </div>
                    <div className="text-white/40 text-xs mt-0.5" style={{ color: parColor(tp) }}>{parSign(tp)}</div>
                  </div>
                  <div className="min-w-[72px] h-16 rounded-xl flex flex-col items-center justify-center gap-0.5"
                    style={has
                      ? { background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e" }
                      : { background: "rgba(255,255,255,0.07)", border: "2px solid rgba(255,255,255,0.1)" }
                    }
                  >
                    {has ? (
                      <>
                        <div className="text-white font-black text-2xl tabular-nums leading-none">{has.score}</div>
                        <div className={cn("text-[10px] font-bold", scoreLabelColor(has.score, currentHole.par))}>
                          {scoreLabel(has.score, currentHole.par)}
                        </div>
                        {madeByPlayer && (
                          <div className="text-[9px] text-white/40 leading-none">{madeByPlayer.name.split(" ")[0]}</div>
                        )}
                      </>
                    ) : (
                      <div className="text-white/25 text-2xl font-light">—</div>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            round.players.map((p) => {
              const has = round.scores[p.id]?.find((x) => x.hole === currentHole.number);
              const tp = totalVsPar(p);
              const pts = totalPoints(p);
              return (
                <button
                  key={p.id}
                  onClick={() => openSheet(p)}
                  className="w-full rounded-2xl p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform"
                  style={{ background: "#1a1a1a" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.name} tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
                    <div className="text-left min-w-0">
                      <div className="text-white font-semibold truncate">{p.name.split(" ")[0]}</div>
                      <div className="text-white/50 text-sm">{isStableford ? `${pts} pts` : parSign(tp)}</div>
                    </div>
                  </div>
                  <div className="min-w-[60px] h-14 rounded-xl flex flex-col items-center justify-center"
                    style={has
                      ? { background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e" }
                      : { background: "rgba(255,255,255,0.07)", border: "2px solid rgba(255,255,255,0.1)" }
                    }
                  >
                    {has ? (
                      <>
                        <div className="text-white font-black text-2xl tabular-nums leading-none">{has.score}</div>
                        <div className={cn("text-[10px] font-bold mt-0.5", scoreLabelColor(has.score, currentHole.par))}>
                          {scoreLabel(has.score, currentHole.par)}
                        </div>
                      </>
                    ) : (
                      <div className="text-white/25 text-2xl font-light">—</div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <button
          onClick={() => setView("scoring")}
          className="flex-1 h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wider"
          style={{ color: view === "scoring" ? "#22c55e" : "rgba(255,255,255,0.4)" }}
        >
          <Flag className="h-4 w-4" />
          СЧЁТ
        </button>
        <button
          onClick={() => setView("leaderboard")}
          className="flex-1 h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wider"
          style={{ color: view === "leaderboard" ? "#22c55e" : "rgba(255,255,255,0.4)" }}
        >
          <Trophy className="h-4 w-4" />
          ТАБЛИЦА
        </button>
      </div>

      {/* Score Sheet */}
      {sheetPlayer && !round.completed && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/70" onClick={() => { setSheetPlayer(null); setSheetTeamMembers([]); }} />
          <div className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250" style={{ background: "#1a1a1a", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <Avatar name={sheetPlayer.name} tone={sheetPlayer.isMe ? "orange" : "muted"} photoUrl={sheetPlayer.photoUrl} />
                <div>
                  <div className="text-white font-bold">
                    {isScramble
                      ? sheetTeamMembers.map((p) => p.name.split(" ")[0]).join(" & ")
                      : sheetPlayer.name.split(" ")[0]
                    }
                  </div>
                  <div className="text-white/40 text-xs">Лунка {currentHole.number} · Par {currentHole.par}</div>
                </div>
              </div>
              <button onClick={() => { setSheetPlayer(null); setSheetTeamMembers([]); }} className="h-9 w-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            <div className="px-5 pt-5 pb-2">
              <div className="rounded-2xl flex flex-col items-center mb-4" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] font-bold uppercase tracking-widest pt-3 pb-1" style={{ color: "rgba(255,255,255,0.4)" }}>СЧЁТ</div>
                <button onClick={() => setHole((h) => ({ ...h, score: h.score + 1 }))} className="w-full h-14 grid place-items-center rounded-xl transition-colors active:bg-white/10" style={{ color: "#22c55e" }}>
                  <Plus className="h-7 w-7" strokeWidth={2.5} />
                </button>
                <div className="text-4xl font-black tabular-nums text-white py-0.5">{hole.score}</div>
                <div className={cn("text-[11px] font-bold mb-0.5", scoreLabelColor(hole.score, currentHole.par))}>
                  {scoreLabel(hole.score, currentHole.par)}
                  {isStableford && <span className="text-white/40 ml-1">· {stablefordPoints(hole.score, currentHole.par)} pts</span>}
                </div>
                <button onClick={() => setHole((h) => ({ ...h, score: Math.max(1, h.score - 1) }))} className="w-full h-14 grid place-items-center rounded-xl transition-colors active:bg-white/10" style={{ color: "#22c55e" }}>
                  <span className="text-3xl leading-none font-bold">−</span>
                </button>
              </div>

              {isScramble && sheetTeamMembers.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Чей мяч?</div>
                  <div className="flex gap-2">
                    {sheetTeamMembers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setHole((h) => ({ ...h, madeBy: p.id }))}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
                        style={hole.madeBy === p.id
                          ? { background: "rgba(34,197,94,0.2)", border: "2px solid #22c55e", color: "#22c55e" }
                          : { background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                        }
                      >
                        {p.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={submit}
                className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform"
                style={{ background: "#22c55e", color: "#000" }}
              >
                СОХРАНИТЬ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add player sheet */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/70" onClick={() => setShowAddPlayer(false)} />
          <div className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250" style={{ background: "#1a1a1a", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-white font-bold">Добавить игрока</div>
              <button onClick={() => setShowAddPlayer(false)} className="h-9 w-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Имя игрока"
                className="w-full h-12 rounded-xl px-4 text-white text-sm outline-none placeholder:text-white/30"
                style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.1)" }}
              />
              <input
                value={newHcp}
                onChange={(e) => setNewHcp(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="HCP"
                inputMode="decimal"
                className="w-full h-12 rounded-xl px-4 text-white text-sm outline-none placeholder:text-white/30"
                style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.1)" }}
              />
              <button
                onClick={addPlayer}
                disabled={!newName.trim()}
                className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: "#22c55e", color: "#000" }}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveScoringPage;
