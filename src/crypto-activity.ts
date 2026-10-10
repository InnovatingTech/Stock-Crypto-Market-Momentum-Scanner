export interface ActivityBaseline {
  /** Mean quote volume of the last ~30 completed daily candles. */
  avgDailyQuote: number;
  /** Quote volume of the most recent hourly candles, oldest first. */
  hourlyQuote: number[];
}

export interface ActivityRatio {
  ratio: number;
  windowHours: number;
}

/**
 * Recent trading over a chosen window versus what the coin's own last month
 * says is normal for that stretch of time — the crypto equivalent of the
 * stock strategy's volume-versus-50-day-average rule.
 */
export function computeActivityRatio(
  base: ActivityBaseline,
  windowHours: 1 | 4 | 24,
  volume24hQuote: number
): ActivityRatio | undefined {
  if (base.avgDailyQuote <= 0) return undefined;
  if (windowHours === 24) {
    return volume24hQuote > 0 ? { ratio: volume24hQuote / base.avgDailyQuote, windowHours } : undefined;
  }
  const recent = base.hourlyQuote.slice(-windowHours).reduce((sum, value) => sum + value, 0);
  const expected = (base.avgDailyQuote / 24) * windowHours;
  return expected > 0 ? { ratio: recent / expected, windowHours } : undefined;
}
