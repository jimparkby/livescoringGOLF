import { cn } from "@/lib/utils";

type Props = {
  holes: number[];
  currentHole: number;
  playedHoles: Set<number>;
  onSelect: (hole: number) => void;
};

// Numbered hole grid, tap any hole to jump to it — matches livescoring.ru's
// FOLLOW scoring app: filled tiles (played = green, open = gray), underlined
// numbers, Cuprum type. Whole round visible at a glance instead of stepping
// through holes one at a time with prev/next.
export const HoleGridNav = ({ holes, currentHole, playedHoles, onSelect }: Props) => {
  const rows: number[][] = [];
  for (let i = 0; i < holes.length; i += 9) rows.push(holes.slice(i, i + 9));

  return (
    <div className="flex flex-col gap-[3px]" style={{ fontFamily: "Cuprum, Arial, Helvetica, sans-serif" }}>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[3px]">
          {row.map((h) => {
            const isCurrent = h === currentHole;
            const isPlayed = playedHoles.has(h);
            return (
              <button
                key={h}
                onClick={() => onSelect(h)}
                className="flex-1 aspect-square min-w-0 grid place-items-center text-lg underline transition-transform active:scale-95"
                style={{
                  background: isPlayed ? "#21835b" : "#cccccc",
                  color: isPlayed ? "#f7f7f7" : "#222430",
                  boxShadow: isCurrent ? "0 0 0 2px #f7f7f7, 0 0 0 4px #222430" : undefined,
                }}
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
