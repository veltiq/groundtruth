import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hookCommand, installHook, installStatusline, settingsPathFor } from "./install.js";

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

  it("installs into multiple events when requested", () => {
    const result = installHook({ cwd: dir, events: ["Stop", "SubagentStop", "SessionEnd"] });
    expect(result.changed).toBe(true);
    const settings = JSON.parse(readFileSync(result.settingsPath, "utf8"));
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(settings.hooks.SubagentStop).toHaveLength(1);
    expect(settings.hooks.SessionEnd).toHaveLength(1);
  });

  it("preserves unrelated existing settings", () => {
    // seed an existing setting then install
    installHook({ cwd: dir });
    const path = join(dir, ".claude", "settings.json");
    const seeded = JSON.parse(readFileSync(path, "utf8"));
    expect(seeded.hooks.Stop).toBeDefined();
  });

  it("defaults to the npx form and supports the bin + strict forms", () => {
    expect(hookCommand({})).toBe("npx -y @twarc_net/groundtruth hook");
    expect(hookCommand({ bin: true })).toBe("groundtruth hook");
    expect(hookCommand({ bin: true, strict: true })).toBe("groundtruth hook --strict");
    expect(hookCommand({ strict: true })).toBe("npx -y @twarc_net/groundtruth hook --strict");
  });

  it("targets the global settings path when --global", () => {
    expect(settingsPathFor({ global: true })).toContain(join(".claude", "settings.json"));
  });
});

describe("installStatusline", () => {
  it("sets the status-bar line when none exists", () => {
    const result = installStatusline({ cwd: dir });
    expect(result.changed).toBe(true);
    const settings = JSON.parse(readFileSync(result.settingsPath, "utf8"));
    expect(settings.statusLine.command).toContain("groundtruth statusline");
  });

  it("never clobbers an existing non-groundtruth statusLine", () => {
    installHook({ cwd: dir }); // create settings file
    const path = join(dir, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(path, "utf8"));
    settings.statusLine = { type: "command", command: "my-custom-statusline" };
    writeFileSync(path, JSON.stringify(settings));

    const result = installStatusline({ cwd: dir });
    expect(result.changed).toBe(false);
    expect(result.existing).toBe("my-custom-statusline");
    const after = JSON.parse(readFileSync(path, "utf8"));
    expect(after.statusLine.command).toBe("my-custom-statusline");
  });
});
