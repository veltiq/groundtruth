import type { Claim, Evidence, Verdict, VerdictLevel } from "./types.js";

/**
 * Checks each claim against the evidence and assigns a verdict.
 *
 * The cardinal rule: only return `unsupported` when a claim is *concretely
 * checkable* and has *zero* corresponding evidence. When in doubt we return
 * `unverifiable` (advisory) — never a false accusation.
 */
export function verifyClaims(claims: Claim[], evidence: Evidence): Verdict[] {
  return claims.map((claim) => verifyClaim(claim, evidence));
}

function verifyClaim(claim: Claim, ev: Evidence): Verdict {
  switch (claim.kind) {
    case "file":
      return verifyFile(claim, ev);
    case "symbol":
      return verifySymbol(claim, ev);
    case "test":
      return verifyTest(claim, ev);
    case "dependency":
      return verifyDependency(claim, ev);
    case "command":
      return verifyCommand(claim, ev);
    case "action":
      return advisory(claim, "Semantic claim — not machine-verifiable. Review manually.");
  }
}

function verifyFile(claim: Claim, ev: Evidence): Verdict {
  const match = ev.touchedFiles.find((f) => fileMatches(claim.target, f));
  if (match) return ok(claim, `\`${match}\` was changed this turn.`, match);
  if (ev.touchedFiles.length === 0) {
    return bad(claim, `Claimed a change to \`${claim.target}\`, but no files changed this turn.`);
  }
  return bad(
    claim,
    `Claimed a change to \`${claim.target}\`, but it is not among the files changed (${preview(ev.touchedFiles)}).`,
  );
}

function verifySymbol(claim: Claim, ev: Evidence): Verdict {
  const id = claim.target;
  if (id.length < 2 || STOPWORDS.has(id.toLowerCase())) {
    return advisory(claim, `\`${id}\` is too generic to verify reliably.`);
  }

  const inAdded = identifierPresent(ev.addedText, id);
  const inRemoved = identifierPresent(ev.removedText, id);

  if (claim.polarity === "remove") {
    return inRemoved
      ? ok(claim, `\`${id}\` appears in the removed code.`)
      : bad(claim, `Claimed removal of \`${id}\`, but it does not appear in the removed code.`);
  }

  if (inAdded) return ok(claim, `\`${id}\` appears in the added code.`);
  if (inRemoved) {
    return advisory(
      claim,
      `\`${id}\` appears only in removed code — the wording implied an addition.`,
    );
  }
  if (!ev.addedText.trim() && !ev.removedText.trim()) {
    return bad(claim, `Claimed \`${id}\`, but no code changes were captured this turn.`);
  }
  return bad(claim, `Claimed \`${id}\`, but it does not appear anywhere in this turn's changes.`);
}

function verifyTest(claim: Claim, ev: Evidence): Verdict {
  const file = ev.touchedFiles.find(isTestFile);
  if (file) return ok(claim, `Test file \`${file}\` was changed.`, file);
  const cmd = ev.commands.find(isTestCommand);
  if (cmd) return ok(claim, `A test command ran: \`${trunc(cmd)}\`.`);
  return bad(
    claim,
    "Claimed test work, but no test file changed and no test command ran this turn.",
  );
}

function verifyDependency(claim: Claim, ev: Evidence): Verdict {
  const manifest = ev.touchedFiles.find(isManifest);
  const installCmd = ev.commands.find(isInstallCommand);
  const specific = claim.target !== "dependency";

  if (manifest && (!specific || ev.addedText.includes(claim.target))) {
    return ok(claim, `Manifest \`${manifest}\` was changed.`, manifest);
  }
  if (installCmd) return ok(claim, `An install command ran: \`${trunc(installCmd)}\`.`);
  if (!specific) {
    return advisory(claim, "Claimed a dependency change, but none was detected — review manually.");
  }
  return bad(
    claim,
    `Claimed installing \`${claim.target}\`, but no manifest change or install command was found.`,
  );
}

function verifyCommand(claim: Claim, ev: Evidence): Verdict {
  const match = ev.commands.find((cmd) => commandMatches(cmd, claim.target));
  if (match) return ok(claim, `Command ran: \`${trunc(match)}\`.`, match);
  // Commands can legitimately run outside the Bash tool, so stay advisory.
  return advisory(
    claim,
    "No matching command was recorded via the Bash tool (it may have run another way).",
  );
}

