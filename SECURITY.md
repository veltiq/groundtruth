# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
[private vulnerability reporting](https://github.com/youcefzemmar/groundtruth/security/advisories/new)
rather than opening a public issue. We aim to acknowledge reports within a few
days.

## Threat model notes

groundtruth runs locally and is designed to be conservative about side effects:

- **Reads** Claude Code transcripts and your git working tree; it does not send
  any data over the network.
- **Writes** only when you run `groundtruth install`, and only to a
  `.claude/settings.json` file (project or `~/.claude`). Nothing else is
  modified.
- Has **no runtime dependencies**, minimizing supply-chain surface.
- Runs `git` read-only (`git diff`, `git status`) via `execFile` with fixed
  arguments — no shell interpolation of untrusted input.

If you find a way for a crafted transcript or repository to cause groundtruth to
execute arbitrary code, write outside the intended settings file, or exfiltrate
data, that's a vulnerability — please report it.
