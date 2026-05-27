# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0]

### Added

- **GitHub Action** (`youcefzemmar/groundtruth@v0.2.0`) that grades a PR's
  description against its diff and posts a sticky PR comment; optional `strict`
  merge gate. See [docs/github-action.md](docs/github-action.md).
- **PR / summary mode**: `verify --summary <file> --base <ref>` grades arbitrary
  summary text against `base...HEAD` — no transcript required.
- **Config support**: `.groundtruthrc.json` or a `groundtruth` key in
  package.json (`strict`, `ignore`, `ignoreKinds`, `output`).
- **Claude Code plugin** manifest (`.claude-plugin/plugin.json` + `hooks/`) for
  one-command marketplace install.

### Changed

- Extraction no longer treats leading-slash routes (e.g. `/api/users`) as file
  claims, removing a class of false positives.
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
