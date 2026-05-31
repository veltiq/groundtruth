## Name
**groundtruth**

---

## Tagline (47 chars — under the 60-char limit)
**The human-in-the-loop for AI coding — automated**

> Alternates, all under 60 chars, if you want to A/B:
> - `Catch when your AI coding agent lies about its work` (51)
> - `Verify what your AI agent claims — against the real diff` (56)
> - `Tests check if code is wrong. We check if it exists` (51)

---

## Description (241 chars — under the 260-char limit)
Your AI agent says "Done — added the rate limiter and tests." Did it? groundtruth extracts each concrete claim and checks it against the real diff — zero LLM calls, every turn. Then it makes the agent run, screenshot, and test before "done."

> Shorter alternate (220 chars):
> AI coding agents confidently report work they never did. groundtruth verifies every claim against the real git diff — deterministic, zero LLM calls — then makes the agent run/test/screenshot to prove it before finishing.

---

## Topics / Tags (pick 3, PH allows up to 3)
**Primary set:**
1. Developer Tools
2. Artificial Intelligence
3. GitHub

**Alternates depending on PH's current taxonomy:** Open Source · Productivity · Code Review · Bots

---

## First gallery image / caption text (for the slides)
1. **The problem** — "Done! I added a `rateLimiter` to `src/server.ts`, fixed the timeout, and added tests." (the only real change was a README edit.)
2. **The catch** — groundtruth flags it: `3 claims · 0 verified · 3 unsupported` — each one a phantom.
3. **The proof** — when the work is real: `4 claims · 4 verified` against the diff.
4. **The loop** — after claims pass, the agent runs / screenshots / tests and self-fixes before it's allowed to say "done."
5. **One command** — `npx @veltiq/groundtruth setup`

---

## Maker's first comment

Hey Product Hunt 👋 I'm the maker of **groundtruth**.

Here's the pain that made me build it. Your AI coding agent finishes a turn and says: *"Done! I added a `rateLimiter` to `src/server.ts`, fixed the timeout, and added tests."* You trust it and move on. Two weeks later something breaks — the rate limiter was never written. **The summary lied, and nothing checked it against the diff.**

This isn't a rare edge case. A 2026 study of 23,247 agentic PRs (Gong et al., arXiv 2601.04886) found that "phantom changes" — descriptions claiming work that was never implemented — are the **#1 message-code inconsistency at 45.4%**, and high-inconsistency PRs saw 51.7% lower acceptance.

**What groundtruth does:** it's a Claude Code Stop hook (and CLI) that reads the agent's end-of-turn summary, extracts every concrete claim — files, symbols, tests, dependencies, commands, actions — and verifies each one against the **real diff** (tool calls + git). The claim check runs with **zero LLM calls** — it's deterministic, free, private, and doesn't flake. Verdicts are `verified`, `unsupported`, or `review`, and it has a deliberate bias toward silence: it only flags `unsupported` when a claim is concretely checkable *and* there's zero evidence. No noise, no false alarms.

**Then there's the second stage (opt-in):** once the claims pass, the verify loop makes the agent actually *run* the change, *screenshot* it with Playwright, and *test* it against your original request — and self-fix — before it's allowed to finish. It never judges whether the code is "good" (so no false positives there either); it just makes the agent prove the work exists and runs.

**Where it fits:** code reviewers (Qodo, CodeRabbit, Greptile) tell you if your code is *buggy*. Provenance tools tell you *who* wrote a line. groundtruth answers the question none of them ask: **did the claimed work actually make it into the diff at all?** Tests check if the code is wrong. groundtruth checks if it was ever written.

**The honest facts:**
- MIT licensed, **zero runtime dependencies**, Node ≥ 20, TypeScript, **141 tests**, SLSA provenance.
- One command to install: `npx @veltiq/groundtruth setup` (wires the Stop hook + verify loop + status line).
- Also ships as a Claude Code plugin, a GitHub Action (grades your PR description against the diff as a sticky comment), SARIF output, and a pre-commit hook.
- Agent-neutral: `verify --agent codex|gemini|cursor|opencode|aider|auto`.
- Kill switch any time: `GROUNDTRUTH_NO_LOOP=1`.

One note on brand, because it matters here: this tool is about catching hallucinated work, so I'm not going to fabricate any stars, download counts, or "trusted by X teams" — there are none of those claims anywhere in this launch. Just the real pain and the real facts.

Try it on a canned example with no setup:
```bash
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

Repo: https://github.com/veltiq/groundtruth · npm: `@veltiq/groundtruth`

I'll be here all day — tear it apart, and if you ever get a false positive, that's gold to me, please send it.