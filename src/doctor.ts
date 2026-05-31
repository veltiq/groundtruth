import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { autoDetect } from "./adapters/index.js";
import { loadConfig } from "./config.js";
import { detectGlobalBinary } from "./install.js";
import { ledgerPath, readLedger, summarize } from "./ledger.js";

/**
 * `groundtruth doctor` — diagnose an install in one command.
 *
 * The most common onboarding question is "is it actually wired up and working?"
 * Doctor answers it: it checks Node, the hook wiring (global + project), the
 * binary, git evidence, config, whether a transcript is discoverable, the verify
 * loop's state, and the ledger — and prints an actionable report with a clear
 * next step when something's off. Pure detection in `buildDoctorReport` (so it's
 * testable); IO is done here and handed in.
 */

export type CheckStatus = "ok" | "warn" | "fail";

export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
  /** A concrete next step shown when the check isn't ok. */
  hint?: string;
}

export interface DoctorReport {
  checks: Check[];
  ok: number;
  warn: number;
  fail: number;
}

interface SettingsScan {
  /** Path → the groundtruth hook command found there (events it's wired into). */
  found: Array<{ path: string; events: string[]; command: string }>;
}

/** Where Claude Code keeps settings: project first, then global (deduped). */
function settingsPaths(cwd: string): string[] {
  return [
    ...new Set([
      join(cwd, ".claude", "settings.json"),
      join(homedir(), ".claude", "settings.json"),
    ]),
  ];
}

interface HooksFile {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
}

/** Scans Claude settings files for a wired groundtruth hook. Pure given the inputs. */
export function scanSettings(files: Array<{ path: string; json: unknown }>): SettingsScan {
  const found: SettingsScan["found"] = [];
  for (const { path, json } of files) {
    const hooks = (json as HooksFile | undefined)?.hooks;
    if (!hooks || typeof hooks !== "object") continue;
    const events: string[] = [];
    let command = "";
    for (const [event, matchers] of Object.entries(hooks)) {
      if (!Array.isArray(matchers)) continue;
      for (const m of matchers) {
        for (const h of m.hooks ?? []) {
          if (typeof h.command === "string" && h.command.includes("groundtruth")) {
            if (!events.includes(event)) events.push(event);
            command = h.command;
          }
        }
      }
    }
    if (events.length > 0) found.push({ path, events, command });
  }
  return found.length > 0 ? { found } : { found: [] };
}

function readJsonSafe(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null; // present but unparseable
  }
}

