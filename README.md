<p align="center">
  <img src="assets/demo.svg" alt="groundtruth — catch when your AI coding assistant claims work it didn't do" width="820">
</p>

<p align="center">
  <a href="https://github.com/youcefzemmar/groundtruth/actions/workflows/ci.yml"><img src="https://github.com/youcefzemmar/groundtruth/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@twarc_net/groundtruth"><img src="https://img.shields.io/npm/v/@twarc_net/groundtruth?color=cb3837&logo=npm" alt="npm"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT">
  <img src="https://img.shields.io/badge/node-%E2%89%A520-3fb950.svg" alt="Node >= 20">
  <img src="https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg" alt="Zero runtime dependencies">
  <a href="https://github.com/youcefzemmar/groundtruth/blob/main/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome"></a>
</p>

<p align="center">
  <b>English</b> ·
  <a href="docs/i18n/README.zh-CN.md">简体中文</a> ·
  <a href="docs/i18n/README.es.md">Español</a> ·
  <a href="docs/i18n/README.pt-BR.md">Português</a> ·
  <a href="docs/i18n/README.fr.md">Français</a> ·
  <a href="docs/i18n/README.de.md">Deutsch</a> ·
  <a href="docs/i18n/README.ja.md">日本語</a> ·
  <a href="docs/i18n/README.ru.md">Русский</a> ·
  <a href="docs/i18n/README.ar.md">العربية</a>
</p>

# groundtruth

> **TL;DR** — Your AI says _"Done! I added X, fixed Y, wrote tests."_ groundtruth checks each claim against the real diff and flags the ones that never happened. One command: `npx @twarc_net/groundtruth install`.

**Catch when your AI coding assistant claims work it didn't do.**

Your agent ends a turn with _"Done! I added a `rateLimiter` middleware to `src/server.ts`, fixed the timeout bug, and added tests."_ You trust the summary, commit, and move on. Two weeks later production breaks — the rate limiter was never written. The summary lied (or hallucinated), and nothing checked it against the actual diff.

`groundtruth` reads the assistant's end-of-turn summary, extracts each concrete claim, and verifies it against what actually changed — the **ground truth**. It runs automatically as a [Claude Code](https://code.claude.com) hook, or on demand from the CLI.

```text
groundtruth — claim check

  ❌ unsupported  symbol `rateLimiter`
     Claimed `rateLimiter`, but it does not appear anywhere in this turn's changes.
     from: "I added a `rateLimiter` middleware to `src/server.ts`, ... and added tests."
  ❌ unsupported  file src/server.ts
     Claimed a change to `src/server.ts`, but it is not among the files changed (README.md).
  ❌ unsupported  tests
     Claimed test work, but no test file changed and no test command ran this turn.

  3 claims · 0 verified · 3 unsupported
```

> The whole codebase here was a single README edit. groundtruth caught all three false claims.

---

## Why this exists

Research on agentic pull requests found that **"phantom changes" — work the description claims but never implements — are the single most common kind of inconsistency.** Tests and CI catch code that's _wrong_; nothing catches code that was simply _never written_ but confidently reported as done. That's the gap groundtruth fills.

It is built on one principle: **the diff doesn't lie.** Natural-language summaries are graded against deterministic facts (which files changed, which symbols appear in the added lines, whether a test file or install command actually ran), never against another model's opinion.

## Try it in 30 seconds

No install, no config — see it catch a phantom change against a canned transcript:

```bash
npx @twarc_net/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

## Install

Requires Node ≥ 20. No global install needed — the hook runs through `npx`.

```bash
# Wire it into Claude Code as a Stop hook for this project (./.claude/settings.json)
npx @twarc_net/groundtruth install

