import type { ToolUse, Turn } from "../types.js";

/** A linear, agent-neutral event used to assemble a turn. */
export interface TurnEvent {
  role: "user" | "assistant";
  text?: string;
  tool?: ToolUse;
}

/**
 * Scopes a linear event stream to the latest turn (everything after the last
 * human message) and folds it into a {summary, toolUses} Turn — the same shape
 * every adapter produces, so claim extraction/verification is agent-neutral.
 */
export function assembleTurn(events: TurnEvent[]): Turn {
  let start = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]?.role === "user") {
      start = i;
      break;
    }
  }
  let summary = "";
  const toolUses: ToolUse[] = [];
  for (const e of events.slice(start + 1)) {
    if (e.role === "assistant" && e.text && e.text.trim()) summary = e.text.trim();
    if (e.tool) toolUses.push(e.tool);
  }
  return { summary, toolUses };
}

/** Parses each non-empty line of JSONL, skipping malformed lines. */
export function parseJsonlLines(raw: string): unknown[] {
  const out: unknown[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // skip malformed line
    }
  }
  return out;
}

/**
 * Parses an `apply_patch` V4A envelope into Write/Edit tool uses.
 * Recognizes `*** Add File: <path>` and `*** Update File: <path>` sections and
 * collects added (`+`) and removed (`-`) lines.
 */
export function parseApplyPatch(patch: string): ToolUse[] {
  const tools: ToolUse[] = [];
  let file: string | null = null;
  let op: "add" | "update" | null = null;
  let added: string[] = [];
  let removed: string[] = [];

  const flush = () => {
    if (!file || !op) return;
    if (op === "add") {
      tools.push({ name: "Write", input: { file_path: file, content: added.join("\n") } });
    } else {
      tools.push({
        name: "Edit",
        input: { file_path: file, new_string: added.join("\n"), old_string: removed.join("\n") },
      });
    }
    added = [];
    removed = [];
  };

  for (const line of patch.split("\n")) {
    const add = /^\*\*\* Add File: (.+)$/.exec(line);
    const upd = /^\*\*\* Update File: (.+)$/.exec(line);
    if (add?.[1]) {
      flush();
      file = add[1].trim();
      op = "add";
    } else if (upd?.[1]) {
      flush();
      file = upd[1].trim();
      op = "update";
    } else if (/^\*\*\* (End Patch|Begin Patch|Delete File:)/.test(line)) {
      flush();
      if (line.startsWith("*** End Patch")) {
        file = null;
        op = null;
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      added.push(line.slice(1));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removed.push(line.slice(1));
    }
  }
  flush();
  return tools;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
