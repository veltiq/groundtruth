import { describe, expect, it } from "vitest";
import { buildReport, renderSarif } from "./report.js";
import type { Verdict } from "./types.js";

const verdict = (over: Partial<Verdict> & Pick<Verdict, "level">): Verdict => ({
  claim: { kind: "symbol", target: "x", polarity: "add", source: "" },
  reason: "",
  ...over,
});

function sarif(verdicts: Verdict[], version = "9.9.9") {
  return JSON.parse(renderSarif(buildReport(verdicts), { version }));
}

describe("renderSarif", () => {
  it("emits a valid SARIF 2.1.0 envelope with the groundtruth driver", () => {
    const doc = sarif([]);
    expect(doc.version).toBe("2.1.0");
    expect(doc.$schema).toContain("sarif-2.1.0");
    const driver = doc.runs[0].tool.driver;
    expect(driver.name).toBe("groundtruth");
    expect(driver.version).toBe("9.9.9");
    expect(doc.runs[0].results).toEqual([]);
  });

  it("includes only unsupported verdicts as results (phantom changes)", () => {
    const doc = sarif([
      verdict({ level: "verified" }),
      verdict({
        level: "unverifiable",
        claim: { kind: "action", target: "fixed it", polarity: "modify", source: "" },
      }),
      verdict({
        level: "unsupported",
        reason: "claimed but never touched",
        claim: { kind: "file", target: "src/auth.ts", polarity: "modify", source: "" },
      }),
    ]);
    expect(doc.runs[0].results).toHaveLength(1);
    expect(doc.runs[0].results[0].ruleId).toBe("unsupported-file");
    expect(doc.runs[0].results[0].level).toBe("warning");
  });

  it("anchors file claims to a location and leaves non-file claims unanchored", () => {
    const doc = sarif([
      verdict({
        level: "unsupported",
        claim: { kind: "file", target: "./src/auth.ts", polarity: "modify", source: "" },
      }),
      verdict({
        level: "unsupported",
        claim: { kind: "symbol", target: "rateLimiter", polarity: "add", source: "" },
      }),
    ]);
    const [fileRes, symRes] = doc.runs[0].results;
    expect(fileRes.locations[0].physicalLocation.artifactLocation.uri).toBe("src/auth.ts");
    expect(symRes.locations).toBeUndefined();
  });

  it("declares one rule per distinct kind and keeps ruleIndex in sync", () => {
    const doc = sarif([
      verdict({
        level: "unsupported",
        claim: { kind: "file", target: "a.ts", polarity: "modify", source: "" },
      }),
      verdict({
        level: "unsupported",
        claim: { kind: "file", target: "b.ts", polarity: "modify", source: "" },
      }),
      verdict({
        level: "unsupported",
        claim: { kind: "test", target: "tests", polarity: "add", source: "" },
      }),
    ]);
    const driver = doc.runs[0].tool.driver;
    expect(driver.rules.map((r: { id: string }) => r.id)).toEqual([
      "unsupported-file",
      "unsupported-test",
    ]);
    for (const r of doc.runs[0].results) {
      expect(driver.rules[r.ruleIndex].id).toBe(r.ruleId);
    }
  });

  it("omits the driver version when none is supplied", () => {
    const doc = JSON.parse(renderSarif(buildReport([])));
    expect(doc.runs[0].tool.driver.version).toBeUndefined();
  });
});
