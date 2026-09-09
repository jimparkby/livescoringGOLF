import { describe, it, expect } from "vitest";
import { calcHandicapIndex } from "@/lib/handicap";

// WHS Rule 5.1/5.2a: Handicap Index = average of the best N Score
// Differentials out of the most recent 20 scores (N grows with the record
// size, per the official table), plus that bracket's net adjustment,
// rounded to the nearest 0.1. No scores → null; fewer than 3 → null.
describe("calcHandicapIndex (WHS best-of table)", () => {
  it("needs at least 3 scores", () => {
    expect(calcHandicapIndex([])).toBeNull();
    expect(calcHandicapIndex([10, 12])).toBeNull();
  });

  it("3 scores: lowest 1, adjustment -2.0", () => {
    expect(calcHandicapIndex([20, 15, 10])).toBe(8.0);
  });

  it("4 scores: lowest 1, adjustment -1.0", () => {
    expect(calcHandicapIndex([20, 15, 10, 5])).toBe(4.0);
  });

  it("5 scores: lowest 1, no adjustment", () => {
    expect(calcHandicapIndex([20, 15, 10, 5, 8])).toBe(5.0);
  });

  it("6 scores: average of lowest 2, adjustment -1.0", () => {
    expect(calcHandicapIndex([20, 18, 16, 14, 12, 10])).toBe(10.0);
  });

  it("20 scores: average of lowest 8, no adjustment, no old 0.96 multiplier", () => {
    const diffs = [12, 11, 10, 9, 8, 7, 6, 5, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
    // lowest 8: 5,6,7,8,9,10,11,12 -> avg 8.5
    expect(calcHandicapIndex(diffs)).toBe(8.5);
  });

  it("more than 20 scores: only the most recent 20 (first 20, newest-first) count", () => {
    const recent20 = Array.from({ length: 20 }, () => 20); // all 20.0
    const older = [0.1, 0.1, 0.1]; // would drag the average way down if included
    expect(calcHandicapIndex([...recent20, ...older])).toBe(20.0);
  });

  it("caps at 54.0", () => {
    // 3 scores of 60 -> lowest 1 (60) - 2.0 adjustment = 58, capped to 54
    expect(calcHandicapIndex([60, 60, 60])).toBe(54.0);
  });
});
