import { c } from "./colors.js";
import type { Claim, Report, Verdict, VerdictLevel } from "./types.js";

export function buildReport(verdicts: Verdict[]): Report {
  const summary = { verified: 0, unsupported: 0, unverifiable: 0, total: verdicts.length };
  for (const v of verdicts) summary[v.level]++;
  return { verdicts, summary };
}

const LEVEL_ORDER: Record<VerdictLevel, number> = {
  unsupported: 0,
  unverifiable: 1,
  verified: 2,
};

const ICON: Record<VerdictLevel, string> = {
  verified: "✅",
  unsupported: "❌",
  unverifiable: "⚠️",
};

const LABEL: Record<VerdictLevel, string> = {
  verified: "verified",
  unsupported: "unsupported",
  unverifiable: "review",
};

function colorize(level: VerdictLevel, text: string): string {
  if (level === "verified") return c.green(text);
  if (level === "unsupported") return c.red(text);
  return c.yellow(text);
}

function claimLabel(claim: Claim): string {
  switch (claim.kind) {
    case "file":
      return `file ${c.cyan(claim.target)}`;
    case "symbol":
      return `symbol ${c.cyan(`\`${claim.target}\``)}`;
    case "test":
      return "tests";
    case "dependency":
      return `dependency ${c.cyan(claim.target)}`;
    case "command":
      return `command ${c.cyan(claim.target)}`;
    case "action":
      return `action ${c.dim(`"${claim.target}"`)}`;
  }
}

function sorted(verdicts: Verdict[]): Verdict[] {
  return [...verdicts].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/** Pretty, colorized output for the terminal / hook. */
export function renderTerminal(report: Report): string {
  const { summary } = report;
  const lines: string[] = [];
  lines.push(c.bold("groundtruth") + c.dim(" — claim check"));
  lines.push("");

  if (report.verdicts.length === 0) {
    lines.push(c.dim("  No checkable claims found in the summary."));
    lines.push("");
    return lines.join("\n");
  }

  for (const v of sorted(report.verdicts)) {
    const head = `  ${ICON[v.level]} ${colorize(v.level, LABEL[v.level].padEnd(11))} ${claimLabel(v.claim)}`;
    lines.push(head);
    lines.push(`     ${c.dim(v.reason)}`);
    if (v.claim.source && v.claim.kind !== "action") {
      lines.push(`     ${c.gray(`from: "${truncate(v.claim.source, 100)}"`)}`);
    }
  }

  lines.push("");
  lines.push(`  ${countsLine(summary)}`);
  lines.push("");
  return lines.join("\n");
}

function countsLine(summary: Report["summary"]): string {
  const parts = [
    `${summary.total} claim${summary.total === 1 ? "" : "s"}`,
    c.green(`${summary.verified} verified`),
  ];
  if (summary.unsupported > 0) parts.push(c.red(`${summary.unsupported} unsupported`));
  if (summary.unverifiable > 0) parts.push(c.yellow(`${summary.unverifiable} to review`));
  return parts.join(c.dim(" · "));
}

/** Machine-readable output. */
export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

/** Shareable markdown — ideal for posting as a PR comment. */
export function renderMarkdown(report: Report): string {
  const { summary } = report;
  const lines: string[] = [];
  lines.push("### 🔍 groundtruth — claim check");
  lines.push("");

  if (report.verdicts.length === 0) {
    lines.push("_No checkable claims found in the summary._");
    return lines.join("\n");
  }

  lines.push("| | Claim | Verdict |");
  lines.push("|---|---|---|");
  for (const v of sorted(report.verdicts)) {
    const claim = plainClaimLabel(v.claim);
    lines.push(`| ${ICON[v.level]} | ${escapeCell(claim)} | ${escapeCell(v.reason)} |`);
  }
  lines.push("");

  const parts = [`**${summary.total}** claims`, `**${summary.verified}** verified`];
  if (summary.unsupported > 0) parts.push(`**${summary.unsupported}** unsupported`);
  if (summary.unverifiable > 0) parts.push(`**${summary.unverifiable}** to review`);
  lines.push(parts.join(" · "));
  return lines.join("\n");
}

// --- SARIF 2.1.0 (GitHub code scanning) -------------------------------------

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: "warning" };
  helpUri: string;
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: "warning";
  message: { text: string };
  locations?: Array<{ physicalLocation: { artifactLocation: { uri: string } } }>;
}

const GROUNDTRUTH_URI = "https://github.com/veltiq/groundtruth#readme";

/**
 * SARIF 2.1.0 output for `github/codeql-action/upload-sarif`, so unsupported
 * claims surface in a repo's Security tab. Only `unsupported` verdicts (phantom
 * changes) become results — `verified`/`unverifiable` are not findings. Each
 * finding is anchored to the claimed file when the claim names one.
 */
export function renderSarif(report: Report, opts: { version?: string } = {}): string {
  const findings = report.verdicts.filter((v) => v.level === "unsupported");
  const kinds = [...new Set(findings.map((f) => f.claim.kind))];
  const ruleIndex = new Map(kinds.map((k, i) => [k, i]));

  const rules: SarifRule[] = kinds.map((kind) => ({
    id: `unsupported-${kind}`,
    name: `Unsupported${kind.charAt(0).toUpperCase()}${kind.slice(1)}Claim`,
    shortDescription: { text: `A ${kind} claim with no matching evidence in the diff` },
    fullDescription: {
      text: `groundtruth found a ${kind} claim in the assistant's summary that has no corresponding change in the diff — a phantom change.`,
    },
    defaultConfiguration: { level: "warning" },
    helpUri: GROUNDTRUTH_URI,
  }));

  const results: SarifResult[] = findings.map((v) => {
    const result: SarifResult = {
      ruleId: `unsupported-${v.claim.kind}`,
      ruleIndex: ruleIndex.get(v.claim.kind) ?? 0,
      level: "warning",
      message: { text: `${plainClaimLabel(v.claim)}: ${v.reason}` },
    };
    const uri = sarifUri(v.claim);
    if (uri) result.locations = [{ physicalLocation: { artifactLocation: { uri } } }];
    return result;
  });

  const driver: Record<string, unknown> = {
    name: "groundtruth",
    informationUri: GROUNDTRUTH_URI,
    rules,
  };
  if (opts.version) driver.version = opts.version;

  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [{ tool: { driver }, results }],
    },
    null,
    2,
  );
}

/** SARIF locations must point at an artifact; only `file` claims name one. */
function sarifUri(claim: Claim): string | null {
  return claim.kind === "file" ? claim.target.replace(/^\.\//, "") : null;
}

function plainClaimLabel(claim: Claim): string {
  switch (claim.kind) {
    case "symbol":
      return `symbol \`${claim.target}\``;
    case "file":
      return `file \`${claim.target}\``;
    case "dependency":
      return `dependency \`${claim.target}\``;
    case "command":
      return `command \`${claim.target}\``;
    case "test":
      return "tests";
    case "action":
      return `action: "${claim.target}"`;
  }
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
