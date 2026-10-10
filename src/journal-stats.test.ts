import { describe, expect, it } from "vitest";
import { coachState, dayProgress, greenWeeks, journalStats, worstHour } from "./journal-stats";
import type { JournalEntry } from "./types";

let nextId = 0;
function entry(outcome: number | undefined, risk = 50, createdAt = "2026-10-10T14:00:00.000Z"): JournalEntry {
  nextId += 1;
  return { id: `e${nextId}`, createdAt, symbol: "TEST", assetClass: "stocks", entry: 10, stop: 9, target: 12, shares: 50, risk, outcome, note: "" };
}

describe("journalStats", () => {
  it("computes accuracy and average win/loss from resolved entries only", () => {
    const stats = journalStats([entry(2), entry(-1), entry(undefined)]);
    expect(stats.resolvedCount).toBe(2);
    expect(stats.accuracyPercent).toBe(50);
    expect(stats.averageWin).toBe(100);
    expect(stats.averageLoss).toBe(50);
  });
});

describe("dayProgress", () => {
  it("tracks peak and half-back give-back in order", () => {
    const progress = dayProgress([
      entry(2, 50, "2026-10-10T13:00:00.000Z"),
      entry(-1, 60, "2026-10-10T14:00:00.000Z")
    ], "2026-10-10");
    expect(progress.peak).toBe(100);
    expect(progress.pnl).toBe(40);
    expect(progress.gaveBackHalf).toBe(true);
  });

  it("ignores other days", () => {
    expect(dayProgress([entry(2, 50, "2026-10-09T13:00:00.000Z")], "2026-10-10").tradeCount).toBe(0);
  });
});

describe("coachState", () => {
  const base = { progress: { pnl: 0, peak: 0, gaveBackHalf: false, tradeCount: 0 }, dailyLossLimit: 150, marketOpenPastPrime: false, noTradeDayRecorded: false };

  it("prioritises the daily loss limit", () => {
    expect(coachState({ ...base, progress: { pnl: -200, peak: 0, gaveBackHalf: false, tradeCount: 3 } }).kind).toBe("limit");
  });

  it("flags half-back before the late warning", () => {
    expect(coachState({ ...base, marketOpenPastPrime: true, progress: { pnl: 40, peak: 100, gaveBackHalf: true, tradeCount: 2 } }).kind).toBe("half-back");
  });

  it("praises a recorded no-trade day", () => {
    expect(coachState({ ...base, noTradeDayRecorded: true }).kind).toBe("no-trade");
  });
});

describe("greenWeeks", () => {
  it("counts positive weeks within the last six", () => {
    const now = Date.parse("2026-10-10T12:00:00.000Z");
    const result = greenWeeks([
      entry(2, 50, "2026-10-09T12:00:00.000Z"),
      entry(-1, 50, "2026-09-25T12:00:00.000Z"),
      entry(2, 50, "2026-01-01T12:00:00.000Z")
    ], now);
    expect(result).toEqual({ green: 1, total: 2 });
  });
});

describe("worstHour", () => {
  it("needs at least three trades in a losing hour", () => {
    const losses = [1, 2, 3].map(() => entry(-1, 50, "2026-10-08T09:30:00.000Z"));
    expect(worstHour(losses.slice(0, 2))).toBeNull();
    const worst = worstHour(losses);
    expect(worst?.totalLoss).toBe(-150);
  });
});
