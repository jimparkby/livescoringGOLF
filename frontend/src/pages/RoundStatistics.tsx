import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { BarChart3, Flag } from "lucide-react";
import { useGolf } from "@/store/golfStore";
import { getDifferentials, calcHandicapIndex } from "@/lib/handicap";
import { getAllCourses } from "@/lib/courses";

// Mini-app "Статистика" tab: personal stats from rounds actually played in
// the mini app (casual, non-tournament rounds) — a different audience than
// the site's club-wide tournament rating page, which lives at the same
// "/statistics" route on the site (see App.tsx).
const getHolePar = (courseId: string, holeNumber: number): number =>
  getAllCourses().find((c) => c.id === courseId)?.holes.find((h) => h.number === holeNumber)?.par ?? 4;

const parSign = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
const parColor = (v: number) => (v < 0 ? "var(--score-birdie)" : v === 0 ? "var(--score-par)" : "var(--score-double)");

function roundTotals(courseId: string, scores: { hole: number; score: number }[]) {
  const course = getAllCourses().find((c) => c.id === courseId);
  const total = scores.reduce((a, s) => a + s.score, 0);
  const vsPar = scores.reduce((a, s) => {
    const h = course?.holes.find((h) => h.number === s.hole);
    return a + (s.score - (h?.par ?? 4));
  }, 0);
  return { total, vsPar };
}

const RoundStatisticsPage = () => {
  const navigate = useNavigate();
  const { rounds, profile } = useGolf();

  const casualRounds = useMemo(
    () => rounds.filter((r) => r.completed && !r.tournamentId),
    [rounds],
  );

  const diffs = useMemo(
    () => getDifferentials(casualRounds, "me", profile.hcp),
    [casualRounds, profile.hcp],
  );
  const hcpIndex = calcHandicapIndex(diffs.map((d) => d.differential));
  const hcpToShow = hcpIndex ?? profile.hcp;

  const perfStats = useMemo(() => {
    if (casualRounds.length === 0) return null;
    let totalHoles = 0, girCount = 0, fairwayCount = 0, totalPutts = 0, totalPenalties = 0;
    casualRounds.forEach((r) => {
      const me = r.players.find((p) => p.isMe);
      (me ? r.scores[me.id] ?? [] : []).forEach((s) => {
        if (s.score > 0) {
          totalHoles++;
          if (s.gir) girCount++;
          if (s.driving) fairwayCount++;
          totalPutts += s.putts || 0;
          totalPenalties += s.penalties || 0;
        }
      });
    });
    return {
      gir: totalHoles > 0 ? Math.round((girCount / totalHoles) * 100) : 0,
      fairways: totalHoles > 0 ? Math.round((fairwayCount / totalHoles) * 100) : 0,
      putts: casualRounds.length > 0 ? (totalPutts / casualRounds.length).toFixed(1) : "0",
      penalties: casualRounds.length > 0 ? (totalPenalties / casualRounds.length).toFixed(1) : "0",
    };
  }, [casualRounds]);

  const scoringBreakdown = useMemo(() => {
    let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0;
    casualRounds.forEach((r) => {
      const me = r.players.find((p) => p.isMe);
      (me ? r.scores[me.id] ?? [] : []).forEach((s) => {
        if (s.score > 0) {
          const d = s.score - getHolePar(r.courseId, s.hole);
          if (d <= -2) eagles++;
          else if (d === -1) birdies++;
          else if (d === 0) pars++;
          else if (d === 1) bogeys++;
          else doubles++;
        }
      });
    });
    const total = eagles + birdies + pars + bogeys + doubles;
    return [
      { key: "eagle", label: "Eagle", count: eagles, color: "var(--score-eagle)" },
      { key: "birdie", label: "Birdie", count: birdies, color: "var(--score-birdie)" },
      { key: "par", label: "Par", count: pars, color: "var(--score-par)" },
      { key: "bogey", label: "Bogey", count: bogeys, color: "var(--score-bogey)" },
      { key: "double", label: "Double+", count: doubles, color: "var(--score-double)" },
    ].filter((s) => total > 0);
  }, [casualRounds]);

  const scoreTotal = scoringBreakdown.reduce((a, s) => a + s.count, 0);

  if (casualRounds.length === 0) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div>
          <div className="gm-eyebrow">Statistics</div>
          <h1 className="text-3xl mt-1">Моя статистика</h1>
          <p className="text-sm text-muted-foreground mt-1">По раундам, сыгранным в мини-апе</p>
        </div>
        <Card className="p-6 text-center shadow-none border border-border">
          <div className="text-sm text-muted-foreground">Пока нет сыгранных раундов</div>
          <button
            onClick={() => navigate("/round")}
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-action"
          >
            <Flag className="h-3.5 w-3.5" /> Начать первый раунд
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <div className="gm-eyebrow">Statistics</div>
        <h1 className="text-3xl mt-1">Моя статистика</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {casualRounds.length} {casualRounds.length === 1 ? "раунд" : "раундов"} в мини-апе
        </p>
      </div>

      <Card className="p-5 shadow-none border border-border">
        <div className="text-center rounded-xl py-4" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
          <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{hcpToShow.toFixed(1)}</div>
          <div className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>HCP</div>
        </div>
      </Card>

      {perfStats && (
        <div>
          <div className="gm-eyebrow mb-2 px-1">Показатели</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center rounded-lg py-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold" style={{ color: "var(--accent)" }}>{perfStats.gir}%</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">GIR</div>
            </div>
            <div className="text-center rounded-lg py-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold">{perfStats.fairways}%</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Fairways</div>
            </div>
            <div className="text-center rounded-lg py-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)" }}>
              <div className="font-display text-lg font-bold">{perfStats.putts}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Putts</div>
            </div>
          </div>
        </div>
      )}

      {scoreTotal > 0 && (
        <Card className="p-5 shadow-none border border-border">
          <div className="flex items-baseline justify-between mb-4">
            <div className="font-bold text-sm">Счёт по лункам</div>
            <div className="text-xs text-muted-foreground">{scoreTotal} лунок</div>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {scoringBreakdown.map((s) => (
              <div key={s.key} title={s.label} style={{ flex: s.count, background: s.color }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 mt-4">
            {scoringBreakdown.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-sm flex-1 text-muted-foreground">{s.label}</span>
                <span className="text-sm font-bold tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <div className="gm-eyebrow mb-2 px-1">Раунды</div>
        <div className="space-y-2">
          {casualRounds.map((r) => {
            const me = r.players.find((p) => p.isMe);
            const { total, vsPar } = roundTotals(r.courseId, me ? r.scores[me.id] ?? [] : []);
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
                  <div className="text-sm font-semibold truncate">{r.courseName.split(" · ")[0]}</div>
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

      <button
        onClick={() => navigate("/profile")}
        className="flex items-center justify-center gap-1.5 w-full text-xs font-bold text-action py-2"
      >
        <BarChart3 className="h-3.5 w-3.5" /> Подробная статистика в профиле
      </button>
    </div>
  );
};

export default RoundStatisticsPage;
