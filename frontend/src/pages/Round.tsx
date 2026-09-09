import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/PlayerAvatar";
import { PlayerPickerSheet } from "@/components/PlayerPickerSheet";
import { TournamentLeaderboard } from "@/components/TournamentLeaderboard";
import { COURSES, getAllCourses, type Course, type TeeColor } from "@/lib/courses";
import { useGolf, type Player, type Round, type HolesMode, type Profile } from "@/store/golfStore";
import { compressImage } from "@/lib/imageUtils";
import { ChevronLeft, ChevronRight, Plus, X, Flag, Trophy, Camera, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// Everyday rounds only happen at the club — no course search, just the two
// layouts Golf Club Minsk actually has.
const CLUB_COURSES = COURSES.filter((c) => c.club === "Golf Club Minsk");

const HOLES_MODE_LABEL: Record<HolesMode, string> = { "18": "18 лунок", front9: "Перед. 9", back9: "Задн. 9" };

const getHolePar = (courseId: string, holeNumber: number): number =>
  getAllCourses().find((c) => c.id === courseId)?.holes.find((h) => h.number === holeNumber)?.par ?? 4;

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
  if (d <= -2) return "var(--score-eagle)";
  if (d === -1) return "var(--score-birdie)";
  if (d === 0) return "var(--score-par)";
  if (d === 1) return "var(--score-bogey)";
  return "var(--score-double)";
};
const scoreLabelColorOnDark = (score: number, par: number) => (score - par <= -2 ? "#c9a24b" : "#f3ede1");
const parSign = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
const parColor = (v: number) => (v < 0 ? "var(--score-birdie)" : v === 0 ? "var(--score-par)" : "var(--score-double)");

function roundTotals(r: Round) {
  const course = getAllCourses().find((c) => c.id === r.courseId);
  const me = r.players.find((p) => p.isMe);
  const scores = me ? r.scores[me.id] ?? [] : [];
  const total = scores.reduce((a, s) => a + s.score, 0);
  const vsPar = scores.reduce((a, s) => {
    const h = course?.holes.find((h) => h.number === s.hole);
    return a + (s.score - (h?.par ?? 4));
  }, 0);
  return { total, vsPar };
}

type Step = "home" | "setup" | "playing";

const RoundPage = () => {
  const { profile, activeRound, rounds } = useGolf();
  const [step, setStep] = useState<Step>("home");

  // A round belonging to a tournament lives in the same `activeRound` slot
  // but is scored from the tournament flow — this page only ever resumes a
  // round it started itself.
  const casualActiveRound = activeRound && !activeRound.tournamentId ? activeRound : null;

  // Checked on `step` alone (not `casualActiveRound` too): finishRound()
  // clears activeRound the moment the round completes, and RoundPlayer needs
  // to keep rendering past that so it can show its own "round complete"
  // screen instead of getting yanked back to Home mid-transition.
  if (step === "playing") {
    return <RoundPlayer onDone={() => setStep("home")} />;
  }

  if (step === "setup") {
    return <SetupScreen onBack={() => setStep("home")} onStarted={() => setStep("playing")} />;
  }

  return (
    <HomeScreen
      profile={profile}
      rounds={rounds}
      activeRound={casualActiveRound}
      onStart={() => setStep("setup")}
      onResume={() => setStep("playing")}
    />
  );
};

