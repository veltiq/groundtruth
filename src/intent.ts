import type { Evidence, WorkContext, WorkKind } from "./types.js";

/**
 * Intent + work-shape inference for the verify loop.
 *
 * This module answers two questions a good human reviewer asks before checking
 * an agent's work: *what was actually requested?* and *what kind of thing did it
 * build, so how do I exercise it?* The answers only **tailor** the verification
 * protocol (which command to run, whether to screenshot). groundtruth still
 * never judges the work itself — detection staying advisory is what keeps the
 * loop free of the false positives the rest of the tool is careful to avoid.
 */

/** Tidy a raw human prompt into a short, single-line quote for the protocol. */
export function summarizeRequest(raw: string | undefined, max = 240): string | undefined {
  if (!raw) return undefined;
  // Drop slash-command noise and fenced code so the quoted ask reads cleanly.
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}

const WEB_EXT = /\.(tsx|jsx|vue|svelte|astro|html|htm|css|scss|sass|less)$/i;
const WEB_DIR = /(^|\/)(components?|pages?|views?|app|public|client|frontend|ui|styles?)\//i;
const WEB_IDIOM =
  /\b(classname=|document\.|window\.|usestate|useeffect|render\s*\(|<\/?[a-z][\w-]*[\s/>]|addeventlistener|queryselector)/i;

const API_FILE = /(^|\/)(server|app|main|index|api|routes?|controllers?|handlers?)[.\/]/i;
const API_IDIOM =
  /\b(express\s*\(|fastify\s*\(|new\s+hono\s*\(|createserver\s*\(|app\.(get|post|put|delete|patch|use|listen)\s*\(|router\.(get|post|put|delete|patch)\s*\(|fastapi\s*\(|@app\.(route|get|post)|flask\s*\(|http\.createserver)/i;

const CLI_IDIOM =
  /\b(process\.argv|#!\/usr\/bin\/env|commander|yargs|argparse|click\.command|cobra|new\s+command\s*\(|\.parse\s*\(\s*process\.argv)/i;

const TEST_PATH = /(\.(test|spec)\.[a-z0-9]+$|(^|\/)(tests?|__tests__|specs?)\/)/i;

/**
 * Classify a turn's work and, when possible, the concrete way to exercise it.
 *
 * `scripts` is the project's package.json `scripts` map (when known); it lets us
 * hand the agent the exact run command (`npm run dev`) instead of a guess.
 */
export function detectWorkKind(
  evidence: Evidence,
  opts: { scripts?: Record<string, string> } = {},
): WorkContext {
  const files = evidence.touchedFiles.map((f) => f.toLowerCase());
  const added = evidence.addedText;
  const scripts = opts.scripts ?? {};

  const codeFiles = files.filter((f) => !TEST_PATH.test(f));
  const onlyTests = files.length > 0 && codeFiles.length === 0;

  const looksWeb =
    codeFiles.some((f) => WEB_EXT.test(f) || WEB_DIR.test(f)) || WEB_IDIOM.test(added);
  const looksApi = codeFiles.some((f) => API_FILE.test(f)) && API_IDIOM.test(added);
  const looksCli = CLI_IDIOM.test(added) || codeFiles.some((f) => /(^|\/)(bin|cli)[.\/]/i.test(f));

  // Priority: the richest exercise wins. A screenshot beats a curl beats a run.
  let kind: WorkKind;
  if (looksWeb) kind = "web";
  else if (looksApi) kind = "api";
  else if (looksCli) kind = "cli";
  else if (onlyTests) kind = "library";
  else kind = "generic";

  const runHint = pickRunHint(kind, scripts);
  const urlHint = kind === "web" || kind === "api" ? pickUrlHint(added, scripts) : undefined;

  const ctx: WorkContext = { kind };
  if (runHint) ctx.runHint = runHint;
  if (urlHint) ctx.urlHint = urlHint;
  return ctx;
}

/** Prefer the script that actually exercises the work for this kind. */
function pickRunHint(kind: WorkKind, scripts: Record<string, string>): string | undefined {
  const has = (name: string) => typeof scripts[name] === "string" && scripts[name].length > 0;
  const order: Record<WorkKind, string[]> = {
    web: ["dev", "start", "serve", "preview"],
    api: ["dev", "start", "serve"],
    cli: ["build", "start"],
    library: ["test"],
    generic: ["dev", "start", "test"],
  };
  for (const name of order[kind]) {
    if (has(name)) return `npm run ${name}`;
  }
  return undefined;
}

/** Best-effort guess at the local URL to open, from the diff or the dev tool. */
function pickUrlHint(added: string, scripts: Record<string, string>): string | undefined {
  const port = detectPort(added);
  if (port) return `http://localhost:${port}`;
  const all = Object.values(scripts).join(" ").toLowerCase();
  if (/\bvite\b/.test(all)) return "http://localhost:5173";
  if (/\bnext\b/.test(all)) return "http://localhost:3000";
  if (/\b(astro)\b/.test(all)) return "http://localhost:4321";
  return undefined;
}

function detectPort(text: string): string | null {
  const m =
    /\blisten\s*\(\s*['"`]?(\d{2,5})/i.exec(text) ??
    /\bport\s*[=:]\s*['"`]?(\d{2,5})/i.exec(text) ??
    /localhost:(\d{2,5})\b/i.exec(text);
  return m?.[1] ?? null;
}
