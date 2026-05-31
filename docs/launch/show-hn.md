**Title (76 chars):**

Show HN: groundtruth – Catch when an AI coding agent claims work it didn't do

---

**Body (first comment from the maker):**

I'm the maker. groundtruth started from a recurring annoyance with AI coding agents: the agent ends its turn with a confident summary — "Added a `rateLimiter` to `src/server.ts`, fixed the timeout, and added tests" — and some of that just isn't in the diff. A recent MSR '26 study of 23,247 agentic PRs (Gong et al., arXiv:2601.04886) found that descriptions claiming changes that were never implemented are the single most common message-code inconsistency, at 45.4%, and that high-inconsistency PRs were accepted 51.7% less often (28.3% vs. 80.0%). So it's not just me.

Tests tell you if code is wrong. Nothing tells you if the code was ever written. groundtruth fills that gap.

How it works (the part I care about): it reads the agent's end-of-turn summary, extracts the concrete claims — a file touched, a symbol added, a test written, a dependency installed, a command run — and checks each one against the REAL diff: the agent's own tool calls plus `git`. The claim check makes ZERO LLM calls. It's deterministic, free, private, and doesn't flake. Each claim comes back verified / unsupported / review, and it's deliberately biased toward silence: it only says "unsupported" when a claim is concretely checkable AND there's zero evidence for it. The thing that gets a tool like this uninstalled is false alarms, so the default is to shut up unless it's sure.

There's a second, opt-in stage I call the verify loop. Once the claims pass, it makes the agent actually prove the work against the ORIGINAL request — run it, screenshot it with Playwright, run the tests — and self-fix before the turn is allowed to finish. It never judges whether the work is "good" (that's how you get false positives); it only checks that what was asked for actually happens. There's a per-session round cap so it can't trap the agent in a loop, and `GROUNDTRUTH_NO_LOOP=1` kills it outright.

Try it without installing anything — this runs the bundled phantom-change example and shows the unsupported claims:

    npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

To wire it into Claude Code (Stop hook + verify loop + status line, one command):

    npx @veltiq/groundtruth setup

The claim engine is agent-neutral — `verify --agent codex|gemini|cursor|opencode|aider|auto` works against other agents too. There's also a Claude Code plugin, a GitHub Action that grades a PR description against its diff as a sticky comment, SARIF output, and a pre-commit hook.

Details: MIT, zero runtime deps, Node >= 20, TypeScript, 141 tests, SLSA provenance.

What it is NOT: it's not an LLM code reviewer (Qodo, Greptile, etc. check correctness — a different axis), and it's not provenance/attribution (who wrote which line). It answers one question those don't: is the claimed work even in the diff? The diff doesn't lie.

Repo: https://github.com/veltiq/groundtruth
npm: https://www.npmjs.com/package/@veltiq/groundtruth

Happy to go into the claim parser, the silence heuristics, or the loop's stop conditions — and I'd genuinely like to hear about false positives, those are the most useful bug reports I can get.