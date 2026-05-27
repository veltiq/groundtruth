#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_NAMES, autoDetect, getAdapter } from "./adapters/index.js";
import { c } from "./colors.js";
import { failingCount, loadConfig } from "./config.js";
import {
  type HookEvent,
  KNOWN_EVENTS,
  detectGlobalBinary,
  hookCommand,
  installHook,
  installStatusline,
  settingsPathFor,
} from "./install.js";
import { readLedger, recordRun, summarize } from "./ledger.js";
import { runPipeline } from "./pipeline.js";
import { renderJson, renderMarkdown, renderTerminal } from "./report.js";
import type { Turn } from "./types.js";

const VERSION = readVersion();

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      printHelp();
      return 0;
    case "version":
    case "-v":
    case "--version":
      process.stdout.write(`${VERSION}\n`);
      return 0;
    case "hook":
      return runHook(rest);
    case "verify":
      return runVerify(rest);
    case "install":
      return runInstall(rest);
    case "statusline":
      return runStatusline();
    case "stats":
      return runStats(rest);
    default:
      process.stderr.write(c.red(`Unknown command: ${cmd}\n\n`));
      printHelp();
      return 1;
  }
}

/** `groundtruth hook` — invoked by the Claude Code Stop hook (reads JSON on stdin). */
async function runHook(args: string[]): Promise<number> {
  let payload: {
    transcript_path?: string;
    cwd?: string;
    stop_hook_active?: boolean;
    session_id?: string;
    hook_event_name?: string;
  } = {};
  try {
    payload = JSON.parse(await readStdin()) as typeof payload;
  } catch {
    return 0; // no/invalid payload: nothing to check, stay silent
  }

  const cwd = payload.cwd ?? process.cwd();
  const config = loadConfig(cwd);

  // SessionEnd: print a per-session digest from the ledger instead of a check.
  if (payload.hook_event_name === "SessionEnd") {
    if (!config.shadow && payload.session_id) {
      const s = summarize(readLedger(), { session: payload.session_id });
      if (s.runs > 0) {
        process.stderr.write(
          `\n${c.bold("groundtruth")}${c.dim(" — session digest")}  ` +
            `${s.runs} turns · ${c.green(`${s.verified} verified`)} · ${c.red(`${s.unsupported} unsupported`)} · ${c.yellow(`${s.unverifiable} to review`)}\n`,
        );
      }
    }
    return 0;
  }

  const transcriptPath = payload.transcript_path;
  if (!transcriptPath) return 0;

  const strict =
    args.includes("--strict") || process.env.GROUNDTRUTH_STRICT === "1" || config.strict === true;

  const report = runPipeline({ transcriptPath, cwd, config });
  recordRun(report, cwd, payload.session_id);

  if (config.shadow) return 0; // record only — never print or block

  if (report.verdicts.length > 0) {
    process.stderr.write(`\n${renderTerminal(report)}`);
  }

  // Never block twice in a row — avoids a strict-mode loop if the agent can't
  // satisfy the check.
  const fails = failingCount(report, config);
  if (strict && !payload.stop_hook_active && fails > 0) {
    process.stderr.write(
      c.red(`groundtruth: ${fails} failing claim(s) — verify before continuing.\n`),
    );
    return 2; // blocks Stop and feeds the reason back to the agent
  }
  return 0;
}

