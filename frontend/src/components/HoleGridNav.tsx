type Props = {
  holes: number[];
  currentHole: number;
  playedHoles: Set<number>;
  onSelect: (hole: number) => void;
};

// Numbered hole grid, tap any hole to jump to it — whole round visible at a
// glance instead of stepping through holes one at a time with prev/next.
export const HoleGridNav = ({ holes, currentHole, playedHoles, onSelect }: Props) => {
  const rows: number[][] = [];
  for (let i = 0; i < holes.length; i += 9) rows.push(holes.slice(i, i + 9));

  return (
    <div className="flex flex-col gap-[3px]">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[3px]">
          {row.map((h) => {
            const isCurrent = h === currentHole;
            const isPlayed = playedHoles.has(h);
            return (
              <button
                key={h}
                onClick={() => onSelect(h)}
                className="font-display flex-1 aspect-square min-w-0 grid place-items-center text-sm font-semibold rounded-md transition-transform active:scale-95"
                style={{
                  background: isPlayed ? "#15361f" : "#e9e1cf",
                  color: isPlayed ? "#f3ede1" : "#8a7f68",
                  boxShadow: isCurrent ? "0 0 0 2px #f3ede1, 0 0 0 3px #c9a24b" : undefined,
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