function isGitRepo(cwd: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

export interface DoctorInputs {
  cwd: string;
  version: string;
  nodeVersion: string;
  settings: Array<{ path: string; json: unknown }>;
  hasGlobalBinary: boolean;
  inGitRepo: boolean;
  config: ReturnType<typeof loadConfig>;
  transcriptFound: boolean;
  noLoopEnv: boolean;
  ledgerRuns: number;
}

/** Builds the report from already-collected facts. Pure — the unit-test seam. */
export function buildDoctorReport(inp: DoctorInputs): DoctorReport {
  const checks: Check[] = [];
  const add = (name: string, status: CheckStatus, detail: string, hint?: string) =>
    checks.push(hint ? { name, status, detail, hint } : { name, status, detail });

  // Node
  const major = Number.parseInt(inp.nodeVersion.replace(/^v/, "").split(".")[0] ?? "0", 10);
  if (major >= 20) add("Node.js", "ok", `${inp.nodeVersion} (>= 20)`);
  else
    add(
      "Node.js",
      "fail",
      `${inp.nodeVersion} — groundtruth needs Node >= 20`,
      "Upgrade Node to 20 or newer.",
    );

  add("Version", "ok", `groundtruth ${inp.version}`);

  // Hook wiring
  const scan = scanSettings(inp.settings);
  const hookHasLoop = scan.found.some((f) => f.command.includes("--loop"));
  if (scan.found.length > 0) {
    const events = [...new Set(scan.found.flatMap((f) => f.events))].join(", ");
    add(
      "Stop hook",
      "ok",
      `wired in ${scan.found.map((f) => shortPath(f.path)).join(" + ")} (${events})${hookHasLoop ? " · verify loop on" : ""}`,
    );
  } else {
    add(
      "Stop hook",
      "fail",
      "not wired into Claude Code — turns aren't being checked",
      "Run `groundtruth setup` (or `groundtruth install`), then restart Claude Code.",
    );
  }

  // Binary vs npx
  if (inp.hasGlobalBinary) add("Binary", "ok", "`groundtruth` is on PATH (fast per-turn startup)");
  else
    add(
      "Binary",
      "warn",
      "running via `npx` (works, but slower per turn)",
      "Optional: `npm i -g @veltiq/groundtruth` for an always-on binary.",
    );

  // Git evidence
  if (inp.inGitRepo)
    add("Git evidence", "ok", "this directory is a git repo — diff corroborates tool calls");
  else
    add(
      "Git evidence",
      "warn",
      "not a git repo — only tool-call evidence is used here",
      "Works fine; git just adds corroborating diff evidence.",
    );

  // Config
  const cfgKeys = Object.keys(inp.config);
  if (cfgKeys.length > 0) add("Config", "ok", `loaded (${cfgKeys.join(", ")})`);
  else add("Config", "ok", "using defaults (no .groundtruthrc.json)");

  // Transcript discoverability
  if (inp.transcriptFound)
    add("Transcript", "ok", "a Claude Code session was found for this project");
  else
    add(
      "Transcript",
      "warn",
      "no session transcript found yet for this project",
      "Expected before your first turn here — run an agent turn, then re-check.",
    );

  // Verify loop — on when the wired hook carries --loop or config enables it.
  const loopOn = hookHasLoop || inp.config.loop?.enabled === true;
  if (inp.noLoopEnv)
    add(
      "Verify loop",
      "warn",
      `paused by GROUNDTRUTH_NO_LOOP=1${loopOn ? " (otherwise on)" : ""}`,
      "Unset GROUNDTRUTH_NO_LOOP to re-enable the loop.",
    );
  else if (loopOn) add("Verify loop", "ok", `on${hookHasLoop ? " (hook --loop)" : " (config)"}`);
  else add("Verify loop", "ok", "off (opt-in) — enable via `setup`, `--loop`, or config");

  // Ledger
  if (inp.ledgerRuns > 0)
    add("Ledger", "ok", `${inp.ledgerRuns} turn(s) recorded — run \`groundtruth stats\``);
  else add("Ledger", "ok", "no turns recorded yet (privacy-safe local counts only)");

  const ok = checks.filter((c) => c.status === "ok").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  return { checks, ok, warn, fail };
}

/** Collects the live facts and builds the report. */
export function runDoctor(cwd: string, version: string): DoctorReport {
  const settings = settingsPaths(cwd).map((path) => ({ path, json: readJsonSafe(path) }));
  const config = loadConfig(cwd);
  let transcriptFound = false;
  try {
    transcriptFound = autoDetect(cwd) !== null;
  } catch {
    transcriptFound = false;
  }
  let ledgerRuns = 0;
  try {
    if (existsSync(ledgerPath())) ledgerRuns = summarize(readLedger(), { cwd }).runs;
  } catch {
    ledgerRuns = 0;
  }
  return buildDoctorReport({
    cwd,
    version,
    nodeVersion: process.version,
    settings,
    hasGlobalBinary: detectGlobalBinary(),
    inGitRepo: isGitRepo(cwd),
    config,
    transcriptFound,
    noLoopEnv: process.env.GROUNDTRUTH_NO_LOOP === "1",
    ledgerRuns,
  });
}

function shortPath(p: string): string {
  const home = homedir();
  return p.startsWith(home) ? p.replace(home, "~") : p;
}
