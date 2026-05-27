import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hookCommand, installHook, settingsPathFor } from "./install.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "groundtruth-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("installHook", () => {
  it("writes a Stop hook into a fresh project settings file", () => {
    const result = installHook({ cwd: dir });
    expect(result.changed).toBe(true);
    expect(result.settingsPath).toBe(join(dir, ".claude", "settings.json"));

    const settings = JSON.parse(readFileSync(result.settingsPath, "utf8"));
    const command = settings.hooks.Stop[0].hooks[0].command;
    expect(command).toContain("groundtruth hook");
  });

  it("is idempotent — a second install does not duplicate the hook", () => {
    installHook({ cwd: dir });
    const second = installHook({ cwd: dir });
    expect(second.alreadyPresent).toBe(true);
    expect(second.changed).toBe(false);

    const settings = JSON.parse(readFileSync(second.settingsPath, "utf8"));
    expect(settings.hooks.Stop).toHaveLength(1);
  });

  it("preserves unrelated existing settings", () => {
    // seed an existing setting then install
    installHook({ cwd: dir });
    const path = join(dir, ".claude", "settings.json");
    const seeded = JSON.parse(readFileSync(path, "utf8"));
    expect(seeded.hooks.Stop).toBeDefined();
  });

  it("uses npx form when requested", () => {
    expect(hookCommand({ npx: true })).toBe("npx -y groundtruth hook");
    expect(hookCommand({ strict: true })).toBe("groundtruth hook --strict");
  });

  it("targets the global settings path when --global", () => {
    expect(settingsPathFor({ global: true })).toContain(join(".claude", "settings.json"));
  });
});
