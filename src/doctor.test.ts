import { describe, expect, it } from "vitest";
import { type DoctorInputs, buildDoctorReport, scanSettings } from "./doctor.js";

const base: DoctorInputs = {
  cwd: "/work/project",
  version: "0.7.0",
  nodeVersion: "v22.0.0",
  settings: [],
  hasGlobalBinary: true,
  inGitRepo: true,
  config: {},
  transcriptFound: true,
  noLoopEnv: false,
  ledgerRuns: 0,
};

describe("scanSettings", () => {
  const hookFile = (event: string, command: string) => ({
    path: "/x/.claude/settings.json",
    json: { hooks: { [event]: [{ hooks: [{ type: "command", command }] }] } },
  });

  it("finds a wired groundtruth hook and its events", () => {
    const scan = scanSettings([hookFile("Stop", "npx -y @veltiq/groundtruth hook --loop")]);
    expect(scan.found).toHaveLength(1);
    expect(scan.found[0]?.events).toEqual(["Stop"]);
    expect(scan.found[0]?.command).toContain("--loop");
  });

  it("ignores non-groundtruth hooks", () => {
    expect(scanSettings([hookFile("Stop", "some-other-tool run")]).found).toHaveLength(0);
  });

  it("tolerates missing/!object settings without throwing", () => {
    expect(
      scanSettings([
        { path: "/x", json: undefined },
        { path: "/y", json: null },
      ]).found,
    ).toEqual([]);
  });
});

describe("buildDoctorReport", () => {
  it("is all-green when everything is wired", () => {
    const r = buildDoctorReport({
      ...base,
      settings: [
        {
          path: "/work/project/.claude/settings.json",
          json: { hooks: { Stop: [{ hooks: [{ command: "groundtruth hook --loop" }] }] } },
        },
      ],
    });
    expect(r.fail).toBe(0);
    const hook = r.checks.find((c) => c.name === "Stop hook");
    expect(hook?.status).toBe("ok");
    expect(hook?.detail).toContain("verify loop on");
    // the Verify-loop check must agree with the wired hook (no off/on contradiction)
    const loop = r.checks.find((c) => c.name === "Verify loop");
    expect(loop?.status).toBe("ok");
    expect(loop?.detail).toMatch(/^on/);
  });

  it("reports the loop on from a wired --loop hook even without config", () => {
    const r = buildDoctorReport({
      ...base,
      settings: [
        {
          path: "/p/.claude/settings.json",
          json: {
            hooks: { Stop: [{ hooks: [{ command: "npx -y @veltiq/groundtruth hook --loop" }] }] },
          },
        },
      ],
    });
    expect(r.checks.find((c) => c.name === "Verify loop")?.detail).toContain("hook --loop");
  });

  it("FAILS with an actionable hint when the hook isn't wired", () => {
    const r = buildDoctorReport(base);
    const hook = r.checks.find((c) => c.name === "Stop hook");
    expect(hook?.status).toBe("fail");
    expect(hook?.hint).toContain("setup");
    expect(r.fail).toBeGreaterThan(0);
  });

  it("fails on old Node", () => {
    const r = buildDoctorReport({ ...base, nodeVersion: "v18.19.0" });
    expect(r.checks.find((c) => c.name === "Node.js")?.status).toBe("fail");
  });

  it("warns when running via npx instead of a global binary", () => {
    const r = buildDoctorReport({ ...base, hasGlobalBinary: false });
    expect(r.checks.find((c) => c.name === "Binary")?.status).toBe("warn");
  });

  it("warns when the loop is paused by the kill-switch", () => {
    const r = buildDoctorReport({ ...base, noLoopEnv: true });
    const loop = r.checks.find((c) => c.name === "Verify loop");
    expect(loop?.status).toBe("warn");
    expect(loop?.detail).toContain("GROUNDTRUTH_NO_LOOP");
  });

  it("counts ok/warn/fail consistently with the check list", () => {
    const r = buildDoctorReport(base);
    expect(r.ok + r.warn + r.fail).toBe(r.checks.length);
  });
});
