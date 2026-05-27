import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseAider } from "./aider.js";
import { parseOpenCode } from "./opencode.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "groundtruth-oc-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(path: string, obj: unknown) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(obj));
}

describe("OpenCode adapter", () => {
  it("reassembles a session from message + part files", () => {
    const root = join(dir, "storage");
    // session "s1": a user message then an assistant message with text + a write tool
    write(join(root, "message", "s1", "m1.json"), { id: "m1", role: "user", time: { created: 1 } });
    write(join(root, "message", "s1", "m2.json"), {
      id: "m2",
      role: "assistant",
      time: { created: 2 },
    });
    write(join(root, "part", "m1", "p0.json"), { type: "text", text: "add a helper" });
    write(join(root, "part", "m2", "p1.json"), {
      type: "text",
      text: "Added `add` to `util.py`.",
    });
    write(join(root, "part", "m2", "p2.json"), {
      type: "tool",
      tool: "write",
      state: { status: "completed", input: { filePath: "util.py", content: "def add(): ..." } },
    });

    const turn = parseOpenCode(root);
    expect(turn.summary).toContain("util.py");
    const w = turn.toolUses.find((t) => t.name === "Write");
    expect(w?.input.file_path).toBe("util.py");
    expect(String(w?.input.content)).toContain("def add");
  });

  it("returns an empty turn when there is no storage", () => {
    expect(parseOpenCode(join(dir, "nope")).toolUses).toHaveLength(0);
  });
});

describe("Aider adapter", () => {
  const history = [
    "# aider chat started at 2025-05-07 17:18:06",
    "",
    "#### add an add() helper to util.py",
    "",
    "I'll add the helper to `util.py`.",
    "",
    "util.py",
    "```python",
    "<<<<<<< SEARCH",
    "=======",
    "def add(a, b):",
    "    return a + b",
    ">>>>>>> REPLACE",
    "```",
    "",
    "> Applied edit to util.py",
    "",
  ].join("\n");

  it("extracts the assistant text and a SEARCH/REPLACE edit", () => {
    const turn = parseAider(history);
    expect(turn.summary).toContain("util.py");
    const edit = turn.toolUses.find((t) => t.name === "Edit");
    expect(edit?.input.file_path).toBe("util.py");
    expect(String(edit?.input.new_string)).toContain("def add");
  });
});
