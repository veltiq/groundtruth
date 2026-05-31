import type { Claim, ClaimKind, Polarity } from "./types.js";

/**
 * Extracts checkable claims from an assistant's summary prose.
 *
 * Design goal: **high precision over high recall.** A missed claim is harmless;
 * a falsely flagged claim erodes trust and gets the tool uninstalled. So we only
 * emit concrete claims anchored on strong signals (backticked tokens, real paths,
 * test/dependency keywords) and treat everything vague as a non-failing "action"
 * claim. We also skip clauses that read as *intent* ("I'll add…") rather than a
 * completed-work assertion.
 */
export function extractClaims(summary: string): Claim[] {
  const claims: Claim[] = [];
  const seen = new Set<string>();

  const add = (kind: ClaimKind, target: string, polarity: Polarity, source: string): void => {
    const key = `${kind}:${target.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    claims.push({ kind, target, polarity, source: source.trim() });
  };

  for (const clause of splitClauses(stripCodeFences(summary))) {
    if (isIntent(clause)) continue;

    const polarity = detectPolarity(clause);
    const hasVerb =
      ADD_VERBS.test(clause) || REMOVE_VERBS.test(clause) || MODIFY_VERBS.test(clause);
    const dep = dependencyTarget(clause);
    let concrete = false;

    // "renamed `A` to `B`" — the old name should be gone, the new name present.
    const renamed = matchRename(clause);
    if (renamed) {
      add("symbol", renamed.from, "remove", clause);
      add("symbol", renamed.to, "add", clause);
      concrete = true;
    }

    for (const tok of backtickTokens(clause)) {
      if (looksLikePath(tok)) {
        add("file", tok, polarity, clause);
        concrete = true;
        continue;
      }
      if (tok.includes(" ")) {
        const first = (tok.split(/\s+/)[0] ?? "").toLowerCase();
        if (COMMAND_WORDS.has(first)) {
          add("command", tok, polarity, clause);
          concrete = true;
        }
        continue;
      }
      const sym = symbolName(tok);
      if (sym) {
        // Don't also mine the dependency's own name as a symbol — "installed
        // `zod`" is a single dependency claim, not a phantom `zod` symbol.
        if (dep && sym === dep) continue;
        add("symbol", sym, polarity, clause);
        concrete = true;
      }
    }

    for (const path of barePaths(clause)) {
      add("file", path, polarity, clause);
      concrete = true;
    }

    // "ran the tests / build / lint" -> a command claim (lenient verification).
    if (RAN_RE.test(clause)) {
      const cmd = ranCommandKeyword(clause);
      if (cmd) {
        add("command", cmd, "modify", clause);
        concrete = true;
      }
    } else if (hasVerb && TEST_RE.test(clause)) {
      // "added / updated tests" -> a test-authoring claim.
      add("test", "tests", polarity === "remove" ? "remove" : "add", clause);
      concrete = true;
    }

    if (dep) {
      add("dependency", dep, "add", clause);
      concrete = true;
    }

    // Fallback: a completed-work assertion we couldn't pin to anything concrete.
    if (!concrete && hasVerb) {
      add("action", shorten(clause), polarity, clause);
    }
  }

  return claims;
}

// --- clause splitting -------------------------------------------------------

function splitClauses(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^\s*([-*+•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    for (const part of line.split(/(?<=[.;!?])\s+/)) {
      const p = part.trim();
      if (p) out.push(p);
    }
  }
  return out;
}

// --- verb / polarity detection ----------------------------------------------

const ADD_VERBS =
  /\b(add(?:ed|s|ing)?|creat(?:e|ed|es|ing)|implement(?:ed|s|ing)?|introduc(?:e|ed|es|ing)|wrote|writ(?:e|es|ing)|includ(?:e|ed|es)|set up|wir(?:e|ed|es)|hook(?:ed)? up|defin(?:e|ed|es))\b/i;
const REMOVE_VERBS =
  /\b(remov(?:e|ed|es|ing)|delet(?:e|ed|es|ing)|drop(?:ped|s)?|strip(?:ped|s)?|deprecat(?:e|ed|es)|tore out|took out|got rid of)\b/i;
const MODIFY_VERBS =
  /\b(updat(?:e|ed|es|ing)|modif(?:y|ied|ies)|chang(?:e|ed|es)|refactor(?:ed|s|ing)?|fix(?:ed|es|ing)?|renam(?:e|ed|es)|improv(?:e|ed|es)|adjust(?:ed|s)?|replac(?:e|ed|es)|migrat(?:e|ed|es)|rework(?:ed)?|clean(?:ed)? up|tweak(?:ed)?)\b/i;

const INTENT_RE =
  /\b(let me|let's|i'?ll|i will|i'?m going to|gonna|going to|need to|needs to|should|would|could|next,?|to-?do|plan to|want to|first,? i|then i'?ll)\b/i;

const RAN_RE = /\b(ran|run|re-?ran|executed|execute)\b/i;
const TEST_RE = /\b(tests?|specs?|unit test|test (?:suite|cases?|coverage)|test file)\b/i;

function detectPolarity(clause: string): Polarity {
  if (REMOVE_VERBS.test(clause)) return "remove";
  if (ADD_VERBS.test(clause)) return "add";
  return "modify";
}

function isIntent(clause: string): boolean {
  return INTENT_RE.test(clause);
}

// --- token extraction -------------------------------------------------------

function backtickTokens(clause: string): string[] {
  const out: string[] = [];
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null = re.exec(clause);
  while (m !== null) {
    const t = m[1]?.trim();
    if (t) out.push(t);
    m = re.exec(clause);
  }
  return out;
}

const COMMAND_WORDS = new Set([
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "npx",
  "git",
  "node",
  "deno",
  "python",
  "python3",
  "pip",
  "pip3",
  "pytest",
  "make",
  "cargo",
  "go",
  "docker",
  "tsc",
  "eslint",
  "prettier",
  "biome",
  "vitest",
  "jest",
  "ruff",
  "poetry",
  "rails",
  "mvn",
  "gradle",
]);

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "java",
  "rb",
  "php",
  "c",
  "h",
  "hpp",
  "cpp",
  "cc",
  "cs",
  "swift",
  "kt",
  "scala",
  "sh",
  "bash",
  "zsh",
  "sql",
  "html",
  "css",
  "scss",
  "sass",
  "less",
  "vue",
  "svelte",
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
  "md",
  "mdx",
  "txt",
  "env",
  "lock",
  "ini",
  "cfg",
  "conf",
  "gradle",
  "proto",
  "graphql",
  "prisma",
]);

const SPECIAL_FILES = new Set([
  "Dockerfile",
  "Makefile",
  "Gemfile",
  "Rakefile",
  "Procfile",
  ".gitignore",
  ".env",
  ".npmignore",
  ".dockerignore",
  ".editorconfig",
]);

/** Normalizes a backtick token to a symbol name, or null if it isn't one. */
function symbolName(tok: string): string | null {
  // JSX/HTML elements: `<Button>`, `</Modal>`, `<Foo.Bar ...>` -> the tag name.
  const jsx = /^<\/?\s*([A-Za-z][\w.]*)\b[^>]*>$/.exec(tok);
  if (jsx?.[1]) return jsx[1];
  const id = stripCall(tok);
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(id) ? id : null;
}

/** Matches "renamed `A` to `B`" forms and returns the two symbol names. */
function matchRename(clause: string): { from: string; to: string } | null {
  if (!/\brenam(?:e|ed|es|ing)\b/i.test(clause)) return null;
  const m = /`([^`]+)`\s*(?:to|into|->|→|=>)\s*`([^`]+)`/i.exec(clause);
  if (!m?.[1] || !m[2]) return null;
  const from = symbolName(m[1]);
  const to = symbolName(m[2]);
  return from && to ? { from, to } : null;
}

/** Removes fenced code blocks so code samples in a summary aren't mined for claims. */
function stripCodeFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/~~~[\s\S]*?~~~/g, " ");
}

function looksLikePath(tok: string): boolean {
  if (tok.includes(" ")) return false;
  if (/[<>]/.test(tok)) return false; // JSX/HTML tags like `</Modal>`, not paths
  if (SPECIAL_FILES.has(tok)) return true;
  if (/^https?:\/\//i.test(tok)) return false;
  const ext = extOf(tok);
  // Leading-slash tokens are routes/URLs (e.g. `/api/users`), not files —
  // unless they carry a real file extension. Avoids false file claims.
  if (tok.startsWith("/")) return ext !== null && CODE_EXTENSIONS.has(ext);
  // Relative tokens with a separator are paths, with or without an extension
  // (`src/auth.ts`, `src/auth`).
  if (tok.includes("/")) return true;
  return ext !== null && CODE_EXTENSIONS.has(ext);
}

function extOf(tok: string): string | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(tok);
  return m?.[1] ? m[1].toLowerCase() : null;
}

function stripCall(tok: string): string {
  return tok.replace(/\([^)]*\)$/, "").trim();
}

/**
 * Bare (un-backticked) file paths. Deliberately conservative: we only accept
 * tokens that contain a slash or are well-known dotfiles, because bare
 * "word.ext" tokens collide with framework names ("Node.js", "Vue.js") and
 * would produce false file claims.
 */
function barePaths(clause: string): string[] {
  const stripped = clause.replace(/`[^`]+`/g, " ");
  const out: string[] = [];

  const re = /(?<![\w@/.-])([\w.-]+\/[\w./-]+)/g;
  let m: RegExpExecArray | null = re.exec(stripped);
  while (m !== null) {
    const tok = m[1];
    if (tok && !/^https?:/i.test(tok)) {
      out.push(tok.replace(/[.,;:)\]]+$/, ""));
    }
    m = re.exec(stripped);
  }

  for (const sf of SPECIAL_FILES) {
    const re2 = new RegExp(`(?<![\\w/])${escapeRe(sf)}(?![\\w])`);
    if (re2.test(stripped)) out.push(sf);
  }
  return out;
}

