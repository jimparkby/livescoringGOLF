import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { COURSES, type Hole } from "@/lib/courses";
import type { HolesMode, Round } from "@/store/golfStore";
import type { FormatId } from "@/lib/formats";
import { TournamentLiveLeaderboard } from "@/components/TournamentLiveLeaderboard";
import { HoleGridNav } from "@/components/HoleGridNav";
import { LiveScoringLogo } from "@/components/LiveScoringLogo";

const CUPRUM = "Cuprum, Arial, Helvetica, sans-serif";
const INK = "#222430";

type GroupPlayer = { id: string; name: string; hcp: number };

type LiveLinkData = {
  tournamentId: string;
  tournamentName: string;
  courseId: string | null;
  format: FormatId;
  holesMode: HolesMode;
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

const Stepper = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="flex-1 flex flex-col items-center gap-3">
    <div className="text-xs uppercase tracking-wider font-bold truncate max-w-[140px]" style={{ color: "#8a8a8a" }}>{label}</div>
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="h-11 w-11 rounded-full grid place-items-center active:scale-95 transition-transform border"
        style={{ borderColor: "#e5e5e5" }}
      >
        <Minus className="h-5 w-5" style={{ color: INK }} strokeWidth={2.5} />
      </button>
      <div className="text-5xl font-black tabular-nums w-16 text-center" style={{ color: INK }}>{value}</div>
      <button
        onClick={() => onChange(Math.min(15, value + 1))}
        className="h-11 w-11 rounded-full grid place-items-center active:scale-95 transition-transform"
        style={{ background: "#e8f3ee" }}
      >
        <Plus className="h-5 w-5" style={{ color: "#21835b" }} strokeWidth={2.5} />
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
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ background: "#f7f7f7", fontFamily: CUPRUM }}>
        <div className="text-4xl mb-2">⛳</div>
        <div className="font-bold text-lg" style={{ color: INK }}>Ссылка недействительна</div>
        <div className="text-sm" style={{ color: "#8a8a8a" }}>Проверьте ссылку или обратитесь к организатору</div>
      </div>
    );
  }

  if (!link || !course || !currentHole) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#f7f7f7" }}>
        <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#21835b", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const playedHoles = new Set(
    playHoles.filter((h) => scoreFor(link.myId, h.number) != null).map((h) => h.number),
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#f7f7f7", fontFamily: CUPRUM }}>
      <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)", paddingBottom: 10 }}>
        <LiveScoringLogo />
      </div>

      <div className="px-5 py-3 text-center" style={{ background: "#e2e2e2" }}>
        <div className="font-bold text-lg tracking-wide truncate" style={{ color: INK }}>{link.tournamentName}</div>
        {link.flightLabel && <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "#8a8a8a" }}>{link.flightLabel}</div>}
      </div>

      {view === "scoring" && (
        <div className="px-5 pt-3 pb-1">
          <HoleGridNav
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
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-1" style={{ color: "#8a8a8a" }}>
              Par {currentHole.par} · Hole {currentHole.number}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs mb-8" style={{ color: "#8a8a8a" }}>
              <span>{scoreLabel(myScore, currentHole.par)}</span>
              {link.marker && <><span>·</span><span>{scoreLabel(markerScore, currentHole.par)}</span></>}
            </div>

            <div className="w-full flex items-start gap-6">
              <Stepper label={(link.myName || "Я").split(" ")[0]} value={myScore} onChange={setMyScore} />
              {link.marker && (
                <>
                  <div className="w-px self-stretch" style={{ background: "#e5e5e5" }} />
                  <Stepper label={`${link.marker.name.split(" ")[0]} · маркер`} value={markerScore} onChange={setMarkerScore} />
                </>
              )}
            </div>

            {!link.marker && (
              <div className="text-xs mt-6 text-center max-w-xs" style={{ color: "#8a8a8a" }}>
                Вы играете один в группе — маркер не назначен
              </div>
            )}
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={save}
              disabled={saving}
              className="w-full h-14 rounded-xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: "#21835b", color: "#f7f7f7" }}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </>
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
          onClick={() => setView("live")}
          className="flex-1 h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: view === "live" ? "#21835b" : "#8a8a8a" }}
        >
          <span className="text-xl leading-none">🏆</span>
          Таблица
        </button>
      </div>
    </div>
  );
};

export default TournamentLivePage;
