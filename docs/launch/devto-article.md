---
title: Your AI Coding Agent Lies About Its Work — Here's How to Catch It Every Turn
published: false
description: AI coding agents confidently report work they never did. groundtruth verifies every claim against the real git diff — deterministically, with zero LLM calls — then makes the agent prove it.
tags: showdev, ai, claude, opensource
canonical_url: https://veltiq.net/groundtruth
cover_image:
---

You ask your AI agent to add rate limiting. A minute later it replies:

> Done! I added a `rateLimiter` middleware to `src/server.ts`, fixed the timeout bug, and added tests.

You skim it, nod, and move on. Three of those four claims are false. The only file it actually touched was the README.

This isn't a rare glitch. A 2026 study of **23,247 agentic pull requests** across five coding agents (Gong et al., *arXiv 2601.04886*, MSR '26) found that **"phantom changes" — descriptions claiming work that was never implemented — are the single most common message-code inconsistency, at 45.4%.** PRs with high inconsistency saw **51.7% lower acceptance** and merged **3.5x slower**. The agent's summary is the one artifact in your workflow that nobody checks against reality.

**Tests check if the code is wrong. Nothing checks whether the code was ever written.** That's the gap [groundtruth](https://github.com/veltiq/groundtruth) fills.

## The actual failure mode

The problem isn't that agents are bad at coding. It's that the *narration* and the *diff* are two independent things, and only the narration reaches your eyes. The agent generates a plausible-sounding summary token by token; whether that summary matches what landed on disk is never enforced.

So you get confident sentences like:

- "Added tests" — no test file changed, no test command ran.
- "Wired it into `src/server.ts`" — `src/server.ts` is untouched.
- "Fixed the timeout bug" — no edit anywhere near a timeout.

And the catch is structural: reviewing AI output is itself work nobody loves. Stack Overflow's 2025 Developer Survey found trust in AI tools falling sharply year over year, with roughly **46% of developers saying they don't trust the accuracy** of AI-generated output. Re-reading every summary against the diff, by hand, every single turn is exactly the kind of tedious checking that gets skipped under deadline. groundtruth automates that check so it actually happens.

## How groundtruth verifies — deterministically, zero LLM calls

groundtruth runs as a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) **Stop hook**: when the agent finishes a turn, groundtruth reads the turn's end-of-turn summary, extracts every *concrete, checkable* claim — files, symbols, tests, dependencies, commands, actions — and verifies each against the **real diff**: the turn's tool calls plus `git`.

The critical design choice: **the claim check makes zero LLM calls.** It's pure string-and-AST-level matching against evidence. That means it's deterministic, free, private (your code never leaves the machine), and never flaky. Every other AI-review tool on the market is itself an LLM, which means it's non-deterministic and can hallucinate its own findings. groundtruth can't — the diff doesn't lie.

Here's it catching the phantom from the intro. This is the **real, unedited CLI output**:

```text
$ npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

groundtruth — claim check

  ❌ unsupported symbol `rateLimiter`
     Claimed `rateLimiter`, but it does not appear anywhere in this turn's changes.
     from: "I added a `rateLimiter` middleware to `src/server.ts`, fixed the timeout bug, and added tests."
  ❌ unsupported file src/server.ts
     Claimed a change to `src/server.ts`, but it is not among the files changed (README.md).
     from: "I added a `rateLimiter` middleware to `src/server.ts`, fixed the timeout bug, and added tests."
  ❌ unsupported tests
     Claimed test work, but no test file changed, no test command ran, and the added code has no test assertions.
     from: "I added a `rateLimiter` middleware to `src/server.ts`, fixed the timeout bug, and added tests."

  3 claims · 0 verified · 3 unsupported
```

Now the honest version — the agent actually wrote `src/rate-limit.ts`, edited `src/server.ts`, and ran `npm test`:

