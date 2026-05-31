# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.1]

### Fixed

- **`doctor`: the "Verify loop" check now agrees with the wired hook.** It read
  only the config, so after `setup` it could say "off" while the Stop-hook line
  said "verify loop on". It now reports the loop **on** when the installed hook
  command carries `--loop` (or config enables it). Cosmetic, caught by an
  independent verification pass.

## [0.7.0]

### Added

- **`groundtruth doctor`** — diagnose an install in one command. It checks Node,
  the hook wiring (project + global), the binary, git evidence, config, whether a
  transcript is discoverable, the verify-loop state, and the ledger — and prints
  an actionable report with a clear next step when something's off (exit 1 if any
  check fails). Answers the #1 onboarding question: "is it actually working?"
- **Launch kit** under [`docs/launch/`](docs/launch/) — fact-checked go-to-market
  drafts (Show HN, X thread, Reddit, Product Hunt, dev.to, the awesome-claude-code
  submission, good-first-issues, and an ordered launch checklist), plus a new
  [`docs/comparison.md`](docs/comparison.md) (groundtruth vs tests / manual review
  / AI code reviewers) and a refreshed `assets/social-card.svg`.

### Changed

- **README** now cites the primary research it was built on — a 2026 study of
  23,247 agentic PRs ([Gong et al., MSR'26](https://arxiv.org/abs/2601.04886))
  found descriptions of never-implemented changes are the most common message-vs-
  code inconsistency (45.4%), and those PRs were accepted 51.7% less often.

## [0.6.2]

### Changed

- **README rebuilt for conversion** — cut from 380 → ~248 lines following the
  patterns of top OSS projects (uv, Bun, Zod, Hono): a tight hero (tagline +
  badges incl. a live **monthly-downloads** badge), the before/after catch
  screenshots up top, two-stage value prop, one-command install, and everything
  optional folded into `<details>` or linked to `/docs`. All 8 translations
  (zh-CN, es, pt-BR, fr, de, ja, ru, ar) regenerated to match. Docs only.

## [0.6.1]

### Changed

- **Positioning refresh** — the README, the npm/GitHub descriptions, and the
  plugin manifest now lead with what groundtruth *is*: the human-in-the-loop for
  AI coding, automated. It both verifies an agent's claims against the real diff
  **and** (opt-in) makes the agent run / screenshot / test its own work and
  self-fix before finishing. No behavior change — docs and metadata only.

## [0.6.0]

### Added

- **One-command setup** — `groundtruth setup` wires the Stop hook (with the
  verify loop on), the SessionEnd digest, and the status-bar line in a single
  idempotent step, globally by default. Install once; it just works. `install`
  stays for fine-grained control.
- **Verify loop** (`setup`, `install --loop`, a `loop` config block, or
  `GROUNDTRUTH_LOOP=1`) — an opt-in behavioral gate. After the claim check
  passes, a turn that changed something is held at the Stop event and asked to
  actually run / screenshot / test the work and prove it matches the request,
  fixing and re-checking until it does. groundtruth only gates the stop and
  counts rounds — it never judges the work itself, so the loop adds no false
  positives; a per-session round cap (`maxRounds`, default 6) guarantees it can
  never loop forever. Pure conversation turns are never gated. See
  [`docs/verify-loop.md`](docs/verify-loop.md).
- **Intent-aware verification** — the loop now grounds its check in the *actual
  human request* (parsed from the transcript) and tailors the protocol to the
  kind of work it detects: **web/UI** leads with "start it, open the URL,
  take a screenshot, read it"; **API** with "hit the endpoint, check status +
  body"; **CLI** with "run it, check stdout + exit code"; **library** with "run
  the tests + a smoke call". It surfaces the concrete run command (`npm run
  dev`) and the local URL when it can find them. Detection only *tailors* the
  guidance — groundtruth still never judges the work, so no new false positives.
- **`GROUNDTRUTH_NO_LOOP=1` kill-switch** — an always-available env var that
  instantly pauses the verify loop regardless of config, so it can never trap a
  turn. Documented in `groundtruth help`.
- **`analyze()` + `detectWorkKind()` / `summarizeRequest()`** added to the
  public library API (the pipeline now returns its evidence alongside the report).

### Fixed

- **Precision: bare prose slash-pairs are no longer mined as file claims.**
  Tokens like `web/UI`, `stdout/stderr`, `client/server`, or `and/or` in a
  summary were being treated as bare file paths and flagged `unsupported`. A
  bare (un-backticked) slash token now counts as a path only when it carries a
  real code extension or sits under a known source root (`src/`, `lib/`,
  `packages/`, …). Caught by groundtruth dogfooding its own PR. Real paths
  (`src/db/client.ts`, `src/auth`) are unaffected.
- **Precision: eliminated four classes of false `unsupported` verdicts** on
  honest work, with an end-to-end regression suite (`src/precision.test.ts`):
  - A **modify** claim whose identifier isn't in the changed lines
    (`"updated the `parseConfig` function"` while editing only its body) is now
    `unverifiable`, not `unsupported` — a modification needn't surface the name.
  - **"added tests"** is verified when the added code carries test-runner idioms
    (`describe` / `it` / `expect` / `assert` / …), even when the file isn't
    conventionally named (`foo.test.ts`).
  - A dependency name is no longer also mined as a phantom symbol — `"installed
    the `zod` package"` is one dependency claim, not a stray `zod` symbol.
  Phantom claims (a symbol/file/test that genuinely never appeared) are still
  flagged exactly as before.

## [0.5.0]

### Added

- **`verify --sarif`** — emit SARIF 2.1.0 so unsupported claims surface in a
  repo's Security tab via `github/codeql-action/upload-sarif`. Only phantom
  changes become results, anchored to the claimed file when one is named. (#15)
- **`stats --json`** — print the 7d/30d/all-time tallies as
  `{ scope, project, generatedAt, week, month, allTime }` for dashboards. (#17)
- **pre-commit support** — a `.pre-commit-hooks.yaml` defining a `groundtruth`
  hook (`commit-msg` stage) that grades the commit message against the staged
  diff; add it via [pre-commit](https://pre-commit.com). (#16)
- **Cursor SQLite adapter** — read older Cursor builds' `state.vscdb` store, not
  just `agent-transcripts/*.jsonl`. Uses `node:sqlite` (Node 24+, or Node 22 with
  `--experimental-sqlite`) and falls back to JSONL elsewhere. (#14)

### Changed

- `prepublishOnly` → `prepare` so the package builds when installed from git
  (how pre-commit consumes it); publishing and registry installs are unchanged.

## [0.4.0]

### Changed

- **Renamed the package to `@veltiq/groundtruth`** (previously
  `@twarc_net/groundtruth`) as the project moved to the
  [Veltiq](https://veltiq.net) organization. Update your hook and CI to
  `npx -y @veltiq/groundtruth …`, and the GitHub Action to
  `veltiq/groundtruth@v0.4.0`. The CLI binary name is unchanged
  (`groundtruth`). The old package is deprecated with a pointer to the new name.

## [0.3.0]

### Added

- **OpenCode** and **Aider** transcript adapters — `verify --agent opencode|aider`
  completes the multi-agent set (claude, codex, gemini, cursor, opencode, aider).
- **`verify --staged`** — use the staged index as evidence, so a git `commit-msg`
  hook can check a commit message against what's actually staged.

## [0.2.0]

### Added

- **GitHub Action** (`veltiq/groundtruth@v0.3.0`) that grades a PR's
  description against its diff and posts a sticky PR comment; optional `strict`
  merge gate. See [docs/github-action.md](docs/github-action.md).
- **PR / summary mode**: `verify --summary <file> --base <ref>` grades arbitrary
  summary text against `base...HEAD` — no transcript required.
- **Config support**: `.groundtruthrc.json` or a `groundtruth` key in
  package.json (`strict`, `ignore`, `ignoreKinds`, `output`).
- **Claude Code plugin** manifest (`.claude-plugin/plugin.json` + `hooks/`) for
  one-command marketplace install.
- **`stats` + `statusline`** commands backed by a privacy-safe local ledger
  (`~/.groundtruth/ledger.jsonl`, counts only — never code or prompts).
  `install --statusline` wires the status bar without clobbering an existing one.
- **More hook events**: `install --events Stop,SubagentStop,SessionEnd`;
  `SessionEnd` prints a per-session digest.
- **Gate config**: `failOn` (which verdict levels fail strict mode) and `shadow`
  (record-only, no print/block) for gradual rollout.
- **Multi-agent adapters**: `verify --agent codex|gemini|cursor|auto` — the claim
  engine is agent-neutral; adapters normalize each transcript to `{summary, toolUses}`.

### Changed

- Extraction no longer treats leading-slash routes (e.g. `/api/users`) or JSX
  tags as file claims; JSX/HTML tags extract the component name as a symbol.
- "renamed `A` to `B`" expects `A` removed and `B` added.
- Fenced code blocks in a summary are stripped before extraction.
- File matching now accepts extensionless references (`src/auth` matches
  `src/auth.ts`).

## [0.1.0]

### Added

- Claim extraction from assistant summaries (file, symbol, test, dependency,
  command, and action claims) with intent-vs-claim filtering.
- Deterministic verification against tool-call and git evidence, with
  `verified` / `unsupported` / `review` verdicts.
- Claude Code `Stop` hook integration (`groundtruth install`), non-blocking by
  default with an opt-in `--strict` mode.
- `groundtruth verify` CLI with terminal, `--json`, and `--markdown` output.
- Library API (`runPipeline`, `extractClaims`, `verifyClaims`, renderers).
