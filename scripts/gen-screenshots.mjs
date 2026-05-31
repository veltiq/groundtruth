/**
 * Regenerate the README terminal screenshots from REAL `groundtruth` output.
 *
 * It runs the built CLI against fixed demo transcripts, captures the actual
 * ANSI-colored output, renders it into a terminal-styled HTML frame, and
 * screenshots that with Playwright at 2x for a crisp retina PNG.
 *
 * Usage:
 *   npm run build
 *   npm i -D playwright && npx playwright install chromium   # one-time
 *   node scripts/gen-screenshots.mjs
 *
 * The PNGs land in assets/. Re-run whenever the renderer output changes.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets");

// --- demo scenarios: each is a one-turn transcript -------------------------

const SCENARIOS = [
  {
    out: "screenshot-catch.png",
    transcript: [
      user("add rate limiting to the server and tests"),
      assistant(
        [write("README.md", "## Rate limiting\nWe should add a rate limiter.")],
        "Done! I added a `rateLimiter` middleware to `src/server.ts`, fixed the timeout bug, and added tests.",
      ),
    ],
  },
  {
    out: "screenshot-verified.png",
    transcript: [
      user("add a rate limiter and wire it into the server"),
      assistant(
        [
          write(
            "src/rate-limit.ts",
            "export function rateLimiter(max: number) {\n  return (req, res, next) => next();\n}",
          ),
          edit("src/server.ts", "app.use(json());", "app.use(json());\napp.use(rateLimiter(100));"),
          bash("npm test"),
        ],
        "Added a `rateLimiter` in `src/rate-limit.ts`, wired it into `src/server.ts`, and ran the tests.",
      ),
    ],
  },
];

// --- transcript builders ----------------------------------------------------

function user(text) {
  return { type: "user", message: { role: "user", content: text } };
}
function assistant(toolBlocks, summary) {
  return {
    type: "assistant",
    message: { role: "assistant", content: [...toolBlocks, { type: "text", text: summary }] },
  };
}
function write(file_path, content) {
  return { type: "tool_use", name: "Write", input: { file_path, content } };
}
function edit(file_path, old_string, new_string) {
  return { type: "tool_use", name: "Edit", input: { file_path, old_string, new_string } };
}
function bash(command) {
  return { type: "tool_use", name: "Bash", input: { command } };
}

// --- ANSI -> HTML (GitHub-dark palette, matches assets/demo.svg) ------------

const COLORS = {
  31: "#ff7b72", // red    (unsupported)
  32: "#3fb950", // green  (verified)
  33: "#d29922", // yellow (review)
  36: "#39c5cf", // cyan   (targets)
  90: "#6e7681", // gray   (from: …)
};

function ansiToHtml(input) {
  let html = "";
  let i = 0;
  const style = { bold: false, dim: false, color: null };
  const span = (text) => {
    if (!text) return "";
    const css = [];
    if (style.bold) css.push("font-weight:700");
    if (style.color) css.push(`color:${style.color}`);
    if (style.dim && !style.color) css.push("color:#8b949e");
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return css.length ? `<span style="${css.join(";")}">${esc}</span>` : esc;
  };
  while (i < input.length) {
    const esc = input.indexOf("[", i);
    if (esc === -1) {
      html += span(input.slice(i));
      break;
    }
    html += span(input.slice(i, esc));
    const end = input.indexOf("m", esc);
    const codes = input
      .slice(esc + 2, end)
      .split(";")
      .map(Number);
    for (const code of codes) {
      if (code === 0) Object.assign(style, { bold: false, dim: false, color: null });
      else if (code === 1) style.bold = true;
      else if (code === 2) style.dim = true;
      else if (code === 22) style.bold = style.dim = false;
      else if (code === 39) style.color = null;
      else if (COLORS[code]) style.color = COLORS[code];
    }
    i = end + 1;
  }
  return html;
}

function page(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin:0; box-sizing:border-box; }
    body { padding:44px; background:radial-gradient(1200px 500px at 30% -10%, #1b2230, #0a0c10); }
    .win { width:1000px; border-radius:14px; overflow:hidden; background:#0d1117;
           border:1px solid #30363d; box-shadow:0 24px 70px rgba(0,0,0,.55); }
    .bar { height:44px; display:flex; align-items:center; padding:0 16px; gap:8px;
           background:#161b22; border-bottom:1px solid #21262d; }
    .dot { width:12px; height:12px; border-radius:50%; }
    .title { flex:1; text-align:center; color:#6e7681; font:12px ui-monospace,Menlo,Consolas,monospace;
             margin-right:54px; }
    pre { margin:0; padding:22px 26px 26px; color:#e6edf3; white-space:pre-wrap;
          font:13.5px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .p { color:#6e7681; } .p b { color:#e6edf3; font-weight:400; }
  </style></head><body>
    <div class="win">
      <div class="bar">
        <span class="dot" style="background:#ff5f56"></span>
        <span class="dot" style="background:#ffbd2e"></span>
        <span class="dot" style="background:#27c93f"></span>
        <span class="title">${title}</span>
      </div>
      <pre>${bodyHtml}</pre>
    </div>
  </body></html>`;
}

// --- run --------------------------------------------------------------------

const { chromium } = await import("playwright");
const browser = await chromium.launch();
// Viewport width = window (1000) + body padding (44*2); fullPage captures height.
const ctx = await browser.newContext({
  deviceScaleFactor: 2,
  viewport: { width: 1088, height: 200 },
});
const tmp = mkdtempSync(join(tmpdir(), "gt-shot-"));

for (const s of SCENARIOS) {
  const tPath = join(tmp, "turn.jsonl");
  writeFileSync(tPath, s.transcript.map((e) => JSON.stringify(e)).join("\n"));
  const raw = execFileSync(
    process.execPath,
    [join(root, "dist", "cli.js"), "verify", "--transcript", tPath, "--no-git"],
    { env: { ...process.env, FORCE_COLOR: "1" }, encoding: "utf8" },
  );
  const prompt = '<span class="p">$ <b>npx @veltiq/groundtruth verify</b></span>\n\n';
  const html = page("claude code — your project", prompt + ansiToHtml(raw.trimEnd()));
  const file = join(tmp, `${s.out}.html`);
  writeFileSync(file, html);

  const pg = await ctx.newPage();
  await pg.goto(`file://${file}`);
  await pg.screenshot({ path: join(assets, s.out), fullPage: true });
  await pg.close();
  console.log(`wrote assets/${s.out}`);
}

await browser.close();
