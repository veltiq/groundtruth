# groundtruth

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

## Install

Requires Node ≥ 20.

```bash
# Wire it into Claude Code as a Stop hook (writes ./.claude/settings.json)
npx groundtruth install

# …or globally for every project
npx groundtruth install --global --npx
```

Restart Claude Code (or run `/hooks`) and groundtruth will check every turn automatically. To verify an existing session without installing anything:

```bash
npx groundtruth verify
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

## Honest limitations

- It verifies that claimed work **exists in the diff**, not that it is **correct**. _"Fixed the bug"_ can be confirmed to touch the right code; it cannot be confirmed to actually fix anything. That's what tests are for.
- Extraction favors precision over recall — it will miss vaguely-worded claims rather than risk a false accusation.
- Today it targets the Claude Code transcript format. The core (`extractClaims`, `verifyClaims`) is format-agnostic; adapters for other agents are welcome — see [Contributing](CONTRIBUTING.md).

## Use as a library

```ts
import { runPipeline, renderMarkdown } from "groundtruth";

const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

## Contributing

Issues and PRs welcome — especially new claim patterns, agent adapters, and false-positive reports (those are gold). See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © youcefzemmar
