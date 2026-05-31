> 7 ready-to-file "good first issue" tickets for [veltiq/groundtruth](https://github.com/veltiq/groundtruth) — _"The human-in-the-loop for AI coding, automated."_
>
> Each is scoped for a first-time contributor and points at real files in the repo. Apply the **`good first issue`** label to all; secondary labels are noted per issue. All paths are repo-relative. Every change must pass `npm run check` (biome + tsc + vitest) and add a test, per [CONTRIBUTING.md](https://github.com/veltiq/groundtruth/blob/main/CONTRIBUTING.md).

---

### 1. Add a `groundtruth doctor` command to diagnose a wired-up install
**Labels:** `good first issue`, `enhancement`

groundtruth is silent by design, so a mis-wired install (wrong settings file, no binary on PATH, no transcripts yet, not a git repo) looks identical to "working but nothing to flag." Add a read-only `doctor` command that prints a green/yellow/red checklist: Node >= 20 (`process.version`), the resolved settings path plus whether our Stop hook is present, `groundtruth` on PATH (else note it'll use the `npx` form), whether cwd is a git repo, which agent transcripts were found (`AGENT_NAMES` + `adapter.locate(cwd)`), and the ledger run-count (`readLedger`). Add `case "doctor":` to the switch in `src/cli.ts`, a line in `printHelp()`, and a `--json` branch mirroring `stats --json`. Reuse existing helpers — no new subsystem, no LLM, no network. Add `src/doctor.test.ts` (vitest + `mkdtempSync` + a `GROUNDTRUTH_LEDGER` override, like `ledger.test.ts`).

**Done when:** `groundtruth doctor` prints the checklist, exits 0 normally / 1 on a hard fail, has a `--json` mode, and is covered by tests plus a README line.

---

### 2. Harden the Aider markdown adapter against multi-file edit blocks
**Labels:** `good first issue`, `accuracy`

`src/adapters/aider.ts` recovers edits from inline `SEARCH/REPLACE` blocks by taking the path from "the nearest preceding non-empty, non-fence line" (`parseSearchReplace`). That heuristic mis-attributes the path when an assistant message contains several blocks for different files, or has prose between the path and the fence. Collect 2-3 real `.aider.chat.history.md` snippets, add them as fixtures, and tighten path recovery (e.g. only accept a preceding line that actually looks like a path). Keep it best-effort — a missed edit is fine, a wrong file path is not. Add positive and negative cases to `src/adapters/adapters.test.ts`.

**Done when:** multi-block assistant turns attribute each edit to the correct file, with tests, and no existing adapter test regresses.

---

### 3. New agent adapter: parse Cline / Roo transcripts into a `Turn`
**Labels:** `good first issue`, `help wanted`, `enhancement`

The claim engine is agent-neutral; adapters just normalize a transcript into a `Turn` (`{ summary, toolUses }`). We ship claude, codex, gemini, cursor, opencode, and aider — Cline (and the Roo fork) are popular VS Code agents we don't cover yet. Add `src/adapters/cline.ts` exporting `parseCline(raw)`, a `locate(cwd)` + `parse` entry in the `ADAPTERS` map in `src/adapters/index.ts`, and re-export it. Document the on-disk transcript location you used. Follow `codex.ts` as the simplest template and add a fixture-backed test in `src/adapters/adapters.test.ts`.

**Done when:** `verify --agent cline` parses a real transcript end-to-end, `autoDetect` can pick it up, and a parsing test covers it.

---

### 4. Claim pattern: recognize "renamed/moved `a` to `b`" file moves
**Labels:** `good first issue`, `accuracy`

Extraction already handles symbol renames (`matchRename` in `src/extract.ts`); file moves like "moved `src/old.ts` to `src/new.ts`" or "renamed the config to `app.config.ts`" aren't reliably caught as `file` claims tied to the new path. Add a small pattern in `src/extract.ts` that emits a `file` claim for the destination path, and verify it in `src/verify.ts` against a touched file (a git rename shows up as the new path). Precision first: only fire on explicit move/rename phrasing, and prefer `review` over a false `unsupported`. Add one positive and one negative case to `src/extract.test.ts`, plus a verdict test in `src/verify.test.ts`.

**Done when:** "moved `x` to `y`" yields a `file` claim for `y` that verifies when `y` was touched, with positive and negative tests and no precision regression in `precision.test.ts`.

---

### 5. Standing false-positive bounty: report a verdict groundtruth got wrong
**Labels:** `good first issue`, `accuracy`, `help wanted`

This is a permanent, no-code-required entry point — accuracy reports are the highest-signal contribution we get. If groundtruth flagged real work as `unsupported` (false positive) or missed a phantom claim (false negative), open a report using the **False positive / false negative** issue form with the assistant's summary text and what actually changed (files/diff/commands). Even better: turn it into a failing case in `src/verify.test.ts` or `src/extract.test.ts` and send a PR. A change that catches more claims but adds a false `unsupported` is a regression, not a feature — so these reports directly protect the tool's core promise.

**Done when:** a reproducible summary + evidence pair is captured (ideally as a failing test) so a fix can be verified against it. Pin this issue.

---

### 6. Translate the README into a new language
**Labels:** `good first issue`, `documentation`

README translations live in `docs/i18n/` as `README.<lang>.md` and follow the process in `CONTRIBUTING.md`. Pick a language we don't have yet, copy an existing `docs/i18n/README.*.md`, translate the prose (keep all code, commands, and flag names exactly as-is — including the tagline phrasing where it's a product term), update the language bar at the top of every i18n file to include yours, and add your language to the bar in the root `README.md`. Translating the concise README is plenty; the full `docs/` stay in English. No build step, no tests — just keep links and code blocks intact.

**Done when:** a new `docs/i18n/README.<lang>.md` exists, every language bar (including the root `README.md`) links to it, and no code/command/flag text was altered in translation.

---

### 7. Print a "run `groundtruth doctor`" pointer after `setup`
**Labels:** `good first issue`, `enhancement`

_(Pairs with issue #1 — pick this up once `doctor` lands.)_ Today `runSetup()` in `src/cli.ts` wires the Stop hook and says "Restart Claude Code," then goes quiet — a new user has no way to confirm it's live. Add one line at the end of `runSetup()` that points them at the diagnostic: `Run groundtruth doctor to confirm it's live.` This closes the onboarding loop in ~5 lines and makes every bug report start with pasteable `doctor` output. Update the setup section of `README.md` to mention the check. Keep the copy honest and concrete — no claims `doctor` can't back up.

**Done when:** `groundtruth setup` ends by suggesting `doctor`, the README mentions it, and the existing setup tests still pass.