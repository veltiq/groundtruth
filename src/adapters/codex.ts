import type { ToolUse, Turn } from "../types.js";
import {
  type TurnEvent,
  assembleTurn,
  isRecord,
  parseApplyPatch,
  parseJsonlLines,
  str,
} from "./turn.js";

/**
 * OpenAI Codex CLI rollout transcripts: JSONL where each line is
 * `{timestamp, type, payload}`. The `response_item` payloads carry assistant
 * messages, `function_call`/`custom_tool_call` (incl. `apply_patch`), and
 * `local_shell_call`. See `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
 */
export function parseCodex(raw: string): Turn {
  const events: TurnEvent[] = [];
  for (const line of parseJsonlLines(raw)) {
    if (!isRecord(line) || line.type !== "response_item" || !isRecord(line.payload)) continue;
    const p = line.payload;
    switch (p.type) {
      case "message": {
        events.push({ role: p.role === "user" ? "user" : "assistant", text: textOf(p.content) });
        break;
      }
      case "function_call": {
        for (const tool of fromFunctionCall(str(p.name), str(p.arguments))) {
          events.push({ role: "assistant", tool });
        }
        break;
      }
      case "custom_tool_call": {
        if (str(p.name) === "apply_patch") {
          for (const tool of parseApplyPatch(str(p.input)))
            events.push({ role: "assistant", tool });
        }
        break;
      }
      case "local_shell_call": {
        const cmd = isRecord(p.action) ? commandToString(p.action.command) : "";
        if (cmd)
          events.push({ role: "assistant", tool: { name: "Bash", input: { command: cmd } } });
        break;
      }
      default:
        break;
    }
  }
  return assembleTurn(events);
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

function fromFunctionCall(name: string, argsJson: string): ToolUse[] {
  if (name === "apply_patch") {
    const parsed = safeJson(argsJson);
    const patch = isRecord(parsed) && typeof parsed.input === "string" ? parsed.input : argsJson;
    return parseApplyPatch(patch);
  }
  if (name === "shell" || name === "shell_command" || name === "bash") {
    const parsed = safeJson(argsJson);
    const cmd = isRecord(parsed) ? commandToString(parsed.command) : "";
    if (!cmd) return [];
    // A shell call may itself carry a heredoc apply_patch.
    if (cmd.includes("apply_patch") && cmd.includes("*** Begin Patch")) {
      const m = /\*\*\* Begin Patch[\s\S]*?\*\*\* End Patch/.exec(cmd);
      if (m) return parseApplyPatch(m[0]);
    }
    return [{ name: "Bash", input: { command: cmd } }];
  }
  return [];
}

function commandToString(command: unknown): string {
  if (typeof command === "string") return command;
  if (Array.isArray(command)) return command.filter((c) => typeof c === "string").join(" ");
  return "";
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
