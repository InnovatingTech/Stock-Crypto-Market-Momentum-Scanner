import type { JournalEntry } from "./types";

export function entryPnl(entry: JournalEntry): number {
  return (entry.outcome ?? 0) * entry.risk;
}

export function resolvedEntries(journal: JournalEntry[]): JournalEntry[] {
  return journal.filter((entry) => entry.outcome !== undefined);
}

export interface JournalStats {
  resolvedCount: number;
  winCount: number;
  lossCount: number;
  accuracyPercent: number;
  averageWin: number;
  averageLoss: number;
}

export function journalStats(journal: JournalEntry[]): JournalStats {
  const resolved = resolvedEntries(journal);
  const wins = resolved.filter((entry) => (entry.outcome ?? 0) > 0);
  const losses = resolved.filter((entry) => (entry.outcome ?? 0) <= 0);
  return {
    resolvedCount: resolved.length,
    winCount: wins.length,
    lossCount: losses.length,
    accuracyPercent: resolved.length ? Math.round((wins.length / resolved.length) * 100) : 0,
    averageWin: wins.length ? wins.reduce((sum, entry) => sum + entryPnl(entry), 0) / wins.length : 0,
    averageLoss: losses.length ? Math.abs(losses.reduce((sum, entry) => sum + entryPnl(entry), 0) / losses.length) : 0
  };
}

export function greenWeeks(journal: JournalEntry[], now = Date.now()): { green: number; total: number } {
  const weekPnl = new Map<number, number>();
  for (const entry of resolvedEntries(journal)) {
    const weeksAgo = Math.floor((now - new Date(entry.createdAt).getTime()) / (7 * 24 * 3_600_000));
    if (weeksAgo < 0 || weeksAgo > 5) continue;
    weekPnl.set(weeksAgo, (weekPnl.get(weeksAgo) ?? 0) + entryPnl(entry));
  }
  const values = [...weekPnl.values()];
  return { green: values.filter((value) => value > 0).length, total: values.length };
}

export interface DayProgress {
  pnl: number;
  peak: number;
  gaveBackHalf: boolean;
  tradeCount: number;
}

/** Running P&L for one day's resolved entries, in creation order. */
export function dayProgress(journal: JournalEntry[], dayKey: string): DayProgress {
  const today = resolvedEntries(journal)
    .filter((entry) => entry.createdAt.slice(0, 10) === dayKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let running = 0;
  let peak = 0;
  for (const entry of today) {
    running += entryPnl(entry);
    peak = Math.max(peak, running);
  }
  return { pnl: running, peak, gaveBackHalf: peak > 0 && running <= peak / 2, tradeCount: today.length };
}

export type CoachState =
  | { kind: "limit"; limit: number }
  | { kind: "half-back"; peak: number; pnl: number }
  | { kind: "late" }
  | { kind: "no-trade" }
  | { kind: "positive"; pnl: number }
  | { kind: "none" };

export interface CoachInputs {
  progress: DayProgress;
  dailyLossLimit: number;
  marketOpenPastPrime: boolean;
  noTradeDayRecorded: boolean;
}

/** Which discipline message the day has earned, highest priority first. */
export function coachState(inputs: CoachInputs): CoachState {
  const { progress, dailyLossLimit } = inputs;
  if (progress.pnl <= -dailyLossLimit) return { kind: "limit", limit: dailyLossLimit };
  if (progress.gaveBackHalf) return { kind: "half-back", peak: progress.peak, pnl: progress.pnl };
  if (inputs.marketOpenPastPrime && progress.tradeCount > 0) return { kind: "late" };
  if (!progress.tradeCount && inputs.noTradeDayRecorded) return { kind: "no-trade" };
  if (progress.pnl > 0) return { kind: "positive", pnl: progress.pnl };
  return { kind: "none" };
}

export interface HourInsight {
  hour: number;
  totalLoss: number;
}

/** The hour bucket (≥3 trades) that has cost the most, if any is negative. */
export function worstHour(journal: JournalEntry[]): HourInsight | null {
  const byHour = new Map<number, { pnl: number; count: number }>();
  for (const entry of resolvedEntries(journal)) {
    const hour = new Date(entry.createdAt).getHours();
    const bucket = byHour.get(hour) ?? { pnl: 0, count: 0 };
    bucket.pnl += entryPnl(entry);
    bucket.count += 1;
    byHour.set(hour, bucket);
  }
  let worst: HourInsight | null = null;
  for (const [hour, bucket] of byHour) {
    if (bucket.count >= 3 && bucket.pnl < 0 && (worst === null || bucket.pnl < worst.totalLoss)) {
      worst = { hour, totalLoss: bucket.pnl };
    }
  }
  return worst;
}
