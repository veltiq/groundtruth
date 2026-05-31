# How groundtruth compares

> The human-in-the-loop for AI coding — automated.

There is already plenty checking your AI agent's work: your own eyes on the
summary, your tests and CI, and a growing field of AI code reviewers. They are
all useful. None of them answer the one question groundtruth exists for:

**Did the agent actually do what it said it did?**

Tests check whether the code is *wrong*. groundtruth checks whether it was ever
*written*. Those are different axes, and the gap between them is where phantom
changes live — work described in the summary but never implemented. Research on
agentic PRs found these "phantom changes" to be the single most common
inconsistency between what an agent says and what its diff contains. This page
lays out, honestly, where groundtruth fits next to the alternatives — and where
it deliberately does **not** step.

## At a glance

| | Reading the summary yourself | Tests / CI | Generic AI code review | **groundtruth** |
|---|---|---|---|---|
| **Catches work that was *claimed but never written*** (phantom changes) | Only if you re-read every claim against the diff, by hand, every turn | No — there's nothing to test for code that doesn't exist | Rarely — it reviews the code that *is* there, not the gap between the summary and the diff | **Yes — this is the whole job:** every concrete claim is graded against the real diff |
| **Judges whether the code is *correct* / well-designed** | You can, slowly | Yes — that's exactly what tests do | Yes — its core purpose | **No, by design** — it never judges correctness or style |
| **Deterministic & private** (no LLM, nothing leaves your machine) | You are not deterministic at 5pm on a Friday | Yes | No — LLM-based, non-deterministic, usually sends code to a service | **Yes** — zero LLM calls for the check, runs fully local |
| **Runs automatically, per turn, before the PR exists** | No — it's manual, and you stop doing it | Only if you wrote a test for it and CI runs | No — it runs on the PR, after the work is "done" | **Yes** — fires on every Stop, at the source |

## Reading the summary yourself

This is the status quo, and on a good day it works. You read *"Done! I added a
`rateLimiter` to `src/server.ts`, fixed the timeout, and added tests,"* you skim
the diff, and you catch the lie.

The problem is that you don't do it every time. Manual claim-checking is exactly
the kind of repetitive, attention-heavy task humans quietly stop doing —
especially as agents get faster and the summaries get longer and more confident.

**groundtruth is that read-the-claims-against-the-diff pass, automated and
applied to every single turn** — deterministically, so it never gets tired,
distracted, or talked into believing a confident summary.

## Tests and CI

Tests are essential, and groundtruth is **not** a replacement for them. But tests
have a structural blind spot: *they can only check code that exists.*

If the agent claims it added a rate limiter and never wrote one, there is no
function to call, no behavior to assert, no test that turns red. The change is
simply absent. CI stays green because nothing changed where the claim said it
would. A phantom change is invisible to a test suite precisely because there is
nothing there to test.

groundtruth catches that class of failure *before* tests ever run, by comparing
the claim to the diff itself. Think of the two as complementary layers:

- **groundtruth** — *was the work done?* (present in the diff)
- **tests / CI** — *does the work work?* (behaves correctly)

You want both. groundtruth is the cheaper, earlier gate; tests are the deeper,
behavioral one.

## Generic AI code review

AI code reviewers (the broad category of LLM-based PR review tools) are good at a
real and different job: looking at the code that *is* in the diff and asking *is
this buggy, unsafe, or badly designed?* That's correctness and quality review.

groundtruth asks a question they don't: *is the claimed work even in the diff at
all?* A code reviewer reads the lines that exist; it generally won't flag that the
summary promised a `rateLimiter` the diff never contains, because there's nothing
on screen to review. The two tools sit on different axes:

- **AI code review** — judges the code that's there (LLM-based, non-deterministic, usually hosted).
- **groundtruth** — verifies the claimed work is there at all (deterministic, zero LLM calls, fully local).

Three practical differences fall out of that:

1. **Deterministic vs. probabilistic.** groundtruth's claim check makes zero LLM
   calls, so the same transcript and diff always produce the same verdicts —
   reproducible, free, and flake-free. An LLM reviewer's output varies run to run.
2. **Private by default.** The claim check reads your transcript and `git` locally
   and sends nothing anywhere. Most AI reviewers upload code to a service.
3. **At the source, not the PR.** groundtruth fires per turn, on the Stop hook,
   before a PR exists — so the lie gets caught while you're still in the loop,
   not after a reviewer (human or bot) is already looking at it.

You can absolutely run both: groundtruth confirms the work exists, your reviewer
checks whether it's any good.

## What groundtruth uniquely does

It catches **work that was claimed but never written** — the phantom change. It
reads the agent's end-of-turn summary, extracts each *concrete* claim (a file,
symbol, test, dependency, or command), and grades it against the **ground truth**:
the tool calls and the git diff. A claim is marked `unsupported` only when it is
unambiguously checkable and has **zero** matching evidence. No other layer in your
workflow is structurally built to notice that a described change is simply absent.

## What groundtruth deliberately does *not* do

Being honest about scope is the entire brand, so the limits are explicit:

- **It does not judge correctness.** groundtruth verifies a claim *exists in the
  diff*, never that it *works*. Confirming "fixed the bug" actually fixes the bug
  is what your tests and your own judgment are for.
- **It does not use an LLM to grade claims.** No model judges the work — verdicts
  come from deterministic checks against files, symbols, and commands, so no
  second model's hallucinations leak into the verifier.
- **It biases toward silence.** Vague or semantic statements (*"refactored the
  helper," "improved performance"*) are surfaced as `review`, never marked as a
  failure. groundtruth would rather miss a vaguely-worded real claim than wrongly
  accuse a correct one.

For the *behavioral* side — making the agent actually run / screenshot / test the
change and self-fix before finishing — see the opt-in
[verify loop](verify-loop.md). Even there, the loop never judges the work itself;
it makes the agent prove it against your original request.

## In one line

> Reading the summary yourself is manual and you stop doing it. Tests check if the
> code is *wrong*. AI code review judges the code that's *there*. groundtruth
> checks whether the claimed work was ever *written* — deterministically, on every
> turn, before the PR exists.

## See also

- [How it works](how-it-works.md) — the parse → extract → verify → report pipeline.
- [Claim types](claim-types.md) — what's concretely checkable vs. advisory.
- [Design notes](design.md) — why precision-over-recall and zero-LLM are deliberate.
- [Verify loop](verify-loop.md) — the opt-in behavioral gate.