/** `groundtruth verify` — run manually against the latest (or a given) transcript. */
function runVerify(args: string[]): number {
  const { flags, values } = parseFlags(args, ["transcript", "cwd", "summary", "base", "agent"]);
  const cwd = values.cwd ?? process.cwd();
  const config = loadConfig(cwd);
  const useGit = !flags.has("no-git");
  const gitCwd = useGit ? cwd : undefined;

  let turn: Turn;
  if (values.summary !== undefined) {
    // PR / description mode: grade arbitrary summary text against the diff.
    turn = { summary: readFileSync(values.summary, "utf8"), toolUses: [] };
  } else if (values.agent === "auto" && !values.transcript) {
    const detected = autoDetect(cwd);
    if (!detected) {
      process.stderr.write(
        c.red("No transcript found.\n") +
          c.dim(`No session found for ${cwd} across: ${AGENT_NAMES.join(", ")}.\n`),
      );
      return 1;
    }
    turn = detected.adapter.parse(detected.path);
  } else {
    const name = values.agent && values.agent !== "auto" ? values.agent : "claude";
    const adapter = getAdapter(name);
    if (!adapter) {
      process.stderr.write(
        c.red(`Unknown agent: ${name}.`) + c.dim(` Known: ${AGENT_NAMES.join(", ")}, auto\n`),
      );
      return 1;
    }
    const path = values.transcript ?? adapter.locate(cwd);
    if (!path) {
      process.stderr.write(
        c.red("No transcript found.\n") +
          c.dim(
            `No ${name} session found for ${cwd}. Pass --transcript <path>, or try --agent auto.\n`,
          ),
      );
      return 1;
    }
    turn = adapter.parse(path);
  }

  const report = runPipeline({ turn, cwd: gitCwd, base: values.base, config });

  const format = flags.has("json")
    ? "json"
    : flags.has("markdown")
      ? "markdown"
      : (config.output ?? "terminal");
  if (format === "json") process.stdout.write(`${renderJson(report)}\n`);
  else if (format === "markdown") process.stdout.write(`${renderMarkdown(report)}\n`);
  else process.stdout.write(renderTerminal(report));

  const strict = flags.has("strict") || config.strict === true;
  return strict && failingCount(report, config) > 0 ? 2 : 0;
}

/** `groundtruth install` — wire the Stop hook into Claude Code settings. */
function runInstall(args: string[]): number {
  const { flags, values } = parseFlags(args, ["cwd", "events"]);
  // Prefer the global binary if one is on PATH (faster per turn); otherwise use
  // npx (always works). Explicit --bin / --npx override the detection.
  const useBin = flags.has("bin") || (!flags.has("npx") && detectGlobalBinary());

  let events: HookEvent[] | undefined;
  if (values.events) {
    const requested = values.events.split(",").map((e) => e.trim());
    const invalid = requested.filter((e) => !(KNOWN_EVENTS as readonly string[]).includes(e));
    if (invalid.length > 0) {
      process.stderr.write(
        c.red(`Unknown hook event(s): ${invalid.join(", ")}. Known: ${KNOWN_EVENTS.join(", ")}\n`),
      );
      return 1;
    }
    events = requested as HookEvent[];
  }

  const opts = {
    global: flags.has("global"),
    bin: useBin,
    strict: flags.has("strict"),
    events,
    cwd: values.cwd,
  };

  const eventList = events && events.length > 0 ? events : (["Stop"] as HookEvent[]);

  if (flags.has("print")) {
    const command = hookCommand(opts);
    const entry = [{ hooks: [{ type: "command", command }] }];
    const hooks = Object.fromEntries(eventList.map((e) => [e, entry]));
    process.stdout.write(`Add this to ${settingsPathFor(opts)}:\n\n`);
    process.stdout.write(`${JSON.stringify({ hooks }, null, 2)}\n`);
    return 0;
  }

  const result = installHook(opts);
  if (result.alreadyPresent) {
    process.stdout.write(c.dim(`groundtruth hook already present in ${result.settingsPath}\n`));
    return 0;
  }
  process.stdout.write(`${c.green("✓")} Installed groundtruth hook (${eventList.join(", ")})\n`);
  process.stdout.write(c.dim(`  settings: ${result.settingsPath}\n`));
  process.stdout.write(c.dim(`  command:  ${result.command}\n`));

  if (flags.has("statusline")) {
    const sl = installStatusline(opts);
    if (sl.changed) {
      process.stdout.write(`${c.green("✓")} Wired the status-bar line\n`);
    } else if (sl.existing) {
      process.stdout.write(
        c.yellow(
          `! You already have a statusLine (${sl.existing}). Add this command yourself to combine: ${sl.command}\n`,
        ),
      );
    } else {
      process.stdout.write(c.dim("  status-bar line already present\n"));
    }
  }

  process.stdout.write(`\nRestart Claude Code (or run ${c.cyan("/hooks")}) to pick it up.\n`);
  return 0;
}

/** `groundtruth statusline` — compact one-liner for the Claude Code status bar. */
async function runStatusline(): Promise<number> {
  let cwd = process.cwd();
  try {
    const payload = JSON.parse(await readStdin()) as { cwd?: string };
    if (typeof payload.cwd === "string" && payload.cwd) cwd = payload.cwd;
  } catch {
    // no payload — fall back to process.cwd()
  }
  const week = summarize(readLedger(), { cwd, sinceDays: 7 });
  const status = week.unsupported > 0 ? `🔎 gt ${week.unsupported}❌ ·7d` : "🔎 gt ✓ ·7d";
  process.stdout.write(status);
  return 0;
}

