import { readFileSync } from "node:fs";
import type { ToolUse, Turn } from "./types.js";

/**
 * Parses a Claude Code (or compatible) JSONL transcript and extracts the most
 * recent turn: the assistant's final summary text plus every tool it called
 * since the last genuine human message.
 *
 * The format is treated defensively — unknown/malformed lines are skipped — so
 * this keeps working as the transcript schema evolves.
 */

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface TranscriptEntry {
  type?: string;
  message?: {
    role?: string;
    content?: string | ContentBlock[];
  };
}

export function parseTranscriptFile(path: string): Turn {
  return parseTranscript(readFileSync(path, "utf8"));
}

export function parseTranscript(raw: string): Turn {
  const entries = parseJsonl(raw);
  const start = lastHumanIndex(entries);
  const turnEntries = entries.slice(start + 1);

  const toolUses: ToolUse[] = [];
  let summary = "";

  for (const entry of turnEntries) {
    if (entry.type !== "assistant" || !entry.message) continue;
    const content = entry.message.content;

    if (typeof content === "string") {
      if (content.trim()) summary = content.trim();
      continue;
    }
    if (!Array.isArray(content)) continue;

    const text = content
      .filter(
        (b): b is ContentBlock & { text: string } =>
          b.type === "text" && typeof b.text === "string",
      )
      .map((b) => b.text)
      .join("\n")
      .trim();
    // The end-of-turn summary is the latest assistant text block in the turn.
    if (text) summary = text;

    for (const block of content) {
      if (block.type === "tool_use" && typeof block.name === "string") {
        toolUses.push({
          name: block.name,
          input: isRecord(block.input) ? block.input : {},
        });
      }
    }
  }

  return { summary, toolUses };
}

function parseJsonl(raw: string): TranscriptEntry[] {
  const out: TranscriptEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as TranscriptEntry);
    } catch {
      // ignore malformed / partial lines
    }
  }
  return out;
}

/** Index of the last genuine human prompt (not a tool result, not pure assistant output). */
function lastHumanIndex(entries: TranscriptEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== "user" || !entry.message) continue;
    if (isHumanMessage(entry.message.content)) return i;
  }
  return -1;
}

function isHumanMessage(content: string | ContentBlock[] | undefined): boolean {
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  const hasText = content.some(
    (b) => b.type === "text" && typeof b.text === "string" && b.text.trim().length > 0,
  );
  // Tool results arrive as `user` messages too; those are not human turns.
  const hasToolResult = content.some((b) => b.type === "tool_result");
  return hasText && !hasToolResult;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
