# GitHub Action

Run groundtruth in CI and post the claim verdicts as a sticky comment on every
pull request. Two modes:

- **`pr` (default)** — grades the **PR description** against the PR's diff. Works
  on any PR, no agent integration required.
- **`transcript`** — grades a committed/artifact JSONL transcript against the diff.

## Quick start

```yaml
# .github/workflows/groundtruth.yml
name: groundtruth
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write   # required to post the comment

jobs:
  claim-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0   # needed so base...HEAD can be diffed
      - uses: veltiq/groundtruth@v0.3.0
```

That's it. On each PR, groundtruth extracts the claims in the description and
checks them against the diff, then posts (and updates) a single comment.

## Inputs

| Input | Default | Description |
|---|---|---|
| `mode` | `pr` | `pr` grades the PR description; `transcript` grades a JSONL transcript. |
| `transcript` | `""` | Path to a JSONL transcript (when `mode: transcript`). |
| `base` | PR base SHA | Base ref to diff against (`base...HEAD`). |
| `version` | `latest` | npm version/dist-tag of groundtruth to run. |
| `strict` | `false` | Fail the job if any claim is unsupported (turns it into a merge gate). |
| `comment` | `true` | Post/update the sticky PR comment. |
| `github-token` | `github.token` | Token used to read/post comments. |

## Outputs

| Output | Description |
|---|---|
| `report` | The markdown report. |
| `unsupported` | Count of unsupported claims. |

## Gate merges (opt-in)

Start advisory (comment only). When you trust it, flip on `strict` to block PRs
whose description claims work the diff doesn't contain:

```yaml
      - uses: veltiq/groundtruth@v0.3.0
        with:
          strict: true
```

## Notes

- `fetch-depth: 0` is required — a shallow checkout can't compute `base...HEAD`.
- The comment is posted by the `github-actions` bot and **updated in place** on
  re-runs (it carries a hidden `<!-- groundtruth -->` marker), so PRs never get
  spammed with duplicates.
