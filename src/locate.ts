import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Locates the most recent Claude Code transcript for a working directory.
 *
 * Claude Code stores session transcripts under
 * `~/.claude/projects/<encoded-cwd>/<session>.jsonl`, where the directory name
 * is the absolute cwd with every non-alphanumeric character replaced by `-`.
 */
export function findLatestTranscript(cwd: string): string | null {
  const dir = projectDir(cwd);
  if (!existsSync(dir)) return null;

  let newest: { path: string; mtime: number } | null = null;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".jsonl")) continue;
    const path = join(dir, name);
    try {
      const mtime = statSync(path).mtimeMs;
      if (!newest || mtime > newest.mtime) newest = { path, mtime };
    } catch {
      // skip unreadable entries
    }
  }
  return newest?.path ?? null;
}

export function projectDir(cwd: string): string {
  const encoded = resolve(cwd).replace(/[^A-Za-z0-9]/g, "-");
  return join(homedir(), ".claude", "projects", encoded);
}
