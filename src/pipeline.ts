import { buildEvidence } from "./evidence.js";
import { extractClaims } from "./extract.js";
import { buildReport } from "./report.js";
import { parseTranscriptFile } from "./transcript.js";
import type { Report, Turn } from "./types.js";
import { verifyClaims } from "./verify.js";

export interface PipelineInput {
  /** Path to a JSONL transcript to read the latest turn from. */
  transcriptPath?: string;
  /** A pre-parsed turn (takes precedence over `transcriptPath`). */
  turn?: Turn;
  /** Working directory used to collect corroborating git evidence. */
  cwd?: string;
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

  const evidence = buildEvidence(turn.toolUses, input.cwd);
  const claims = extractClaims(turn.summary);
  const verdicts = verifyClaims(claims, evidence);
  return buildReport(verdicts);
}
