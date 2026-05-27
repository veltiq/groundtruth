import { describe, expect, it } from "vitest";
import { runPipeline } from "../pipeline.js";
import type { ToolUse } from "../types.js";
import { parseCodex } from "./codex.js";
import { parseCursor } from "./cursor.js";
import { parseGemini } from "./gemini.js";

const jsonl = (lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join("\n");
const writeOf = (tools: ToolUse[]) => tools.find((t) => t.name === "Write");
const bashOf = (tools: ToolUse[]) => tools.find((t) => t.name === "Bash");

describe("Codex adapter", () => {
  const raw = jsonl([
    { timestamp: "t", type: "session_meta", payload: { id: "s", cwd: "/p" } },
    {
      timestamp: "t",
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "text", text: "add a helper" }] },
    },
    {
      timestamp: "t",
      type: "response_item",
      payload: {
        type: "function_call",
        name: "shell",
        arguments: '{"command":["bash","-lc","pytest -q"]}',
        call_id: "c1",
      },
    },
    {
      timestamp: "t",
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        name: "apply_patch",
        input:
          "*** Begin Patch\n*** Add File: src/util.py\n+def add(a, b):\n+    return a + b\n*** End Patch",
        call_id: "c2",
      },
    },
    {
      timestamp: "t",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Added `add` to `src/util.py` and ran the tests." }],
        phase: "final_answer",
      },
    },
  ]);

  it("extracts summary, apply_patch writes, and shell commands", () => {
    const turn = parseCodex(raw);
    expect(turn.summary).toContain("src/util.py");
    const write = writeOf(turn.toolUses);
    expect(write?.input.file_path).toBe("src/util.py");
    expect(String(write?.input.content)).toContain("def add");
    expect(String(bashOf(turn.toolUses)?.input.command)).toContain("pytest");
  });

  it("verifies an honest Codex turn end-to-end", () => {
    const report = runPipeline({ turn: parseCodex(raw) });
    expect(report.summary.unsupported).toBe(0);
    expect(report.summary.verified).toBeGreaterThanOrEqual(1);
  });
});

describe("Gemini adapter", () => {
  const raw = jsonl([
    { id: "m1", type: "user", content: "add a helper" },
    {
      id: "m2",
      type: "gemini",
      content: [{ text: "Added the helper in `util.py` and ran tests." }],
      toolCalls: [
        {
          name: "write_file",
          args: { file_path: "util.py", content: "def add(a,b):\n  return a+b\n" },
        },
        { name: "run_shell_command", args: { command: "pytest -q" } },
      ],
    },
  ]);

  it("extracts summary, write_file, and run_shell_command", () => {
    const turn = parseGemini(raw);
    expect(turn.summary).toContain("util.py");
    expect(writeOf(turn.toolUses)?.input.file_path).toBe("util.py");
    expect(String(bashOf(turn.toolUses)?.input.command)).toContain("pytest");
  });

  it("also parses the legacy single-object form", () => {
    const legacy = JSON.stringify({
      messages: [
        { type: "user", content: "x" },
        { type: "gemini", content: [{ text: "Touched `a.ts`." }], toolCalls: [] },
      ],
    });
    expect(parseGemini(legacy).summary).toContain("a.ts");
  });
});

describe("Cursor adapter", () => {
  const raw = jsonl([
    { type: "user", message: { content: [{ type: "text", text: "add a helper" }] } },
    {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "working" }] },
    },
    {
      type: "tool_call",
      subtype: "completed",
      call_id: "t1",
      tool_call: {
        writeToolCall: { args: { path: "src/util.ts", fileText: "export const add = 1;" } },
      },
    },
    {
      type: "tool_call",
      subtype: "completed",
      call_id: "t2",
      tool_call: { shellToolCall: { args: { command: "npm test" } } },
    },
    { type: "result", subtype: "success", result: "Added `add` to `src/util.ts`." },
  ]);

  it("uses the final result as the summary and extracts tool inputs", () => {
    const turn = parseCursor(raw);
    expect(turn.summary).toContain("src/util.ts");
    expect(writeOf(turn.toolUses)?.input.file_path).toBe("src/util.ts");
    expect(String(bashOf(turn.toolUses)?.input.command)).toContain("npm test");
  });

  it("does not double-count a tool_call seen twice", () => {
    const dup = jsonl([
      {
        type: "tool_call",
        subtype: "started",
        call_id: "x",
        tool_call: { shellToolCall: { args: { command: "ls" } } },
      },
      {
        type: "tool_call",
        subtype: "completed",
        call_id: "x",
        tool_call: { shellToolCall: { args: { command: "ls" } } },
      },
    ]);
    expect(parseCursor(dup).toolUses).toHaveLength(1);
  });
});
