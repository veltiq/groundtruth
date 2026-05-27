import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCursorSqlite } from "./cursor-sqlite.js";
import { parseCursorFile } from "./cursor.js";

// node:sqlite is version-gated (absent on Node 20, flagged on Node 22). Skip the
// whole suite where it can't be loaded so the CI matrix stays green.
const require = createRequire(import.meta.url);
interface Stmt {
  run(...params: unknown[]): unknown;
}
interface Db {
  exec(sql: string): void;
  prepare(sql: string): Stmt;
  close(): void;
}
let DatabaseSync: (new (path: string) => Db) | undefined;
try {
  DatabaseSync = (require("node:sqlite") as { DatabaseSync: new (path: string) => Db })
    .DatabaseSync;
} catch {
  DatabaseSync = undefined;
}
const hasSqlite = typeof DatabaseSync === "function";

let dir: string;
let dbPath: string;

/** Writes a state.vscdb fixture mirroring Cursor's cursorDiskKV layout. */
function seed(rows: Array<[string, unknown]>) {
  const Ctor = DatabaseSync;
  if (!Ctor) throw new Error("node:sqlite unavailable");
  const db = new Ctor(dbPath);
  db.exec("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)");
  const insert = db.prepare("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)");
  for (const [key, value] of rows) insert.run(key, JSON.stringify(value));
  db.close();
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "groundtruth-cur-"));
  dbPath = join(dir, "state.vscdb");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!hasSqlite)("Cursor SQLite adapter", () => {
  it("reassembles the latest conversation, double-parsing tool params", () => {
    seed([
      // An older conversation that must be ignored.
      [
        "composerData:c0",
        { lastUpdatedAt: 1000, fullConversationHeadersOnly: [{ bubbleId: "x1", type: 1 }] },
      ],
      ["bubbleId:c0:x1", { type: 1, text: "old conversation about something else" }],
      // The most recently updated conversation.
      [
        "composerData:c1",
        {
          lastUpdatedAt: 2000,
          fullConversationHeadersOnly: [
            { bubbleId: "b1", type: 1 },
            { bubbleId: "b2", type: 2 },
            { bubbleId: "b3", type: 2 },
            { bubbleId: "b4", type: 2 },
          ],
        },
      ],
      ["bubbleId:c1:b1", { type: 1, text: "add an add() helper to util.ts and run the tests" }],
      [
        "bubbleId:c1:b2",
        {
          type: 2,
          // params is a JSON-ENCODED STRING — the adapter must parse it twice.
          toolFormerData: {
            name: "write",
            params: JSON.stringify({
              target_file: "src/util.ts",
              contents: "export function add(a, b) { return a + b; }",
            }),
          },
        },
      ],
      [
        "bubbleId:c1:b3",
        {
          type: 2,
          toolFormerData: {
            name: "run_terminal_cmd",
            params: JSON.stringify({ command: "npm test" }),
          },
        },
      ],
      ["bubbleId:c1:b4", { type: 2, text: "Added `add` to `src/util.ts` and ran the tests." }],
    ]);

    const turn = parseCursorSqlite(dbPath);
    expect(turn.summary).toContain("src/util.ts");
    expect(turn.summary).not.toContain("old conversation");

    const write = turn.toolUses.find((t) => t.name === "Write");
    expect(write?.input.file_path).toBe("src/util.ts");
    expect(String(write?.input.content)).toContain("function add");

    const bash = turn.toolUses.find((t) => t.name === "Bash");
    expect(String(bash?.input.command)).toContain("npm test");
  });

  it("maps search_replace tool calls to an Edit", () => {
    seed([
      [
        "composerData:c1",
        { lastUpdatedAt: 5, fullConversationHeadersOnly: [{ bubbleId: "b1", type: 2 }] },
      ],
      [
        "bubbleId:c1:b1",
        {
          type: 2,
          toolFormerData: {
            name: "search_replace",
            params: JSON.stringify({
              file_path: "src/auth.ts",
              old_string: "const x = 1;",
              new_string: "const x = 2;",
            }),
          },
        },
      ],
    ]);

    const edit = parseCursorSqlite(dbPath).toolUses.find((t) => t.name === "Edit");
    expect(edit?.input.file_path).toBe("src/auth.ts");
    expect(String(edit?.input.new_string)).toContain("const x = 2;");
    expect(String(edit?.input.old_string)).toContain("const x = 1;");
  });

  it("is reached via parseCursorFile by SQLite detection", () => {
    seed([
      [
        "composerData:c1",
        { lastUpdatedAt: 1, fullConversationHeadersOnly: [{ bubbleId: "b1", type: 2 }] },
      ],
      ["bubbleId:c1:b1", { type: 2, text: "Touched `src/a.ts`." }],
    ]);
    expect(parseCursorFile(dbPath).summary).toContain("src/a.ts");
  });

  it("returns an empty turn when there is no conversation data", () => {
    seed([["someOtherKey", { ignored: true }]]);
    expect(parseCursorSqlite(dbPath)).toEqual({ summary: "", toolUses: [] });
  });
});
