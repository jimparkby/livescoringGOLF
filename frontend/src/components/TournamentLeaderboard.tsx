import { Avatar } from "@/components/PlayerAvatar";
import { COURSES } from "@/lib/courses";
import { stablefordPoints, netStablefordPoints, type FormatId } from "@/lib/formats";
import { calcCourseHcpForMode, holeRankInSet, holeStrokesInSet } from "@/lib/handicap";
import { computePlayerRoundStats } from "@/lib/tournamentLiveScoring";
import { useGolf, type Player } from "@/store/golfStore";
import { cn } from "@/lib/utils";

const parSign = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
const parColor = (v: number) => (v < 0 ? "var(--score-birdie)" : v === 0 ? "#1b1b16" : "var(--score-double)");

/* ── Leaderboard ── */
export const TournamentLeaderboard = ({
  activeRound,
  course,
  format,
}: {
  activeRound: NonNullable<ReturnType<typeof useGolf>["activeRound"]>;
  course: ReturnType<typeof COURSES.find> & object;
  format: FormatId;
}) => {
  const isStableford = format === "stableford";
  const isMatchPlay = format === "match_play";
  const isScramble = format === "scramble";
  const isFourball = format === "best_ball";
  const isTeam = isScramble || isFourball;

  const teams = activeRound.teams;
  const teamAIds = teams?.[0] ?? [];
  const teamBIds = teams?.[1] ?? [];

  /* ── HCP / net-scoring helpers, shared by every format below ── */
  const _mode = activeRound.holesMode ?? "18";
  const playHoles = _mode === "front9"
    ? course.holes.filter((h) => h.number <= 9)
    : _mode === "back9"
    ? course.holes.filter((h) => h.number > 9)
    : course.holes;

  const getCourseHcp = (p: Player) => {
    const teeInfo = course.tees.find((t) => t.color === (p.tee ?? "yellow")) ?? course.tees[0];
    return calcCourseHcpForMode(p.hcp, teeInfo.slope, teeInfo.rating, course.totalPar, _mode);
  };
  const getHoleStrokes = (p: Player, h: typeof course.holes[0]) => {
    const rank = holeRankInSet(h, playHoles);
    return holeStrokesInSet(getCourseHcp(p), rank, playHoles.length);
  };

  /* ── Match Play (2 players or 2 teams) — net: strokes = difference in course HCP ── */
  if (isMatchPlay) {
    const p1 = activeRound.players[0];
    const p2 = activeRound.players[1];
    if (!p1 || !p2) return null;
    const holes = playHoles;
    const ch1 = getCourseHcp(p1);
    const ch2 = getCourseHcp(p2);
    const strokeDiff = Math.abs(ch1 - ch2);
    const receiver = ch1 > ch2 ? p1.id : ch2 > ch1 ? p2.id : null;
    const strokesFor = (playerId: string, h: typeof course.holes[0]) => {
      if (playerId !== receiver) return 0;
      return holeStrokesInSet(strokeDiff, holeRankInSet(h, playHoles), playHoles.length);
    };
    let p1Wins = 0, p2Wins = 0;
    const holeResults: ("p1" | "p2" | "halved" | null)[] = holes.map((h) => {
      const s1 = activeRound.scores[p1.id]?.find((x) => x.hole === h.number);
      const s2 = activeRound.scores[p2.id]?.find((x) => x.hole === h.number);
      if (!s1 || !s2) return null;
      const n1 = s1.score - strokesFor(p1.id, h);
      const n2 = s2.score - strokesFor(p2.id, h);
      if (n1 < n2) { p1Wins++; return "p1"; }
      if (n2 < n1) { p2Wins++; return "p2"; }
      return "halved";
    });
    const diff = p1Wins - p2Wins;
    const statusText = diff === 0 ? "AS" : diff > 0 ? `${diff} UP` : `${Math.abs(diff)} UP`;
    const statusPlayer = diff > 0 ? p1.name.split(" ")[0] : diff < 0 ? p2.name.split(" ")[0] : null;
    return (
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2 space-y-3">
        <div className="p-4 text-center bg-card border border-border">
          <div className="gm-eyebrow mb-1" style={{ color: "#8a7f68" }}>Match status (net)</div>
          <div className="font-display font-bold text-3xl" style={{ color: "#1b1b16" }}>{statusPlayer ? `${statusPlayer} ${statusText}` : "AS"}</div>
          <div className="text-xs mt-1 text-muted-foreground">{p1Wins + p2Wins} holes played</div>
          {strokeDiff > 0 && receiver && (
            <div className="text-[11px] mt-1 text-muted-foreground">
              {(receiver === p1.id ? p1 : p2).name.split(" ")[0]} receives {strokeDiff} strokes (CH {ch1} vs {ch2})
            </div>
          )}
        </div>
        <div className="overflow-hidden bg-card border border-border">
          <div className="grid px-4 py-2.5 gm-eyebrow" style={{ gridTemplateColumns: "1fr auto auto 1fr", color: "#8a7f68", borderBottom: "1px solid hsl(var(--border))" }}>
            <div>{p1.name.split(" ")[0]}</div>
            <div className="w-8 text-center">#</div>
            <div className="w-8 text-center">Par</div>
            <div className="text-right">{p2.name.split(" ")[0]}</div>
          </div>
          {holes.map((h, i) => {
            const r = holeResults[i];
            const s1 = activeRound.scores[p1.id]?.find((x) => x.hole === h.number);
            const s2 = activeRound.scores[p2.id]?.find((x) => x.hole === h.number);
            const dot1 = strokesFor(p1.id, h) > 0;
            const dot2 = strokesFor(p2.id, h) > 0;
            return (
              <div key={h.number} className="grid items-center px-4 py-2 border-t border-border" style={{ gridTemplateColumns: "1fr auto auto 1fr" }}>
                <div className={cn("font-display font-bold text-lg tabular-nums flex items-center gap-1", r === "p1" ? "text-action" : "text-muted-foreground")}>
                  {s1?.score ?? "—"}{dot1 && <span className="text-[10px] text-muted-foreground">•</span>}
                </div>
                <div className="w-8 text-center text-xs font-bold text-muted-foreground">{h.number}</div>
                <div className="w-8 text-center text-xs text-muted-foreground/70">{h.par}</div>
                <div className={cn("font-display font-bold text-lg tabular-nums text-right flex items-center justify-end gap-1", r === "p2" ? "text-action" : "text-muted-foreground")}>
                  {dot2 && <span className="text-[10px] text-muted-foreground">•</span>}{s2?.score ?? "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Team leaderboard (Scramble / Fourball) — net (HCP-adjusted) ── */
  if (isTeam && teams) {
    type TeamEntry = { name: string; playerIds: string[]; total: number; vsPar: number; points: number; netVsPar: number; netPoints: number; holesPlayed: number };
    const teamEntries: TeamEntry[] = [
      { name: "Team A", playerIds: teamAIds },
      { name: "Team B", playerIds: teamBIds },
    ].map(({ name, playerIds }) => {
      const teamPlayers = activeRound.players.filter((p) => playerIds.includes(p.id));
      const captainId = playerIds[0];

      let total = 0, vsPar = 0, points = 0, netVsPar = 0, netPoints = 0, holesPlayed = 0;

      if (isScramble) {
        // Score stored under captain only. Team allowance = average of members' course HCP
        // (simplified "combined handicap" convention for casual scrambles — adjust if your club uses a different %).
        const teamCh = teamPlayers.length
          ? Math.round(teamPlayers.reduce((a, p) => a + getCourseHcp(p), 0) / teamPlayers.length)
          : 0;
        const scores = activeRound.scores[captainId] ?? [];
        holesPlayed = scores.length;
        scores.forEach((s) => {
          const h = course.holes.find((h) => h.number === s.hole);
          const par = h?.par ?? 4;
          const strokes = h ? holeStrokesInSet(teamCh, holeRankInSet(h, playHoles), playHoles.length) : 0;
          total += s.score;
          vsPar += s.score - par;
          points += stablefordPoints(s.score, par);
          netVsPar += s.score - strokes - par;
          netPoints += netStablefordPoints(s.score, par, strokes);
        });
      } else {
        // Fourball: best NET score per hole among team members (each player's own course HCP applies)
        const holesSet = new Set<number>();
        teamPlayers.forEach((p) => {
          (activeRound.scores[p.id] ?? []).forEach((s) => holesSet.add(s.hole));
        });
        holesSet.forEach((holeNum) => {
          const h = course.holes.find((h) => h.number === holeNum);
          const par = h?.par ?? 4;
          let bestGross = Infinity, bestNet = Infinity;
          teamPlayers.forEach((p) => {
            const s = activeRound.scores[p.id]?.find((x) => x.hole === holeNum);
            if (!s) return;
            if (s.score < bestGross) bestGross = s.score;
            const strokes = h ? getHoleStrokes(p, h) : 0;
            const net = s.score - strokes;
            if (net < bestNet) bestNet = net;
          });
          if (bestGross !== Infinity) {
            total += bestGross;
            vsPar += bestGross - par;
            netVsPar += bestNet - par;
            netPoints += stablefordPoints(bestNet, par);
            holesPlayed++;
          }
        });
      }

      return { name, playerIds, total, vsPar, points, netVsPar, netPoints, holesPlayed };
    });

    const sorted = [...teamEntries].sort((a, b) =>
      isStableford ? b.netPoints - a.netPoints : a.netVsPar - b.netVsPar
    );

    return (
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
        <div className="overflow-hidden bg-card border border-border">
          <div className="grid px-4 py-2.5 gm-eyebrow" style={{ gridTemplateColumns: "2rem 1fr auto auto", color: "#8a7f68", borderBottom: "1px solid hsl(var(--border))" }}>
            <div>#</div><div>Команда</div>
            <div className="w-14 text-center">{isStableford ? "Net Pts" : "Net"}</div>
            <div className="w-12 text-center">Score</div>
          </div>
          {sorted.map((e, i) => (
            <div key={e.name} className="grid items-center px-4 py-3 border-t border-border" style={{ gridTemplateColumns: "2rem 1fr auto auto" }}>
              <div className="font-display text-sm font-bold" style={{ color: i === 0 ? "#c9a24b" : "#8a7f68" }}>
                {i + 1}
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: "#1b1b16" }}>{e.name}</div>
                <div className="text-xs text-muted-foreground">
                  {activeRound.players.filter((p) => e.playerIds.includes(p.id)).map((p) => p.name.split(" ")[0]).join(" & ")}
                  {" · "}gross {isStableford ? e.points : parSign(e.vsPar)}
                </div>
              </div>
              <div className="font-display w-14 text-center font-bold text-base tabular-nums" style={{ color: isStableford ? "#1b1b16" : parColor(e.netVsPar) }}>
                {isStableford ? e.netPoints : parSign(e.netVsPar)}
              </div>
              <div className="font-display w-12 text-center text-muted-foreground font-semibold text-sm tabular-nums">{e.total || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Individual leaderboard (Stroke Play / Stableford) — net (HCP-adjusted) ranking ── */
  const entries = activeRound.players.map((p) => {
    const stats = computePlayerRoundStats(p, activeRound, course);
    return { player: p, ...stats };
  });
  const sorted = [...entries].sort((a, b) =>
    isStableford ? b.netPoints - a.netPoints : a.netVsPar - b.netVsPar || a.total - b.total
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
      <div className="overflow-hidden bg-card border border-border">
        <div className="grid px-4 py-2.5 gm-eyebrow" style={{ gridTemplateColumns: "2rem 1fr auto auto", color: "#8a7f68", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>#</div><div>Игрок</div>
          <div className="w-14 text-center">{isStableford ? "Net Pts" : "Net"}</div>
          <div className="w-12 text-center">Score</div>
        </div>
        {sorted.map((e, i) => (
          <div key={e.player.id} className="grid items-center px-4 py-3 border-t border-border" style={{ gridTemplateColumns: "2rem 1fr auto auto" }}>
            <div className="font-display text-sm font-bold" style={{ color: i === 0 ? "#c9a24b" : "#8a7f68" }}>
              {i + 1}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Avatar name={e.player.name} size="sm" tone={e.player.isMe ? "orange" : "muted"} photoUrl={e.player.photoUrl} />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: "#1b1b16" }}>{e.player.name.split(" ")[0]} <span className="text-muted-foreground font-normal">[{e.player.hcp}]</span></div>
                <div className="text-xs text-muted-foreground">{e.holesPlayed} holes · gross {isStableford ? e.points : parSign(e.vsPar)}</div>
              </div>
            </div>
            <div className="w-14 text-center">
              {isStableford
                ? <span className="font-display font-bold text-base tabular-nums" style={{ color: "#1b1b16" }}>{e.netPoints}</span>
                : <span className="font-display font-bold text-base tabular-nums" style={{ color: parColor(e.netVsPar) }}>{parSign(e.netVsPar)}</span>
              }
            </div>
            <div className="font-display w-12 text-center text-muted-foreground font-semibold text-sm tabular-nums">{e.total || "—"}</div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">Enter scores to see leaderboard</div>
        )}
      </div>
    </div>
  );
};
