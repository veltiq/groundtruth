# How it works

groundtruth is a small, pure pipeline with one I/O boundary at each end (reading
a transcript + git, writing a report):

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary      diff       prose      per-claim
            + tools    ground truth  parse      check
```

## 1. Parse the transcript (`src/transcript.ts`)

Claude Code writes each session as JSON Lines to
`~/.claude/projects/<encoded-cwd>/<session>.jsonl`. We read it and isolate the
**latest turn** — everything since the last genuine human message (tool-result
messages don't count as human turns).

From that turn we keep two things:

- **`summary`** — the assistant's final natural-language text. This is where
  claims live.
- **`toolUses`** — every `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, and
  `Bash` call, with inputs.

The parser is defensive: malformed lines are skipped, so it keeps working as the
transcript schema evolves.

## 2. Build evidence (`src/evidence.ts`, `src/git.ts`)

Evidence is the **ground truth** a turn's claims are checked against, merged from
two sources:

- **Tool calls** (primary, precise, turn-scoped): file paths touched, text added
  (`Write` content, `Edit` `new_string`), text removed (`old_string`), and shell
  commands run.
- **git working tree** (corroborating): `git diff HEAD --unified=0` for changed
  files and added/removed lines, plus `git status --porcelain` for created and
  untracked files. This catches edits made outside the agent's tools and
  degrades gracefully to nothing outside a git repo.

## 3. Extract claims (`src/extract.ts`)

The summary is split into clauses, and clauses that read as **intent** ("I'll
add…", "next I should…") are discarded — only completed-work assertions remain.
From each remaining clause we extract concrete claims anchored on high-signal
tokens:

- Backticked identifiers → `symbol` claims
- Backticked or slash-containing paths → `file` claims
- Test / dependency keywords → `test` / `dependency` claims
- "ran the …" phrasing → `command` claims
- A completed-work clause with nothing concrete → a non-failing `action` claim

This is intentionally **high-precision, lower-recall**: missing a claim is
harmless; inventing one is not.

## 4. Verify (`src/verify.ts`)

Each claim is checked against the evidence:

- `file` → was a matching path touched? (suffix/basename aware)
- `symbol` → does the identifier appear in added code (or removed code, for
  removal claims)?
- `test` → did a test file change or a test command run?
- `dependency` → did a manifest change or an install command run?
- `command` → did a matching Bash command run? (advisory — commands can run
  elsewhere)
- `action` → always advisory

A claim becomes **unsupported** only when it is concretely checkable and has
*zero* matching evidence. Everything else is **verified** or **review**.

## 5. Report (`src/report.ts`)

Verdicts are sorted (unsupported first) and rendered as a colorized terminal
report, JSON, or shareable markdown.
