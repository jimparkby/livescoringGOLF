import { useEffect, useRef } from "react";
import type { ActiveRound } from "@/types";

interface Props {
  round: ActiveRound;
  onClose: () => void;
}

function scoreColor(score: number, par: number): string {
  const diff = score - par;
  if (diff <= -2) return "#ca8a04"; // eagle+
  if (diff === -1) return "#1f7a3d"; // birdie
  if (diff === 0)  return "#1b1b16"; // par
  if (diff === 1)  return "#c2540c"; // bogey
  return "#b3261e";                  // double+
}

export function ScorecardModal({ round, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Swipe-down to close
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 60) onClose();
    touchStartY.current = null;
  };

  const totalPar = round.scorecard?.reduce((a, h) => a + h.par, 0) ?? 0;
  const totalScore = round.scorecard?.reduce((a, h) => a + h.score, 0) ?? round.score;
  const diff = totalScore - totalPar;
  const diffLabel = diff === 0 ? "E" : diff > 0 ? `+${diff}` : String(diff);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(27,27,22,0.4)",
        }}
      />

      {/* Sheet */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 51,
          background: "#fffdf7",
          borderTop: "1px solid #c9a24b",
          borderRadius: "20px 20px 0 0",
          padding: "20px 16px 40px",
          maxHeight: "80dvh",
          overflowY: "auto",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* Handle — tap or swipe down to close */}
        <div
          onClick={onClose}
          style={{ display: "flex", justifyContent: "center", padding: "8px 0 16px", cursor: "pointer" }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(27,27,22,0.16)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1b1b16" }}>{round.playerName}</div>
            <div style={{ fontSize: 13, color: "#8a7f68", marginTop: 2 }}>{round.courseName ?? "Round"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: diff <= 0 ? "#1f7a3d" : "#b3261e" }}>
              {diffLabel}
            </div>
            <div style={{ fontSize: 11, color: "#8a7f68" }}>{round.holesPlayed} holes</div>
          </div>
        </div>

        {/* Scorecard table */}
        {round.scorecard && round.scorecard.length > 0 ? (
          <div style={{ overflow: "hidden", border: "1px solid rgba(27,27,22,0.14)", borderRadius: 12 }}>
            {/* Table header */}
            <div
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: 700,
                color: "#8a7f68",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
            >
              <span>Hole</span>
              <span style={{ textAlign: "center" }}>Par</span>
              <span style={{ textAlign: "right" }}>Score</span>
            </div>

            {round.scorecard.map((h) => (
              <div
                key={h.hole}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "10px 16px",
                  borderTop: "1px solid rgba(27,27,22,0.1)",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1b1b16" }}>{h.hole}</span>
                <span style={{ fontSize: 14, color: "#8a7f68", textAlign: "center" }}>{h.par}</span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                    fontWeight: 700,
                    color: scoreColor(h.score, h.par),
                    textAlign: "right",
                  }}
                >
                  {h.score}
                </span>
              </div>
            ))}

            {/* Total row */}
            <div
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                padding: "12px 16px",
                borderTop: "1px solid rgba(27,27,22,0.14)",
                background: "rgba(27,27,22,0.03)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#8a7f68" }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#8a7f68", textAlign: "center" }}>{totalPar}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: diff <= 0 ? "#1f7a3d" : "#b3261e", textAlign: "right" }}>
                {totalScore}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#8a7f68", padding: "32px 0", fontSize: 14 }}>
            No scores entered yet
          </div>
        )}
      </div>
    </>
  );
}
