import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyConfig, failingCount, loadConfig } from "./config.js";
import type { Claim, Report } from "./types.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "groundtruth-cfg-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const claim = (kind: Claim["kind"], target: string): Claim => ({
  kind,
  target,
  polarity: "add",
  source: "",
});

describe("loadConfig", () => {
  it("returns empty config when nothing is present", () => {
    expect(loadConfig(dir)).toEqual({});
  });

  it("reads .groundtruthrc.json", () => {
    writeFileSync(
      join(dir, ".groundtruthrc.json"),
      JSON.stringify({ strict: true, ignore: ["README.md"] }),
    );
    const config = loadConfig(dir);
    expect(config.strict).toBe(true);
    expect(config.ignore).toEqual(["README.md"]);
  });

  it("reads the groundtruth key from package.json", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", groundtruth: { output: "markdown" } }),
    );
    expect(loadConfig(dir).output).toBe("markdown");
  });

  it(".groundtruthrc.json overrides package.json", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ groundtruth: { strict: false } }));
    writeFileSync(join(dir, ".groundtruthrc.json"), JSON.stringify({ strict: true }));
    expect(loadConfig(dir).strict).toBe(true);
  });

  it("ignores malformed config without throwing", () => {
    writeFileSync(join(dir, ".groundtruthrc.json"), "{ not valid json");
    expect(() => loadConfig(dir)).not.toThrow();
    expect(loadConfig(dir)).toEqual({});
  });

  it("drops invalid field types and unknown claim kinds", () => {
    writeFileSync(
      join(dir, ".groundtruthrc.json"),
      JSON.stringify({ strict: "yes", ignoreKinds: ["action", "bogus"], output: "xml" }),
    );
    const config = loadConfig(dir);
    expect(config.strict).toBeUndefined();
    expect(config.ignoreKinds).toEqual(["action"]);
    expect(config.output).toBeUndefined();
  });

  it("reads the verify loop config and clamps maxRounds", () => {
    writeFileSync(
      join(dir, ".groundtruthrc.json"),
      JSON.stringify({ loop: { enabled: true, maxRounds: 999 } }),
    );
    expect(loadConfig(dir).loop).toEqual({ enabled: true, maxRounds: 20 });
  });

  it("ignores a malformed loop block but keeps valid keys", () => {
    writeFileSync(
      join(dir, ".groundtruthrc.json"),
      JSON.stringify({ loop: { enabled: "sure", maxRounds: "lots" } }),
    );
    expect(loadConfig(dir).loop).toBeUndefined();
  });

  it("omits loop entirely when not configured", () => {
    writeFileSync(join(dir, ".groundtruthrc.json"), JSON.stringify({ strict: true }));
    expect(loadConfig(dir).loop).toBeUndefined();
  });
});

describe("applyConfig", () => {
  const claims = [
    claim("file", "README.md"),
    claim("symbol", "rateLimiter"),
    claim("action", "fixed the bug"),
    claim("file", "src/auth.ts"),
  ];

  it("returns all claims when config is empty", () => {
    expect(applyConfig(claims, {})).toHaveLength(4);
  });

  it("ignores claims by kind", () => {
    const out = applyConfig(claims, { ignoreKinds: ["action"] });
    expect(out.some((c) => c.kind === "action")).toBe(false);
    expect(out).toHaveLength(3);
  });

  it("ignores claims by substring target", () => {
    const out = applyConfig(claims, { ignore: ["readme"] });
    expect(out.some((c) => c.target === "README.md")).toBe(false);
  });

  it("ignores claims by glob pattern", () => {
    const out = applyConfig(claims, { ignore: ["src/*"] });
    expect(out.some((c) => c.target === "src/auth.ts")).toBe(false);
    expect(out.some((c) => c.target === "README.md")).toBe(true);
  });
});

describe("failingCount", () => {
  const report = (u: number, r: number): Report => ({
    verdicts: [],
    summary: { verified: 1, unsupported: u, unverifiable: r, total: 1 + u + r },
  });

  it("defaults to counting only unsupported", () => {
    expect(failingCount(report(2, 3), {})).toBe(2);
  });

  it("counts unverifiable too when failOn includes it", () => {
    expect(failingCount(report(2, 3), { failOn: ["unsupported", "unverifiable"] })).toBe(5);
  });

  it("can be set to fail on nothing", () => {
    expect(failingCount(report(2, 3), { failOn: [] })).toBe(0);
  });

  it("reads failOn and shadow from config files", () => {
    writeFileSync(
      join(dir, ".groundtruthrc.json"),
      JSON.stringify({ failOn: ["unsupported", "unverifiable"], shadow: true }),
    );
    const cfg = loadConfig(dir);
    expect(cfg.failOn).toEqual(["unsupported", "unverifiable"]);
    expect(cfg.shadow).toBe(true);
  });
});
