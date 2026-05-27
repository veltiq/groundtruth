import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ToolUse, Turn } from "../types.js";
import { type TurnEvent, assembleTurn, isRecord, str } from "./turn.js";

/**
 * OpenCode stores a session across many files under `storage/`:
 *   message/<sessionID>/<messageID>.json  — message info (role, time)
 *   part/<messageID>/<partID>.json        — text and tool parts
 * `parseOpenCode` takes the storage root, finds the most recently active
 * session, and reassembles it. See `~/.local/share/opencode/storage/`.
 */
export function parseOpenCode(input: string): Turn {
  const storageRoot = resolveStorageRoot(input);
  const messageRoot = join(storageRoot, "message");
  if (!existsSync(messageRoot)) return { summary: "", toolUses: [] };

  const session = latestSession(messageRoot);
  if (!session) return { summary: "", toolUses: [] };

  const messages = loadMessages(join(messageRoot, session)).sort((a, b) => a.created - b.created);
  const events: TurnEvent[] = [];
  for (const msg of messages) {
    const parts = loadParts(join(storageRoot, "part", msg.id));
    if (msg.role === "user") {
      const text = parts
        .filter((p) => p.type === "text")
        .map((p) => str(p.text))
        .join("\n")
        .trim();
      events.push({ role: "user", text });
      continue;
    }
    for (const part of parts) {
      if (part.type === "text" && str(part.text).trim()) {
        events.push({ role: "assistant", text: str(part.text) });
      } else if (part.type === "tool") {
        const tool = fromToolPart(part);
        if (tool) events.push({ role: "assistant", tool });
      }
    }
  }
  return assembleTurn(events);
}

/** Accepts the storage root, or a `message/<session>/<msg>.json` file (→ root). */
function resolveStorageRoot(p: string): string {
  try {
    if (statSync(p).isFile()) return dirname(dirname(dirname(p)));
  } catch {
    // not a file / missing — treat as a directory path
  }
  return p;
}

interface MessageInfo {
  id: string;
  role: string;
  created: number;
}

function latestSession(messageRoot: string): string | null {
  let best: { session: string; mtime: number } | null = null;
  for (const session of listDirs(messageRoot)) {
    for (const file of listJson(join(messageRoot, session))) {
      try {
        const mtime = statSync(join(messageRoot, session, file)).mtimeMs;
        if (!best || mtime > best.mtime) best = { session, mtime };
      } catch {
        // skip
      }
    }
  }
  return best?.session ?? null;
}

function loadMessages(dir: string): MessageInfo[] {
  const out: MessageInfo[] = [];
  for (const file of listJson(dir)) {
    const obj = readJson(join(dir, file));
    if (!isRecord(obj)) continue;
    const id = str(obj.id) || file.replace(/\.json$/, "");
    const role = str(obj.role);
    const created =
      isRecord(obj.time) && typeof obj.time.created === "number" ? obj.time.created : 0;
    out.push({ id, role, created });
  }
  return out;
}

interface Part {
  type: string;
  text?: string;
  tool?: string;
  state?: unknown;
}

function loadParts(dir: string): Part[] {
  if (!existsSync(dir)) return [];
  const out: Part[] = [];
  for (const file of listJson(dir)) {
    const obj = readJson(join(dir, file));
    if (isRecord(obj) && typeof obj.type === "string") {
      out.push({
        type: obj.type,
        text: typeof obj.text === "string" ? obj.text : undefined,
        tool: typeof obj.tool === "string" ? obj.tool : undefined,
        state: obj.state,
      });
    }
  }
  return out;
}

function fromToolPart(part: Part): ToolUse | null {
  const tool = str(part.tool);
  const state = isRecord(part.state) ? part.state : {};
  const input = isRecord(state.input) ? state.input : {};
  if (tool === "write") {
    return {
      name: "Write",
      input: { file_path: str(input.filePath), content: str(input.content) },
    };
  }
  if (tool === "edit") {
    return {
      name: "Edit",
      input: {
        file_path: str(input.filePath),
        new_string: str(input.newString),
        old_string: str(input.oldString),
      },
    };
  }
  if (tool === "bash") {
    return { name: "Bash", input: { command: str(input.command) } };
  }
  return null;
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function listJson(dir: string): string[] {
  try {
    return readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
