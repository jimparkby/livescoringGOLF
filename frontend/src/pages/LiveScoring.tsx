import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Avatar } from "@/components/PlayerAvatar";
import { TournamentLeaderboard } from "@/components/TournamentLeaderboard";
import { COURSES } from "@/lib/courses";
import { getFormat, stablefordPoints, type FormatId } from "@/lib/formats";
import { api } from "@/lib/api";
import type { Round, Player } from "@/store/golfStore";
import { Plus, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { HoleGridNav } from "@/components/HoleGridNav";
import { LiveScoringLogo } from "@/components/LiveScoringLogo";

const CUPRUM = "Cuprum, Arial, Helvetica, sans-serif";
const INK = "#222430";

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
  if (d <= -2) return "#ca8a04";
  if (d === -1) return "#21835b";
  if (d === 0) return INK;
  if (d === 1) return "#ea580c";
  return "#d80027";
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
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ background: "#f7f7f7", fontFamily: CUPRUM }}>
        <div className="text-4xl mb-2">⛳</div>
        <div className="font-bold text-lg" style={{ color: INK }}>Ссылка недействительна</div>
        <div className="text-sm" style={{ color: "#8a8a8a" }}>Раунд не найден или QR устарел</div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#f7f7f7" }}>
        <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#21835b", borderTopColor: "transparent" }} />
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
      <div className="fixed inset-0 flex items-center justify-center px-6 text-center" style={{ background: "#f7f7f7", color: "#8a8a8a" }}>
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
  const parColor = (v: number) => (v < 0 ? "#21835b" : v === 0 ? INK : "#d80027");

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#f7f7f7", fontFamily: CUPRUM }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)", paddingBottom: 10 }}>
        <LiveScoringLogo />
        <button onClick={() => setShowAddPlayer(true)} className="h-9 w-9 rounded-full grid place-items-center border" style={{ borderColor: "#d9d9d9" }} title="Добавить игрока">
          <UserPlus className="h-4 w-4" style={{ color: INK }} strokeWidth={2.5} />
        </button>
      </div>

      {/* Tournament banner */}
      <div className="px-5 py-3 text-center" style={{ background: "#e2e2e2" }}>
        <div className="font-bold text-lg tracking-wide" style={{ color: INK }}>{fmt.emoji} {fmt.name}</div>
        <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "#8a8a8a" }}>{course.name} · {course.club}</div>
      </div>

      {round.completed && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-xl text-xs text-center font-bold" style={{ background: "#e8f3ee", color: "#21835b" }}>
          Раунд завершён — счёт доступен только для просмотра
        </div>
      )}

      {view === "scoring" && (
        <div className="px-5 pt-3 pb-1">
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
        <div className="flex-1 flex flex-col px-5 py-3 gap-2.5 overflow-y-auto">
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
                  className="w-full rounded-xl p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform border"
                  style={{ background: "#ffffff", borderColor: "#e5e5e5" }}
                >
                  <div className="text-left min-w-0">
                    <div className="font-bold text-sm" style={{ color: INK }}>{label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                      {members.map((p) => p.name.split(" ")[0]).join(" & ")}
                    </div>
                    <div className="text-xs font-bold mt-0.5" style={{ color: parColor(tp) }}>{parSign(tp)}</div>
                  </div>
                  <div className="min-w-[72px] h-16 rounded-lg flex flex-col items-center justify-center gap-0.5"
                    style={has ? { background: "#21835b" } : { background: "#e5e5e5" }}
                  >
                    {has ? (
                      <>
                        <div className="font-black text-2xl tabular-nums leading-none" style={{ color: "#f7f7f7" }}>{has.score}</div>
                        <div className="text-[10px] font-bold" style={{ color: "#f7f7f7" }}>
                          {scoreLabel(has.score, currentHole.par)}
                        </div>
                        {madeByPlayer && (
                          <div className="text-[9px] leading-none" style={{ color: "rgba(247,247,247,0.7)" }}>{madeByPlayer.name.split(" ")[0]}</div>
                        )}
                      </>
                    ) : (
                      <div className="text-2xl font-light" style={{ color: "#8a8a8a" }}>—</div>
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
                  className="w-full rounded-xl p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform border"
                  style={{ background: "#ffffff", borderColor: "#e5e5e5" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.name} tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
                    <div className="text-left min-w-0">
                      <div className="font-semibold truncate" style={{ color: INK }}>{p.name.split(" ")[0]}</div>
                      <div className="text-sm" style={{ color: "#8a8a8a" }}>{isStableford ? `${pts} pts` : parSign(tp)}</div>
                    </div>
                  </div>
                  <div className="min-w-[60px] h-14 rounded-lg flex flex-col items-center justify-center"
                    style={has ? { background: "#21835b" } : { background: "#e5e5e5" }}
                  >
                    {has ? (
                      <>
                        <div className="font-black text-2xl tabular-nums leading-none" style={{ color: "#f7f7f7" }}>{has.score}</div>
                        <div className="text-[10px] font-bold mt-0.5" style={{ color: "#f7f7f7" }}>
                          {scoreLabel(has.score, currentHole.par)}
                        </div>
                      </>
                    ) : (
                      <div className="text-2xl font-light" style={{ color: "#8a8a8a" }}>—</div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex shrink-0" style={{ background: "#ffffff", borderTop: "1px solid #e5e5e5", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <button
          onClick={() => setView("scoring")}
          className="flex-1 h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: view === "scoring" ? "#21835b" : "#8a8a8a" }}
        >
          <span className="text-xl leading-none">🧮</span>
          Счёт
        </button>
        <button
          onClick={() => setView("leaderboard")}
          className="flex-1 h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: view === "leaderboard" ? "#21835b" : "#8a8a8a" }}
        >
          <span className="text-xl leading-none">🏆</span>
          Таблица
        </button>
      </div>

      {/* Score Sheet */}
      {sheetPlayer && !round.completed && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/40" onClick={() => { setSheetPlayer(null); setSheetTeamMembers([]); }} />
          <div className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250" style={{ background: "#ffffff", paddingBottom: "max(env(safe-area-inset-bottom), 24px)", fontFamily: CUPRUM }}>
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1" style={{ background: "#e5e5e5" }} />
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#e5e5e5" }}>
              <div className="flex items-center gap-3">
                <Avatar name={sheetPlayer.name} tone={sheetPlayer.isMe ? "orange" : "muted"} photoUrl={sheetPlayer.photoUrl} />
                <div>
                  <div className="font-bold" style={{ color: INK }}>
                    {isScramble
                      ? sheetTeamMembers.map((p) => p.name.split(" ")[0]).join(" & ")
                      : sheetPlayer.name.split(" ")[0]
                    }
                  </div>
                  <div className="text-xs" style={{ color: "#8a8a8a" }}>Лунка {currentHole.number} · Par {currentHole.par}</div>
                </div>
              </div>
              <button onClick={() => { setSheetPlayer(null); setSheetTeamMembers([]); }} className="h-9 w-9 rounded-full grid place-items-center border" style={{ borderColor: "#e5e5e5" }}>
                <X className="h-4 w-4" style={{ color: INK }} />
              </button>
            </div>

            <div className="px-5 pt-5 pb-2">
              <div className="rounded-2xl flex flex-col items-center mb-4" style={{ background: "#f7f7f7" }}>
                <div className="text-[10px] font-bold uppercase tracking-widest pt-3 pb-1" style={{ color: "#8a8a8a" }}>Счёт</div>
                <button onClick={() => setHole((h) => ({ ...h, score: h.score + 1 }))} className="w-full h-14 grid place-items-center rounded-xl transition-colors active:bg-black/5" style={{ color: "#21835b" }}>
                  <Plus className="h-7 w-7" strokeWidth={2.5} />
                </button>
                <div className="text-4xl font-black tabular-nums py-0.5" style={{ color: INK }}>{hole.score}</div>
                <div className="text-[11px] font-bold mb-0.5" style={{ color: scoreLabelColor(hole.score, currentHole.par) }}>
                  {scoreLabel(hole.score, currentHole.par)}
                  {isStableford && <span className="ml-1" style={{ color: "#8a8a8a" }}>· {stablefordPoints(hole.score, currentHole.par)} pts</span>}
                </div>
                <button onClick={() => setHole((h) => ({ ...h, score: Math.max(1, h.score - 1) }))} className="w-full h-14 grid place-items-center rounded-xl transition-colors active:bg-black/5" style={{ color: "#21835b" }}>
                  <span className="text-3xl leading-none font-bold">−</span>
                </button>
              </div>

              {isScramble && sheetTeamMembers.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#8a8a8a" }}>Чей мяч?</div>
                  <div className="flex gap-2">
                    {sheetTeamMembers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setHole((h) => ({ ...h, madeBy: p.id }))}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border-2"
                        style={hole.madeBy === p.id
                          ? { background: "#e8f3ee", borderColor: "#21835b", color: "#21835b" }
                          : { background: "#f7f7f7", borderColor: "#e5e5e5", color: "#8a8a8a" }
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
                style={{ background: "#21835b", color: "#f7f7f7" }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add player sheet */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/40" onClick={() => setShowAddPlayer(false)} />
          <div className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250" style={{ background: "#ffffff", paddingBottom: "max(env(safe-area-inset-bottom), 24px)", fontFamily: CUPRUM }}>
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1" style={{ background: "#e5e5e5" }} />
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#e5e5e5" }}>
              <div className="font-bold" style={{ color: INK }}>Добавить игрока</div>
              <button onClick={() => setShowAddPlayer(false)} className="h-9 w-9 rounded-full grid place-items-center border" style={{ borderColor: "#e5e5e5" }}>
                <X className="h-4 w-4" style={{ color: INK }} />
              </button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Имя игрока"
                className="w-full h-12 rounded-xl px-4 text-sm outline-none border"
                style={{ background: "#f7f7f7", borderColor: "#e5e5e5", color: INK }}
              />
              <input
                value={newHcp}
                onChange={(e) => setNewHcp(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="HCP"
                inputMode="decimal"
                className="w-full h-12 rounded-xl px-4 text-sm outline-none border"
                style={{ background: "#f7f7f7", borderColor: "#e5e5e5", color: INK }}
              />
              <button
                onClick={addPlayer}
                disabled={!newName.trim()}
                className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: "#21835b", color: "#f7f7f7" }}
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
