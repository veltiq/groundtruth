import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyConfig, loadConfig } from "./config.js";
import type { Claim } from "./types.js";

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
