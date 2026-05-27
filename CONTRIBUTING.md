# Contributing to groundtruth

Thanks for helping! This project lives or dies on its **accuracy**, so the most
valuable contributions are often the smallest: a false-positive report, a missed
claim pattern, or an agent transcript we don't yet parse correctly.

## Ground rules

- **Precision first.** A change that catches more claims but introduces false
  "unsupported" verdicts is a regression, not a feature. When in doubt, prefer
  `unverifiable` (advisory) over `unsupported` (failure).
- **Every behavior change needs a test.** The verifier and extractor are pure
  functions — they're easy to cover. Add a case in `src/*.test.ts`.
- **No runtime dependencies.** groundtruth runs on every turn; keep it fast and
  supply-chain-clean. Dev dependencies are fine.

## Development

```bash
npm install
npm run check     # biome + tsc + vitest — must pass before you push
npm test          # tests only
npm run build     # bundle to dist/
```

Try your change against a real session:

```bash
npm run build && node dist/cli.js verify --transcript path/to/session.jsonl
```

## Reporting a false positive

Open an issue with the **summary text** and the **evidence** (files changed /
diff). Even better: turn it into a failing test in `src/verify.test.ts` or
`src/extract.test.ts` and send a PR. These are the highest-signal contributions
we get.

## Adding a claim pattern

Claim extraction lives in `src/extract.ts`; verification in `src/verify.ts`.
Add the pattern, add at least one positive and one negative test, and run
`npm run check`.

## Adding an agent adapter

The core (`extractClaims`, `verifyClaims`, `buildEvidence`) is agent-agnostic.
To support a new agent, add a transcript parser that produces a `Turn`
(`{ summary, toolUses }`) and wire it into the pipeline.

## Commit / PR conventions

- Keep PRs focused and small.
- Use clear, imperative commit messages (e.g. `extract: handle backticked paths`).
- CI (lint, typecheck, tests on Node 20/22/24) must be green.

By contributing you agree your work is licensed under the project's
[MIT License](LICENSE).
