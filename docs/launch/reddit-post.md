## Title

**My agent said "Done! Added a rateLimiter to src/server.ts and tests." None of it existed. So I wrote a Stop hook that checks the summary against the diff.**

## Body

This keeps happening to me with Claude Code (and honestly every agent): the end-of-turn summary reads great — "added X, fixed the timeout, added tests" — I skim it, commit, move on. Then days later something breaks and it turns out half of what it *said* it did never made it into the diff. The whole "codebase change" was one README edit.

Turns out this isn't just me being unlucky. Research on agentic PRs found these "phantom changes" — the description claiming work that was never implemented — are the single most common kind of message-vs-code inconsistency. Tests catch code that's *wrong*. Nothing catches code that was simply *never written* but reported as done. That gap is what burned me.

So here's the thing I've been chewing on, and I'm curious how others handle it:

**Tests check if the code is wrong. Almost nothing checks whether it was ever written.**

The approach I landed on is dead simple and deterministic — no second LLM grading the first one (those flake and cost tokens). At the end of a turn it reads the agent's summary, pulls out each concrete claim (a file, a symbol/function name, "added tests", "ran npm install", a command it says it ran), and grades each claim against the actual tool calls + git diff. The diff doesn't lie. Three verdicts: verified / unsupported / review. Crucially it's biased toward silence — it only flags "unsupported" when a claim is concretely checkable *and* there's zero evidence for it, so it doesn't nag you on every turn. (False alarms are exactly why people rip these tools out.)

Here's what it looks like in practice, on a transcript where the agent claimed a rate limiter + tests but only edited a README:

```
groundtruth — claim check

  ❌ unsupported symbol `rateLimiter`
     Claimed `rateLimiter`, but it does not appear anywhere in this turn's changes.
  ❌ unsupported file src/server.ts
     Claimed a change to `src/server.ts`, but it is not among the files changed (README.md).
  ❌ unsupported tests
     Claimed test work, but no test file changed, no test command ran, and the added code has no test assertions.

  3 claims · 0 verified · 3 unsupported
```

There's a second, opt-in stage too: once the claims pass, before the agent says "done" it has to actually run / screenshot (Playwright) / test the change against your *original* request and self-fix until it holds up. It never judges whether the work is "good" — only whether the agent did and proved what it said — so it doesn't generate false positives about your code. There's a kill switch (`GROUNDTRUTH_NO_LOOP=1`) and a per-session round cap so it can't trap you in a loop.

A few honest caveats since this sub (rightly) hates overselling:

- It only catches *concrete, checkable* claims. Vague summaries give it less to grab onto — that's by design, to avoid false flags.
- It's a Claude Code Stop hook + CLI. It's silent when everything checks out, which is great for trust but means you should run the demo once to confirm it's actually wired up.
- It also works against Codex / Gemini / Cursor / opencode / aider — the claim engine is agent-neutral.

If you want to see it catch a phantom in about 30 seconds without installing or configuring anything (it ships with the canned transcript above):

```
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

Wiring it into Claude Code as a Stop hook is one command: `npx @veltiq/groundtruth setup` (Node ≥ 20, MIT, zero runtime deps).

Mostly I want to know: **how are you all dealing with agents that confidently report work they didn't do?** Manually re-reading every diff? Trusting it? Something smarter? Genuinely want the war stories.

Repo (MIT, free): https://github.com/veltiq/groundtruth

---

## Note: adapting this for r/programming

r/programming is much stricter about self-promo and bare project links — a "here's my tool" post will get removed or buried. To post there, make it a **standalone-valuable writeup** that's worth reading even if nobody clicks the repo:

- **Retitle to the idea, not the product**, e.g. *"How to verify an AI coding agent's summary against the git diff deterministically (no second LLM)"* or *"Phantom changes: AI agents report work they never did — a deterministic way to catch it."*
- **Lead with the technical content, not the tool.** Open with the failure mode + the research stat (phantom changes are the most common message-code inconsistency in agentic PRs), then explain the *mechanism*: claim extraction → match each claim against tool calls + git diff → verified/unsupported/review, and why deterministic beats an LLM-grades-LLM approach (no flake, no cost, no data leaving the machine).
- **Show the engineering tradeoffs honestly:** bias-toward-silence to avoid false positives, what it deliberately *doesn't* do (it never judges if the code is good), and the limits (only concrete claims are checkable).
- **Move the link to the very bottom**, one line, framed as "implementation here if useful" rather than a CTA. Drop the "war stories" ask — r/programming prefers the post to stand on its own.
- **Drop the emoji/marketing tone entirely;** keep it neutral and technical. Don't ask for upvotes anywhere.