// --- matchers ---------------------------------------------------------------

function fileMatches(claimPath: string, actual: string): boolean {
  const a = norm(claimPath);
  const b = norm(actual);
  if (a === b) return true;
  if (b.endsWith(`/${a}`) || a.endsWith(`/${b}`)) return true;
  if (!a.includes("/") && base(b) === a) return true;
  if (!b.includes("/") && base(a) === b) return true;
  return false;
}

function identifierPresent(haystack: string, id: string): boolean {
  if (!haystack) return false;
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w$])${esc}(?![\\w$])`).test(haystack);
}

function isTestFile(f: string): boolean {
  const b = f.toLowerCase();
  return (
    /(^|\/)(tests?|__tests__|spec|specs)\//.test(b) ||
    /\.(test|spec)\.[a-z0-9]+$/.test(b) ||
    /_test\.[a-z0-9]+$/.test(b) ||
    /(^|\/)test_[^/]+\.py$/.test(b)
  );
}

function isTestCommand(cmd: string): boolean {
  const c = cmd.toLowerCase();
  return (
    /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/.test(c) ||
    /\b(vitest|jest|mocha|ava|rspec|phpunit|pytest)\b/.test(c) ||
    /\bgo\s+test\b/.test(c) ||
    /\bcargo\s+test\b/.test(c)
  );
}

function isManifest(f: string): boolean {
  const b = base(f).toLowerCase();
  return new Set([
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "requirements.txt",
    "pyproject.toml",
    "poetry.lock",
    "pipfile",
    "pipfile.lock",
    "cargo.toml",
    "cargo.lock",
    "go.mod",
    "go.sum",
    "gemfile",
    "gemfile.lock",
    "composer.json",
    "composer.lock",
  ]).has(b);
}

function isInstallCommand(cmd: string): boolean {
  const c = cmd.toLowerCase();
  return (
    /\b(npm|pnpm|yarn|bun)\s+(add|install|i)\b/.test(c) ||
    /\bpip3?\s+install\b/.test(c) ||
    /\bpoetry\s+add\b/.test(c) ||
    /\bcargo\s+add\b/.test(c) ||
    /\bgo\s+get\b/.test(c) ||
    /\bgem\s+install\b/.test(c) ||
    /\bcomposer\s+require\b/.test(c)
  );
}

function commandMatches(cmd: string, target: string): boolean {
  const c = cmd.toLowerCase();
  switch (target) {
    case "tests":
      return isTestCommand(cmd);
    case "build":
      return /\bbuild\b/.test(c);
    case "lint":
      return /\b(lint|eslint|biome|ruff)\b/.test(c);
    case "typecheck":
      return /\b(tsc|typecheck|type-check|mypy)\b/.test(c);
    default: {
      const first = target.toLowerCase().split(/\s+/)[0] ?? target.toLowerCase();
      return c.includes(target.toLowerCase()) || (first.length > 1 && c.includes(first));
    }
  }
}

const STOPWORDS = new Set([
  "it",
  "this",
  "that",
  "the",
  "true",
  "false",
  "null",
  "undefined",
  "none",
  "done",
  "ok",
  "yes",
  "no",
  "id",
  "ok.",
  "fix",
  "fixed",
  "todo",
]);

// --- verdict constructors & string helpers ----------------------------------

function ok(claim: Claim, reason: string, evidence?: string): Verdict {
  return mk(claim, "verified", reason, evidence);
}
function bad(claim: Claim, reason: string): Verdict {
  return mk(claim, "unsupported", reason);
}
function advisory(claim: Claim, reason: string): Verdict {
  return mk(claim, "unverifiable", reason);
}
function mk(claim: Claim, level: VerdictLevel, reason: string, evidence?: string): Verdict {
  return evidence ? { claim, level, reason, evidence } : { claim, level, reason };
}

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}
function base(p: string): string {
  const n = norm(p);
  return n.slice(n.lastIndexOf("/") + 1);
}
function trunc(s: string, max = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
function preview(files: string[], max = 3): string {
  const shown = files.slice(0, max).join(", ");
  return files.length > max ? `${shown}, +${files.length - max} more` : shown;
}
