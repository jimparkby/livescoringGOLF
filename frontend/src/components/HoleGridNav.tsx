import { cn } from "@/lib/utils";

type Props = {
  holes: number[];
  currentHole: number;
  playedHoles: Set<number>;
  onSelect: (hole: number) => void;
  /** "livescoring" (default) matches livescoring.ru's FOLLOW app for the
   *  casual Play/share-code flows. "brand" uses the club's green/gold
   *  palette for the tournament-day /tlive screens. */
  variant?: "livescoring" | "brand";
};

// Numbered hole grid, tap any hole to jump to it — whole round visible at a
// glance instead of stepping through holes one at a time with prev/next.
export const HoleGridNav = ({ holes, currentHole, playedHoles, onSelect, variant = "livescoring" }: Props) => {
  const rows: number[][] = [];
  for (let i = 0; i < holes.length; i += 9) rows.push(holes.slice(i, i + 9));

  const isBrand = variant === "brand";

  return (
    <div className="flex flex-col gap-[3px]" style={!isBrand ? { fontFamily: "Cuprum, Arial, Helvetica, sans-serif" } : undefined}>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[3px]">
          {row.map((h) => {
            const isCurrent = h === currentHole;
            const isPlayed = playedHoles.has(h);
            return (
              <button
                key={h}
                onClick={() => onSelect(h)}
                className={cn(
                  "flex-1 aspect-square min-w-0 grid place-items-center text-lg transition-transform active:scale-95",
                  !isBrand && "underline",
                  isBrand && "font-bold rounded-md",
                )}
                style={
                  isBrand
                    ? {
                        background: isPlayed ? "#15361f" : "#e5e7e3",
                        color: isPlayed ? "#fff" : "#5a5f58",
                        boxShadow: isCurrent ? "0 0 0 2px #fff, 0 0 0 4px #c9a24b" : undefined,
                      }
                    : {
                        background: isPlayed ? "#21835b" : "#cccccc",
                        color: isPlayed ? "#f7f7f7" : "#222430",
                        boxShadow: isCurrent ? "0 0 0 2px #f7f7f7, 0 0 0 4px #222430" : undefined,
                      }
                }
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
