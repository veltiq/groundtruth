import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectGitEvidence } from "./git.js";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "groundtruth-git-"));
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "t@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  writeFileSync(join(dir, "a.ts"), "export const a = 1;\n");
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "base"], dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("collectGitEvidence", () => {
  it("captures uncommitted working-tree changes (no base)", () => {
    writeFileSync(join(dir, "a.ts"), "export const a = 2;\nexport function added() {}\n");
    const ev = collectGitEvidence(dir);
    expect(ev.touchedFiles).toContain("a.ts");
    expect(ev.addedText).toContain("added");
  });

  it("captures committed PR changes against a base ref (base...HEAD)", () => {
    const base = git(["rev-parse", "HEAD"], dir).trim();
    git(["checkout", "-q", "-b", "feature"], dir);
    writeFileSync(join(dir, "b.ts"), "export function brandNew() {}\n");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "feature"], dir);

    const ev = collectGitEvidence(dir, { base });
    expect(ev.touchedFiles).toContain("b.ts");
    expect(ev.createdFiles).toContain("b.ts");
    expect(ev.addedText).toContain("brandNew");
  });

  it("captures staged changes (commit-msg mode)", () => {
    writeFileSync(join(dir, "c.ts"), "export function stagedFn() {}\n");
    git(["add", "c.ts"], dir);
    const ev = collectGitEvidence(dir, { staged: true });
    expect(ev.touchedFiles).toContain("c.ts");
    expect(ev.addedText).toContain("stagedFn");
  });

  it("returns empty evidence outside a git repository", () => {
    const ev = collectGitEvidence(join(dir, "nope"));
    expect(ev.touchedFiles).toHaveLength(0);
    expect(ev.addedText).toBe("");
  });
});