# …or for every project (~/.claude/settings.json)
npx @twarc_net/groundtruth install --global
```

Restart Claude Code (or run `/hooks`) and groundtruth checks every turn automatically. Want a faster, always-on binary? Run `npm i -g @twarc_net/groundtruth` first (it installs the `groundtruth` command) and `install` auto-detects it. To check the current session without installing anything:

```bash
npx @twarc_net/groundtruth verify
```

Prefer plugins? Add the marketplace and install in one step:

```text
/plugin marketplace add youcefzemmar/groundtruth
/plugin install groundtruth
```

## How it works

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary      diff       prose      per-claim
            + tools    ground truth  parse      check
```

1. **Read the turn.** Parse the Claude Code JSONL transcript for the latest turn: the assistant's final summary plus every tool it called (`Write`, `Edit`, `MultiEdit`, `Bash`, …).
2. **Collect ground truth.** Build evidence from those tool calls (precise, turn-scoped) plus the git working-tree diff (corroborating). This is the set of files touched, text added/removed, and commands run.
3. **Extract claims.** Pull concrete assertions out of the prose, anchored on strong signals — backticked identifiers, real file paths, test/dependency keywords. Statements of _intent_ ("I'll add…") are ignored.
4. **Verify.** Check each claim against the evidence and assign a verdict.

| Verdict | Meaning |
|---|---|
| ✅ **verified** | Concrete evidence backs the claim. |
| ❌ **unsupported** | The claim is concretely checkable and has **zero** matching evidence — a phantom change. |
| ⚠️ **review** | Semantic or ambiguous (e.g. _"fixed the bug"_) — shown for your attention, **never** counted as a failure. |

### A deliberate bias toward silence

False alarms are what get a tool like this uninstalled, so the rules are conservative by design: a claim is only marked **unsupported** when it is unambiguously checkable and nothing supports it. Anything vague becomes **review**, not a failure. groundtruth would rather miss a questionable claim than wrongly accuse a correct one. See [`docs/design.md`](docs/design.md).

## Usage

```bash
groundtruth verify                       # check the latest session for this project
groundtruth verify --transcript x.jsonl  # check a specific transcript
groundtruth verify --markdown            # emit markdown (great as a PR comment)
groundtruth verify --json                # machine-readable output
groundtruth verify --strict              # exit non-zero if anything is unsupported

groundtruth install [--global] [--npx] [--strict] [--print]
```

By default the hook is **non-blocking**: it prints its report and gets out of the way. Pass `--strict` (or set `GROUNDTRUTH_STRICT=1`) to make it block the turn when unsupported claims are found.

## What it checks

| Claim type | Example | Verified when… |
|---|---|---|
| **file** | _"updated `src/auth.ts`"_ | that file was touched this turn |
| **symbol** | _"added a `validateInput` function"_ | the identifier appears in the added (or removed) code |
| **test** | _"added tests"_ | a test file changed or a test command ran |
| **dependency** | _"installed `zod`"_ | a manifest changed or an install command ran |
| **command** | _"ran the build"_ | a matching command ran via the Bash tool (advisory) |
| **action** | _"fixed the timeout bug"_ | — not machine-checkable; flagged for review |

Full details in [`docs/claim-types.md`](docs/claim-types.md).

## Use in CI (GitHub Action)

Post claim verdicts as a sticky comment on every PR — grading the **PR description against the diff**, so it works on any PR with zero agent setup. (groundtruth runs this on its own PRs.)

```yaml
# .github/workflows/groundtruth.yml
name: groundtruth
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  claim-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { fetch-depth: 0 }
      - uses: youcefzemmar/groundtruth@v0.3.0
```

Add `with: { strict: true }` to turn it into a merge gate. Full options in [docs/github-action.md](docs/github-action.md).

### Locally, against your commit message

`--staged` checks a message against what's actually staged — drop this in `.git/hooks/commit-msg` (or a [lefthook](https://github.com/evilmartians/lefthook)/husky `commit-msg` hook):

```sh
#!/bin/sh
# .git/hooks/commit-msg — verify the commit message against the staged diff
npx @twarc_net/groundtruth verify --summary "$1" --staged
# add --strict to abort the commit when a claim is unsupported
```

## Configuration

