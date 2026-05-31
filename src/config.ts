import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { clampMaxRounds } from "./loop.js";
import type { Claim, ClaimKind, Config, FailLevel, LoopConfig, Report } from "./types.js";

const RC_FILE = ".groundtruthrc.json";
const VALID_FAIL_LEVELS: ReadonlySet<string> = new Set(["unsupported", "unverifiable"]);
const VALID_KINDS: ReadonlySet<string> = new Set([
  "file",
  "symbol",
  "test",
  "dependency",
  "command",
  "action",
]);
const VALID_OUTPUTS: ReadonlySet<string> = new Set(["terminal", "json", "markdown"]);

/**
 * Loads config for a project, merging (in increasing precedence):
 *   1. a `groundtruth` key in package.json
 *   2. a `.groundtruthrc.json` file
 * Unknown/malformed values are ignored — config never throws.
 */
export function loadConfig(cwd: string): Config {
  const pkg = readJson(join(cwd, "package.json"));
  const fromPkg = pkg && isRecord(pkg.groundtruth) ? pkg.groundtruth : undefined;
  const fromRc = readJson(join(cwd, RC_FILE));
  return { ...sanitize(fromPkg), ...sanitize(fromRc) };
}

/** Drops claims the config asks to ignore (by kind or by target pattern). */
export function applyConfig(claims: Claim[], config: Config): Claim[] {
  const ignoreKinds = new Set<ClaimKind>(config.ignoreKinds ?? []);
  const matchers = (config.ignore ?? []).map(toMatcher);
  return claims.filter((claim) => {
    if (ignoreKinds.has(claim.kind)) return false;
    return !matchers.some((match) => match(claim.target));
  });
}

function toMatcher(pattern: string): (value: string) => boolean {
  const p = pattern.toLowerCase();
  if (p.includes("*")) {
    const re = new RegExp(`^${p.split("*").map(escapeRe).join(".*")}$`);
    return (value) => re.test(value.toLowerCase());
  }
  return (value) => value.toLowerCase().includes(p);
}

/** How many verdicts count as a failure under the config's `failOn` policy. */
export function failingCount(report: Report, config: Config): number {
  const levels: FailLevel[] = config.failOn ?? ["unsupported"];
  let n = 0;
  if (levels.includes("unsupported")) n += report.summary.unsupported;
  if (levels.includes("unverifiable")) n += report.summary.unverifiable;
  return n;
}

function sanitize(input: unknown): Config {
  if (!isRecord(input)) return {};
  const out: Config = {};
  if (typeof input.strict === "boolean") out.strict = input.strict;
  if (typeof input.shadow === "boolean") out.shadow = input.shadow;
  if (isStringArray(input.failOn)) {
    out.failOn = input.failOn.filter((l): l is FailLevel => VALID_FAIL_LEVELS.has(l));
  }
  if (isStringArray(input.ignore)) out.ignore = input.ignore;
  if (isStringArray(input.ignoreKinds)) {
    out.ignoreKinds = input.ignoreKinds.filter((k): k is ClaimKind => VALID_KINDS.has(k));
  }
  if (typeof input.output === "string" && VALID_OUTPUTS.has(input.output)) {
    out.output = input.output as Config["output"];
  }
  const loop = sanitizeLoop(input.loop);
  if (loop) out.loop = loop;
  return out;
}

function sanitizeLoop(input: unknown): LoopConfig | undefined {
  if (!isRecord(input)) return undefined;
  const loop: LoopConfig = {};
  if (typeof input.enabled === "boolean") loop.enabled = input.enabled;
  if (typeof input.maxRounds === "number" && Number.isFinite(input.maxRounds)) {
    loop.maxRounds = clampMaxRounds(input.maxRounds);
  }
  return Object.keys(loop).length > 0 ? loop : undefined;
}

function readJson(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
