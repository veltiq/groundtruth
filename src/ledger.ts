import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Report } from "./types.js";

/**
 * A privacy-safe local tally of verdict counts per turn. It stores ONLY counts,
 * timestamps, and the project path — never code, claims, or prompts. Powers the
 * `statusline` and `stats` commands.
 */
export interface LedgerEntry {
  /** ISO timestamp. */
  t: string;
  /** Project working directory. */
  cwd: string;
  /** Session id, when known. */
  session?: string;
  /** verified / unsupported / review counts. */
  v: number;
  u: number;
  r: number;
}

export interface LedgerSummary {
  runs: number;
  verified: number;
  unsupported: number;
  unverifiable: number;
}

/** A point-in-time stats snapshot over a project (or all projects). */
export interface StatsReport {
  /** "project" when scoped to one cwd, "all" when aggregated. */
  scope: "project" | "all";
  /** The project path when scoped, otherwise null. */
  project: string | null;
  /** When this snapshot was produced (ISO). */
  generatedAt: string;
  week: LedgerSummary;
  month: LedgerSummary;
  allTime: LedgerSummary;
}

export function ledgerPath(): string {
  return process.env.GROUNDTRUTH_LEDGER ?? join(homedir(), ".groundtruth", "ledger.jsonl");
}

/** Appends a turn's verdict counts. Best-effort — never throws into the hook. */
export function recordRun(report: Report, cwd: string, session?: string): void {
  if (report.summary.total === 0) return;
  const entry: LedgerEntry = {
    t: new Date().toISOString(),
    cwd,
    v: report.summary.verified,
    u: report.summary.unsupported,
    r: report.summary.unverifiable,
  };
  if (session) entry.session = session;
  try {
    const path = ledgerPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // ledger is non-essential; swallow failures
  }
}

export function readLedger(): LedgerEntry[] {
  const path = ledgerPath();
  if (!existsSync(path)) return [];
  const out: LedgerEntry[] = [];
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (isEntry(parsed)) out.push(parsed);
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // unreadable ledger -> treat as empty
  }
  return out;
}

export function summarize(
  entries: LedgerEntry[],
  opts: { cwd?: string; sinceDays?: number; session?: string } = {},
): LedgerSummary {
  const cutoff = opts.sinceDays !== undefined ? Date.now() - opts.sinceDays * 86_400_000 : 0;
  const sum: LedgerSummary = { runs: 0, verified: 0, unsupported: 0, unverifiable: 0 };
  for (const e of entries) {
    if (opts.cwd && e.cwd !== opts.cwd) continue;
    if (opts.session && e.session !== opts.session) continue;
    if (cutoff && Date.parse(e.t) < cutoff) continue;
    sum.runs += 1;
    sum.verified += e.v;
    sum.unsupported += e.u;
    sum.unverifiable += e.r;
  }
  return sum;
}

/**
 * Builds the 7d / 30d / all-time snapshot used by `groundtruth stats`. Scoped to
 * a single project by default; pass `all` to aggregate across every project.
 */
export function buildStats(
  entries: LedgerEntry[],
  opts: { cwd?: string; all?: boolean } = {},
): StatsReport {
  const cwd = opts.all ? undefined : opts.cwd;
  return {
    scope: opts.all ? "all" : "project",
    project: cwd ?? null,
    generatedAt: new Date().toISOString(),
    week: summarize(entries, { cwd, sinceDays: 7 }),
    month: summarize(entries, { cwd, sinceDays: 30 }),
    allTime: summarize(entries, { cwd }),
  };
}

function isEntry(v: unknown): v is LedgerEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.t === "string" &&
    typeof e.cwd === "string" &&
    typeof e.v === "number" &&
    typeof e.u === "number" &&
    typeof e.r === "number"
  );
}
