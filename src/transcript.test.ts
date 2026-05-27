import { describe, expect, it } from "vitest";
import { parseTranscript } from "./transcript.js";

const jsonl = (entries: unknown[]) => entries.map((e) => JSON.stringify(e)).join("\n");

describe("parseTranscript", () => {
  it("extracts the final summary and the turn's tool calls", () => {
    const raw = jsonl([
      { type: "user", message: { role: "user", content: "add validation" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Working on it." },
            {
              type: "tool_use",
              name: "Edit",
              input: { file_path: "src/auth.ts", old_string: "a", new_string: "validateInput" },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }],
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Done! I added `validateInput` to `src/auth.ts`." }],
        },
      },
    ]);

    const turn = parseTranscript(raw);
    expect(turn.summary).toContain("validateInput");
    expect(turn.toolUses).toHaveLength(1);
    expect(turn.toolUses[0]?.name).toBe("Edit");
    expect(turn.toolUses[0]?.input.file_path).toBe("src/auth.ts");
  });

  it("scopes to the latest turn (ignores prior turns)", () => {
    const raw = jsonl([
      { type: "user", message: { role: "user", content: "first task" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", name: "Write", input: { file_path: "old.ts", content: "x" } },
          ],
        },
      },
      { type: "user", message: { role: "user", content: "second task" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              name: "Edit",
              input: { file_path: "new.ts", old_string: "a", new_string: "b" },
            },
            { type: "text", text: "Edited new.ts." },
          ],
        },
      },
    ]);

    const turn = parseTranscript(raw);
    expect(turn.toolUses).toHaveLength(1);
    expect(turn.toolUses[0]?.input.file_path).toBe("new.ts");
    expect(turn.summary).toBe("Edited new.ts.");
  });

  it("ignores malformed JSONL lines", () => {
    const raw = [
      "not json",
      JSON.stringify({ type: "user", message: { content: "hi" } }),
      "{bad",
    ].join("\n");
    expect(() => parseTranscript(raw)).not.toThrow();
  });

  it("returns empty turn for empty input", () => {
    const turn = parseTranscript("");
    expect(turn.summary).toBe("");
    expect(turn.toolUses).toHaveLength(0);
  });
});
