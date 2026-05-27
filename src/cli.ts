#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { c } from "./colors.js";
import { hookCommand, installHook, settingsPathFor } from "./install.js";
import { findLatestTranscript } from "./locate.js";
import { runPipeline } from "./pipeline.js";
import { renderJson, renderMarkdown, renderTerminal } from "./report.js";

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
    default:
      process.stderr.write(c.red(`Unknown command: ${cmd}\n\n`));
      printHelp();
      return 1;
  }
}

/** `groundtruth hook` — invoked by the Claude Code Stop hook (reads JSON on stdin). */
async function runHook(args: string[]): Promise<number> {
  const strict = args.includes("--strict") || process.env.GROUNDTRUTH_STRICT === "1";

  let payload: { transcript_path?: string; cwd?: string } = {};
  try {
    payload = JSON.parse(await readStdin()) as typeof payload;
  } catch {
    return 0; // no/invalid payload: nothing to check, stay silent
  }

  const transcriptPath = payload.transcript_path;
  if (!transcriptPath) return 0;
  const cwd = payload.cwd ?? process.cwd();

  const report = runPipeline({ transcriptPath, cwd });
  if (report.verdicts.length > 0) {
    process.stderr.write(`\n${renderTerminal(report)}`);
  }

  if (strict && report.summary.unsupported > 0) {
    process.stderr.write(
      c.red(
        `groundtruth: ${report.summary.unsupported} unsupported claim(s) — verify before continuing.\n`,
      ),
    );
    return 2; // blocks Stop and feeds the reason back to the agent
  }
  return 0;
}

/** `groundtruth verify` — run manually against the latest (or a given) transcript. */
function runVerify(args: string[]): number {
  const { flags, values } = parseFlags(args, ["transcript", "cwd"]);
  const cwd = values.cwd ?? process.cwd();

  let transcriptPath = values.transcript;
  if (!transcriptPath) {
    const found = findLatestTranscript(cwd);
    if (!found) {
      process.stderr.write(
        c.red("No transcript found.\n") +
          c.dim(
            `Looked for the most recent Claude Code session for ${cwd}.\nPass one explicitly: groundtruth verify --transcript <path.jsonl>\n`,
          ),
      );
      return 1;
    }
    transcriptPath = found;
  }

  const useGit = !flags.has("no-git");
  const report = runPipeline({ transcriptPath, cwd: useGit ? cwd : undefined });
  if (flags.has("json")) process.stdout.write(`${renderJson(report)}\n`);
  else if (flags.has("markdown")) process.stdout.write(`${renderMarkdown(report)}\n`);
  else process.stdout.write(renderTerminal(report));

  return flags.has("strict") && report.summary.unsupported > 0 ? 2 : 0;
}

/** `groundtruth install` — wire the Stop hook into Claude Code settings. */
function runInstall(args: string[]): number {
  const { flags, values } = parseFlags(args, ["cwd"]);
  const opts = {
    global: flags.has("global"),
    npx: flags.has("npx"),
    strict: flags.has("strict"),
    cwd: values.cwd,
  };

  if (flags.has("print")) {
    const command = hookCommand(opts);
    process.stdout.write(`Add this to ${settingsPathFor(opts)}:\n\n`);
    process.stdout.write(
      `${JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command }] }] } }, null, 2)}\n`,
    );
    return 0;
  }

  const result = installHook(opts);
  if (result.alreadyPresent) {
    process.stdout.write(c.dim(`groundtruth hook already present in ${result.settingsPath}\n`));
    return 0;
  }
  process.stdout.write(`${c.green("✓")} Installed groundtruth Stop hook\n`);
  process.stdout.write(c.dim(`  settings: ${result.settingsPath}\n`));
  process.stdout.write(c.dim(`  command:  ${result.command}\n\n`));
  process.stdout.write(`Restart Claude Code (or run ${c.cyan("/hooks")}) to pick it up.\n`);
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
  ${c.cyan("hook")}       Internal: run as a Stop hook (reads hook JSON on stdin)
  ${c.cyan("version")}    Print the version
  ${c.cyan("help")}       Show this help

${c.bold("verify options")}
  --transcript <path>   Check a specific .jsonl transcript
  --cwd <path>          Working dir for git evidence (default: cwd)
  --no-git              Use only the transcript's tool calls as evidence
  --json | --markdown   Output format (default: pretty terminal)
  --strict              Exit non-zero if any claim is unsupported

${c.bold("install options")}
  --global              Install into ~/.claude/settings.json (default: ./.claude)
  --npx                 Use "npx -y groundtruth" instead of a global binary
  --strict              Make the hook block on unsupported claims
  --print               Print the settings snippet instead of writing it

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
