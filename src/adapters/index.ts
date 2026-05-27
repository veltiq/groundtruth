import { createHash } from "node:crypto";
import { type Dirent, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { findLatestTranscript } from "../locate.js";
import { parseTranscriptFile } from "../transcript.js";
import type { Turn } from "../types.js";
import { parseAider } from "./aider.js";
import { parseCodex } from "./codex.js";
import { parseCursorFile } from "./cursor.js";
import { parseGemini } from "./gemini.js";
import { parseOpenCode } from "./opencode.js";

export interface Adapter {
  name: string;
  /** Locate the most recent transcript for a project, or null. Best-effort. */
  locate(cwd: string): string | null;
  /** Parse a transcript file into a Turn. */
  parse(path: string): Turn;
}

const claude: Adapter = {
  name: "claude",
  locate: (cwd) => findLatestTranscript(cwd),
  parse: (path) => parseTranscriptFile(path),
};

const codex: Adapter = {
  name: "codex",
  locate() {
    const home = process.env.CODEX_HOME ?? join(homedir(), ".codex");
    return newestMatch(
      join(home, "sessions"),
      (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"),
    );
  },
  parse: (path) => parseCodex(readFileSync(path, "utf8")),
};

const gemini: Adapter = {
  name: "gemini",
  locate(cwd) {
    const home = process.env.GEMINI_DIR ?? join(homedir(), ".gemini");
    const hash = createHash("sha256").update(cwd).digest("hex");
    const scoped = newestMatch(
      join(home, "tmp", hash, "chats"),
      (n) => n.endsWith(".jsonl") || n.endsWith(".json"),
    );
    if (scoped) return scoped;
    return newestMatch(join(home, "tmp"), (n) => n.startsWith("session") && /\.jsonl?$/.test(n));
  },
  parse: (path) => parseGemini(readFileSync(path, "utf8")),
};

const cursor: Adapter = {
  name: "cursor",
  locate() {
    // Prefer the newer per-project JSONL transcripts; fall back to the global
    // SQLite store (state.vscdb) that older Cursor builds use.
    const jsonl = newestMatch(join(homedir(), ".cursor", "projects"), (n) => n.endsWith(".jsonl"));
    return jsonl ?? cursorStateDb();
  },
  parse: (path) => parseCursorFile(path),
};

/** Locates Cursor's global SQLite store, per OS (or the CURSOR_STATE_DB override). */
function cursorStateDb(): string | null {
  const override = process.env.CURSOR_STATE_DB;
  if (override) return existsSync(override) ? override : null;
  const home = homedir();
  let base: string;
  if (process.platform === "darwin") {
    base = join(home, "Library", "Application Support");
  } else if (process.platform === "win32") {
    base = process.env.APPDATA ?? join(home, "AppData", "Roaming");
  } else {
    base = process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  }
  const db = join(base, "Cursor", "User", "globalStorage", "state.vscdb");
  return existsSync(db) ? db : null;
}

const opencode: Adapter = {
  name: "opencode",
  locate() {
    const base = process.env.XDG_DATA_HOME
      ? join(process.env.XDG_DATA_HOME, "opencode")
      : join(homedir(), ".local", "share", "opencode");
    return newestMatch(join(base, "storage", "message"), (n) => n.endsWith(".json"));
  },
  parse: (path) => parseOpenCode(path),
};

const aider: Adapter = {
  name: "aider",
  locate(cwd) {
    const file = join(cwd, ".aider.chat.history.md");
    return existsSync(file) ? file : null;
  },
  parse: (path) => parseAider(readFileSync(path, "utf8")),
};

export const ADAPTERS: Record<string, Adapter> = {
  claude,
  codex,
  gemini,
  cursor,
  opencode,
  aider,
};
export const AGENT_NAMES = Object.keys(ADAPTERS);

export function getAdapter(name: string): Adapter | null {
  return ADAPTERS[name] ?? null;
}

/** Picks the adapter whose latest transcript is the most recently modified. */
export function autoDetect(cwd: string): { adapter: Adapter; path: string } | null {
  let best: { adapter: Adapter; path: string; mtime: number } | null = null;
  for (const adapter of Object.values(ADAPTERS)) {
    const path = adapter.locate(cwd);
    if (!path) continue;
    try {
      const mtime = statSync(path).mtimeMs;
      if (!best || mtime > best.mtime) best = { adapter, path, mtime };
    } catch {
      // unreadable — ignore
    }
  }
  return best ? { adapter: best.adapter, path: best.path } : null;
}

/** Recursively finds the newest file (by mtime) whose name passes `test`. */
function newestMatch(dir: string, test: (name: string) => boolean, depth = 6): string | null {
  const found = walk(dir, test, depth);
  return found?.path ?? null;
}

function walk(
  dir: string,
  test: (name: string) => boolean,
  depth: number,
): { path: string; mtime: number } | null {
  if (depth < 0 || !existsSync(dir)) return null;
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  let best: { path: string; mtime: number } | null = null;
  for (const entry of entries) {
    const full = join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        const sub = walk(full, test, depth - 1);
        if (sub && (!best || sub.mtime > best.mtime)) best = sub;
      } else if (entry.isFile() && test(entry.name)) {
        const mtime = statSync(full).mtimeMs;
        if (!best || mtime > best.mtime) best = { path: full, mtime };
      }
    } catch {
      // skip unreadable entry
    }
  }
  return best;
}

export { parseCodex } from "./codex.js";
export { parseGemini } from "./gemini.js";
export { parseCursor } from "./cursor.js";
export { parseOpenCode } from "./opencode.js";
export { parseAider } from "./aider.js";
