# Verify loop — behavioral checks

The claim check (the rest of groundtruth) grades what a turn _says_ against the
diff. The **verify loop** is an opt-in second gate that grades what a turn
_does_: before the agent is allowed to finish a turn that changed something, it
must actually run / screenshot / test the work, compare it to the original
request, and fix-and-recheck until it holds up.

It is off by default. Turn it on with any of:

```bash
groundtruth install --loop                      # bakes --loop into the Stop hook
# .groundtruthrc.json:  { "loop": { "enabled": true, "maxRounds": 6 } }
# environment:          GROUNDTRUTH_LOOP=1
```

## The design constraint

groundtruth's whole reputation rests on a [bias toward silence](design.md): it
would rather miss a questionable claim than wrongly accuse a correct one. A loop
that let an LLM _judge_ the work would reintroduce exactly the false positives
the tool is built to avoid.

So the loop keeps groundtruth out of the judging business entirely. groundtruth
does three deterministic things and nothing more:

1. **Gates the Stop event** for turns that did work.
2. **Counts rounds** so the loop can never run forever.
3. **Injects a protocol** telling the agent how to verify and where to report.

The agent performs the verification and reports the verdict. groundtruth never
inspects a screenshot or grades an output, so the loop adds **no false
positives of its own**.

## The cycle

```text
agent finishes a work turn
        │
   Stop hook ── claims fail? ──▶ (existing strict check blocks first)
        │ claims ok
   verify loop enabled & turn used a mutating tool?
        │ yes
   signal written?
     ├─ pass / skip ─▶ allow the stop, clear state
     ├─ none, rounds < max ─▶ block, inject protocol, rounds++
     └─ none, rounds = max ─▶ give up, allow the stop (never trapped)
```

Each block hands the agent a protocol (see `buildProtocol` in
[`src/loop.ts`](../src/loop.ts)) that asks it to:

- write `skip` to its signal file if the turn made no checkable change; or
- spawn a **fresh** sub-checker (one that didn't write the code) that verifies
  by the kind of work —
  - **Web / UI** → open the page in a browser (e.g. the Playwright MCP),
    screenshot it, read the screenshot, compare against the request;
  - **CLI** → run the command(s), check output and exit code;
  - **API** → start the server, hit the endpoint(s), check status + body;
  - **Library** → run the tests plus a smoke call of the changed code;
- on **FAIL**, fix every issue and verify again (no signal yet);
- on **PASS**, write `pass` to its signal file, then finish.

## State

Loop state lives under `~/.groundtruth/loops/` (override with
`GROUNDTRUTH_LOOP_DIR`), keyed by session id so concurrent projects don't
collide:

- `<key>.rounds` — how many times groundtruth has blocked this stop-sequence.
- `<key>.signal` — the agent's verdict (`pass` / `skip`); the exact path is
  handed to the agent in every protocol message.

Both files are cleared the moment the stop is allowed, so the next turn starts
fresh.

## Guarantees

- **No pure-conversation gating.** A turn that used no mutating or shell tool is
  treated as an answer or a question and is never held (`turnDidWork`).
- **No infinite loop.** `maxRounds` (clamped 2–20, default 6) caps the rounds;
  hitting the cap gives up and lets the turn finish, printing a one-line notice.
- **Claude Code-oriented.** The protocol assumes an agent that can spawn a
  sub-checker and drive a browser/MCP. The loop mechanism itself is
  agent-neutral, but the richest verification (screenshots) needs a capable
  host.
