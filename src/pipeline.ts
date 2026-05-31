import { applyConfig, loadConfig } from "./config.js";
import { buildEvidence } from "./evidence.js";
import { extractClaims } from "./extract.js";
import { buildReport } from "./report.js";
import { parseTranscriptFile } from "./transcript.js";
import type { Config, Evidence, Report, Turn } from "./types.js";
import { verifyClaims } from "./verify.js";

export interface PipelineInput {
  /** Path to a JSONL transcript to read the latest turn from. */
  transcriptPath?: string;
  /** A pre-parsed turn (takes precedence over `transcriptPath`). */
  turn?: Turn;
  /** Working directory used to collect corroborating git evidence. */
  cwd?: string;
  /** Base ref to diff against (PR mode: `base...HEAD`). Defaults to the working tree. */
  base?: string;
  /** Use the staged index as evidence (commit-msg checks). */
  staged?: boolean;
  /** Config (ignore rules etc.). If omitted, loaded from `cwd` when present. */
  config?: Config;
}

/** The full pipeline result, including the evidence the verdicts were graded against. */
export interface PipelineResult {
  report: Report;
  /** The turn that was analyzed (with its parsed request, when available). */
  turn: Turn;
  /** The ground-truth evidence collected for the turn. */
  evidence: Evidence;
}

/**
 * The full groundtruth pipeline, returning the report *plus* the turn and the
 * evidence behind it — the verify loop reuses the evidence to tailor its checks.
 *   transcript -> Turn -> (Evidence + Claim[]) -> Verdict[] -> Report
 */
export function analyze(input: PipelineInput): PipelineResult {
  const turn =
    input.turn ??
    (input.transcriptPath
      ? parseTranscriptFile(input.transcriptPath)
      : { summary: "", toolUses: [] });

  const config = input.config ?? (input.cwd ? loadConfig(input.cwd) : {});
  const evidence = buildEvidence(turn.toolUses, input.cwd, {
    base: input.base,
    staged: input.staged,
  });
  const claims = applyConfig(extractClaims(turn.summary), config);
  const verdicts = verifyClaims(claims, evidence);
  return { report: buildReport(verdicts), turn, evidence };
}

/** Convenience wrapper that returns only the report. */
export function runPipeline(input: PipelineInput): Report {
  return analyze(input).report;
}
