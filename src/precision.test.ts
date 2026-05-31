import { describe, expect, it } from "vitest";
import { buildEvidence } from "./evidence.js";
import { extractClaims } from "./extract.js";
import type { ToolUse } from "./types.js";
import { verifyClaims } from "./verify.js";

/**
 * End-to-end precision guard: run an honest, correctly-done turn through the
 * whole extract → verify pipeline and assert it produces NO `unsupported`
 * verdict. `unsupported` is the only failing verdict, so a false one here is a
 * false accusation — the exact thing that gets a tool like this uninstalled.
 *
 * Each case below was a real false positive before the precision fixes.
 */
function unsupportedFrom(summary: string, tools: ToolUse[]): string[] {
  const verdicts = verifyClaims(extractClaims(summary), buildEvidence(tools));
  return verdicts
    .filter((v) => v.level === "unsupported")
    .map((v) => `${v.claim.kind}:${v.claim.target}`);
}

const tool = (name: string, input: Record<string, unknown>): ToolUse => ({ name, input });

describe("no false positives on honest work", () => {
  it("modifying a symbol's body whose name isn't in the diff hunk", () => {
    expect(
      unsupportedFrom("I updated the `validateInput` function to trim whitespace.", [
        tool("Edit", {
          file_path: "src/validate.ts",
          old_string: "return value;",
          new_string: "return value.trim();",
        }),
      ]),
    ).toEqual([]);
  });

  it("refactoring a symbol whose name isn't in the diff hunk", () => {
    expect(
      unsupportedFrom("I refactored `parseConfig` to be async.", [
        tool("Edit", {
          file_path: "src/config.ts",
          old_string: "const x = read();",
          new_string: "const x = await read();",
        }),
      ]),
    ).toEqual([]);
  });

  it("adding tests in an unconventionally-named file (describe/it)", () => {
    expect(
      unsupportedFrom("I added tests for the parser.", [
        tool("Write", {
          file_path: "src/checks.ts",
          content: "describe('parser', () => { it('works', () => expect(1).toBe(1)); });",
        }),
      ]),
    ).toEqual([]);
  });

  it("adding tests recognized by assertion idioms (expect())", () => {
    expect(
      unsupportedFrom("Added tests covering the edge cases.", [
        tool("Write", {
          file_path: "src/edge.ts",
          content: "test('edge', () => { expect(f()).toEqual(2); });",
        }),
      ]),
    ).toEqual([]);
  });

  it("installing a dependency does not also raise a phantom symbol for its name", () => {
    expect(
      unsupportedFrom("I installed the `zod` package.", [
        tool("Bash", { command: "npm install zod" }),
      ]),
    ).toEqual([]);
  });
});

describe("phantoms are still caught (no over-leniency)", () => {
  it("flags a symbol that was never written", () => {
    expect(
      unsupportedFrom("I added a `rateLimiter` middleware.", [
        tool("Write", { file_path: "README.md", content: "docs only" }),
      ]),
    ).toContain("symbol:rateLimiter");
  });

  it("flags a file that was never changed", () => {
    expect(
      unsupportedFrom("I changed `src/server.ts`.", [
        tool("Write", { file_path: "README.md", content: "docs" }),
      ]),
    ).toContain("file:src/server.ts");
  });

  it("flags 'added tests' when nothing test-like changed", () => {
    expect(
      unsupportedFrom("I added tests.", [
        tool("Write", { file_path: "README.md", content: "no assertions here" }),
      ]),
    ).toContain("test:tests");
  });

  it("still flags a phantom 'added' symbol when other code did change", () => {
    expect(
      unsupportedFrom("I added a `rateLimiter` and updated the router.", [
        tool("Write", {
          file_path: "src/router.ts",
          content: "export const router = makeRouter();",
        }),
      ]),
    ).toContain("symbol:rateLimiter");
  });
});
