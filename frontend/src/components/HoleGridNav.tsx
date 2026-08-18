import { cn } from "@/lib/utils";

type Props = {
  holes: number[];
  currentHole: number;
  playedHoles: Set<number>;
  onSelect: (hole: number) => void;
};

// Numbered hole grid, tap any hole to jump to it — matches how on-course
// scoring apps do navigation (vs. a prev/next stepper): the whole round is
// visible at a glance, and you can jump straight to a hole someone asks
// about instead of stepping through one at a time.
export const HoleGridNav = ({ holes, currentHole, playedHoles, onSelect }: Props) => {
  const rows: number[][] = [];
  for (let i = 0; i < holes.length; i += 9) rows.push(holes.slice(i, i + 9));

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
          {row.map((h) => {
            const isCurrent = h === currentHole;
            const isPlayed = playedHoles.has(h);
            return (
              <button
                key={h}
                onClick={() => onSelect(h)}
                className={cn(
                  "h-9 rounded-lg text-sm font-bold tabular-nums transition-all",
                  isCurrent ? "text-black" : isPlayed ? "bg-action/15 text-action" : "bg-white/10 text-white/40",
                )}
                style={isCurrent ? { background: "#22c55e" } : undefined}
              >
                {h}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
