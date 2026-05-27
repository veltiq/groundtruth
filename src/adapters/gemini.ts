import type { ToolUse, Turn } from "../types.js";
import { type TurnEvent, assembleTurn, isRecord, parseJsonlLines, str } from "./turn.js";

/**
 * Gemini CLI chat transcripts. Current versions write JSONL (one MessageRecord
 * per line); older versions write a single `{messages: [...]}` JSON object.
 * `type:"gemini"` messages carry assistant text + a `toolCalls[]` array.
 * See `~/.gemini/tmp/<project_hash>/chats/`.
 */
export function parseGemini(raw: string): Turn {
  const events: TurnEvent[] = [];
  for (const rec of records(raw)) {
    if (!isRecord(rec)) continue;
    if (rec.type === "user") {
      events.push({ role: "user", text: textOf(rec.content) });
    } else if (rec.type === "gemini") {
      events.push({ role: "assistant", text: textOf(rec.content) });
      const calls = Array.isArray(rec.toolCalls) ? rec.toolCalls : [];
      for (const call of calls) {
        const tool = fromToolCall(call);
        if (tool) events.push({ role: "assistant", tool });
      }
    }
  }
  return assembleTurn(events);
}

function records(raw: string): unknown[] {
  const trimmed = raw.trim();
  // Legacy single-object form: {messages: [...]}
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      if (isRecord(obj) && Array.isArray(obj.messages)) return obj.messages;
    } catch {
      // fall through to JSONL
    }
  }
  return parseJsonlLines(raw);
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(isRecord)
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .join("\n")
    .trim();
}

function fromToolCall(call: unknown): ToolUse | null {
  if (!isRecord(call)) return null;
  const name = str(call.name);
  const args = isRecord(call.args) ? call.args : {};
  if (name === "write_file") {
    return { name: "Write", input: { file_path: str(args.file_path), content: str(args.content) } };
  }
  if (name === "replace") {
    return {
      name: "Edit",
      input: {
        file_path: str(args.file_path),
        new_string: str(args.new_string),
        old_string: str(args.old_string),
      },
    };
  }
  if (name === "run_shell_command") {
    return { name: "Bash", input: { command: str(args.command) } };
  }
  return null;
}