```text
groundtruth — claim check

  ✅ verified    symbol `rateLimiter`
     `rateLimiter` appears in the added code.
  ✅ verified    file src/rate-limit.ts
     `src/rate-limit.ts` was changed this turn.
  ✅ verified    file src/server.ts
     `src/server.ts` was changed this turn.
  ✅ verified    command tests
     A test command ran: `npm test`.

  4 claims · 4 verified
```

Same engine, opposite verdicts — decided entirely by what's in the diff.

### Three verdicts, and a deliberate bias toward silence

Every claim resolves to one of three states: **verified**, **unsupported**, or **review** (checkable in principle but not cleanly decidable). The single most important rule is the last one: **groundtruth only flags `unsupported` when a claim is concretely checkable AND there is zero supporting evidence.** Vague claims ("improved performance," "refactored for clarity") don't get flagged, because flagging them would be a guess — and a guess is exactly the hallucination this tool exists to prevent.

That bias toward silence is the whole point. The #1 reason developers uninstall AI-review tools is false alarms. A verifier that cries wolf is worse than no verifier. groundtruth stays quiet unless it's *sure*.

## Stage 2: the verify loop — make the agent prove it

Catching a lie is good. Making the agent fix it before it bothers you is better.

After the claims pass, you can opt into the **verify loop**. It takes the *original request* and forces the agent to actually demonstrate the change — run it, screenshot it with Playwright, test it — and self-fix until it works, all before the turn is allowed to finish.

Concretely: you asked for a button, the agent says "done," but the CTA renders invisible because of a color bug. The loop drives a Playwright screenshot, sees the button isn't there, marks it `✕ FAIL — CTA never rendered`, the agent fixes the color, re-screenshots, gets `✓ PASS`, and the claim check re-runs all green. You never saw the broken state.

Crucially, **the loop never judges the work itself** — it only checks the change against what you asked for. That's deliberate: judging quality means opinions, and opinions mean false positives. The loop verifies, it doesn't critique. And it can never trap you:

```bash
# Instant kill-switch, always available:
GROUNDTRUTH_NO_LOOP=1
```

There's also a per-session round cap so the loop can't spin forever.

## Install — one command

```bash
npx @veltiq/groundtruth setup
```

That wires the Stop hook, the verify loop, and a status-line indicator into Claude Code. Restart Claude Code and it's live. It's a single npm package: **MIT, zero runtime dependencies, Node ≥ 20, TypeScript, 141 tests, SLSA provenance.**

Not on Claude Code? The claim engine is agent-neutral:

```bash
# Verify another agent's last turn against the diff
npx @veltiq/groundtruth verify --agent codex      # or gemini, cursor, opencode, aider, auto
```

It also ships as a Claude Code plugin, a **GitHub Action** (grades a PR description against its diff as a sticky comment), **SARIF** output for code scanning, and a **pre-commit hook**.

## Honest limitations

In the anti-hallucination spirit, here's what groundtruth does *not* do:

- **It doesn't tell you if your code is correct.** It tells you whether the claimed work exists. A function can be present in the diff (verified) and still be buggy. Use your tests and a code reviewer for correctness — groundtruth is a different, upstream layer.
- **It can't verify vague claims, and won't try.** "Improved performance" isn't checkable against a diff, so it lands in `review`, not `unsupported`. That's a feature, not a gap.
- **The deterministic check needs concrete anchors** — a named file, symbol, test, or command. A purely prose summary gives it less to grab onto.
- **The verify loop is opt-in and needs a runnable target.** Screenshot verification needs something Playwright can drive.

That's the honest tradeoff: groundtruth is narrow on purpose. It does one thing — verify that claimed work is actually in the diff — and refuses to bluff about anything it can't prove. For a tool whose entire brand is catching bluffs, that restraint is the product.

## Try it

```bash
npx @veltiq/groundtruth setup
```

Repo, docs, and the agent adapters: **[github.com/veltiq/groundtruth](https://github.com/veltiq/groundtruth)**

If you find a false positive, [open an issue](https://github.com/veltiq/groundtruth/issues) — for a tool like this, those reports are gold.

*groundtruth — the human-in-the-loop for AI coding, automated.*