Optional — drop a `.groundtruthrc.json` in your project (or a `"groundtruth"` key in package.json):

```json
{
  "strict": false,
  "failOn": ["unsupported"],
  "shadow": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "output": "terminal"
}
```

- **`ignore`** — claim targets to skip (substring or `*` glob). Your escape hatch for any false positive.
- **`ignoreKinds`** — whole claim kinds to skip (`file`, `symbol`, `test`, `dependency`, `command`, `action`).
- **`strict`** / **`output`** — defaults for blocking and output format.
- **`failOn`** — which verdict levels count as a failure in strict mode (default `["unsupported"]`).
- **`shadow`** — record to the ledger but never print or block (for gradual rollout).

Install into more hook events for multi-agent workflows:

```bash
npx @twarc_net/groundtruth install --events Stop,SubagentStop,SessionEnd
```

`SubagentStop` checks each subagent's turn; `SessionEnd` prints a per-session digest.

## Other agents

The Stop hook is Claude Code-specific, but `verify` reads other agents' transcripts too — the claim engine is agent-neutral:

```bash
groundtruth verify --agent codex     # OpenAI Codex CLI
groundtruth verify --agent gemini    # Gemini CLI
groundtruth verify --agent cursor    # Cursor (agent-transcripts)
groundtruth verify --agent opencode  # OpenCode
groundtruth verify --agent aider     # Aider (best-effort)
groundtruth verify --agent auto      # pick the most recent across all
```

Each adapter normalizes the agent's transcript into the same `{summary, toolUses}` shape. New adapters are a great contribution — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Stats & status bar

The hook keeps a privacy-safe local tally (counts only — never code or prompts, in `~/.groundtruth/ledger.jsonl`):

```bash
groundtruth stats          # this project: turns, verified, unsupported, to-review (7d/30d/all)
groundtruth stats --all    # across every project
```

Show a live count in the Claude Code status bar (`🔎 gt 3❌ ·7d`):

```bash
npx @twarc_net/groundtruth install --statusline
```

## Honest limitations

- It verifies that claimed work **exists in the diff**, not that it is **correct**. _"Fixed the bug"_ can be confirmed to touch the right code; it cannot be confirmed to actually fix anything. That's what tests are for.
- Extraction favors precision over recall — it will miss vaguely-worded claims rather than risk a false accusation.
- Today it targets the Claude Code transcript format. The core (`extractClaims`, `verifyClaims`) is format-agnostic; adapters for other agents are welcome — see [Contributing](CONTRIBUTING.md).

## Use as a library

```ts
import { runPipeline, renderMarkdown } from "@twarc_net/groundtruth";

const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

## FAQ

**Does it send my code anywhere?**
No. It runs entirely locally — reads your transcript and `git`, writes nothing except when you run `install`. Zero network calls, zero runtime dependencies.

**Will it block my commits or get in the way?**
No. By default it just prints a report and exits cleanly. Blocking is strictly opt-in (`--strict`).

**Isn't this what tests are for?**
Tests catch code that's _wrong_. groundtruth catches code that was _never written_ but reported as done — there's nothing for a test to run. They're complementary.

**Does it work with Cursor / other agents?**
The engine is format-agnostic; today it ships a Claude Code transcript adapter. Adapters for other agents are a great first contribution — see [CONTRIBUTING.md](CONTRIBUTING.md).

**Will it falsely accuse me?**
It's tuned hard against that. A claim is only `unsupported` when it's concretely checkable and nothing supports it; everything fuzzy is shown as advisory, never a failure.

## Contributing

Issues and PRs welcome — especially new claim patterns, agent adapters, and false-positive reports (those are gold). See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Star history

If groundtruth ever catches your agent in a lie, a ⭐ helps other people find it.

<a href="https://star-history.com/#youcefzemmar/groundtruth&Date">
  <img src="https://api.star-history.com/svg?repos=youcefzemmar/groundtruth&type=Date" alt="Star History Chart" width="600">
</a>

## License

[MIT](LICENSE) © youcefzemmar
