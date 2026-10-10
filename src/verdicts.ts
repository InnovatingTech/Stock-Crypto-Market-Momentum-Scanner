export type TickState = "pass" | "fail" | "unknown";

export interface Tick {
  label: string;
  detail: string;
  state: TickState;
  /** Stable identifier for rules that care which check this is. */
  key?: "gain" | "rvol" | "price" | "shares" | "catalyst" | "momentum" | "activity" | "liquidity" | "venues";
}

export type MomentVerdict = "entry" | "wait" | "avoid" | undefined;

export type VerdictClass = "go" | "hold" | "off" | "strong" | "mid" | "skip";

export interface Verdict {
  cls: VerdictClass;
  label: string;
  passes: number;
  fails: number;
}

/**
 * The single source of truth combining the quality pillars with the live
 * moment check. Unknown ticks are neutral: a missing data point is not a
 * failed check. A candidate outside the configured price range is never
 * given an entry call, however good the chart looks — percentage targets
 * are unrealistic at the wrong price.
 */
export function verdictFor(ticks: Tick[], moment: MomentVerdict, simple: boolean): Verdict {
  const passes = ticks.filter((tick) => tick.state === "pass").length;
  const fails = ticks.filter((tick) => tick.state === "fail").length;
  const strong = passes >= 3 && fails <= 1;
  const weak = fails >= 3 || passes <= 1;
  const priceFailed = ticks.some((tick) => tick.key === "price" && tick.state === "fail");
  if (weak) return { cls: "skip", label: simple ? "Skip this one" : "Skip · weak quality", passes, fails };
  if (!strong || (priceFailed && moment === "entry")) {
    return { cls: "mid", label: simple ? "Borderline — be careful" : "Borderline", passes, fails };
  }
  if (moment === "entry") return { cls: "go", label: simple ? "✓ Entry zone" : "Entry zone", passes, fails };
  if (moment === "wait") return { cls: "hold", label: simple ? "Wait — not yet" : "Wait · pattern forming", passes, fails };
  if (moment === "avoid") return { cls: "off", label: simple ? "Avoid — move has faded" : "Avoid · pattern failed", passes, fails };
  return { cls: "strong", label: simple ? "Good quality — checking timing…" : "Quality passes · timing unchecked", passes, fails };
}

/** Sort order for the movers list: buyable now, then forming, then the rest. */
export function momentRank(moment: MomentVerdict): number {
  return moment === "entry" ? 0 : moment === "wait" ? 1 : moment === undefined ? 2 : 3;
}
