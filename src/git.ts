import { execFileSync } from "node:child_process";
import { emptyEvidence } from "./evidence.js";
import type { Evidence } from "./types.js";

/**
 * Collects corroborating evidence from git: the working-tree diff against HEAD
 * plus `status --porcelain` for created/untracked files. This complements the
 * precise tool-call evidence and catches edits made outside the agent's tools.
 *
 * If `cwd` is not a git repository (or git is unavailable) this returns empty
 * evidence rather than throwing — the pipeline degrades gracefully.
 */
export function collectGitEvidence(cwd: string): Evidence {
  const ev = emptyEvidence();

  const diff = git(["diff", "HEAD", "--no-color", "--unified=0"], cwd);
  if (diff !== null) parseDiff(diff, ev);

  const status = git(["status", "--porcelain"], cwd);
  if (status !== null) parseStatus(status, ev);

  return ev;
}

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function parseDiff(diff: string, ev: Evidence): void {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      const path = stripDiffPath(line.slice(4));
      if (path) pushUnique(ev.touchedFiles, path);
    } else if (line.startsWith("+")) {
      ev.addedText += `\n${line.slice(1)}`;
    } else if (line.startsWith("-")) {
      ev.removedText += `\n${line.slice(1)}`;
    }
  }
}

function stripDiffPath(raw: string): string {
  const t = raw.trim();
  if (t === "/dev/null") return "";
  return t.replace(/^[ab]\//, "");
}

function parseStatus(status: string, ev: Evidence): void {
  for (const line of status.split("\n")) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    let path = line.slice(3).trim();

    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4); // rename: keep destination

    path = path.replace(/^"|"$/g, "");
    if (!path) continue;

    pushUnique(ev.touchedFiles, path);
    if (code.includes("A") || code.includes("?")) pushUnique(ev.createdFiles, path);
  }
}

function pushUnique(arr: string[], value: string): void {
  if (!arr.includes(value)) arr.push(value);
}
