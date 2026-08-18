// Matches the livescoring.ru wordmark: red "LIVE" badge stacked over
// italic "SCORING" — used as the header brand on the live-scoring screens.
export const LiveScoringLogo = () => (
  <div style={{ fontFamily: "Cuprum, Arial, Helvetica, sans-serif", lineHeight: 1 }}>
    <span
      className="inline-block px-1.5 py-0.5 text-white font-bold italic text-sm tracking-wide"
      style={{ background: "#d80027" }}
    >
      LIVE
    </span>
    <div className="italic font-bold text-lg mt-0.5" style={{ color: "#222430" }}>
      SCORING
    </div>
  </div>
);
