import type { ToolUse, Turn } from "../types.js";
import { type TurnEvent, assembleTurn } from "./turn.js";

/**
 * Aider chat history (`.aider.chat.history.md`) — best-effort. User turns are
 * `#### ` lines; assistant turns are raw markdown; tool output is blockquoted.
 * Edits appear inline as SEARCH/REPLACE blocks (default editblock coder); we
 * recover the new content + the path from the line preceding the block.
 */
export function parseAider(raw: string): Turn {
  // Only the most recent session (after the last "# aider chat started").
  const sessions = raw.split(/^# aider chat started at .*$/m);
  const last = sessions[sessions.length - 1] ?? raw;

  const events: TurnEvent[] = [];
  let assistant: string[] = [];
  let user: string[] = [];

  const flushAssistant = () => {
    const text = assistant.join("\n").trim();
    if (text) {
      events.push({ role: "assistant", text });
      for (const tool of parseSearchReplace(text)) events.push({ role: "assistant", tool });
    }
    assistant = [];
  };
  const flushUser = () => {
    const text = user.join("\n").trim();
    if (text) events.push({ role: "user", text });
    user = [];
  };

  for (const line of last.split("\n")) {
    if (line.startsWith("#### ")) {
      flushAssistant();
      user.push(line.slice(5));
    } else if (line.startsWith("> ")) {
      // blockquoted tool output / commit notes — not a claim source
    } else {
      flushUser();
      assistant.push(line);
    }
  }
  flushUser();
  flushAssistant();

  return assembleTurn(events);
}

/** Recovers Edit tool uses from inline SEARCH/REPLACE blocks. */
function parseSearchReplace(text: string): ToolUse[] {
  const tools: ToolUse[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^<{5,9} SEARCH\s*$/.test(lines[i] ?? "")) continue;

    // Path = nearest preceding non-empty, non-fence line.
    let path = "";
    for (let j = i - 1; j >= 0; j--) {
      const l = (lines[j] ?? "").trim();
      if (!l || l.startsWith("```")) continue;
      path = l;
      break;
    }

    const added: string[] = [];
    let inReplace = false;
    let k = i + 1;
    for (; k < lines.length; k++) {
      const l = lines[k] ?? "";
      if (/^={5,9}\s*$/.test(l)) {
        inReplace = true;
        continue;
      }
      if (/^>{5,9} REPLACE\s*$/.test(l)) break;
      if (inReplace) added.push(l);
    }
    if (path)
      tools.push({ name: "Edit", input: { file_path: path, new_string: added.join("\n") } });
    i = k;
  }
  return tools;
}
