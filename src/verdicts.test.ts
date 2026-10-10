import { describe, expect, it } from "vitest";
import { momentRank, verdictFor, type Tick } from "./verdicts";

function ticks(states: Tick["state"][], priceState?: Tick["state"]): Tick[] {
  const built: Tick[] = states.map((state, index) => ({ label: `t${index}`, detail: "", state }));
  if (priceState) built.push({ key: "price", label: "price", detail: "", state: priceState });
  return built;
}

describe("verdictFor", () => {
  it("treats unknown ticks as neutral", () => {
    const verdict = verdictFor(ticks(["pass", "pass", "pass", "unknown", "unknown"]), "wait", false);
    expect(verdict.cls).toBe("hold");
  });

  it("gives an entry zone only when strong and the moment fires", () => {
    expect(verdictFor(ticks(["pass", "pass", "pass", "pass"]), "entry", false).cls).toBe("go");
    expect(verdictFor(ticks(["pass", "pass", "pass", "pass"]), "entry", true).label).toBe("✓ Entry zone");
  });

  it("never gives an entry zone when the price check fails", () => {
    const verdict = verdictFor(ticks(["pass", "pass", "pass", "pass"], "fail"), "entry", false);
    expect(verdict.cls).toBe("mid");
  });

  it("marks three failures as skip", () => {
    expect(verdictFor(ticks(["fail", "fail", "fail", "pass", "pass"]), undefined, false).cls).toBe("skip");
  });

  it("marks a faded strong candidate as avoid", () => {
    const verdict = verdictFor(ticks(["pass", "pass", "pass", "pass"]), "avoid", true);
    expect(verdict.cls).toBe("off");
    expect(verdict.label).toContain("Avoid");
  });
});

describe("momentRank", () => {
  it("sorts entry before wait before unknown before avoid", () => {
    expect(momentRank("entry")).toBeLessThan(momentRank("wait"));
    expect(momentRank("wait")).toBeLessThan(momentRank(undefined));
    expect(momentRank(undefined)).toBeLessThan(momentRank("avoid"));
  });
});
