import { createRequire } from "node:module";
import type { ToolUse, Turn } from "../types.js";
import { type TurnEvent, assembleTurn, isRecord, str } from "./turn.js";

/**
 * Older Cursor builds store agent sessions in SQLite at
 * `globalStorage/state.vscdb`, table `cursorDiskKV`:
 *
 *   composerData:<id>            -> { fullConversationHeadersOnly: [{ bubbleId, type }], ... }
 *   bubbleId:<composer>:<bubble> -> { type, text, toolFormerData? }
 *
 * `type` is 1 for user, 2 for assistant/tool. `toolFormerData.params` (and
 * `.result`) are JSON-*encoded strings*, so they need a second parse. Tool
 * names and param keys vary across Cursor versions, so the param lookup below
 * is deliberately tolerant (tries several candidate keys).
 */
export function parseCursorSqlite(path: string): Turn {
  const db = openDatabase(path);
  try {
    const composers = new Map<string, Record<string, unknown>>();
    const bubbles = new Map<string, Record<string, unknown>>();

    const rows = db
      .prepare(
        "SELECT key, value FROM cursorDiskKV WHERE key GLOB 'composerData:*' OR key GLOB 'bubbleId:*'",
      )
      .all();
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const key = str(row.key);
      const value = safeParse(str(row.value));
      if (!isRecord(value)) continue;
      if (key.startsWith("composerData:")) composers.set(key.slice("composerData:".length), value);
      else if (key.startsWith("bubbleId:")) bubbles.set(key.slice("bubbleId:".length), value);
    }

    const composerId = latestComposer(composers);
    const composer = composerId ? composers.get(composerId) : undefined;
    if (!composerId || !composer) return { summary: "", toolUses: [] };

    const headers = Array.isArray(composer.fullConversationHeadersOnly)
      ? composer.fullConversationHeadersOnly
      : [];
    const events: TurnEvent[] = [];
    for (const header of headers) {
      if (!isRecord(header)) continue;
      const bubbleId = str(header.bubbleId);
      const bubble = bubbleId ? bubbles.get(`${composerId}:${bubbleId}`) : undefined;
      if (bubble) pushBubble(events, bubble);
    }
    return assembleTurn(events);
  } finally {
    db.close();
  }
}

// --- node:sqlite (version-gated) --------------------------------------------

interface StatementSync {
  all(...params: unknown[]): unknown[];
}
interface DatabaseSyncInstance {
  prepare(sql: string): StatementSync;
  close(): void;
}
interface SqliteModule {
  DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => DatabaseSyncInstance;
}

/** Loads node:sqlite, or throws a friendly error on Node versions without it. */
function openDatabase(path: string): DatabaseSyncInstance {
  const require = createRequire(import.meta.url);
  let mod: SqliteModule;
  try {
    mod = require("node:sqlite") as SqliteModule;
  } catch {
    throw new Error(
      "Reading Cursor's state.vscdb needs node:sqlite — run on Node 24+ (or Node 22 " +
        "with --experimental-sqlite). Otherwise pass the newer agent-transcripts/*.jsonl " +
        "via --transcript.",
    );
  }
  return new mod.DatabaseSync(path, { readOnly: true });
}

// --- bubble -> turn events --------------------------------------------------

function pushBubble(events: TurnEvent[], bubble: Record<string, unknown>): void {
  const role = bubble.type === 1 ? "user" : "assistant";
  if (isRecord(bubble.toolFormerData)) {
    const tool = fromToolFormer(bubble.toolFormerData);
    if (tool) events.push({ role: "assistant", tool });
  }
  const text = str(bubble.text);
  if (text.trim()) events.push({ role, text });
}

function fromToolFormer(tfd: Record<string, unknown>): ToolUse | null {
  const name = str(tfd.name).toLowerCase();
  const params = safeParse(tfd.params);
  const p = isRecord(params) ? params : {};

  const file = pick(p, "target_file", "file_path", "path", "relativeWorkspacePath", "uri");
  const command = pick(p, "command", "cmd");

  if (command || /terminal|shell|run_|exec/.test(name)) {
    return command ? { name: "Bash", input: { command } } : null;
  }
  if (/write|create|new_file/.test(name)) {
    const content = pick(p, "contents", "file_text", "fileText", "code", "content", "code_edit");
    return { name: "Write", input: { file_path: file, content } };
  }
  if (/edit|search_replace|replace|apply|patch|diff/.test(name)) {
    return {
      name: "Edit",
      input: {
        file_path: file,
        new_string: pick(
          p,
          "code_edit",
          "new_string",
          "newString",
          "fileText",
          "contents",
          "replacement",
        ),
        old_string: pick(p, "old_string", "oldString", "search"),
      },
    };
  }
  // Unknown tool, but it names a file (e.g. delete) — record the touch only.
  if (file) return { name: "Edit", input: { file_path: file, new_string: "", old_string: "" } };
  return null;
}

// --- helpers ----------------------------------------------------------------

/** Picks the most recently active conversation. */
function latestComposer(composers: Map<string, Record<string, unknown>>): string | null {
  let best: { id: string; score: number } | null = null;
  for (const [id, c] of composers) {
    const headers = Array.isArray(c.fullConversationHeadersOnly)
      ? c.fullConversationHeadersOnly.length
      : 0;
    const score = num(c.lastUpdatedAt) ?? num(c.createdAt) ?? headers;
    if (!best || score > best.score) best = { id, score };
  }
  return best?.id ?? null;
}

/** Cursor stores some values as JSON-encoded strings; parse those, pass through objects. */
function safeParse(v: unknown): unknown {
  if (isRecord(v)) return v;
  if (typeof v !== "string") return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function pick(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
  }
  return "";
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
