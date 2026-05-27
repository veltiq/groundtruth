import { describe, expect, it } from "vitest";
import { extractClaims } from "./extract.js";
import type { ClaimKind } from "./types.js";

const kinds = (summary: string, kind: ClaimKind) =>
  extractClaims(summary).filter((claim) => claim.kind === kind);

describe("extractClaims", () => {
  it("pulls a symbol claim from a backticked identifier", () => {
    const claims = kinds("I added a `validateInput` function.", "symbol");
    expect(claims).toHaveLength(1);
    expect(claims[0]?.target).toBe("validateInput");
    expect(claims[0]?.polarity).toBe("add");
  });

  it("strips call parentheses from symbols", () => {
    const claims = kinds("Added `parseUser()` to handle the payload.", "symbol");
    expect(claims[0]?.target).toBe("parseUser");
  });

  it("recognizes backticked file paths", () => {
    const claims = kinds("Updated `src/auth.ts` with the new guard.", "file");
    expect(claims[0]?.target).toBe("src/auth.ts");
  });

  it("recognizes bare file paths that contain a slash", () => {
    const claims = kinds("Updated src/db/client.ts to use pooling.", "file");
    expect(claims[0]?.target).toBe("src/db/client.ts");
  });

  it("does NOT treat framework names like Node.js as files", () => {
    expect(kinds("This runs on Node.js now.", "file")).toHaveLength(0);
  });

  it("does NOT treat a leading-slash route as a file", () => {
    expect(kinds("Added a `/api/users` endpoint.", "file")).toHaveLength(0);
  });

  it("treats an extensionless relative path as a file claim", () => {
    const claims = kinds("Updated `src/auth` with the new guard.", "file");
    expect(claims[0]?.target).toBe("src/auth");
  });

  it("detects test-authoring claims", () => {
    const claims = kinds("I also added tests for the new endpoint.", "test");
    expect(claims).toHaveLength(1);
  });

  it("detects dependency installs", () => {
    const claims = kinds("Installed the `zod` package for validation.", "dependency");
    expect(claims[0]?.target).toBe("zod");
  });

  it("detects 'ran the tests' as a command claim", () => {
    const claims = kinds("I ran the tests and they all pass.", "command");
    expect(claims[0]?.target).toBe("tests");
  });

  it("captures remove polarity", () => {
    const claims = kinds("Removed the `LegacyClient` class.", "symbol");
    expect(claims[0]?.polarity).toBe("remove");
  });

  it("skips intent ('let me…') rather than claiming it", () => {
    expect(extractClaims("Let me add a `foo` helper next.")).toHaveLength(0);
    expect(extractClaims("I'll update `bar.ts` after this.")).toHaveLength(0);
  });

  it("falls back to a non-failing action claim when nothing concrete is present", () => {
    const claims = extractClaims("I fixed the flaky timeout bug.");
    expect(claims).toHaveLength(1);
    expect(claims[0]?.kind).toBe("action");
  });

  it("does not duplicate identical claims", () => {
    const claims = extractClaims("Added `foo`. Also added `foo` again.");
    expect(claims.filter((c) => c.kind === "symbol")).toHaveLength(1);
  });

  it("handles rename: old name removed, new name added", () => {
    const claims = extractClaims("Renamed `oldFn` to `newFn`.");
    const from = claims.find((c) => c.target === "oldFn");
    const to = claims.find((c) => c.target === "newFn");
    expect(from?.polarity).toBe("remove");
    expect(to?.polarity).toBe("add");
  });

  it("extracts the tag name from a JSX/HTML component claim", () => {
    const claims = kinds("Added a `<Button>` component and a `</Modal>` close tag.", "symbol");
    const targets = claims.map((c) => c.target);
    expect(targets).toContain("Button");
    expect(targets).toContain("Modal");
  });

  it("ignores content inside fenced code blocks", () => {
    const summary = "Added validation.\n\n```ts\nthe `rateLimiter` lives here\n```\n";
    const claims = extractClaims(summary);
    expect(claims.some((c) => c.target === "rateLimiter")).toBe(false);
  });

  it("extracts multiple distinct claims from one sentence", () => {
    const claims = extractClaims(
      "I added a `validateInput` function to `src/auth.ts` and updated the tests.",
    );
    const seen = new Set(claims.map((c) => c.kind));
    expect(seen.has("symbol")).toBe(true);
    expect(seen.has("file")).toBe(true);
    expect(seen.has("test")).toBe(true);
  });
});
