# Roadmap & growth plan

Distilled from research into how comparable tools (ccusage, OpenClaw, aider,
SuperClaude, CodeRabbit, awesome-claude-code) grew, plus a competitive feature
analysis. Tactics are ordered by impact-for-effort.

## Status

- **v0.1.0** — published to npm (`@veltiq/groundtruth`), Stop hook + CLI.
- **v0.2.0** — GitHub Action (PR claim-check + sticky comment), config file,
  Claude Code plugin manifest, precision fixes, `verify --summary/--base`,
  `stats`/`statusline` + local ledger, extra hook events (SubagentStop/SessionEnd),
  gate config (`failOn`/`shadow`), rename/JSX/code-fence extraction, and
  multi-agent adapters (Codex, Gemini, Cursor). Most of P1 below is now shipped.
- **v0.5.0** — `verify --sarif` (GitHub code scanning), `stats --json` (dashboards),
  `.pre-commit-hooks.yaml` (pre-commit framework), and the Cursor `state.vscdb`
  SQLite adapter. Clears the rest of P1/P2 below except the hosted dashboard.
- **Next** — the metrics dashboard (now that `stats --json` feeds it); submit the
  plugin to the community marketplace; submit to awesome-claude-code.

## Growth playbook (ranked)

1. **Hero demo GIF/asciinema** of the phantom-change catch (3 red ❌). A tool
   people *see work* beats any description — this is the single highest-leverage
   gap. Put it above the badges.
2. **`npx` one-liner as the first CTA**, with "no install · <1 MB · 0 deps · 0
   network" framing. ccusage's entire funnel was frictionless trial.
3. **Submit to [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)**
   (36k★) after the repo is ≥1 week old, via the web "Recommend New Resource"
   issue form. We fit both *Hooks* and *Tooling*. Requires clear install +
   uninstall + a network-behavior note (we have all three).
4. **Launch around the "my AI lied" narrative with proof** — Cursor's 74-day
   "shipping shortly", Replit fabricating 4,000 records, METR's "felt 20% faster,
   was 19% slower". Then: "so I built a hook that grades every summary against
   the diff."
5. **Ship a status/curiosity loop** — a `statusline` / "claims caught this week"
   counter for the Claude Code status bar. This was ccusage's accelerant: it
   turns a report into a screenshottable always-on object. *(P1 feature.)*
6. **One headline stat + the tagline.** Run groundtruth over a public corpus of
   agent PRs/transcripts and publish "X% of agent turns made ≥1 unsupported
   claim." Pair permanently with **"The diff doesn't lie."**
7. **Launch velocity**: freeze the README/GIF first, post HN Tue–Thu 12:00–17:00
   UTC, then be present for 48h (~92% of star impact lands in 48h; ~1.4 stars per
   upvote). "Show HN" gives no measurable edge — the problem framing does.
8. **Founder-in-public on X** — post real catches, reply in "my Claude Code
   setup" threads, thank anyone who features it.
9. **Cross-post** to r/ClaudeAI and the Claude Code plugin marketplaces.
10. **Trust signals**: badge wall + star-history + conditional-star ask (done);
    add npm-downloads + Trendshift badges once listed.
11. **Lower the contribution bar** — tag agent adapters as "good first issue";
    each adapter unlocks a new community.
12. **Be loud about precision + zero-network.** Trust is the moat for a verifier;
    unprovable claims (cf. SuperClaude skepticism) are the anti-pattern.

## Launch sequence

- **Day 1 (polish, don't launch):** record the hero GIF; promote the `npx`
  demo; confirm install+uninstall+network note; publish the npm release so
  version/downloads badges are live.
- **Week 1:** let the repo age ≥7 days while posting 2–3 build-in-public catches;
  write the launch post; post to HN (Tue–Thu 12–17 UTC) + r/ClaudeAI, stay on for
  48h; on day 7+, submit to awesome-claude-code.
- **Month 1:** ship the statusline/counter; publish the headline stat; submit the
  plugin to the marketplaces; open adapter "good first issues".

## Feature roadmap

**P0 — done in v0.2**
- ✅ GitHub Action with sticky PR comment + PR-description mode
- ✅ Config file (`ignore` escape hatch is the retention lever)
- ✅ Claude Code plugin manifest *(still to do: submit to the community marketplace)*

**P1 — next**
- `statusline` / running "claims caught" counter (growth tactic #5).
- Agent transcript adapters, in order of reach-for-effort:
  **Codex CLI** (`~/.codex/sessions/**/rollout-*.jsonl`, JSONL — easiest) →
  **OpenCode** (`~/.local/share/opencode/storage/`) →
  **Gemini CLI** (`~/.gemini/tmp/<hash>/chats/`) →
  **Cursor** (`agent-transcripts/*.jsonl`, else `state.vscdb` SQLite — biggest, hardest) →
  **Aider** (`.aider.chat.history.md`, Markdown — hardest to parse).
  Keep a normalized `Turn` behind each adapter; `extractClaims`/`verifyClaims`
  are already format-agnostic.
- More hook events: `SubagentStop`, `SessionEnd`.
- Formalize advisory ↔ gate modes (`failOn`) + a "shadow mode" for gradual CI
  adoption.

**P2 — later**
- Local metrics ("phantom-claim rate over time") — ✅ groundwork: `stats --json`
  (v0.5) emits the per-window tallies; the shareable dashboard is the next step.
- ✅ pre-commit recipe for non-Claude-Code users (`.pre-commit-hooks.yaml`, v0.5).
  lefthook/husky still welcome.
- ✅ SARIF output (`verify --sarif`, v0.5) for GitHub code scanning.
- Optional `git notes` / commit-trailer provenance — speculative.

## Monetization (later, don't gate anything now)

Every comparable tool grew free/MIT first. The natural commercial layer mirrors
CodeRabbit: a hosted "groundtruth for PRs/CI" with org dashboards and history —
after the OSS tool has traction.
