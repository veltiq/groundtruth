import { describe, expect, it } from "vitest";
import { emptyEvidence } from "./evidence.js";
import type { Claim, Evidence } from "./types.js";
import { verifyClaims } from "./verify.js";

function evidence(partial: Partial<Evidence>): Evidence {
  return { ...emptyEvidence(), ...partial };
}

const one = (claim: Claim, ev: Evidence) => {
  const [verdict] = verifyClaims([claim], ev);
  if (!verdict) throw new Error("expected a verdict");
  return verdict;
};

describe("verifyClaims", () => {
  it("verifies a symbol that appears in the added code", () => {
    const verdict = one(
      { kind: "symbol", target: "validateInput", polarity: "add", source: "" },
      evidence({ addedText: "export function validateInput(x) { return !!x; }" }),
    );
    expect(verdict.level).toBe("verified");
  });

  it("flags a symbol that appears nowhere as unsupported (phantom change)", () => {
    const verdict = one(
      { kind: "symbol", target: "rateLimiter", polarity: "add", source: "" },
      evidence({ addedText: "# Docs\nSome rate limiting prose", touchedFiles: ["README.md"] }),
    );
    expect(verdict.level).toBe("unsupported");
  });

  it("treats overly generic symbols as unverifiable, never unsupported", () => {
    const verdict = one(
      { kind: "symbol", target: "it", polarity: "add", source: "" },
      evidence({ addedText: "nothing relevant" }),
    );
    expect(verdict.level).toBe("unverifiable");
  });

  it("verifies a file that was touched (suffix match)", () => {
    const verdict = one(
      { kind: "file", target: "auth.ts", polarity: "modify", source: "" },
      evidence({ touchedFiles: ["src/server/auth.ts"] }),
    );
    expect(verdict.level).toBe("verified");
  });

  it("flags a claimed file change with no matching file", () => {
    const verdict = one(
      { kind: "file", target: "src/auth.ts", polarity: "modify", source: "" },
      evidence({ touchedFiles: ["README.md"] }),
    );
    expect(verdict.level).toBe("unsupported");
  });

  it("verifies tests when a test file changed", () => {
    const verdict = one(
      { kind: "test", target: "tests", polarity: "add", source: "" },
      evidence({ touchedFiles: ["src/auth.test.ts"] }),
    );
    expect(verdict.level).toBe("verified");
  });

  it("verifies tests when a test command ran", () => {
    const verdict = one(
      { kind: "test", target: "tests", polarity: "add", source: "" },
      evidence({ commands: ["npm run test"] }),
    );
    expect(verdict.level).toBe("verified");
  });

  it("flags claimed tests with no test file or command", () => {
    const verdict = one(
      { kind: "test", target: "tests", polarity: "add", source: "" },
      evidence({ touchedFiles: ["src/index.ts"] }),
    );
    expect(verdict.level).toBe("unsupported");
  });

  it("verifies a dependency when a manifest changed", () => {
    const verdict = one(
      { kind: "dependency", target: "zod", polarity: "add", source: "" },
      evidence({ touchedFiles: ["package.json"], addedText: '"zod": "^3.0.0"' }),
    );
    expect(verdict.level).toBe("verified");
  });

  it("stays advisory for commands that left no Bash trace", () => {
    const verdict = one(
      { kind: "command", target: "build", polarity: "modify", source: "" },
      evidence({}),
    );
    expect(verdict.level).toBe("unverifiable");
  });

  it("never marks an action claim as unsupported", () => {
    const verdict = one(
      { kind: "action", target: "fixed the timeout bug", polarity: "modify", source: "" },
      evidence({}),
    );
    expect(verdict.level).toBe("unverifiable");
  });

  it("verifies removal claims against removed code", () => {
    const verdict = one(
      { kind: "symbol", target: "LegacyClient", polarity: "remove", source: "" },
      evidence({ removedText: "class LegacyClient {}" }),
    );
    expect(verdict.level).toBe("verified");
  });
});
