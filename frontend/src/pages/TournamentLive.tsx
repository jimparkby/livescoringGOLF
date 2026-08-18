import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Minus, Plus, Flag, Trophy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { COURSES, type Hole } from "@/lib/courses";
import type { HolesMode, Round } from "@/store/golfStore";
import type { FormatId } from "@/lib/formats";
import { TournamentLiveLeaderboard } from "@/components/TournamentLiveLeaderboard";
import { HoleGridNav } from "@/components/HoleGridNav";

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
    <div className="text-white/60 text-xs uppercase tracking-wider font-semibold truncate max-w-[140px]">{label}</div>
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="h-11 w-11 rounded-full grid place-items-center active:scale-95 transition-transform"
        style={{ background: "rgba(255,255,255,0.1)" }}
      >
        <Minus className="h-5 w-5 text-white" strokeWidth={2.5} />
      </button>
      <div className="text-5xl font-black text-white tabular-nums w-16 text-center">{value}</div>
      <button
        onClick={() => onChange(Math.min(15, value + 1))}
        className="h-11 w-11 rounded-full grid place-items-center active:scale-95 transition-transform"
        style={{ background: "rgba(34,197,94,0.25)" }}
      >
        <Plus className="h-5 w-5 text-action" strokeWidth={2.5} />
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
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ background: "#0a0a0a" }}>
        <div className="text-4xl mb-2">⛳</div>
        <div className="text-white font-bold text-lg">Ссылка недействительна</div>
        <div className="text-white/40 text-sm">Проверьте ссылку или обратитесь к организатору</div>
      </div>
    );
  }

  if (!link || !course || !currentHole) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="h-8 w-8 rounded-full border-2 border-action border-t-transparent animate-spin" />
      </div>
    );
  }

  const playedHoles = new Set(
    playHoles.filter((h) => scoreFor(link.myId, h.number) != null).map((h) => h.number),
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
      <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)", paddingBottom: 10 }}>
        <div className="text-white font-bold text-sm truncate">{link.tournamentName}</div>
        {link.flightLabel && <div className="text-white/40 text-xs shrink-0 ml-2">{link.flightLabel}</div>}
      </div>

      {view === "scoring" && (
        <div className="px-5 pb-3">
          <HoleGridNav
            holes={playHoles.map((h) => h.number)}
            currentHole={currentHole.number}
            playedHoles={playedHoles}
            onSelect={(h) => setHoleIdx(playHoles.findIndex((x) => x.number === h))}
          />
        </div>
      )}

      {view === "live" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <TournamentLiveLeaderboard tournamentId={link.tournamentId} format={link.format} />
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-white/40 text-xs uppercase tracking-[0.2em] font-semibold mb-1">
              Par {currentHole.par} · Hole {currentHole.number}
            </div>
            <div className="flex items-center justify-center gap-2 text-white/50 text-xs mb-8">
              <span>{scoreLabel(myScore, currentHole.par)}</span>
              {link.marker && <><span>·</span><span>{scoreLabel(markerScore, currentHole.par)}</span></>}
            </div>

            <div className="w-full flex items-start gap-6">
              <Stepper label={(link.myName || "Я").split(" ")[0]} value={myScore} onChange={setMyScore} />
              {link.marker && (
                <>
                  <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <Stepper label={`${link.marker.name.split(" ")[0]} · маркер`} value={markerScore} onChange={setMarkerScore} />
                </>
              )}
            </div>

            {!link.marker && (
              <div className="text-white/40 text-xs mt-6 text-center max-w-xs">
                Вы играете один в группе — маркер не назначен
              </div>
            )}
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={save}
              disabled={saving}
              className="w-full h-14 rounded-xl font-bold text-base bg-action text-action-foreground active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </>
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
          onClick={() => setView("live")}
          className="flex-1 h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wider"
          style={{ color: view === "live" ? "#22c55e" : "rgba(255,255,255,0.4)" }}
        >
          <Trophy className="h-4 w-4" />
          ТАБЛИЦА
        </button>
      </div>
    </div>
  );
};

export default TournamentLivePage;
