import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface InstallOptions {
  /** Install into the global ~/.claude/settings.json instead of the project. */
  global?: boolean;
  /** Invoke the globally-installed `groundtruth` binary instead of `npx`. */
  bin?: boolean;
  /** Make the hook block when unsupported claims are found. */
  strict?: boolean;
  /** Project directory (defaults to process.cwd()). */
  cwd?: string;
}

export interface InstallResult {
  settingsPath: string;
  command: string;
  changed: boolean;
  alreadyPresent: boolean;
}

interface HookHandler {
  type?: string;
  command?: string;
}
interface HookMatcher {
  matcher?: string;
  hooks?: HookHandler[];
}
interface Settings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

export function hookCommand(opts: InstallOptions): string {
  // Default to the npx form: it works whether or not groundtruth is installed
  // globally, so `npx groundtruth install` produces a hook that just runs.
  const base = opts.bin ? "groundtruth hook" : "npx -y groundtruth hook";
  return opts.strict ? `${base} --strict` : base;
}

/** True if a `groundtruth` binary is already resolvable on PATH. */
export function detectGlobalBinary(): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(probe, ["groundtruth"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function settingsPathFor(opts: InstallOptions): string {
  if (opts.global) return join(homedir(), ".claude", "settings.json");
  return join(opts.cwd ?? process.cwd(), ".claude", "settings.json");
}

/** The Stop-hook fragment groundtruth installs. */
export function hookSettingsFragment(command: string): Settings {
  return { hooks: { Stop: [{ hooks: [{ type: "command", command }] }] } };
}

export function installHook(opts: InstallOptions): InstallResult {
  const settingsPath = settingsPathFor(opts);
  const command = hookCommand(opts);
  const settings = readSettings(settingsPath);

  const hooks = settings.hooks ?? {};
  settings.hooks = hooks;
  const stop = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  hooks.Stop = stop;

  const alreadyPresent = stop.some(
    (entry) =>
      Array.isArray(entry.hooks) &&
      entry.hooks.some((h) => typeof h.command === "string" && h.command.includes("groundtruth")),
  );

  if (alreadyPresent) {
    return { settingsPath, command, changed: false, alreadyPresent: true };
  }

  stop.push({ hooks: [{ type: "command", command }] });
  writeSettings(settingsPath, settings);
  return { settingsPath, command, changed: true, alreadyPresent: false };
}

function readSettings(path: string): Settings {
  if (!existsSync(path)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Could not parse existing settings at ${path}. Fix or remove it, then retry.`);
  }
  return isRecord(parsed) ? (parsed as Settings) : {};
}

function writeSettings(path: string, settings: Settings): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
