import type { JournalEntry } from "./types";

const key = "pulseboard-journal-v1";

export const STORAGE_KEYS = {
  journal: "pulseboard-journal-v1",
  noTradeDays: "pulseboard-no-trade-days-v1",
  prefs: "pulseboard-prefs-v1"
} as const;

export interface ExportedData {
  journal: JournalEntry[];
  noTradeDays: string[];
  prefs: Record<string, unknown> | null;
}

/**
 * Parses an "Export my data" file. Accepts the full keyed shape and, for
 * backwards compatibility, a bare journal array from older exports.
 */
export function parseExportedData(text: string): ExportedData {
  const raw: unknown = JSON.parse(text);
  if (Array.isArray(raw)) {
    return { journal: parseJournal(text), noTradeDays: [], prefs: null };
  }
  if (!raw || typeof raw !== "object") throw new Error("Not a Pulseboard export file");
  const record = raw as Record<string, unknown>;
  const journal = parseJournal(JSON.stringify(record[STORAGE_KEYS.journal] ?? []));
  const noTradeDaysRaw = record[STORAGE_KEYS.noTradeDays];
  const noTradeDays = Array.isArray(noTradeDaysRaw)
    ? noTradeDaysRaw.filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    : [];
  const prefsRaw = record[STORAGE_KEYS.prefs];
  const prefs = prefsRaw && typeof prefsRaw === "object" && !Array.isArray(prefsRaw) ? prefsRaw as Record<string, unknown> : null;
  if (!journal.length && !noTradeDays.length && !prefs) throw new Error("No recognisable Pulseboard data in this file");
  return { journal, noTradeDays, prefs };
}

export function parseJournal(value: string | null): JournalEntry[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is JournalEntry => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      const numbers = [item.entry, item.stop, item.target, item.shares, item.risk];
      return typeof item.id === "string"
        && typeof item.createdAt === "string"
        && typeof item.symbol === "string"
        && (item.assetClass === "stocks" || item.assetClass === "crypto")
        && numbers.every((number) => typeof number === "number" && Number.isFinite(number))
        && (item.outcome === undefined || typeof item.outcome === "number" && Number.isFinite(item.outcome))
        && typeof item.note === "string";
    });
  } catch {
    return [];
  }
}

export class JournalStore {
  load(): JournalEntry[] {
    return parseJournal(localStorage.getItem(key));
  }

  save(entries: JournalEntry[]) {
    localStorage.setItem(key, JSON.stringify(entries));
  }

  /** Exports journal, no-trade days and preferences under their storage key names. */
  export(entries: JournalEntry[], noTradeDays: string[] = [], prefs: Record<string, unknown> | null = null) {
    const payload = {
      [STORAGE_KEYS.journal]: entries,
      [STORAGE_KEYS.noTradeDays]: noTradeDays,
      [STORAGE_KEYS.prefs]: prefs
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pulseboard-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    const href = link.href;
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(href);
    }, 1_000);
  }
}
