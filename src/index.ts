/**
 * groundtruth — public library API.
 *
 * Use this to embed claim verification in your own tooling. The CLI in
 * `cli.ts` is a thin wrapper around `runPipeline`.
 */
export type * from "./types.js";
export { parseTranscript, parseTranscriptFile } from "./transcript.js";
export { extractClaims } from "./extract.js";
export { loadConfig, applyConfig, failingCount } from "./config.js";
export { buildEvidence, emptyEvidence, mergeEvidence } from "./evidence.js";
export { collectGitEvidence } from "./git.js";
export { verifyClaims } from "./verify.js";
export { buildReport, renderTerminal, renderJson, renderMarkdown } from "./report.js";
export { runPipeline } from "./pipeline.js";
export type { PipelineInput } from "./pipeline.js";
export {
  type Adapter,
  ADAPTERS,
  AGENT_NAMES,
  autoDetect,
  getAdapter,
  parseAider,
  parseCodex,
  parseCursor,
  parseGemini,
  parseOpenCode,
} from "./adapters/index.js";
export { ledgerPath, recordRun, readLedger, summarize } from "./ledger.js";
export type { LedgerEntry, LedgerSummary } from "./ledger.js";
