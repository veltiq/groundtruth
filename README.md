<p align="center">
  <a href="README.md"><b>English</b></a> ·
  <a href="docs/i18n/README.zh-CN.md">简体中文</a> ·
  <a href="docs/i18n/README.es.md">Español</a> ·
  <a href="docs/i18n/README.pt-BR.md">Português</a> ·
  <a href="docs/i18n/README.fr.md">Français</a> ·
  <a href="docs/i18n/README.de.md">Deutsch</a> ·
  <a href="docs/i18n/README.ja.md">日本語</a> ·
  <a href="docs/i18n/README.ru.md">Русский</a> ·
  <a href="docs/i18n/README.ar.md">العربية</a>
</p>

<p align="center">
  <img src="assets/demo.svg" alt="groundtruth — the human-in-the-loop for AI coding" width="820">
</p>

<h1 align="center">groundtruth</h1>

<p align="center">
  <b>The human-in-the-loop for AI coding — automated.</b><br>
  Catch when your AI agent lies, leaves typos, or skips work — then make it prove the work before it says "done."
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@veltiq/groundtruth"><img src="https://img.shields.io/npm/v/@veltiq/groundtruth?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@veltiq/groundtruth"><img src="https://img.shields.io/npm/dm/@veltiq/groundtruth?color=cb3837&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/veltiq/groundtruth/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/veltiq/groundtruth/ci.yml?branch=main&label=CI" alt="CI"></a>
  <a href="https://github.com/veltiq/groundtruth/stargazers"><img src="https://img.shields.io/github/stars/veltiq/groundtruth?style=flat&color=f5c518" alt="GitHub stars"></a>
  <img src="https://img.shields.io/npm/l/@veltiq/groundtruth?color=blue" alt="MIT license">
  <img src="https://img.shields.io/badge/runtime%20deps-0-3fb950" alt="Zero runtime dependencies">
</p>

```bash
npx @veltiq/groundtruth setup
```

---

Your agent says _"Done! I added a `rateLimiter` to `src/server.ts`, fixed the timeout, and added tests."_ You commit and move on. Two weeks later production breaks — the rate limiter was never written. **The summary lied, and nothing checked it against the diff.**

`groundtruth` is the reviewer that does, on **every** turn — deterministically, with **zero LLM calls** for the check:

<table>
<tr>
<td width="50%" valign="top">

**When the summary lies** — every claim here is a phantom (the whole "codebase" was one README edit):

<img src="assets/screenshot-catch.png" alt="groundtruth flags three claims the diff doesn't support" width="100%">

</td>
<td width="50%" valign="top">

**When it's honest** — the same kind of summary, each claim backed by the real diff:

<img src="assets/screenshot-verified.png" alt="groundtruth verifies four honest claims against the diff" width="100%">

</td>
</tr>
</table>

## Why

Left unsupervised, AI agents confidently report work they never did — research on agentic PRs found these **"phantom changes" are the single most common inconsistency.** Tests catch code that's _wrong_; nothing catches code that was simply _never written_ but reported as done. That's the gap — and the faster agents code, the more slips through.

groundtruth closes it in two stages:

1. **Verify the claims.** It reads the agent's end-of-turn summary, extracts each concrete claim, and grades it against the **ground truth** — which files changed, which symbols appear in the diff, whether tests or installs actually ran. Built on one rule: _the diff doesn't lie._
2. **Make the agent prove it works** _(opt-in [verify loop](docs/verify-loop.md))._ Before finishing, the agent must run / **screenshot** / test the change against your original request, hunt for its own mistakes, and fix-and-recheck until it holds up.

→ higher-quality output you don't have to babysit.

## Install

Requires Node ≥ 20. One command wires the Stop hook + verify loop + status line, idempotently:

```bash
npx @veltiq/groundtruth setup
```

Restart Claude Code (or run `/hooks`) and it checks every turn automatically.

<details>
<summary>Try it in 30 seconds · manual install · plugin</summary>

```bash
# See it catch a phantom change against a canned transcript — no install, no config:
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# Check the current session without installing anything:
npx @veltiq/groundtruth verify

# Just the claim-check hook (no loop), this project or globally:
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

Prefer plugins?

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

> The loop can never trap you: a per-session round cap always lets a turn finish, and `GROUNDTRUTH_NO_LOOP=1` instantly pauses it.

## How it works

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary       diff      prose       per-claim
            + tools    ground truth  parse        check
```

