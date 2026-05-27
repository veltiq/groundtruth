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
