import { collectGitEvidence } from "./git.js";
import type { Evidence, ToolUse } from "./types.js";

/**
 * Builds the ground-truth evidence for a turn from two sources:
 *   1. The agent's own tool calls (precise, turn-scoped) — the primary signal.
 *   2. The git working tree (corroborating, catches non-tool edits) — optional.
 */
export function buildEvidence(toolUses: ToolUse[], cwd?: string, base?: string): Evidence {
  const ev = emptyEvidence();
  collectToolEvidence(toolUses, ev);
  if (cwd) mergeEvidence(ev, collectGitEvidence(cwd, base));
  return ev;
}

export function emptyEvidence(): Evidence {
  return { touchedFiles: [], createdFiles: [], addedText: "", removedText: "", commands: [] };
}

function collectToolEvidence(toolUses: ToolUse[], ev: Evidence): void {
  for (const { name, input } of toolUses) {
    switch (name) {
      case "Write": {
        const file = str(input.file_path);
        if (file) {
          addFile(ev, file, true);
        }
        ev.addedText += `\n${str(input.content)}`;
        break;
      }
      case "Edit": {
        const file = str(input.file_path);
        if (file) addFile(ev, file, false);
        ev.addedText += `\n${str(input.new_string)}`;
        ev.removedText += `\n${str(input.old_string)}`;
        break;
      }
      case "MultiEdit": {
        const file = str(input.file_path);
        if (file) addFile(ev, file, false);
        const edits = Array.isArray(input.edits) ? input.edits : [];
        for (const edit of edits) {
          if (!isRecord(edit)) continue;
          ev.addedText += `\n${str(edit.new_string)}`;
          ev.removedText += `\n${str(edit.old_string)}`;
        }
        break;
      }
      case "NotebookEdit": {
        const file = str(input.notebook_path);
        if (file) addFile(ev, file, false);
        ev.addedText += `\n${str(input.new_source)}`;
        break;
      }
      case "Bash": {
        const cmd = str(input.command);
        if (cmd) ev.commands.push(cmd);
        break;
      }
      default:
        break;
    }
  }
}

export function mergeEvidence(target: Evidence, extra: Evidence): void {
  for (const f of extra.touchedFiles) pushUnique(target.touchedFiles, f);
  for (const f of extra.createdFiles) pushUnique(target.createdFiles, f);
  target.addedText += `\n${extra.addedText}`;
  target.removedText += `\n${extra.removedText}`;
  for (const cmd of extra.commands) target.commands.push(cmd);
}

function addFile(ev: Evidence, file: string, created: boolean): void {
  const n = norm(file);
  pushUnique(ev.touchedFiles, n);
  if (created) pushUnique(ev.createdFiles, n);
}

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function pushUnique(arr: string[], value: string): void {
  if (!arr.includes(value)) arr.push(value);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
