import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Turn, WorkContext } from "./types.js";

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
  /** The human request that opened the turn (grounds the verification). */
  request?: string;
  /** Inferred work shape, used to tailor the protocol (which command, screenshot?). */
  work?: WorkContext;
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
    message: buildProtocol(signalFile(key), decision.rounds, input.maxRounds, {
      request: input.request,
      work: input.work,
    }),
  };
}

export interface ProtocolContext {
  /** The human request that opened the turn, grounding the verification. */
  request?: string;
  /** Inferred work shape, used to pick the verification steps and commands. */
  work?: WorkContext;
}

/**
 * The verification protocol fed back to the agent when the gate blocks. It is
 * deliberately agent-agnostic about *how* to spawn a sub-checker but specific
 * about *what* to verify, and it hands the agent the exact signal-file path.
 *
 * When the context is known it grounds the check in the real request and leads
 * with the verification appropriate to the work — for web that means actually
 * driving a browser and reading a screenshot, the richest signal there is.
 */
export function buildProtocol(
  signalPath: string,
  round: number,
  maxRounds: number,
  ctx: ProtocolContext = {},
): string {
  const askLine = ctx.request ? `\nThe request you must verify against:\n  "${ctx.request}"\n` : "";

  return `🔍 groundtruth verify loop — round ${round}/${maxRounds - 1}. Do not finish yet.

You reported this work as done. Before stopping, PROVE it behaves as requested —
re-reading the code is not enough; you must execute something and observe it.
${askLine}
1. No checkable change this turn (a pure answer or question)? Then finish:
     printf skip > ${signalPath}

2. Otherwise spawn a FRESH verification sub-agent (one that did not write the
   code). Have it actually exercise the work and observe the result:
${verificationSteps(ctx.work)}
   It must check the result against the request above and actively hunt for
   mistakes (missed requirements, wrong values, broken edge cases, console
   errors), then return a verdict: PASS, or FAIL with a concrete list of issues.

3. FAIL → fix every issue and verify again. Do NOT write the signal yet.
   PASS → printf pass > ${signalPath}   then you may stop.

Only write \`pass\` when verification genuinely succeeded. Be honest.`;
}

/** The verification body, tailored to the inferred work when we know it. */
function verificationSteps(work?: WorkContext): string {
  const run = work?.runHint ? `\`${work.runHint}\`` : "the project's run/dev command";
  const url = work?.urlHint ?? "the local URL it serves";
  switch (work?.kind) {
    case "web":
      return `   • This looks like WEB / UI work. Start it (${run}), open ${url} in a
     real browser (the Playwright MCP, or a headless Chrome), take a SCREENSHOT,
     and READ the screenshot — compare what is actually on screen, pixel-for-
     intent, against the request. Check the console for errors too.`;
    case "api":
      return `   • This looks like an API / server. Start it (${run}), then hit the
     affected endpoint(s) at ${url} (curl / fetch) and check the status code
     and response body against the request. Cover the error paths, not just 200.`;
    case "cli":
      return `   • This looks like a CLI. Actually run the affected command(s) (${run}),
     with realistic args, and check stdout/stderr and the exit code against the
     request. Try at least one invalid-input case.`;
    case "library":
      return `   • This looks like library code. Run the tests (${run}), and add a smoke
     call that exercises the changed function with a real input, observing the
     return value against the request.`;
    default:
      return `   • Run / open / call whatever this turn changed and observe the result:
     Web → screenshot the page; CLI → run it; API → hit the endpoint; library →
     run the tests plus a smoke call. Use ${run} if it applies.`;
  }
}