/** `groundtruth stats` — verdict tallies from the local ledger. */
function runStats(args: string[]): number {
  const { flags, values } = parseFlags(args, ["cwd"]);
  const entries = readLedger();
  if (entries.length === 0) {
    process.stdout.write(
      c.dim("No runs recorded yet. groundtruth tallies each turn once installed.\n"),
    );
    return 0;
  }
  const scopeAll = flags.has("all");
  const cwd = scopeAll ? undefined : (values.cwd ?? process.cwd());

  const week = summarize(entries, { cwd, sinceDays: 7 });
  const month = summarize(entries, { cwd, sinceDays: 30 });
  const allTime = summarize(entries, { cwd });

  const scopeLabel = scopeAll ? "all projects" : (cwd ?? process.cwd());
  process.stdout.write(`${c.bold("groundtruth stats")} ${c.dim(`— ${scopeLabel}`)}\n\n`);
  const row = (label: string, s: ReturnType<typeof summarize>) => {
    const parts = [
      `${s.runs} turn${s.runs === 1 ? "" : "s"}`,
      c.green(`${s.verified} verified`),
      c.red(`${s.unsupported} unsupported`),
      c.yellow(`${s.unverifiable} to review`),
    ];
    process.stdout.write(`  ${label.padEnd(9)} ${parts.join(c.dim(" · "))}\n`);
  };
  row("last 7d", week);
  row("last 30d", month);
  row("all time", allTime);
  process.stdout.write("\n");
  return 0;
}

// --- helpers ----------------------------------------------------------------

function parseFlags(
  args: string[],
  valueKeys: string[],
): { flags: Set<string>; values: Record<string, string | undefined>; positionals: string[] } {
  const valueSet = new Set(valueKeys);
  const flags = new Set<string>();
  const values: Record<string, string | undefined> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (valueSet.has(key)) {
        i += 1;
        values[key] = args[i];
      } else {
        flags.add(key);
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, values, positionals };
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp(): void {
  process.stdout.write(`${c.bold("groundtruth")} ${c.dim(`v${VERSION}`)} — verify what your AI says it did against the actual diff.

${c.bold("Usage")}
  groundtruth <command> [options]

${c.bold("Commands")}
  ${c.cyan("verify")}     Check the latest Claude Code turn's claims against the diff
  ${c.cyan("install")}    Wire groundtruth into Claude Code as a Stop hook
  ${c.cyan("stats")}      Show verdict tallies from the local ledger
  ${c.cyan("statusline")} Compact status for the Claude Code status bar (reads JSON on stdin)
  ${c.cyan("hook")}       Internal: run as a Stop hook (reads hook JSON on stdin)
  ${c.cyan("version")}    Print the version
  ${c.cyan("help")}       Show this help

${c.bold("verify options")}
  --agent <name>        claude (default), codex, gemini, cursor, or auto
  --transcript <path>   Check a specific transcript file
  --summary <file>      Grade arbitrary summary text (e.g. a PR description)
  --base <ref>          Diff against a base ref (PR mode: base...HEAD)
  --cwd <path>          Working dir for git evidence (default: cwd)
  --no-git              Use only the transcript's tool calls as evidence
  --json | --markdown   Output format (default: pretty terminal)
  --strict              Exit non-zero if any claim is unsupported

${c.bold("install options")}
  --global              Install into ~/.claude/settings.json (default: ./.claude)
  --bin                 Invoke the global "groundtruth" binary (auto-detected)
  --npx                 Force the "npx -y groundtruth" form
  --strict              Make the hook block on failing claims
  --events <list>       Hook events to install (default: Stop). e.g. Stop,SubagentStop,SessionEnd
  --statusline          Also wire the status-bar line (if none is set)
  --print               Print the settings snippet instead of writing it

${c.bold("stats options")}
  --all                 Aggregate across all projects (default: current project)

${c.bold("Examples")}
  npx groundtruth verify
  npx groundtruth verify --markdown > claim-check.md
  npx groundtruth install --global
`);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(c.red(`groundtruth: ${message}\n`));
    process.exit(1);
  });