/* ── Home ── */
const HomeScreen = ({
  profile,
  rounds,
  activeRound,
  onStart,
  onResume,
}: {
  profile: Profile;
  rounds: Round[];
  activeRound: Round | null;
  onStart: () => void;
  onResume: () => void;
}) => {
  const navigate = useNavigate();
  const casualRounds = rounds.filter((r) => r.completed && !r.tournamentId).slice(0, 5);

  const perfStats = (() => {
    const completed = rounds.filter((r) => r.completed);
    if (completed.length === 0) return null;
    let totalHoles = 0, girCount = 0, fairwayCount = 0, totalPutts = 0;
    completed.forEach((r) => {
      const me = r.players.find((p) => p.isMe);
      (me ? r.scores[me.id] ?? [] : []).forEach((s) => {
        if (s.score > 0) {
          totalHoles++;
          if (s.gir) girCount++;
          if (s.driving) fairwayCount++;
          totalPutts += s.putts || 0;
        }
      });
    });
    return {
      gir: totalHoles > 0 ? Math.round((girCount / totalHoles) * 100) : 0,
      fairways: totalHoles > 0 ? Math.round((fairwayCount / totalHoles) * 100) : 0,
      putts: completed.length > 0 ? (totalPutts / completed.length).toFixed(1) : "0",
      rounds: completed.length,
    };
  })();

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <div className="gm-eyebrow">Play</div>
        <h1 className="text-3xl mt-1">Обычный раунд</h1>
        <p className="text-sm text-muted-foreground mt-1">Golf Club Minsk · для будничной игры</p>
      </div>

      {activeRound && (
        <div
          onClick={onResume}
          className="px-5 py-4 flex items-center gap-4 cursor-pointer rounded-2xl"
          style={{ background: "#15361f", border: "1px solid #c9a24b" }}
        >
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#c9a24b" }} />
          <div className="flex-1 min-w-0">
            <div className="gm-eyebrow" style={{ color: "#9fc2a8" }}>Раунд идёт</div>
            <div className="text-sm font-bold text-white truncate">{activeRound.courseName}</div>
          </div>
          <span className="flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-bold shrink-0" style={{ background: "#c9a24b", color: "#15361f" }}>
            Продолжить <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </div>
      )}

      <Card className="p-5 shadow-none border border-border">
        <div className="font-display font-semibold text-lg">Начать новый раунд</div>
        <div className="text-sm text-muted-foreground mt-1">Поле, тройник и лунки — за 30 секунд</div>
        <Button
          onClick={onStart}
          size="lg"
          className="w-full h-14 mt-4 text-base font-semibold bg-action hover:bg-action/90 text-action-foreground rounded-xl shadow-glow"
        >
          <Flag className="h-5 w-5 mr-2" strokeWidth={2.5} /> Начать раунд
        </Button>
      </Card>

      {perfStats && (
        <Card className="p-4 shadow-none border border-border">
          <div className="flex items-baseline justify-between">
            <div className="font-bold text-sm">Личная статистика</div>
            <div className="text-[11px] text-muted-foreground">{perfStats.rounds} раундов</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center rounded-lg py-2.5" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold" style={{ color: "var(--accent)" }}>{perfStats.gir}%</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">GIR</div>
            </div>
            <div className="text-center rounded-lg py-2.5" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold">{perfStats.fairways}%</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Fairways</div>
            </div>
            <div className="text-center rounded-lg py-2.5" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold">{perfStats.putts}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Putts</div>
            </div>
          </div>
          <button onClick={() => navigate("/profile")} className="flex items-center gap-1 mt-3 text-xs font-bold text-action">
            <BarChart3 className="h-3.5 w-3.5" /> Вся статистика в профиле
          </button>
        </Card>
      )}

      {casualRounds.length > 0 && (
        <div>
          <div className="gm-eyebrow mb-2 px-1">Последние раунды</div>
          <div className="space-y-2">
            {casualRounds.map((r) => {
              const { total, vsPar } = roundTotals(r);
              const d = new Date(r.date);
              const partners = r.players.length - 1;
              return (
                <Card key={r.id} className="p-3 flex items-center gap-3 shadow-none border border-border">
                  <div className="w-10 text-center shrink-0">
                    <div className="font-display font-bold leading-none">{d.getDate()}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      {d.toLocaleDateString("ru-RU", { month: "short" })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {r.courseName.split(" · ")[0]} · {HOLES_MODE_LABEL[r.holesMode ?? "18"]}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.tee} колышки · {partners > 0 ? `${partners} партнёр(ов)` : "соло"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-xl font-bold leading-none">{total}</div>
                    <div className="text-xs font-bold mt-0.5" style={{ color: parColor(vsPar) }}>{parSign(vsPar)}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Setup ── */
const SetupScreen = ({ onBack, onStarted }: { onBack: () => void; onStarted: () => void }) => {
  const { profile, startRound } = useGolf();
  const [courseId, setCourseId] = useState(CLUB_COURSES[0].id);
  const course = CLUB_COURSES.find((c) => c.id === courseId) ?? CLUB_COURSES[0];
  const [teeColor, setTeeColor] = useState<TeeColor>(
    course.tees.find((t) => t.color === profile.defaultTee)?.color ?? course.tees[0].color
  );
  const [holesMode, setHolesMode] = useState<HolesMode>("18");
  const [players, setPlayers] = useState<Player[]>([
    { id: "me", name: `${profile.firstName} ${profile.lastName}`.trim() || "Я", initials: profile.initials || "Я", hcp: profile.hcp, isMe: true, photoUrl: profile.photoUrl },
  ]);
  const [showPicker, setShowPicker] = useState(false);

  const selectCourse = (c: Course) => {
    setCourseId(c.id);
    if (!c.tees.find((t) => t.color === teeColor)) setTeeColor(c.tees[0].color);
  };

  const handleStart = () => {
    const withTee = players.map((p) => (p.isMe ? { ...p, tee: teeColor } : p));
    startRound(course, withTee, undefined, "stroke_play", course.holes.length > 9 ? holesMode : "18");
    onStarted();
  };

  return (
    <div className="space-y-5 animate-in slide-in-from-right duration-300">
      <button onClick={onBack} className="flex items-center gap-1 text-action font-bold text-lg">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> Раунд
      </button>
      <h1 className="text-2xl font-bold">Новый раунд</h1>

      <Card className="p-4 shadow-none border border-border space-y-4">
        <div>
          <div className="gm-eyebrow mb-2">Поле</div>
          <div className="flex gap-2">
            {CLUB_COURSES.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCourse(c)}
                className="flex-1 p-3 rounded-xl border-2 text-left transition-all"
                style={courseId === c.id ? { borderColor: "#15361f", background: "var(--accent-tint)" } : { borderColor: "hsl(var(--border))" }}
              >
                <div className="text-sm font-bold">{c.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Пар {c.totalPar}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="gm-eyebrow mb-2">Колышки</div>
          <div className="flex gap-2 flex-wrap">
            {course.tees.map((t) => (
              <button
                key={t.color}
                onClick={() => setTeeColor(t.color)}
                className="px-3 h-9 rounded-full text-xs font-bold transition-all"
                style={teeColor === t.color ? { background: "#15361f", color: "#f3ede1" } : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {course.holes.length > 9 && (
          <div>
            <div className="gm-eyebrow mb-2">Лунки</div>
            <div className="flex gap-1 p-1 rounded-xl bg-muted">
              {(["18", "front9", "back9"] as HolesMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setHolesMode(m)}
                  className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
                  style={holesMode === m ? { background: "#c9a24b", color: "#15361f" } : { color: "hsl(var(--muted-foreground))" }}
                >
                  {HOLES_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 shadow-none border border-border">
        <div className="gm-eyebrow mb-2">Игроки</div>
        <div className="space-y-1">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <Avatar name={p.name} size="sm" tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
              <div className="flex-1 text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground font-semibold">HCP {p.hcp}</div>
              {!p.isMe && (
                <button onClick={() => setPlayers((prev) => prev.filter((x) => x.id !== p.id))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {players.length < 4 && (
          <button onClick={() => setShowPicker(true)} className="flex items-center gap-1.5 mt-2 text-sm font-bold text-action">
            <Plus className="h-4 w-4" /> Добавить партнёра
          </button>
        )}
      </Card>

      <Button
        onClick={handleStart}
        size="lg"
        className="w-full h-14 text-base font-semibold bg-action hover:bg-action/90 text-action-foreground rounded-xl shadow-glow"
      >
        <Flag className="h-5 w-5 mr-2" strokeWidth={2.5} /> Начать · {course.name}
      </Button>

      {showPicker && (
        <PlayerPickerSheet
          players={players}
          onAdd={(p) => { setPlayers((prev) => [...prev, p]); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
};

/* ── Scoring ── */
const RoundPlayer = ({ onDone }: { onDone: () => void }) => {
  const { activeRound, enterScore, finishRound, cancelActiveRound, setRoundPhoto } = useGolf();
  const [view, setView] = useState<"scoring" | "leaderboard">("scoring");
  const [holeIdx, setHoleIdx] = useState(0);
  const [sheetPlayer, setSheetPlayer] = useState<Player | null>(null);
  const [hole, setHole] = useState({ score: 4, putts: 2 });
  const [completedRound, setCompletedRound] = useState<Round | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  if (completedRound) {
    const completedCourse = getAllCourses().find((c) => c.id === completedRound.courseId);
    const cme = completedRound.players.find((p) => p.isMe) ?? completedRound.players[0];
    const cScores = cme ? completedRound.scores[cme.id] ?? [] : [];
    const cTotal = cScores.reduce((a, s) => a + s.score, 0);
    const cVsPar = cScores.reduce((a, s) => {
      const h = completedCourse?.holes.find((h) => h.number === s.hole);
      return a + (s.score - (h?.par ?? 4));
    }, 0);
    const vpText = parSign(cVsPar);
    const vpColor = parColor(cVsPar);
    const girCount = cScores.filter((s) => s.gir).length;
    const totalPutts = cScores.reduce((a, s) => a + (s.putts || 0), 0);
    const totalPenalties = cScores.reduce((a, s) => a + (s.penalties || 0), 0);
    const girPct = cScores.length > 0 ? Math.round((girCount / cScores.length) * 100) : 0;

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const compressed = await compressImage(file);
      setRoundPhoto(completedRound.id, compressed);
      setCompletedRound({ ...completedRound, photoUrl: compressed });
      e.target.value = "";
    };

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: "max(env(safe-area-inset-top), 32px)", paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}>
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5 overflow-y-auto">
          <div className="text-center">
            <div className="h-16 w-16 rounded-full mx-auto mb-4 grid place-items-center" style={{ background: "var(--accent-tint)", border: "2px solid hsl(var(--action))" }}>
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                <path d="M2 11L10 19L26 3" stroke="hsl(var(--action))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="gm-eyebrow" style={{ color: "var(--text-muted)" }}>Раунд завершён</div>
            <div className="font-display text-foreground font-bold text-5xl tabular-nums leading-none mt-2">{cTotal}</div>
            <div className="text-xl font-bold mt-1" style={{ color: vpColor }}>{vpText}</div>
            <div className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{completedRound.courseName}</div>
          </div>

          {completedRound.photoUrl ? (
            <div className="w-full">
              <div className="w-full overflow-hidden border border-border rounded-2xl" style={{ aspectRatio: "4/3", maxHeight: 200 }}>
                <img src={completedRound.photoUrl} alt="Round" className="w-full h-full object-cover" />
              </div>
              <button onClick={() => photoRef.current?.click()} className="flex items-center justify-center gap-2 w-full mt-2 py-2 text-sm font-semibold text-action">
                <Camera className="h-4 w-4" /> Заменить фото
              </button>
            </div>
          ) : (
            <button onClick={() => photoRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-3 py-8 bg-muted/50 border-2 border-dashed border-border rounded-2xl">
              <Camera className="h-8 w-8 text-action" />
              <div className="text-sm font-semibold text-muted-foreground">Добавить фото раунда</div>
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

          <div className="w-full grid grid-cols-3 gap-2">
            <div className="text-center rounded-xl py-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold" style={{ color: "var(--accent)" }}>{girPct}%</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">GIR</div>
            </div>
            <div className="text-center rounded-xl py-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold">{totalPutts}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Putts</div>
            </div>
            <div className="text-center rounded-xl py-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold">{totalPenalties}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Penalties</div>
            </div>
          </div>

          <div className="text-center text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Раунд сохранён в статистике профиля<br />и синхронизирован с сайтом клуба
          </div>
        </div>
        <div className="px-5 pt-4">
          <button onClick={onDone} className="w-full h-14 rounded-2xl font-bold text-base uppercase tracking-wider active:scale-[0.98] transition-transform bg-action text-action-foreground">
            ГОТОВО
          </button>
        </div>
      </div>
    );
  }

  if (!activeRound) return null;

  const course = getAllCourses().find((c) => c.id === activeRound.courseId)!;
  const mode = activeRound.holesMode ?? "18";
  const playHoles = mode === "front9"
    ? course.holes.filter((h) => h.number <= 9)
    : mode === "back9"
    ? course.holes.filter((h) => h.number > 9)
    : course.holes;
  const currentHole = playHoles[holeIdx];
  const totalHoles = playHoles.length;
  const mePlayer = activeRound.players.find((p) => p.isMe);

  const openSheet = (p: Player) => {
    const existing = activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number);
    setHole({ score: existing?.score ?? currentHole.par, putts: existing?.putts ?? 2 });
    setSheetPlayer(p);
  };

  const openNextPlayer = () => {
    const next =
      activeRound.players.find((p) => !activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number)) ??
      activeRound.players[0];
    openSheet(next);
  };

  const submit = () => {
    if (!sheetPlayer) return;
    enterScore(sheetPlayer.id, {
      hole: currentHole.number,
      score: hole.score,
      putts: hole.putts,
      driving: false,
      gir: false,
      bunker: 0,
      penalties: 0,
    });
    const justScored = sheetPlayer;
    setSheetPlayer(null);

    const allOthersScored = activeRound.players
      .filter((p) => p.id !== justScored.id)
      .every((p) => !!activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number));

    if (allOthersScored && holeIdx < totalHoles - 1) {
      setTimeout(() => setHoleIdx((h) => Math.min(totalHoles - 1, h + 1)), 600);
    }
  };

  const handleFinish = () => {
    const snapshot = activeRound;
    finishRound();
    setCompletedRound({ ...snapshot, completed: true });
  };

  const totalVsPar = (p: Player) => {
    const played = activeRound.scores[p.id] ?? [];
    return played.reduce((a, s) => {
      const h = course.holes.find((h) => h.number === s.hole);
      return a + (s.score - (h?.par ?? 0));
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-5" style={{ paddingTop: 10, paddingBottom: 10 }}>
        <button onClick={() => { cancelActiveRound(); onDone(); }} className="h-9 w-9 rounded-full grid place-items-center bg-muted">
          <X className="h-4 w-4 text-foreground" strokeWidth={2.5} />
        </button>

        {view === "scoring" ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setHoleIdx(Math.max(0, holeIdx - 1))} disabled={holeIdx === 0} className="h-9 w-9 grid place-items-center disabled:opacity-20">
              <ChevronLeft className="h-6 w-6 text-foreground" strokeWidth={2.5} />
            </button>
            <span className="text-foreground font-bold text-base tracking-wider min-w-[90px] text-center">Лунка {currentHole.number}</span>
            <button onClick={() => setHoleIdx(Math.min(totalHoles - 1, holeIdx + 1))} disabled={holeIdx === totalHoles - 1} className="h-9 w-9 grid place-items-center disabled:opacity-20">
              <ChevronRight className="h-6 w-6 text-foreground" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <span className="text-foreground font-bold text-base tracking-wider">Таблица</span>
        )}

        <button onClick={handleFinish} className="h-9 px-4 rounded-full font-bold text-xs tracking-wider border" style={{ borderColor: "#15361f", color: "#15361f" }}>
          ФИНИШ
        </button>
      </div>

      <div className="px-5 pb-3">
        <div className="flex rounded-full p-1 gap-1 bg-muted">
          <button
            onClick={() => setView("scoring")}
            className="flex-1 h-8 rounded-full text-xs font-bold tracking-wider transition-all"
            style={view === "scoring" ? { background: "#c9a24b", color: "#15361f" } : { color: "#8a7f68" }}
          >
            СЧЁТ
          </button>
          <button
            onClick={() => setView("leaderboard")}
            className="flex-1 h-8 rounded-full text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-1.5"
            style={view === "leaderboard" ? { background: "#c9a24b", color: "#15361f" } : { color: "#8a7f68" }}
          >
            <Trophy className="h-3 w-3" /> ТАБЛИЦА
          </button>
        </div>
      </div>

      {view === "leaderboard" ? (
        <TournamentLeaderboard activeRound={activeRound} course={course} format="stroke_play" />
      ) : (
        <div className="flex-1 flex flex-col justify-center px-5 pb-4 gap-4 overflow-y-auto">
          <div className="overflow-hidden bg-card border border-border rounded-2xl">
            <div className="gm-eyebrow px-5 pt-4" style={{ color: "#8a7f68" }}>Обычный раунд</div>
            <div className="flex items-baseline gap-4 px-5 pt-1 pb-4">
              <span className="font-display text-foreground font-bold text-4xl tracking-tight">PAR {currentHole.par}</span>
              <span className="font-display text-muted-foreground font-semibold text-xl tracking-tight">HCP {currentHole.hcp}</span>
            </div>
            <div className="px-5 pb-4">
              <button
                onClick={openNextPlayer}
                className="w-full h-12 rounded-full font-black text-sm tracking-[0.15em] active:scale-[0.97] transition-transform bg-action text-action-foreground"
              >
                ВВЕСТИ СЧЁТ
              </button>
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-muted/50 border-t border-border">
              <div>
                <div className="text-foreground/80 text-sm font-semibold">{course.club}</div>
                <div className="text-muted-foreground text-xs">{course.name} · {currentHole.meters[mePlayer?.tee ?? "yellow"]} m</div>
              </div>
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5" style={{ color: "#15361f" }} />
                <span className="font-display text-foreground font-bold text-2xl tabular-nums">{currentHole.number}</span>
              </div>
            </div>
          </div>

          {activeRound.players.map((p) => {
            const has = activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number);
            const tp = totalVsPar(p);
            return (
              <button
                key={p.id}
                onClick={() => openSheet(p)}
                className="w-full p-4 rounded-2xl flex items-center justify-between gap-3 active:scale-[0.98] transition-transform bg-card border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={p.name} tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
                  <div className="text-left min-w-0">
                    <div className="text-foreground font-semibold truncate">{p.name.split(" ")[0]}</div>
                    <div className="text-muted-foreground text-sm">{parSign(tp)}</div>
                  </div>
                </div>
                <div className="min-w-[60px] h-14 rounded-xl flex flex-col items-center justify-center" style={has ? { background: "#15361f" } : { background: "#e9e1cf" }}>
                  {has ? (
                    <>
                      <div className="font-display font-bold text-2xl tabular-nums leading-none" style={{ color: "#f3ede1" }}>{has.score}</div>
                      <div className="text-[10px] font-bold mt-0.5" style={{ color: scoreLabelColorOnDark(has.score, currentHole.par) }}>
                        {scoreLabel(has.score, currentHole.par)}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground text-2xl font-light">—</div>
                  )}
                </div>
              </button>
            );
          })}

          <div className="flex items-center justify-center gap-1.5 pt-1">
            {playHoles.map((h, i) => {
              const scored = activeRound.players.some((p) => activeRound.scores[p.id]?.find((s) => s.hole === h.number));
              return (
                <button
                  key={i}
                  onClick={() => setHoleIdx(i)}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === holeIdx ? 20 : 8,
                    height: 8,
                    background: i === holeIdx ? "hsl(var(--action))" : scored ? "hsl(var(--muted-foreground) / 0.5)" : "hsl(var(--border))",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {sheetPlayer && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/40" onClick={() => setSheetPlayer(null)} />
          <div className="relative w-full animate-in slide-in-from-bottom duration-250 bg-card border-t rounded-t-3xl" style={{ borderColor: "#c9a24b", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1 bg-border" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar name={sheetPlayer.name} tone={sheetPlayer.isMe ? "orange" : "muted"} photoUrl={sheetPlayer.photoUrl} />
                <div>
                  <div className="text-foreground font-bold">{sheetPlayer.name.split(" ")[0]}</div>
                  <div className="text-muted-foreground text-xs">Лунка {currentHole.number} · Par {currentHole.par}</div>
                </div>
              </div>
              <button onClick={() => setSheetPlayer(null)} className="h-9 w-9 rounded-full grid place-items-center border border-border">
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>

            <div className="px-5 pt-5 pb-2">
              <div className="flex flex-col items-center mb-4 border border-border rounded-2xl overflow-hidden">
                <div className="gm-eyebrow pt-3 pb-1 text-muted-foreground">СЧЁТ</div>
                <button onClick={() => setHole((h) => ({ ...h, score: h.score + 1 }))} className="w-full h-14 grid place-items-center transition-colors active:bg-black/5" style={{ color: "#15361f" }}>
                  <Plus className="h-7 w-7" strokeWidth={2.5} />
                </button>
                <div className="font-display text-4xl font-bold tabular-nums text-foreground py-0.5">{hole.score}</div>
                <div className="text-[11px] font-bold mb-0.5" style={{ color: scoreLabelColor(hole.score, currentHole.par) }}>
                  {scoreLabel(hole.score, currentHole.par)}
                </div>
                <button onClick={() => setHole((h) => ({ ...h, score: Math.max(1, h.score - 1) }))} className="w-full h-14 grid place-items-center transition-colors active:bg-black/5" style={{ color: "#15361f" }}>
                  <span className="text-3xl leading-none font-bold">&minus;</span>
                </button>
              </div>

              <button
                onClick={submit}
                className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform bg-action text-action-foreground"
              >
                СОХРАНИТЬ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoundPage;
