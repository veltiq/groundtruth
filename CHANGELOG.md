# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0]

### Added

- **OpenCode** and **Aider** transcript adapters — `verify --agent opencode|aider`
  completes the multi-agent set (claude, codex, gemini, cursor, opencode, aider).
- **`verify --staged`** — use the staged index as evidence, so a git `commit-msg`
  hook can check a commit message against what's actually staged.

## [0.2.0]

### Added

- **GitHub Action** (`youcefzemmar/groundtruth@v0.3.0`) that grades a PR's
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
