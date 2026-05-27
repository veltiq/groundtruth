# Claim types

groundtruth recognizes six kinds of claim. The first four are **concretely
checkable** and can be marked `unsupported`. The last two are deliberately never
treated as failures.

## `file`

> "Updated `src/auth.ts`", "created src/db/client.ts"

Triggered by a backticked path, or a bare token containing a `/`, or a known
dotfile (`.gitignore`, `Dockerfile`, …). Bare `word.ext` tokens are **not**
treated as files, to avoid matching framework names like `Node.js`.

- **verified** — a touched file matches (exact, suffix, or basename).
- **unsupported** — no touched file matches.

## `symbol`

> "Added a `validateInput` function", "removed the `LegacyClient` class"

Triggered by a backticked identifier (call parentheses are stripped:
`parseUser()` → `parseUser`). Identifiers shorter than 2 characters or in a small
stopword list (`it`, `this`, `done`, …) are treated as too generic to check.

- **verified** — the identifier appears in the added code (or removed code, for
  removal claims), matched on word boundaries.
- **unsupported** — it appears nowhere in the turn's changes.
- **review** — wording implied an addition but the identifier only appears in
  removed code.

## `test`

> "Added tests", "updated the test suite"

Triggered by test/spec keywords next to an action verb.

- **verified** — a test file changed (`*.test.*`, `*_test.*`, `tests/`,
  `__tests__/`, `test_*.py`, …) **or** a test command ran (`vitest`, `pytest`,
  `go test`, `npm test`, …).
- **unsupported** — neither happened.

## `dependency`

> "Installed `zod`", "added the `axios` package"

Triggered by install phrasing or `<pm> install <pkg>` patterns.

- **verified** — a manifest changed (`package.json`, `requirements.txt`,
  `Cargo.toml`, …) **or** an install command ran.
- **unsupported** — a specific package was named but neither happened.
- **review** — a generic "dependency" with no detected change.

## `command` (advisory)

> "Ran the build", "ran the tests"

- **verified** — a matching command was recorded via the Bash tool.
- **review** — no matching command found. This stays advisory because commands
  can legitimately run outside the agent's tools.

## `action` (advisory)

> "Fixed the timeout bug", "refactored the helper", "improved performance"

Semantic claims with no machine-checkable subject. Always **review** — groundtruth
surfaces them so you know what it *couldn't* vouch for, but never marks them
failed. Confirming these is what your tests and your own eyes are for.