| Verdict | Meaning |
|---|---|
| ✅ **verified** | Concrete evidence in the diff backs the claim. |
| ❌ **unsupported** | Concretely checkable and **zero** matching evidence — a phantom change. |
| ⚠️ **review** | Vague or semantic (_"fixed the bug"_) — shown for attention, **never** a failure. |

**A deliberate bias toward silence:** false alarms get a tool like this uninstalled, so a claim is only `unsupported` when it's unambiguously checkable and nothing supports it. Everything fuzzy becomes `review`. It would rather miss a claim than wrongly accuse a correct one. → [`docs/how-it-works.md`](docs/how-it-works.md) · [`docs/design.md`](docs/design.md)

## Verify loop — make the agent prove it (opt-in)

<p align="center">
  <img src="assets/loop-demo.svg" alt="The loop screenshots a page, catches an invisible button, fixes it, and re-verifies — no human needed" width="760">
</p>

The claim check grades a turn's _words_; the loop grades its _behavior_. With it on (`setup` enables it, or `GROUNDTRUTH_LOOP=1`), a turn that changed something is held at the Stop event and the agent must verify by the **kind of work** — open the page in a browser and read a screenshot (web), run the command (CLI), hit the endpoint (API), run the tests (library) — check it against your **original request**, fix any mistakes, and only finish once it passes. It never judges the work itself (no false positives of its own) and a round cap means it can't loop forever. → [`docs/verify-loop.md`](docs/verify-loop.md)

## More

<details>
<summary><b>CLI usage & flags</b></summary>

```bash
groundtruth verify                       # check the latest session for this project
groundtruth verify --transcript x.jsonl  # a specific transcript
groundtruth verify --markdown            # markdown (great as a PR comment)
groundtruth verify --json | --sarif      # machine-readable / GitHub code scanning
groundtruth verify --strict              # exit non-zero if anything is unsupported
groundtruth stats [--all]                # local tally: verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

By default the hook is **non-blocking** — it prints a report and gets out of the way. `--strict` (or `GROUNDTRUTH_STRICT=1`) makes it block on unsupported claims.

</details>

<details>
<summary><b>What it checks</b></summary>

| Claim | Example | Verified when… |
|---|---|---|
| **file** | _"updated `src/auth.ts`"_ | that file was touched this turn |
| **symbol** | _"added `validateInput`"_ | the identifier appears in the added/removed code |
| **test** | _"added tests"_ | a test file changed or a test command ran |
| **dependency** | _"installed `zod`"_ | a manifest changed or an install command ran |
| **command** | _"ran the build"_ | a matching command ran via Bash (advisory) |
| **action** | _"fixed the timeout bug"_ | not machine-checkable → flagged for review |

Full details in [`docs/claim-types.md`](docs/claim-types.md).

</details>

<details>
<summary><b>Use in CI · commit messages · pre-commit</b></summary>

Grade a **PR description against its diff** as a sticky comment (works on any PR, zero agent setup):

```yaml
# .github/workflows/groundtruth.yml
name: groundtruth
on: pull_request
permissions: { contents: read, pull-requests: write }
jobs:
  claim-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { fetch-depth: 0 }
      - uses: veltiq/groundtruth@v0.6.1   # add  with: { strict: true }  to gate merges
```

Verify a commit message against the staged diff — drop in `.git/hooks/commit-msg`, or via [pre-commit](https://pre-commit.com):

```yaml
repos:
  - repo: https://github.com/veltiq/groundtruth
    rev: v0.6.1
    hooks:
      - id: groundtruth
```

→ [docs/github-action.md](docs/github-action.md)

</details>

<details>
<summary><b>Other agents · config · library API</b></summary>

`verify` reads other agents' transcripts too — the claim engine is agent-neutral:

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

Optional `.groundtruthrc.json` (or a `"groundtruth"` key in package.json):

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

`ignore` is your escape hatch for any false positive. Use as a library:

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>Privacy & honest limitations</b></summary>

- **Runs entirely locally.** Reads your transcript and `git`, writes nothing except on `install`. Zero network calls, zero runtime deps. The local tally (`~/.groundtruth/ledger.jsonl`) stores counts only — never code or prompts.
- It verifies claimed work **exists in the diff**, not that it's **correct** — that's what tests (and the verify loop) are for.
- Extraction favors precision over recall: it misses vague claims rather than risk a false accusation.

</details>

## Contributing

Issues and PRs welcome — especially new claim patterns, agent adapters, and false-positive reports (those are gold). See [CONTRIBUTING.md](CONTRIBUTING.md).

If groundtruth ever catches your agent in a lie, a ⭐ helps others find it.

## License

[MIT](LICENSE) © [Veltiq](https://veltiq.net)
