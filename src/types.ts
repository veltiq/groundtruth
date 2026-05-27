/**
 * Core domain types for groundtruth.
 *
 * The pipeline is intentionally small and pure:
 *   transcript -> Turn -> (Evidence + Claim[]) -> Verdict[] -> Report
 */

/** The kind of factual assertion extracted from an assistant's summary. */
export type ClaimKind =
  | "file" // "I updated src/auth.ts"
  | "symbol" // "I added a `validateInput` function"
  | "test" // "I added tests" / "I updated the test suite"
  | "dependency" // "I installed `zod`"
  | "command" // "I ran the tests" / "I ran the build"
  | "action"; // "I fixed the timeout bug" (semantic, not machine-checkable)

/** Whether the claim asserts that something was added, removed, or changed. */
export type Polarity = "add" | "remove" | "modify";

/** A single checkable assertion pulled out of the assistant's prose. */
export interface Claim {
  kind: ClaimKind;
  /** The concrete subject: a path, identifier, package, command keyword, or short label. */
  target: string;
  polarity: Polarity;
  /** The sentence/clause the claim was extracted from (shown to the user for context). */
  source: string;
}

/**
 * The three possible outcomes of checking a claim against the evidence.
 *
 * `unsupported` is deliberately conservative: it is only emitted for concretely
 * checkable claims that have *zero* corresponding evidence (a "phantom change").
 * Anything semantic or ambiguous becomes `unverifiable`, never `unsupported`.
 */
export type VerdictLevel = "verified" | "unsupported" | "unverifiable";

export interface Verdict {
  claim: Claim;
  level: VerdictLevel;
  /** Human-readable explanation of why this verdict was reached. */
  reason: string;
  /** Optional pointer to the matching evidence (e.g. the file or command). */
  evidence?: string;
}

/** A tool invocation captured from the transcript. */
export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

/** One conversational turn: the assistant's final summary plus the tools it ran. */
export interface Turn {
  /** The assistant's end-of-turn natural-language summary (where claims live). */
  summary: string;
  /** Tool calls the assistant made during this turn. */
  toolUses: ToolUse[];
}

/** The ground truth a turn's claims are checked against. */
export interface Evidence {
  /** Every file path touched via tools or git this turn (normalized to posix). */
  touchedFiles: string[];
  /** Files that were newly created this turn. */
  createdFiles: string[];
  /** All text that was ADDED (Write content, Edit new_string, git `+` lines). */
  addedText: string;
  /** All text that was REMOVED (Edit old_string, git `-` lines). */
  removedText: string;
  /** Shell commands run via the Bash tool. */
  commands: string[];
}

export interface ReportSummary {
  verified: number;
  unsupported: number;
  unverifiable: number;
  total: number;
}

export interface Report {
  verdicts: Verdict[];
  summary: ReportSummary;
}
