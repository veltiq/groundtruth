**Tweet 1 / Hook**

Your AI coding agent just told you:

"Done! Added a rateLimiter to src/server.ts, fixed the timeout, added tests."

The only thing it actually changed was the README.

I built groundtruth to catch this — every single turn. 🧵

---

**Tweet 2 / The pain**

This isn't rare. A 2026 study (Gong et al., MSR'26) of 23,247 AI-agent PRs found that descriptions claiming work that was never implemented are the #1 message-vs-code inconsistency (45.4%) — and those PRs got accepted 51.7% less often.

You read the summary. You trust it. Nothing checks it against the real diff.

---

**Tweet 3 / Before → after the catch**

Before: agent claims a file, a symbol, a passing test → you commit and move on.

After groundtruth, the same turn:

✗ unsupported  symbol `rateLimiter`
✗ unsupported  file src/server.ts
✗ unsupported  tests

3 claims · 0 verified · 3 unsupported

The diff doesn't lie.

---

**Tweet 4 / How it works**

It reads the agent's end-of-turn summary, pulls out concrete claims (file / symbol / test / command), and checks each against the actual diff — tool calls + git.

Deterministic. ZERO LLM calls for the check. Free, private, no flake.

---

**Tweet 5 / Bias toward silence (no false alarms)**

The reason these tools get uninstalled is false alarms. groundtruth only flags "unsupported" when a claim is concretely checkable AND has zero matching evidence.

If it can't be sure, it stays quiet. It never judges whether your code is good — only whether the claimed work exists.

---

**Tweet 6 / One-command install**

It runs as a Claude Code Stop hook, so it fires automatically before every turn finishes.

```
npx @veltiq/groundtruth setup
```

That wires the hook + the (opt-in) verify loop + a status line. Restart Claude Code and you're live. MIT, zero runtime deps, Node 20+.

---

**Tweet 7 / The self-fixing loop**

Stage 2 is the verify loop: once the claims pass, groundtruth makes the agent actually run / screenshot (Playwright) / test the change against your ORIGINAL request — and self-fix before it's allowed to say "done."

Caught a bug → fix → re-screenshot → ✓ PASS. The agent proves it. (Per-session round cap so it can never trap you; GROUNDTRUTH_NO_LOOP=1 kills it.)

---

**Tweet 8 / Agent-neutral**

The claim engine isn't Claude-only:

verify --agent codex | gemini | cursor | opencode | aider | auto

Same deterministic check against the diff, whichever agent you run.

---

**Tweet 9 / Repo + soft star ask**

This is the human-in-the-loop for AI coding — automated.

Tests check if the code is wrong. groundtruth checks if it was ever written.

It's MIT and open source 👇
https://github.com/veltiq/groundtruth

If the idea resonates, a ⭐ genuinely helps it reach the next dev who got burned by a phantom.