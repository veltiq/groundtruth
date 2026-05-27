# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release.
- Claim extraction from assistant summaries (file, symbol, test, dependency,
  command, and action claims) with intent-vs-claim filtering.
- Deterministic verification against tool-call and git evidence, with
  `verified` / `unsupported` / `review` verdicts.
- Claude Code `Stop` hook integration (`groundtruth install`), non-blocking by
  default with an opt-in `--strict` mode.
- `groundtruth verify` CLI with terminal, `--json`, and `--markdown` output.
- Library API (`runPipeline`, `extractClaims`, `verifyClaims`, renderers).
