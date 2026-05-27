import { applyConfig, loadConfig } from "./config.js";
import { buildEvidence } from "./evidence.js";
import { extractClaims } from "./extract.js";
import { buildReport } from "./report.js";
import { parseTranscriptFile } from "./transcript.js";
import type { Config, Report, Turn } from "./types.js";
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
  /** Config (ignore rules etc.). If omitted, loaded from `cwd` when present. */
  config?: Config;
}

/**
 * The full groundtruth pipeline:
 *   transcript -> Turn -> (Evidence + Claim[]) -> Verdict[] -> Report
 */
export function runPipeline(input: PipelineInput): Report {
  const turn =
    input.turn ??
    (input.transcriptPath
      ? parseTranscriptFile(input.transcriptPath)
      : { summary: "", toolUses: [] });

  const config = input.config ?? (input.cwd ? loadConfig(input.cwd) : {});
  const evidence = buildEvidence(turn.toolUses, input.cwd, input.base);
  const claims = applyConfig(extractClaims(turn.summary), config);
  const verdicts = verifyClaims(claims, evidence);
  return buildReport(verdicts);
}
