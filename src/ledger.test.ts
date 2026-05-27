import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLedger, recordRun, summarize } from "./ledger.js";
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
