import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { COURSES, type Hole } from "@/lib/courses";
import type { HolesMode, Round } from "@/store/golfStore";
import { TournamentLiveLeaderboard } from "@/components/TournamentLiveLeaderboard";
import type { FormatId } from "@/lib/formats";
import { cn } from "@/lib/utils";

export type GroupPlayer = { id: string; name: string; hcp: number };

type Props = {
  tournamentId: string;
  format: FormatId;
  courseId: string;
  holesMode: HolesMode;
  roundId: string;
  myId: string;
  players: GroupPlayer[];
  marker: GroupPlayer | null;
  onExit: () => void;
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
    <div className="text-white/60 text-xs uppercase tracking-wider font-semibold truncate max-w-[120px]">{label}</div>
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

export const TournamentGroupScoring = ({ tournamentId, format, courseId, holesMode, roundId, myId, players, marker, onExit }: Props) => {
  const course = COURSES.find((c) => c.id === courseId);
  const playHoles = course ? playHolesFor(course.holes, holesMode) : [];

  const [view, setView] = useState<"scoring" | "live">("scoring");
  const [holeIdx, setHoleIdx] = useState(0);
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [myScore, setMyScore] = useState(4);
  const [markerScore, setMarkerScore] = useState(4);
  const [saving, setSaving] = useState(false);

  const loadRounds = () =>
    api.get<Round[]>(`/api/tournaments/${tournamentId}/rounds`).then(setRounds).catch(() => {});

  useEffect(() => {
    api.post(`/api/tournaments/${tournamentId}/checkin`, {}).catch(() => {});
    loadRounds();
    const t = setInterval(loadRounds, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const myName = players.find((p) => p.id === myId)?.name ?? "Я";
  const currentHole = playHoles[holeIdx];
  const totalHoles = playHoles.length;
  const round = rounds?.find((r) => r.id === roundId);
  const scoreFor = (playerId: string, hole: number) => round?.scores[playerId]?.find((s) => s.hole === hole)?.score;

  useEffect(() => {
    if (!currentHole) return;
    setMyScore(scoreFor(myId, currentHole.number) ?? currentHole.par);
    setMarkerScore(marker ? (scoreFor(marker.id, currentHole.number) ?? currentHole.par) : currentHole.par);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeIdx, rounds]);

  const save = async () => {
    if (!currentHole) return;
    setSaving(true);
    try {
      await api.post(`/api/tournaments/${tournamentId}/scores`, {
        hole: currentHole.number,
        myScore,
        markerScore: marker ? markerScore : undefined,
      });
      await loadRounds();
      if (holeIdx < totalHoles - 1) setHoleIdx((h) => h + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (!course || !currentHole) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4" style={{ background: "#0a0a0a" }}>
        <div className="text-white/60 text-sm">Данные поля не найдены</div>
        <button onClick={onExit} className="text-action font-semibold">Назад</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
      <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(var(--tg-safe-top) + 10px)", paddingBottom: 10 }}>
        <button onClick={onExit} className="h-9 w-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,0.1)" }}>
          <X className="h-4 w-4 text-white" strokeWidth={2.5} />
        </button>
        {view === "scoring" ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setHoleIdx((h) => Math.max(0, h - 1))} disabled={holeIdx === 0} className="h-9 w-9 grid place-items-center disabled:opacity-20">
              <ChevronLeft className="h-6 w-6 text-white" strokeWidth={2.5} />
            </button>
            <span className="text-white font-bold text-base tracking-wider min-w-[90px] text-center">Лунка {currentHole.number}</span>
            <button onClick={() => setHoleIdx((h) => Math.min(totalHoles - 1, h + 1))} disabled={holeIdx === totalHoles - 1} className="h-9 w-9 grid place-items-center disabled:opacity-20">
              <ChevronRight className="h-6 w-6 text-white" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <span className="text-white font-bold text-base tracking-wider">Live</span>
        )}
        <div className="w-9" />
      </div>

      <div className="px-5 pb-3 flex gap-2">
        <button
          onClick={() => setView("scoring")}
          className={cn("flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-wider", view === "scoring" ? "bg-action text-action-foreground" : "text-white/50")}
        >
          Счёт
        </button>
        <button
          onClick={() => setView("live")}
          className={cn("flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-wider", view === "live" ? "bg-action text-action-foreground" : "text-white/50")}
        >
          Live
        </button>
      </div>

      {view === "live" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <TournamentLiveLeaderboard tournamentId={tournamentId} format={format} />
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-white/40 text-xs uppercase tracking-[0.2em] font-semibold mb-1">
              Par {currentHole.par} · Hole {currentHole.number}
            </div>
            <div className="flex items-center justify-center gap-2 text-white/50 text-xs mb-8">
              <span>{scoreLabel(myScore, currentHole.par)}</span>
              {marker && <><span>·</span><span>{scoreLabel(markerScore, currentHole.par)}</span></>}
            </div>

            <div className="w-full flex items-start gap-6">
              <Stepper label={myName} value={myScore} onChange={setMyScore} />
              {marker && (
                <>
                  <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <Stepper label={`${marker.name} (маркер)`} value={markerScore} onChange={setMarkerScore} />
                </>
              )}
            </div>

            {!marker && (
              <div className="text-white/40 text-xs mt-6 text-center max-w-xs">
                Вы играете один в группе — маркер не назначен
              </div>
            )}
          </div>

          <div className="px-5 pb-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
            <button
              onClick={save}
              disabled={saving}
              className="w-full h-14 rounded-xl font-bold text-base bg-action text-action-foreground active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {saving ? "Сохранение..." : holeIdx < totalHoles - 1 ? "Сохранить и дальше" : "Сохранить"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