function ranCommandKeyword(clause: string): string | null {
  if (TEST_RE.test(clause)) return "tests";
  if (/\bbuild\b/i.test(clause)) return "build";
  if (/\blint(?:er|ing)?\b/i.test(clause)) return "lint";
  if (/\btype[- ]?check|tsc\b/i.test(clause)) return "typecheck";
  return null;
}

const INSTALL_RE = /\b(install(?:ed|s|ing)?)\b/i;
const DEP_NOUN_RE =
  /\b(package|packages|dependency|dependencies|module|modules|library|libraries)\b/i;

function dependencyTarget(clause: string): string | null {
  const m =
    /\b(?:npm|pnpm|yarn|bun)\s+(?:add|install|i)\s+(@?[\w./-]+)/i.exec(clause) ??
    /\b(?:pip3?|poetry|cargo|gem|composer)\s+(?:install|add|require)\s+([\w.\-]+)/i.exec(clause) ??
    /\binstalled\s+(?:the\s+)?`?(@?[\w./-]+)`?\s+(?:package|dependency|module|library)/i.exec(
      clause,
    );
  if (m?.[1]) return m[1];
  if (INSTALL_RE.test(clause) && DEP_NOUN_RE.test(clause)) return "dependency";
  return null;
}

// --- misc -------------------------------------------------------------------

function shorten(text: string, max = 90): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
