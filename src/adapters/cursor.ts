import type { ToolUse, Turn } from "../types.js";
import { type TurnEvent, assembleTurn, isRecord, parseJsonlLines, str } from "./turn.js";

/**
 * Cursor agent transcripts (the newer `agent-transcripts/*.jsonl`, matching the
 * `cursor-agent` stream-json format): `assistant` / `tool_call` / `result`
 * lines. Tool inputs (path + content, command) are recorded; we don't need the
 * cached outputs. See `~/.cursor/projects/<project>/agent-transcripts/`.
 */
export function parseCursor(raw: string): Turn {
  const events: TurnEvent[] = [];
  const seen = new Set<string>();
  let resultText = "";

  for (const line of parseJsonlLines(raw)) {
    if (!isRecord(line)) continue;
    switch (line.type) {
      case "user":
        events.push({ role: "user", text: messageText(line.message) });
        break;
      case "assistant":
        events.push({ role: "assistant", text: messageText(line.message) });
        break;
      case "tool_call": {
        const id = str(line.call_id);
        if (id && seen.has(id)) break;
        if (id) seen.add(id);
        const tool = fromToolCall(line.tool_call);
        if (tool) events.push({ role: "assistant", tool });
        break;
      }
      case "result":
        resultText = str(line.result);
        break;
      default:
        break;
    }
  }

  // The terminal `result` carries the authoritative end-of-turn assistant text.
  if (resultText.trim()) events.push({ role: "assistant", text: resultText });
  return assembleTurn(events);
}

function messageText(message: unknown): string {
  if (!isRecord(message)) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(isRecord)
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .join("\n")
    .trim();
}

function fromToolCall(tc: unknown): ToolUse | null {
  if (!isRecord(tc)) return null;
  if (isRecord(tc.writeToolCall)) {
    const a = argsOf(tc.writeToolCall);
    return { name: "Write", input: { file_path: str(a.path), content: str(a.fileText) } };
  }
  if (isRecord(tc.editToolCall)) {
    const a = argsOf(tc.editToolCall);
    return {
      name: "Edit",
      input: {
        file_path: str(a.path),
        new_string: str(a.fileText ?? a.newString),
        old_string: str(a.oldString),
      },
    };
  }
  if (isRecord(tc.shellToolCall)) {
    const a = argsOf(tc.shellToolCall);
    return { name: "Bash", input: { command: str(a.command) } };
  }
  return null;
}

function argsOf(x: Record<string, unknown>): Record<string, unknown> {
  return isRecord(x.args) ? x.args : {};
}
