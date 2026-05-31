## awesome-claude-code submission — groundtruth

> Submit via the **web-UI issue form ONLY**: https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml
> Do **not** open a PR and do **not** use the `gh` CLI — both risk a ban. The maintainer/bot generate the list entry from the form; the bot then auto-creates the merge PR. (A human-authored PR title/body is included below for completeness.)

---

### 1) Issue-form field values (copy-paste into the form)

| Form field | Value |
|---|---|
| **Display Name** | `groundtruth` |
| **Category** | `Tooling` |
| **Sub-Category** | `Code Analysis & Testing` |
| **Primary Link** | `https://github.com/veltiq/groundtruth` |
| **Author Name** | `Veltiq` |
| **Author Link** | `https://github.com/veltiq` |
| **License** | `MIT` |
| **Description** | *(see below — 1–3 plain sentences, no emojis, descriptive not promotional)* |

**Description**
```
Reads an AI coding agent's end-of-turn summary, extracts concrete claims (files, symbols, tests, dependencies, commands), and verifies each against the real diff — deterministically, with zero LLM calls — so phantom changes the agent never made are flagged before the work is accepted. Runs every turn as a Claude Code Stop hook (also a CLI and GitHub Action), with an opt-in loop that makes the agent run, screenshot, or test the change and self-fix before finishing. The agent-neutral engine also supports Codex, Gemini, Cursor, OpenCode, and Aider.
```

---

### 2) Plugin/skill mandatory fields (required because it ships as a Claude Code plugin/hook)

**Validate Claims** *(low-friction proof of functionality)*
```
git clone https://github.com/veltiq/groundtruth && cd groundtruth && npm install && npm run build
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git --strict
```
Expected: the canned transcript claims work that was never written, and groundtruth prints three `unsupported` claims with the footer `3 claims · 0 verified · 3 unsupported`. With `--strict` the process exits non-zero (exit code 2); drop `--strict` and the same report prints but exits 0, because the check is non-blocking by default. No API key, no network, no LLM call — the check is deterministic.

**Specific Task(s)**
```
Have Claude write only a README edit, but report in its summary that it also added a `rateLimiter` to `src/server.ts` and added tests. groundtruth (wired as the Stop hook) should flag the unwritten symbol, file, and tests as `unsupported` instead of letting the false summary stand.
```

**Specific Prompt(s)**
```
Add rate limiting to the server and add a test for it.
```
*(Then, when the agent's summary claims a `rateLimiter` symbol, an edit to `src/server.ts`, and a new test that aren't in the diff, groundtruth flags each as `unsupported`. To reproduce deterministically without an agent, use the `verify --transcript examples/phantom-change.jsonl --no-git` command above.)*

**Additional Comments** *(optional)*
```
MIT, zero runtime dependencies, Node >= 20, TypeScript, SLSA build provenance, 141 tests. The claim check makes zero LLM calls and sends no code anywhere — it reads the transcript plus the git diff locally. It biases toward silence: a claim is only flagged "unsupported" when it is concretely checkable and there is zero supporting evidence in the diff. Kill-switch: GROUNDTRUTH_NO_LOOP=1. Install in one command: npx @veltiq/groundtruth setup.
```

---

### 3) Resulting list / CSV entry (what gets added to the repo)

The list is generated from `THE_RESOURCES_TABLE.csv`. The maintainer/bot create the row from the form above; the row that represents this submission is:

```csv
tool-groundtruth,groundtruth,Tooling,Code Analysis & Testing,https://github.com/veltiq/groundtruth,https://www.npmjs.com/package/@veltiq/groundtruth,Veltiq,https://github.com/veltiq,TRUE,2026-05-31,2026-05-31,2026-05-31,MIT,"Reads an AI coding agent's end-of-turn summary, extracts concrete claims (files, symbols, tests, dependencies, commands), and verifies each against the real diff — deterministically, with zero LLM calls — so phantom changes the agent never made are flagged before the work is accepted. Runs every turn as a Claude Code Stop hook (also a CLI and GitHub Action), with an opt-in loop that makes the agent run, screenshot, or test the change and self-fix before finishing.",FALSE,FALSE,,,,
```
*(Columns: `ID,Display Name,Category,Sub-Category,Primary Link,Secondary Link,Author Name,Author Link,Active,Date Added,Last Modified,Last Checked,License,Description,Removed From Origin,Stale,Repo Created,Latest Release,Release Version,Release Source`. The `ID` and the date/release columns are normally assigned by the maintainer's tooling — leave them to the bot; they are shown here only so the row is complete.)*

Rendered list line it produces (Tooling → Code Analysis & Testing section):
```markdown
- [groundtruth](https://github.com/veltiq/groundtruth) by [Veltiq](https://github.com/veltiq) `MIT` — Reads an AI coding agent's end-of-turn summary, extracts concrete claims (files, symbols, tests, dependencies, commands), and verifies each against the real diff — deterministically, with zero LLM calls — so phantom changes the agent never made are flagged before the work is accepted. Runs every turn as a Claude Code Stop hook (also a CLI and GitHub Action), with an opt-in loop that makes the agent run, screenshot, or test the change and self-fix before finishing.
```

---

### 4) PR title and PR body (the bot auto-creates the PR; use these if a manual PR is ever needed)

**PR title**
```
Add groundtruth (Tooling — Code Analysis & Testing)
```

**PR body**
```markdown
## Resource: groundtruth

- **Category:** Tooling → Code Analysis & Testing
- **Primary link:** https://github.com/veltiq/groundtruth
- **Author:** Veltiq (https://github.com/veltiq)
- **License:** MIT

### Description
Reads an AI coding agent's end-of-turn summary, extracts concrete claims (files, symbols, tests, dependencies, commands), and verifies each against the real diff — deterministically, with zero LLM calls — so phantom changes the agent never made are flagged before the work is accepted. Runs every turn as a Claude Code Stop hook (also a CLI and GitHub Action), with an opt-in loop that makes the agent run, screenshot, or test the change and self-fix before finishing. The claim engine is agent-neutral (Codex, Gemini, Cursor, OpenCode, Aider).

### How to validate
```
git clone https://github.com/veltiq/groundtruth && cd groundtruth && npm install && npm run build
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git --strict
```
The canned transcript claims work that was never written; groundtruth prints three `unsupported` claims (`3 claims · 0 verified · 3 unsupported`) and, with `--strict`, exits non-zero (exit code 2). Deterministic, no API key, no network, no LLM call.

### Submission checklist
- [x] Resource is unique and not already listed
- [x] Repo is older than one week (first public commit predates this submission by more than 7 days)
- [x] Links are public and working
- [x] No other open issue from this submitter in the repo
- [x] Submitted by a human
- [x] Description is 1–3 sentences, no emojis, descriptive (not promotional)
- [x] License (MIT) declared and present in the repo
```
