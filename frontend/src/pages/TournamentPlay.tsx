import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/PlayerAvatar";
import { PlayerPickerSheet } from "@/components/PlayerPickerSheet";
import { COURSES } from "@/lib/courses";
import { TOURNAMENTS, TIER_LABELS, type Tier } from "@/lib/tournaments";
import { getFormat, stablefordPoints, type FormatId } from "@/lib/formats";
import { useGolf, type Player, type Round } from "@/store/golfStore";
import { compressImage } from "@/lib/imageUtils";
import { ChevronLeft, ChevronRight, Plus, X, Flag, Trophy, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TournamentLeaderboard } from "@/components/TournamentLeaderboard";
import { api } from "@/lib/api";

const tierColor: Record<Tier, string> = {
  gold: "bg-tier-gold",
  platinum: "bg-tier-platinum",
  diamond: "bg-tier-diamond",
  closed: "bg-tier-closed",
};

type AnyTournament = {
  id: string;
  name: string;
  date: string;
  day: string;
  month: string;
  format: FormatId;
  courseId?: string;
  tier?: Tier;
  fee?: string;
  notes?: string;
};

type Step = "info" | "join" | "playing";

type MyGroup = {
  registered: boolean;
  status?: "pending_review" | "awaiting_payment" | "paid";
  checkedIn?: boolean;
  flightLabel?: string | null;
  roundId?: string | null;
  accessToken?: string | null;
  group?: { players: { id: string; name: string; hcp: number }[] } | null;
  marker?: { id: string; name: string; hcp: number } | null;
};

const REG_STATUS_LABEL: Record<string, string> = {
  pending_review: "Заявка на рассмотрении",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачено — ожидайте групп",
};

const TournamentPlayPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, activeRound, cancelActiveRound, customTournaments, startRound } = useGolf();

  const staticT = TOURNAMENTS.find((t) => t.id === id);
  const customT = customTournaments.find((t) => t.id === id);
  const tournament: AnyTournament | undefined = staticT ?? customT ?? undefined;

  // If activeRound matches THIS tournament, go straight to playing — an
  // unrelated active round (a different tournament, or a solo round) must
  // not hijack this page.
  const [step, setStep] = useState<Step>(
    activeRound?.tournamentId === id ? "playing" : "info"
  );
  const [joinPlayers, setJoinPlayers] = useState<Player[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Official registration-based group, if the admin has already flighted
  // this tournament (see TournamentRegistrations "Сформировать группы").
  // When present, it takes over live-scoring entirely — own score + the
  // marker's score, written via /api/tournaments/:id/scores — instead of
  // the ad-hoc "pick your own partners" flow below.
  const [myGroup, setMyGroup] = useState<MyGroup | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.get<MyGroup>(`/api/tournaments/${id}/my-group`).then((g) => { if (!cancelled) setMyGroup(g); }).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  if (!tournament) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <button onClick={() => navigate("/tournaments")} className="flex items-center gap-1 text-action font-bold">
          <ChevronLeft className="h-5 w-5" /> Back
        </button>
        <Card className="p-8 text-center text-muted-foreground">Tournament not found</Card>
      </div>
    );
  }

  // Official group scoring now happens on the public per-player link
  // (/tlive/:token, no login) instead of embedded here — redirect straight
  // to it if we know it (only possible for a logged-in, grouped player).
  if (myGroup?.roundId && myGroup.accessToken) {
    return <Navigate to={`/tlive/${myGroup.accessToken}`} replace />;
  }

  if ((activeRound && activeRound.tournamentId === tournament.id) || step === "playing") {
    return (
      <TournamentRoundPlayer
        tournamentName={tournament.name}
        format={tournament.format}
        onExit={() => { cancelActiveRound(); navigate("/tournaments"); }}
      />
    );
  }

  const fmt = getFormat(tournament.format);

  // Join screen — pick playing partners (up to 3) before starting a shared
  // round tagged with this tournament's id, so it shows up in the tournament's
  // aggregated live leaderboard.
  if (step === "join") {
    const course = COURSES.find((c) => c.id === (tournament.courseId ?? "championship")) ?? COURSES[0];

    const handleStart = () => {
      const me: Player = {
        id: "me",
        name: `${profile.firstName} ${profile.lastName}`.trim() || "Me",
        initials: profile.initials || "ME",
        hcp: profile.hcp,
        tee: profile.defaultTee,
        isMe: true,
        photoUrl: profile.photoUrl,
      };
      startRound(course, [me, ...joinPlayers], tournament.id, tournament.format, "18", undefined);
      setStep("playing");
    };

    return (
      <div className="space-y-5 animate-in slide-in-from-right duration-300">
        <button onClick={() => setStep("info")} className="flex items-center gap-1 text-action font-bold text-lg">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> {tournament.name}
        </button>

        <Card className="p-5 shadow-soft space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Тройник (необязательно)
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl">
                <Avatar name={profile.firstName || "Me"} tone="orange" photoUrl={profile.photoUrl} size="sm" />
                <div className="text-sm font-medium truncate">
                  {`${profile.firstName} ${profile.lastName}`.trim() || "Я"}
                </div>
                <div className="ml-auto text-xs text-muted-foreground">HCP {profile.hcp}</div>
              </div>
              {joinPlayers.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl">
                  <Avatar name={p.name} tone="muted" photoUrl={p.photoUrl} size="sm" />
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="ml-auto text-xs text-muted-foreground">HCP {p.hcp}</div>
                  <button
                    onClick={() => setJoinPlayers((prev) => prev.filter((x) => x.id !== p.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {joinPlayers.length < 3 && (
              <button
                onClick={() => setShowPicker(true)}
                className="mt-3 flex items-center gap-1 text-action font-semibold text-sm"
              >
                <Plus className="h-4 w-4" /> Добавить партнёра
              </button>
            )}
          </div>

          <Button
            onClick={handleStart}
            size="lg"
            className="w-full h-14 text-base font-semibold bg-action hover:bg-action/90 text-action-foreground rounded-xl shadow-glow"
          >
            <Flag className="h-5 w-5 mr-2" strokeWidth={2.5} /> Начать · {course.name}
          </Button>
        </Card>

        {showPicker && (
          <PlayerPickerSheet
            players={joinPlayers}
            onAdd={(p) => { setJoinPlayers((prev) => [...prev, p]); setShowPicker(false); }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    );
  }

  // Info screen for static tournaments
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <button onClick={() => navigate("/tournaments")} className="flex items-center gap-1 text-action font-bold text-lg">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> Tournaments
      </button>

      <Card className="overflow-hidden shadow-none border border-border">
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                {tournament.month} · {tournament.date} {tournament.day}
              </div>
              <h1 className="text-xl font-bold leading-snug">{tournament.name}</h1>
            </div>
            {tournament.tier && (
              <div
                className={cn("h-10 w-10 rounded-full grid place-items-center text-[9px] font-bold text-primary-foreground shadow-soft shrink-0", tierColor[tournament.tier])}
                title={TIER_LABELS[tournament.tier]}
              >
                {tournament.tier === "gold" && "G"}
                {tournament.tier === "platinum" && "PL"}
                {tournament.tier === "diamond" && "◆"}
                {tournament.tier === "closed" && "C"}
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="gm-eyebrow px-2.5 py-1 border border-border rounded-full">{fmt.emoji} {fmt.name}</span>
          </div>
          <div className="mt-4 p-3 border border-border rounded-xl">
            <div className="text-xs font-semibold text-foreground mb-1">{fmt.name} — rules</div>
            <div className="text-xs text-muted-foreground">{fmt.description}</div>
            <div className="text-xs text-action mt-1 font-medium">💡 {fmt.tip}</div>
          </div>
        </div>
        {myGroup?.registered && (
          <div className="px-5 pb-4">
            <div className="p-3 border rounded-xl" style={{ background: "var(--accent-tint)", borderColor: "rgba(21,54,31,0.28)", color: "#15361f" }}>
              <span className="text-xs font-semibold">
                {myGroup.roundId
                  ? `Группа сформирована${myGroup.flightLabel ? ` · ${myGroup.flightLabel}` : ""} — можно начинать`
                  : REG_STATUS_LABEL[myGroup.status ?? "pending_review"]}
              </span>
            </div>
          </div>
        )}
        <div className="px-5 pb-5">
          <Button
            onClick={() => setStep("join")}
            size="lg"
            className="w-full h-14 text-base font-semibold bg-action hover:bg-action/90 text-action-foreground rounded-xl shadow-glow"
          >
            <Flag className="h-5 w-5 mr-2" strokeWidth={2.5} /> Start Live Scoring
          </Button>
        </div>
      </Card>
    </div>
  );
};

/* ── Scoring helpers ── */
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
// On the solid forest-green score badges, label text needs to read against a
// dark fill — only Eagle gets its own (gold) highlight, everything else is cream.
const scoreLabelColorOnDark = (score: number, par: number) => (score - par <= -2 ? "#c9a24b" : "#f3ede1");
const parSign = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
const parColor = (v: number) => (v < 0 ? "var(--score-birdie)" : v === 0 ? "var(--score-par)" : "var(--score-double)");

/* ── Round player ── */
const TournamentRoundPlayer = ({
  tournamentName,
  format,
  onExit,
}: {
  tournamentName: string;
  format: FormatId;
  onExit: () => void;
}) => {
  const { activeRound, enterScore, finishRound, setRoundPhoto, refreshActiveRound } = useGolf();

  useEffect(() => {
    if (!activeRound) return;
    const hasPartners = activeRound.players.length > 1;
    if (!hasPartners) return;
    const id = setInterval(() => refreshActiveRound(), 15000);
    return () => clearInterval(id);
  }, [activeRound?.id]);
  const [view, setView] = useState<"scoring" | "leaderboard">("scoring");
  const [holeIdx, setHoleIdx] = useState(0);
  const [sheetPlayer, setSheetPlayer] = useState<Player | null>(null);
  const [sheetTeamMembers, setSheetTeamMembers] = useState<Player[]>([]);
  const [hole, setHole] = useState({ score: 4, putts: 2, madeBy: undefined as string | undefined });
  const [completedRound, setCompletedRound] = useState<Round | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const isScramble = format === "scramble";
  const isFourball = format === "best_ball";
  const isMatchPlay = format === "match_play";
  const isStableford = format === "stableford";

  if (completedRound) {
    const completedCourse = COURSES.find((c) => c.id === completedRound.courseId);
    const cme = completedRound.players.find((p) => p.isMe) ?? completedRound.players[0];
    const cScores = cme ? (completedRound.scores[cme.id] ?? []) : [];
    const cTotal = cScores.reduce((a, s) => a + s.score, 0);
    const cVsPar = cScores.reduce((a, s) => {
      const h = completedCourse?.holes.find((h) => h.number === s.hole);
      return a + (s.score - (h?.par ?? 4));
    }, 0);
    const vpText = cVsPar === 0 ? "E" : cVsPar > 0 ? `+${cVsPar}` : `${cVsPar}`;
    const vpColor = cVsPar < 0 ? "var(--score-birdie)" : cVsPar === 0 ? "var(--score-par)" : "var(--score-double)";

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const compressed = await compressImage(file);
      setRoundPhoto(completedRound.id, compressed);
      setCompletedRound({ ...completedRound, photoUrl: compressed });
      toast.success("Photo added!");
      e.target.value = "";
    };

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: "max(env(safe-area-inset-top), 32px)", paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}>
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6 overflow-y-auto">
          <div className="text-center">
            <div className="h-16 w-16 rounded-full mx-auto mb-4 grid place-items-center" style={{ background: "var(--accent-tint)", border: "2px solid hsl(var(--action))" }}>
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                <path d="M2 11L10 19L26 3" stroke="hsl(var(--action))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="gm-eyebrow" style={{ color: "var(--text-muted)" }}>Round Complete</div>
            <div className="font-display text-foreground font-bold text-5xl tabular-nums leading-none mt-2">{cTotal}</div>
            <div className="text-xl font-bold mt-1" style={{ color: vpColor }}>{vpText}</div>
            <div className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{tournamentName}</div>
          </div>
          {completedRound.photoUrl ? (
            <div className="w-full">
              <div className="w-full overflow-hidden border border-border rounded-2xl" style={{ aspectRatio: "4/3", maxHeight: 220 }}>
                <img src={completedRound.photoUrl} alt="Round" className="w-full h-full object-cover" />
              </div>
              <button onClick={() => photoRef.current?.click()} className="flex items-center justify-center gap-2 w-full mt-2 py-2 text-sm font-semibold text-action">
                <Camera className="h-4 w-4" /> Replace Photo
              </button>
            </div>
          ) : (
            <button onClick={() => photoRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-3 py-10 bg-muted/50 border-2 border-dashed border-border rounded-2xl">
              <Camera className="h-8 w-8 text-action" />
              <div className="text-sm font-semibold text-muted-foreground">Add Round Photo</div>
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>
        <div className="px-5 pt-4">
          <button onClick={onExit} className="w-full h-14 rounded-2xl font-bold text-base uppercase tracking-wider active:scale-[0.98] transition-transform bg-action text-action-foreground">
            ГОТОВО
          </button>
        </div>
      </div>
    );
  }

  if (!activeRound) {
    return (
      <Card className="p-8 text-center">
        <div className="text-muted-foreground mb-4">No active round</div>
        <Button onClick={onExit}>Back</Button>
      </Card>
    );
  }

  const course = COURSES.find((c) => c.id === activeRound.courseId)!;
  const _mode = activeRound.holesMode ?? "18";
  const playHoles = _mode === "front9"
    ? course.holes.filter((h) => h.number <= 9)
    : _mode === "back9"
    ? course.holes.filter((h) => h.number > 9)
    : course.holes;
  const currentHole = playHoles[holeIdx];
  const totalHoles = playHoles.length;
  const mePlayer = activeRound.players.find((p) => p.isMe);

  // Teams
  const teams = activeRound.teams;
  const teamAIds = teams?.[0] ?? (activeRound.players.length >= 2 ? [activeRound.players[0].id, activeRound.players[1]?.id].filter(Boolean) as string[] : []);
  const teamBIds = teams?.[1] ?? (activeRound.players.length >= 4 ? [activeRound.players[2].id, activeRound.players[3]?.id].filter(Boolean) as string[] : []);
  const teamAPlayers = activeRound.players.filter((p) => teamAIds.includes(p.id));
  const teamBPlayers = activeRound.players.filter((p) => teamBIds.includes(p.id));

  // For Scramble: show 2 team entries (captains)
  const scoringPlayers = isScramble
    ? [teamAPlayers[0], teamBPlayers[0]].filter(Boolean)
    : activeRound.players;

  // Fourball: who has best score for their team on current hole
  const fourballBest = (teamIds: string[]) => {
    if (!isFourball) return null;
    let bestId: string | null = null;
    let bestScore = Infinity;
    teamIds.forEach((id) => {
      const s = activeRound.scores[id]?.find((x) => x.hole === currentHole.number);
      if (s && s.score < bestScore) { bestScore = s.score; bestId = id; }
    });
    return bestId;
  };
  const fourballBestA = fourballBest(teamAIds);
  const fourballBestB = fourballBest(teamBIds);

  const openSheet = (p: Player, teamMembers: Player[] = []) => {
    const existing = activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number);
    setHole({
      score: existing?.score ?? currentHole.par,
      putts: existing?.putts ?? 2,
      madeBy: existing?.madeBy ?? teamMembers[0]?.id,
    });
    setSheetPlayer(p);
    setSheetTeamMembers(teamMembers);
  };

  const openNextPlayer = () => {
    if (isScramble) {
      const captains = [teamAPlayers[0], teamBPlayers[0]].filter(Boolean);
      const next = captains.find((c) => !activeRound.scores[c.id]?.find((x) => x.hole === currentHole.number)) ?? captains[0];
      const members = teamAPlayers.includes(next) ? teamAPlayers : teamBPlayers;
      openSheet(next, members);
    } else {
      const next =
        activeRound.players.find((p) => !activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number)) ??
        activeRound.players[0];
      openSheet(next, []);
    }
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
      madeBy: isScramble ? hole.madeBy : undefined,
    });
    setSheetPlayer(null);
    setSheetTeamMembers([]);

    const checkPlayers = isScramble
      ? [teamAPlayers[0], teamBPlayers[0]].filter(Boolean)
      : activeRound.players;

    const allOthersScored = checkPlayers
      .filter((p) => p.id !== sheetPlayer.id)
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

  const total = (p: Player) => activeRound.scores[p.id]?.reduce((a, s) => a + (s.score || 0), 0) ?? 0;
  const totalVsPar = (p: Player) => {
    const played = activeRound.scores[p.id] ?? [];
    return played.reduce((a, s) => {
      const h = course.holes.find((h) => h.number === s.hole);
      return a + (s.score - (h?.par ?? 0));
    }, 0);
  };

  // Stableford points for a player
  const totalPoints = (p: Player) =>
    (activeRound.scores[p.id] ?? []).reduce((a, s) => {
      const h = course.holes.find((h) => h.number === s.hole);
      return a + stablefordPoints(s.score, h?.par ?? 4);
    }, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5" style={{ paddingTop: 10, paddingBottom: 10 }}>
        <button onClick={onExit} className="h-9 w-9 rounded-full grid place-items-center bg-muted">
          <X className="h-4 w-4 text-foreground" strokeWidth={2.5} />
        </button>

        {view === "scoring" ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setHoleIdx(Math.max(0, holeIdx - 1))} disabled={holeIdx === 0} className="h-9 w-9 grid place-items-center disabled:opacity-20">
              <ChevronLeft className="h-6 w-6 text-foreground" strokeWidth={2.5} />
            </button>
            <span className="text-foreground font-bold text-base tracking-wider min-w-[90px] text-center">
              Лунка {currentHole.number}
            </span>
            <button onClick={() => setHoleIdx(Math.min(totalHoles - 1, holeIdx + 1))} disabled={holeIdx === totalHoles - 1} className="h-9 w-9 grid place-items-center disabled:opacity-20">
              <ChevronRight className="h-6 w-6 text-foreground" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <span className="text-foreground font-bold text-base tracking-wider">Leaderboard</span>
        )}

        <button onClick={handleFinish} className="h-9 px-4 rounded-full font-bold text-xs tracking-wider border" style={{ borderColor: "#15361f", color: "#15361f" }}>
          ФИНИШ
        </button>
      </div>

      {/* View toggle */}
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

      {/* Content */}
      {view === "leaderboard" ? (
        <TournamentLeaderboard activeRound={activeRound} course={course} format={format} />
      ) : (
        <div className="flex-1 flex flex-col justify-center px-5 pb-4 gap-4 overflow-y-auto">
          {/* Widget card */}
          <div className="overflow-hidden bg-card border border-border rounded-2xl">
            <div className="gm-eyebrow px-5 pt-4" style={{ color: "#8a7f68" }}>{tournamentName}</div>
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

          {/* Player/team score cards */}
          {isScramble ? (
            // Scramble: show 2 team cards
            [
              { captain: teamAPlayers[0], members: teamAPlayers, label: "Team A" },
              { captain: teamBPlayers[0], members: teamBPlayers, label: "Team B" },
            ].filter((t) => t.captain).map(({ captain, members, label }) => {
              const has = activeRound.scores[captain.id]?.find((x) => x.hole === currentHole.number);
              const madeByPlayer = has?.madeBy ? members.find((p) => p.id === has.madeBy) : null;
              const tp = totalVsPar(captain);
              return (
                <button
                  key={captain.id}
                  onClick={() => openSheet(captain, members)}
                  className="w-full p-4 rounded-2xl flex items-center justify-between gap-3 active:scale-[0.98] transition-transform bg-card border border-border"
                >
                  <div className="text-left min-w-0">
                    <div className="text-foreground font-bold text-sm">{label}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {members.map((p) => p.name.split(" ")[0]).join(" & ")}
                    </div>
                    <div className="font-display text-xs font-bold mt-0.5" style={{ color: parColor(tp) }}>{parSign(tp)}</div>
                  </div>
                  <div className="min-w-[72px] h-16 rounded-xl flex flex-col items-center justify-center gap-0.5"
                    style={has ? { background: "#15361f" } : { background: "#e9e1cf" }}
                  >
                    {has ? (
                      <>
                        <div className="font-display font-bold text-2xl tabular-nums leading-none" style={{ color: "#f3ede1" }}>{has.score}</div>
                        <div className="text-[10px] font-bold" style={{ color: scoreLabelColorOnDark(has.score, currentHole.par) }}>
                          {scoreLabel(has.score, currentHole.par)}
                        </div>
                        {madeByPlayer && (
                          <div className="text-[9px] leading-none" style={{ color: "rgba(243,237,225,0.7)" }}>{madeByPlayer.name.split(" ")[0]}</div>
                        )}
                      </>
                    ) : (
                      <div className="text-2xl font-light" style={{ color: "#8a7f68" }}>—</div>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            // Individual players (Stroke Play / Stableford / Match Play / Fourball)
            activeRound.players.map((p) => {
              const has = activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number);
              const tp = totalVsPar(p);
              const pts = totalPoints(p);
              const isBestForTeam = isFourball && (p.id === fourballBestA || p.id === fourballBestB);
              return (
                <button
                  key={p.id}
                  onClick={() => openSheet(p)}
                  className="w-full p-4 rounded-2xl flex items-center justify-between gap-3 active:scale-[0.98] transition-transform bg-card border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.name} tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
                    <div className="text-left min-w-0">
                      <div className="text-foreground font-semibold truncate flex items-center gap-1.5">
                        {p.name.split(" ")[0]}
                        {isFourball && isBestForTeam && has && (
                          <span className="text-[10px] font-bold px-1 rounded bg-action/20 text-action">★ best</span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {isStableford ? `${pts} pts` : parSign(tp)}
                        {isFourball && (
                          <span className="text-muted-foreground/70 text-xs ml-1">
                            {teamAIds.includes(p.id) ? "Team A" : "Team B"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-[60px] h-14 rounded-xl flex flex-col items-center justify-center"
                    style={has ? { background: "#15361f" } : { background: "#e9e1cf" }}
                  >
                    {has ? (
                      <>
                        <div className="font-display font-bold text-2xl tabular-nums leading-none" style={{ color: "#f3ede1" }}>{has.score}</div>
                        <div className="text-[10px] font-bold mt-0.5" style={{ color: scoreLabelColorOnDark(has.score, currentHole.par) }}>
                          {scoreLabel(has.score, currentHole.par)}
                        </div>
                        {isStableford && (
                          <div className="text-[9px] font-bold" style={{ color: "#c9a24b" }}>
                            +{stablefordPoints(has.score, currentHole.par)}pts
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground text-2xl font-light">—</div>
                    )}
                  </div>
                </button>
              );
            })
          )}

          {/* Hole progress dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {playHoles.map((h, i) => {
              const checkIds = isScramble
                ? [teamAPlayers[0]?.id, teamBPlayers[0]?.id].filter(Boolean) as string[]
                : activeRound.players.map((p) => p.id);
              const scored = checkIds.some((id) => activeRound.scores[id]?.find((s) => s.hole === h.number));
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

      {/* Score Sheet */}
      {sheetPlayer && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/40" onClick={() => { setSheetPlayer(null); setSheetTeamMembers([]); }} />
          <div className="relative w-full animate-in slide-in-from-bottom duration-250 bg-card border-t rounded-t-3xl" style={{ borderColor: "#c9a24b", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1 bg-border" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar name={sheetPlayer.name} tone={sheetPlayer.isMe ? "orange" : "muted"} photoUrl={sheetPlayer.photoUrl} />
                <div>
                  <div className="text-foreground font-bold">
                    {isScramble
                      ? sheetTeamMembers.map((p) => p.name.split(" ")[0]).join(" & ")
                      : sheetPlayer.name.split(" ")[0]
                    }
                  </div>
                  <div className="text-muted-foreground text-xs">Лунка {currentHole.number} · Par {currentHole.par}</div>
                </div>
              </div>
              <button onClick={() => { setSheetPlayer(null); setSheetTeamMembers([]); }} className="h-9 w-9 rounded-full grid place-items-center border border-border">
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>

            <div className="px-5 pt-5 pb-2">
              {/* Score counter */}
              <div className="flex flex-col items-center mb-4 border border-border rounded-2xl overflow-hidden">
                <div className="gm-eyebrow pt-3 pb-1 text-muted-foreground">СЧЁТ</div>
                <button onClick={() => setHole((h) => ({ ...h, score: h.score + 1 }))} className="w-full h-14 grid place-items-center transition-colors active:bg-black/5" style={{ color: "#15361f" }}>
                  <Plus className="h-7 w-7" strokeWidth={2.5} />
                </button>
                <div className="font-display text-4xl font-bold tabular-nums text-foreground py-0.5">{hole.score}</div>
                <div className="text-[11px] font-bold mb-0.5" style={{ color: scoreLabelColor(hole.score, currentHole.par) }}>
                  {scoreLabel(hole.score, currentHole.par)}
                  {isStableford && <span className="text-muted-foreground ml-1">· {stablefordPoints(hole.score, currentHole.par)} pts</span>}
                </div>
                <button onClick={() => setHole((h) => ({ ...h, score: Math.max(1, h.score - 1) }))} className="w-full h-14 grid place-items-center transition-colors active:bg-black/5" style={{ color: "#15361f" }}>
                  <span className="text-3xl leading-none font-bold">−</span>
                </button>
              </div>

              {/* Scramble: "Чей мяч?" selector */}
              {isScramble && sheetTeamMembers.length > 0 && (
                <div className="mb-4">
                  <div className="gm-eyebrow mb-2 text-muted-foreground">Чей мяч?</div>
                  <div className="flex gap-2">
                    {sheetTeamMembers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setHole((h) => ({ ...h, madeBy: p.id }))}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border-2"
                        style={hole.madeBy === p.id
                          ? { background: "#15361f", borderColor: "#15361f", color: "#f3ede1" }
                          : { background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.name} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <Avatar name={p.name} size="sm" />
                        )}
                        {p.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

export default TournamentPlayPage;
