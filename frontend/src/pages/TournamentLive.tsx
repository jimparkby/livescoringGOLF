import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Minus, Plus, Trophy, Flag } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { COURSES, type Hole } from "@/lib/courses";
import type { HolesMode, Round } from "@/store/golfStore";
import type { FormatId } from "@/lib/formats";
import { courseHandicap, playingHandicap } from "@/lib/handicap";
import { TournamentLiveLeaderboard } from "@/components/TournamentLiveLeaderboard";
import { HoleGridNav } from "@/components/HoleGridNav";

type GroupPlayer = { id: string; name: string; hcp: number };

type LiveLinkData = {
  tournamentId: string;
  tournamentName: string;
  courseId: string | null;
  format: FormatId;
  holesMode: HolesMode;
  tee: string;
  rating: number | null;
  slope: number | null;
  roundId: string;
  myId: string;
  myName: string;
  flightLabel: string | null;
  group: { players: GroupPlayer[] };
  marker: GroupPlayer | null;
};

function playHolesFor(holes: Hole[], mode: HolesMode) {
  return mode === "front9" ? holes.filter((h) => h.number <= 9)
    : mode === "back9" ? holes.filter((h) => h.number > 9)
    : holes;
}

const scoreLabel = (score: number, par: number) => {
  const d = score - par;
  if (d <= -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  return `+${d}`;
};

const Header = () => (
  <div className="flex items-center gap-2 px-5 h-14 shrink-0" style={{ background: "#0d1f14", paddingTop: "env(safe-area-inset-top, 0px)" }}>
    <Trophy className="h-5 w-5" style={{ color: "#c9a24b" }} strokeWidth={2} />
    <span className="font-black tracking-wider text-sm text-white">GOLF CLUB MINSK</span>
  </div>
);

const Stepper = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="flex-1 flex flex-col items-center gap-3">
    <div className="text-xs uppercase tracking-wider font-bold truncate max-w-[140px] text-muted-foreground">{label}</div>
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="h-11 w-11 rounded-full grid place-items-center active:scale-95 transition-transform border border-border"
      >
        <Minus className="h-5 w-5 text-foreground" strokeWidth={2.5} />
      </button>
      <div className="text-5xl font-black tabular-nums w-16 text-center text-foreground">{value}</div>
      <button
        onClick={() => onChange(Math.min(15, value + 1))}
        className="h-11 w-11 rounded-full grid place-items-center active:scale-95 transition-transform"
        style={{ background: "rgba(44,107,61,0.12)" }}
      >
        <Plus className="h-5 w-5" style={{ color: "#2c6b3d" }} strokeWidth={2.5} />
      </button>
    </div>
  </div>
);

