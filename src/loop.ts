import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Turn } from "./types.js";

/**
 * The behavioral verify loop.
 *
 * groundtruth's claim check is static: it grades a turn's *words* against the
 * diff. The verify loop adds a second, opt-in gate that grades the turn's
 * *behavior*: before the agent is allowed to finish, it must actually run /
 * screenshot / test the work and prove it does what was asked — fixing and
 * re-verifying until it does.
 *
 * Crucially, groundtruth never judges the work itself (that would reintroduce
 * the false positives the rest of the tool is careful to avoid). It only:
 *   1. gates the Stop event,
 *   2. counts rounds so the loop can never run forever, and
 *   3. injects a protocol telling the agent how to self-verify.
 * The agent reports the outcome by writing `pass` / `skip` to a signal file
 * whose path is handed to it in the protocol.
 */

export const DEFAULT_MAX_ROUNDS = 6;
export const MIN_MAX_ROUNDS = 2;
export const MAX_MAX_ROUNDS = 20;

/** What the agent may write to its signal file to report a verdict. */
export type LoopSignal = "pass" | "skip";

/** The outcome of one gate evaluation. */
export type LoopAction = "allow" | "block" | "giveup";

export interface LoopState {
  /** The verdict the agent wrote this cycle, if any. */
  signal: LoopSignal | null;
  /** How many times we have already blocked in this stop-sequence. */
  rounds: number;
}

export interface LoopDecision {
  action: LoopAction;
  /** Round count to persist for the next evaluation (0 clears it). */
  rounds: number;
}

/**
 * Pure loop decision — no IO. Allows the stop when the agent has reported a
 * verdict, gives up (and allows the stop) once the round cap is reached so a
 * stuck agent can never be trapped, and otherwise blocks for another round.
 */
export function decideLoop(state: LoopState, maxRounds: number): LoopDecision {
  if (state.signal === "pass" || state.signal === "skip") {
    return { action: "allow", rounds: 0 };
  }
  const next = state.rounds + 1;
  if (next >= maxRounds) {
    return { action: "giveup", rounds: 0 };
  }
  return { action: "block", rounds: next };
}

/** Clamp a requested round cap into the supported range. */
export function clampMaxRounds(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MAX_ROUNDS;
  return Math.min(MAX_MAX_ROUNDS, Math.max(MIN_MAX_ROUNDS, Math.floor(n)));
}

/**
 * Whether a turn did work worth verifying. A turn that used no mutating or
 * shell tools is conversational (an answer or a question) and is never gated —
 * this is what keeps the loop from blocking pure chat.
 */
export function turnDidWork(turn: Turn): boolean {
  return turn.toolUses.some((t) => {
    const n = t.name.toLowerCase();
    return (
      n.includes("write") ||
      n.includes("edit") ||
      n.includes("bash") ||
      n.includes("shell") ||
      n.includes("patch") ||
      n.includes("notebook")
    );
  });
}

// --- IO layer ---------------------------------------------------------------

/** Where per-session loop state lives. Overridable for tests. */
function stateDir(): string {
  return process.env.GROUNDTRUTH_LOOP_DIR ?? join(homedir(), ".groundtruth", "loops");
}

/**
 * A stable, opaque key for a loop. Prefers the session id so concurrent
 * projects don't collide; falls back to the working directory.
 */
function loopKey(opts: { session?: string; cwd: string }): string {
  const raw = opts.session && opts.session.length > 0 ? opts.session : opts.cwd;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

function signalFile(key: string): string {
  return join(stateDir(), `${key}.signal`);
}
function roundsFile(key: string): string {
  return join(stateDir(), `${key}.rounds`);
}

function readSignal(key: string): LoopSignal | null {
  const path = signalFile(key);
  if (!existsSync(path)) return null;
  try {
    const v = readFileSync(path, "utf8").trim().toLowerCase();
    if (v === "pass" || v === "skip") return v;
  } catch {
    // unreadable signal -> treat as absent
  }
  return null;
}

function readRounds(key: string): number {
  const path = roundsFile(key);
  if (!existsSync(path)) return 0;
  try {
    const n = Number.parseInt(readFileSync(path, "utf8").trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeRounds(key: string, n: number): void {
  const path = roundsFile(key);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, String(n), "utf8");
  } catch {
    // best-effort; a failed write just resets the counter next time
  }
}

/** Removes a loop's signal + round files. Best-effort. */
export function clearLoop(opts: { session?: string; cwd: string }): void {
  const key = loopKey(opts);
  for (const path of [signalFile(key), roundsFile(key)]) {
    try {
      if (existsSync(path)) rmSync(path);
    } catch {
      // ignore
    }
  }
}

export interface LoopGateInput {
  cwd: string;
  session?: string;
  maxRounds: number;
}

export interface LoopGateResult {
  /** Block the Stop and feed `message` back to the agent. */
  block: boolean;
  /** The protocol to print when blocking. */
  message?: string;
  /** True when the round cap was hit and we allowed the stop anyway. */
  gaveUp?: boolean;
}

/**
 * Evaluate the gate for one Stop event: read the agent's signal + round count,
 * decide, persist, and return whether to block (with the protocol to inject).
 */
export function runLoopGate(input: LoopGateInput): LoopGateResult {
  const key = loopKey(input);
  const decision = decideLoop(
    { signal: readSignal(key), rounds: readRounds(key) },
    input.maxRounds,
  );

  if (decision.action === "allow") {
    clearLoop(input);
    return { block: false };
  }
  if (decision.action === "giveup") {
    clearLoop(input);
    return { block: false, gaveUp: true };
  }

  writeRounds(key, decision.rounds);
  return {
    block: true,
    message: buildProtocol(signalFile(key), decision.rounds, input.maxRounds),
  };
}

/**
 * The verification protocol fed back to the agent when the gate blocks. It is
 * deliberately agent-agnostic about *how* to spawn a sub-checker but specific
 * about *what* to verify, and it hands the agent the exact signal-file path.
 */
export function buildProtocol(signalPath: string, round: number, maxRounds: number): string {
  return `🔍 groundtruth verify loop — round ${round}/${maxRounds - 1}. Do not finish yet.

You reported this work as done. Before stopping, PROVE it behaves as requested —
re-reading the code is not enough; you must execute something and observe it.

1. No checkable change this turn (a pure answer or question)? Then finish:
     printf skip > ${signalPath}

2. Otherwise spawn a FRESH verification sub-agent (one that did not write the
   code). Have it verify by the kind of work:
     • Web / UI  → open the page in the browser (e.g. the Playwright MCP),
                   screenshot it, READ the screenshot, and compare what is
                   actually on screen against the request.
     • CLI       → actually run the command(s); check output and exit code.
     • API       → start the server, hit the endpoint(s), check status + body.
     • Library   → run the tests, plus a smoke call of the changed code.
   It must check against the ORIGINAL request and actively hunt for mistakes
   (missed requirements, wrong values, broken edge cases), then return a
   verdict: PASS, or FAIL with a concrete list of issues.

3. FAIL → fix every issue and verify again. Do NOT write the signal yet.
   PASS → printf pass > ${signalPath}   then you may stop.

Only write \`pass\` when verification genuinely succeeded. Be honest.`;
}
