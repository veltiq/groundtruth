import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_ROUNDS,
  MAX_MAX_ROUNDS,
  MIN_MAX_ROUNDS,
  buildProtocol,
  clampMaxRounds,
  clearLoop,
  decideLoop,
  runLoopGate,
  turnDidWork,
} from "./loop.js";
import type { ToolUse, Turn } from "./types.js";

describe("decideLoop", () => {
  it("allows the stop when the agent reported pass", () => {
    expect(decideLoop({ signal: "pass", rounds: 3 }, 6)).toEqual({ action: "allow", rounds: 0 });
  });

  it("allows the stop when the agent reported skip", () => {
    expect(decideLoop({ signal: "skip", rounds: 0 }, 6)).toEqual({ action: "allow", rounds: 0 });
  });

  it("blocks and increments rounds when there is no verdict yet", () => {
    expect(decideLoop({ signal: null, rounds: 0 }, 6)).toEqual({ action: "block", rounds: 1 });
    expect(decideLoop({ signal: null, rounds: 3 }, 6)).toEqual({ action: "block", rounds: 4 });
  });

  it("gives up once the round cap is reached so it can never loop forever", () => {
    // maxRounds 6 -> blocks at rounds 1..5, gives up on the 6th attempt
    expect(decideLoop({ signal: null, rounds: 4 }, 6)).toEqual({ action: "block", rounds: 5 });
    expect(decideLoop({ signal: null, rounds: 5 }, 6)).toEqual({ action: "giveup", rounds: 0 });
  });

  it("a verdict always wins, even at the cap", () => {
    expect(decideLoop({ signal: "pass", rounds: 99 }, 6).action).toBe("allow");
  });
});

describe("clampMaxRounds", () => {
  it("keeps in-range values", () => {
    expect(clampMaxRounds(6)).toBe(6);
  });
  it("clamps below the floor and above the ceiling", () => {
    expect(clampMaxRounds(1)).toBe(MIN_MAX_ROUNDS);
    expect(clampMaxRounds(999)).toBe(MAX_MAX_ROUNDS);
  });
  it("floors fractions and falls back on non-finite input", () => {
    expect(clampMaxRounds(6.9)).toBe(6);
    expect(clampMaxRounds(Number.NaN)).toBe(DEFAULT_MAX_ROUNDS);
  });
});

describe("turnDidWork", () => {
  const turn = (...names: string[]): Turn => ({
    summary: "",
    toolUses: names.map((name): ToolUse => ({ name, input: {} })),
  });

  it("is false for a conversational turn (no tools)", () => {
    expect(turnDidWork(turn())).toBe(false);
  });

  it("is false for a read-only turn", () => {
    expect(turnDidWork(turn("Read", "Grep", "Glob"))).toBe(false);
  });

  it("is true when the turn wrote, edited, or ran commands", () => {
    expect(turnDidWork(turn("Read", "Write"))).toBe(true);
    expect(turnDidWork(turn("Edit"))).toBe(true);
    expect(turnDidWork(turn("Bash"))).toBe(true);
    expect(turnDidWork(turn("MultiEdit"))).toBe(true);
    expect(turnDidWork(turn("NotebookEdit"))).toBe(true);
  });
});

describe("buildProtocol", () => {
  it("embeds the exact signal path and the round counter", () => {
    const out = buildProtocol("/tmp/x/abc.signal", 2, 6);
    expect(out).toContain("/tmp/x/abc.signal");
    expect(out).toContain("round 2/5");
    expect(out).toContain("printf pass > /tmp/x/abc.signal");
    expect(out).toContain("printf skip > /tmp/x/abc.signal");
  });
});

describe("runLoopGate (IO)", () => {
  let dir: string;
  const input = (over: Partial<{ session: string; maxRounds: number }> = {}) => ({
    cwd: "/work/project",
    session: over.session ?? "sess-1",
    maxRounds: over.maxRounds ?? 6,
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "groundtruth-loop-"));
    vi.stubEnv("GROUNDTRUTH_LOOP_DIR", dir);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("blocks the first time, with a protocol pointing at a real signal path", () => {
    const r = runLoopGate(input());
    expect(r.block).toBe(true);
    expect(r.message).toContain("verify loop");
    // the protocol hands the agent a writable path under our temp dir
    const m = r.message?.match(/printf pass > (\S+)/);
    expect(m?.[1]).toContain(dir);
  });

  it("blocks repeatedly until the agent writes a verdict, then allows", () => {
    expect(runLoopGate(input()).block).toBe(true); // round 1
    expect(runLoopGate(input()).block).toBe(true); // round 2

    // agent writes its pass signal to the path the protocol gave it
    const signalPath = runLoopGate(input()).message?.match(/printf pass > (\S+)/)?.[1];
    expect(signalPath).toBeTruthy();
    if (signalPath) writeFileSync(signalPath, "pass");

    const allowed = runLoopGate(input());
    expect(allowed.block).toBe(false);
    expect(allowed.gaveUp).toBeUndefined();
    // state is cleared for the next turn
    expect(existsSync(signalPath as string)).toBe(false);
  });

  it("honors a skip verdict", () => {
    const msgPath = runLoopGate(input()).message?.match(/printf skip > (\S+)/)?.[1];
    expect(msgPath).toBeTruthy();
    if (msgPath) writeFileSync(msgPath, "skip\n");
    expect(runLoopGate(input()).block).toBe(false);
  });

  it("gives up once the cap is reached and allows the stop", () => {
    const small = input({ maxRounds: 3 });
    expect(runLoopGate(small).block).toBe(true); // round 1
    expect(runLoopGate(small).block).toBe(true); // round 2
    const giveUp = runLoopGate(small); // round 3 -> cap
    expect(giveUp.block).toBe(false);
    expect(giveUp.gaveUp).toBe(true);
  });

  it("keeps separate sessions independent", () => {
    runLoopGate(input({ session: "a" }));
    runLoopGate(input({ session: "a" }));
    // a fresh session starts at round 1, unaffected by session "a"
    const b = runLoopGate(input({ session: "b" }));
    expect(b.block).toBe(true);
  });

  it("clearLoop removes persisted state", () => {
    runLoopGate(input());
    clearLoop(input());
    // after clearing, the next gate is back to round 1 (still blocks, fresh)
    expect(runLoopGate(input()).block).toBe(true);
  });
});
