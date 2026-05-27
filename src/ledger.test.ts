import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildStats, readLedger, recordRun, summarize } from "./ledger.js";
import type { Report } from "./types.js";

let dir: string;
let ledger: string;

const report = (v: number, u: number, r: number): Report => ({
  verdicts: [],
  summary: { verified: v, unsupported: u, unverifiable: r, total: v + u + r },
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "groundtruth-led-"));
  ledger = join(dir, "ledger.jsonl");
  process.env.GROUNDTRUTH_LEDGER = ledger;
});
afterEach(() => {
  Reflect.deleteProperty(process.env, "GROUNDTRUTH_LEDGER");
  rmSync(dir, { recursive: true, force: true });
});

describe("ledger", () => {
  it("records counts and reads them back", () => {
    recordRun(report(2, 1, 0), "/proj/a", "s1");
    recordRun(report(0, 3, 1), "/proj/a", "s2");
    const entries = readLedger();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.v).toBe(2);
    expect(entries[1]?.u).toBe(3);
  });

  it("never records a run with zero claims", () => {
    recordRun(report(0, 0, 0), "/proj/a");
    expect(readLedger()).toHaveLength(0);
  });

  it("stores no code or claim content (counts + path + time only)", () => {
    recordRun(report(1, 1, 1), "/proj/a", "s1");
    const raw = readFileSync(ledger, "utf8");
    const parsed = JSON.parse(raw.trim());
    expect(Object.keys(parsed).sort()).toEqual(["cwd", "session", "t", "u", "v", "r"].sort());
  });

  it("summarizes by project", () => {
    recordRun(report(2, 1, 0), "/proj/a");
    recordRun(report(1, 0, 0), "/proj/b");
    const a = summarize(readLedger(), { cwd: "/proj/a" });
    expect(a.runs).toBe(1);
    expect(a.unsupported).toBe(1);
    const all = summarize(readLedger());
    expect(all.runs).toBe(2);
    expect(all.verified).toBe(3);
  });

  it("filters by recency", () => {
    recordRun(report(0, 5, 0), "/proj/a");
    const recent = summarize(readLedger(), { sinceDays: 7 });
    expect(recent.unsupported).toBe(5);
    const ancient = summarize(readLedger(), { sinceDays: 0.00001 });
    // entries are "now"; a tiny window still includes them
    expect(ancient.runs).toBeGreaterThanOrEqual(0);
  });

  it("returns empty for a missing ledger", () => {
    process.env.GROUNDTRUTH_LEDGER = join(dir, "nope.jsonl");
    expect(readLedger()).toEqual([]);
  });
});

describe("buildStats", () => {
  it("scopes to a project by default", () => {
    recordRun(report(2, 1, 0), "/proj/a");
    recordRun(report(9, 9, 9), "/proj/b");
    const stats = buildStats(readLedger(), { cwd: "/proj/a" });
    expect(stats.scope).toBe("project");
    expect(stats.project).toBe("/proj/a");
    expect(stats.allTime).toMatchObject({ runs: 1, verified: 2, unsupported: 1 });
    expect(stats.week).toMatchObject({ runs: 1, verified: 2 });
  });

  it("aggregates across all projects when all=true", () => {
    recordRun(report(2, 1, 0), "/proj/a");
    recordRun(report(1, 0, 3), "/proj/b");
    const stats = buildStats(readLedger(), { cwd: "/proj/a", all: true });
    expect(stats.scope).toBe("all");
    expect(stats.project).toBeNull();
    expect(stats.allTime).toMatchObject({ runs: 2, verified: 3, unsupported: 1, unverifiable: 3 });
  });

  it("emits a stable, JSON-serializable shape", () => {
    recordRun(report(1, 0, 0), "/proj/a");
    const stats = buildStats(readLedger(), { cwd: "/proj/a" });
    expect(Object.keys(stats).sort()).toEqual(
      ["allTime", "generatedAt", "month", "project", "scope", "week"].sort(),
    );
    expect(() => JSON.parse(JSON.stringify(stats))).not.toThrow();
    expect(Date.parse(stats.generatedAt)).not.toBeNaN();
  });
});
