# Design notes

## The core bet: precision over recall

The fastest way to kill a tool like this is a false alarm. The first time
groundtruth says _"unsupported"_ about work the developer knows they did, they
stop trusting it and uninstall it. So the entire design is biased toward silence:

- A claim is marked **unsupported** only when it is *unambiguously* checkable and
  has *zero* corresponding evidence.
- Anything fuzzy — a semantic action, an un-anchored statement, a generic word —
  becomes **review** (advisory), never a failure.
- Extraction anchors on strong signals (backticks, slashes, keywords) and skips
  the rest. We would rather miss a vaguely-worded real claim than fabricate one.

The reliable, high-value signal we *can* deliver is the **phantom change**: the
agent said it created `validateInput` / edited `src/server.ts` / added tests, and
none of those things touched the diff at all. That class of error is common,
deterministically detectable, and exactly what tests and CI can't catch (there's
nothing to test).

## What we explicitly do not attempt

- **Correctness.** We verify a claim *exists in the diff*, not that it *works*.
  Confirming "fixed the bug" actually fixes the bug is undecidable in general and
  is what a test suite is for. Conflating "present" with "correct" would make the
  tool dishonest.
- **LLM-judging-LLM.** No model grades the claims. Verdicts come from
  deterministic checks against files, symbols, and commands. This keeps results
  reproducible, fast, free, and trustworthy — and avoids importing a second
  model's hallucinations into the verifier.

## Two evidence sources, on purpose

Tool-call evidence is precise and turn-scoped but blind to edits made outside the
agent's tools. The git working tree catches those but isn't turn-scoped. Merging
both gives good coverage while the conservative verdict rules absorb the
imprecision (extra evidence can only *prevent* a false `unsupported`, never
create one).

## Architecture

The pipeline is a chain of pure functions (`extract`, `verify`, `report`) with
I/O isolated at the edges (`transcript`, `git`). That makes the interesting
logic trivially unit-testable without fixtures on disk, and makes the package
usable as a library, not just a CLI.

- **Zero runtime dependencies** — it runs on every turn; startup cost and
  supply-chain surface both matter.
- **Format-agnostic core** — `extractClaims` / `verifyClaims` know nothing about
  Claude Code. Supporting another agent is just another transcript adapter that
  produces a `Turn`.

## Roadmap sketch

- Adapters for other agent transcript formats (Cursor, Codex, OpenCode).
- Optional, opt-in LLM-assisted claim *extraction* (never verification) for
  higher recall, behind a flag.
- A `--comment` mode to post the markdown report directly onto a PR.