// Public per-player live-scoring link — /tlive/:token, no login. Handed out
// (as a link or QR) once the admin builds tournament groups; whoever has it
// can enter their own score and their marker's, same idea as the paper
// scorecard QR at the tee.
const TournamentLivePage = () => {
  const { token } = useParams<{ token: string }>();
  const [link, setLink] = useState<LiveLinkData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<"scoring" | "live">("scoring");
  const [holeIdx, setHoleIdx] = useState(0);
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [myScore, setMyScore] = useState(4);
  const [markerScore, setMarkerScore] = useState(4);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(() => token ? sessionStorage.getItem(`tlive-confirmed-${token}`) === "1" : false);

  const confirmIntro = () => {
    if (token) sessionStorage.setItem(`tlive-confirmed-${token}`, "1");
    setConfirmed(true);
  };

  useEffect(() => {
    if (!token) return;
    api.get<LiveLinkData>(`/api/tournaments/live/${token}`).then(setLink).catch(() => setNotFound(true));
  }, [token]);

  const loadRounds = () => {
    if (!link) return;
    api.get<Round[]>(`/api/tournaments/${link.tournamentId}/rounds`).then(setRounds).catch(() => {});
  };

  useEffect(() => {
    if (!link) return;
    loadRounds();
    const t = setInterval(loadRounds, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.tournamentId]);

  const course = link?.courseId ? COURSES.find((c) => c.id === link.courseId) : undefined;
  const playHoles = course ? playHolesFor(course.holes, link?.holesMode ?? "18") : [];
  const currentHole = playHoles[holeIdx];
  const round = rounds?.find((r) => r.id === link?.roundId);
  const scoreFor = (playerId: string, hole: number) => round?.scores[playerId]?.find((s) => s.hole === hole)?.score;

  useEffect(() => {
    if (!currentHole || !link) return;
    setMyScore(scoreFor(link.myId, currentHole.number) ?? currentHole.par);
    setMarkerScore(link.marker ? (scoreFor(link.marker.id, currentHole.number) ?? currentHole.par) : currentHole.par);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeIdx, rounds, link]);

  const save = async () => {
    if (!currentHole || !token || !link) return;
    setSaving(true);
    try {
      await api.post(`/api/tournaments/live/${token}/scores`, {
        hole: currentHole.number,
        myScore,
        markerScore: link.marker ? markerScore : undefined,
      });
      await loadRounds();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center bg-background">
        <Flag className="h-10 w-10 mb-2 text-muted-foreground" />
        <div className="font-bold text-lg text-foreground">Ссылка недействительна</div>
        <div className="text-sm text-muted-foreground">Проверьте ссылку или обратитесь к организатору</div>
      </div>
    );
  }

  if (!link || !course || !currentHole) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#15361f", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const playedHoles = new Set(
    playHoles.filter((h) => scoreFor(link.myId, h.number) != null).map((h) => h.number),
  );

  if (!confirmed) {
    const myHcp = link.group.players.find((p) => p.id === link.myId)?.hcp ?? 0;
    const ch = link.rating != null && link.slope != null ? courseHandicap(myHcp, link.slope, link.rating, course.totalPar) : null;
    const ph = link.rating != null && link.slope != null ? playingHandicap(myHcp, link.slope, link.rating, course.totalPar) : null;

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <Header />

        <div className="flex-1 overflow-y-auto px-5 py-2">
          <div className="text-xl mt-4 text-foreground">Привет, <b>{link.myName}</b>!</div>
          <div className="text-sm mt-1 text-muted-foreground">Добро пожаловать на <b>{link.tournamentName}</b></div>

          <div className="rounded-xl mt-5 overflow-hidden" style={{ background: "#15361f" }}>
            {link.flightLabel && (
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <span className="text-sm" style={{ color: "#9fc2a8" }}>Группа</span>
                <span className="text-sm font-bold text-white">{link.flightLabel}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm" style={{ color: "#9fc2a8" }}>Поле</span>
              <span className="text-sm font-bold text-white">{course.name}</span>
            </div>
          </div>

          <div className="rounded-xl mt-3 overflow-hidden bg-card border border-border shadow-soft">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Handicap Index</span>
              <span className="text-sm font-bold text-foreground">{myHcp.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Course Handicap</span>
              <span className="text-sm font-bold text-foreground">{ch ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Playing Handicap</span>
              <span className="text-sm font-bold text-foreground">{ph ?? "—"}</span>
            </div>
          </div>

          {link.marker && (
            <div className="rounded-xl mt-3 overflow-hidden" style={{ background: "rgba(201,162,75,0.12)", border: "1px solid rgba(201,162,75,0.35)" }}>
              <div className="px-4 py-3">
                <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "#a5822f" }}>Вы маркер для</div>
                <div className="text-base font-bold text-foreground mt-0.5">{link.marker.name}</div>
                <div className="text-xs mt-1 text-muted-foreground">Вносите его счёт и свой — он делает то же самое для вас</div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
          <button
            onClick={confirmIntro}
            className="w-full h-14 rounded-xl font-bold text-base text-white active:scale-[0.98] transition-transform"
            style={{ background: "#15361f" }}
          >
            Подтвердить и продолжить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <Header />

      <div className="px-5 py-3 text-center border-b border-border">
        <div className="font-bold text-lg tracking-wide truncate text-foreground">{link.tournamentName}</div>
        {link.flightLabel && <div className="text-xs uppercase tracking-wide mt-0.5 text-muted-foreground">{link.flightLabel}</div>}
      </div>

      {view === "scoring" && (
        <div className="px-5 pt-3 pb-1">
          <HoleGridNav
            variant="brand"
            holes={playHoles.map((h) => h.number)}
            currentHole={currentHole.number}
            playedHoles={playedHoles}
            onSelect={(h) => setHoleIdx(playHoles.findIndex((x) => x.number === h))}
          />
        </div>
      )}

      {view === "live" ? (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <TournamentLiveLeaderboard tournamentId={link.tournamentId} format={link.format} />
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-1 text-muted-foreground">
              Par {currentHole.par} · Hole {currentHole.number}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs mb-8 text-muted-foreground">
              <span>{scoreLabel(myScore, currentHole.par)}</span>
              {link.marker && <><span>·</span><span>{scoreLabel(markerScore, currentHole.par)}</span></>}
            </div>

            <div className="w-full flex items-start gap-6">
              <Stepper label={(link.myName || "Я").split(" ")[0]} value={myScore} onChange={setMyScore} />
              {link.marker && (
                <>
                  <div className="w-px self-stretch bg-border" />
                  <Stepper label={`${link.marker.name.split(" ")[0]} · маркер`} value={markerScore} onChange={setMarkerScore} />
                </>
              )}
            </div>

            {!link.marker && (
              <div className="text-xs mt-6 text-center max-w-xs text-muted-foreground">
                Вы играете один в группе — маркер не назначен
              </div>
            )}
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={save}
              disabled={saving}
              className="w-full h-14 rounded-xl font-bold text-base text-white active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: "#15361f" }}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </>
      )}

      {/* Bottom nav */}
      <div className="flex shrink-0 bg-card border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <button
          onClick={() => setView("scoring")}
          className="flex-1 h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: view === "scoring" ? "#15361f" : "#a9b6ac" }}
        >
          <Flag className="h-5 w-5" strokeWidth={2.25} />
          Счёт
        </button>
        <button
          onClick={() => setView("live")}
          className="flex-1 h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: view === "live" ? "#15361f" : "#a9b6ac" }}
        >
          <Trophy className="h-5 w-5" strokeWidth={2.25} />
          Таблица
        </button>
      </div>
    </div>
  );
};

export default TournamentLivePage;
