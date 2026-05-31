# groundtruth — Go-to-Market Launch Checklist

**Tagline:** _The human-in-the-loop for AI coding — automated._

The order is the point. Polish until the demo is undeniable, soft-launch to age the repo
and gather the first signal, then spend your one big day (Show HN / Product Hunt) when the
funnel is airtight — and follow up while attention is still warm.

**Brand rule (non-negotiable):** groundtruth is an anti-hallucination tool. Every claim in
every post must be truthful — no invented stars/downloads/users, no "trusted by thousands,"
no fabricated benchmarks. Lead with the real pain and real facts: MIT, zero runtime deps,
Node ≥ 20, 141 tests, **zero LLM calls** for the claim check, SLSA provenance, and the one
citable third-party number (MSR '26, arXiv 2601.04886: phantom changes = 45.4% of agent
message-code inconsistencies, the single most common; high-inconsistency PRs see 51.7% lower
acceptance and merge 3.5x slower).

**Legend:** `[ ]` = to do · `[x]` = already done · **(OWNER)** = only the maintainer can do
this (it requires posting under a real human identity, repo admin, or an in-app form — never
automate or delegate these).

---

## Timeline at a glance

| Phase | When | Goal |
|---|---|---|
| **Phase 0 — Repo polish** | Now → launch-day minus 2 | Make the demo undeniable; close every discoverability leak. No posting. |
| **Phase 1 — Soft launch** | Launch-day minus 7 → minus 1 | Age the repo to clear the ≥7-day gates; seed 2–3 build-in-public catches; line up supporters. |
| **Phase 2 — Big day** | A Tuesday–Thursday | Show HN (primary) ± Product Hunt; be present for 48h. |
| **Phase 3 — Follow-ups** | Day +1 → +14 | awesome-claude-code, plugin marketplace, dev.to, Reddit, articles, post-mortem. |

> **Hard date math:** first public commit was **2026-05-27**, so the ≥7-day gates
> (awesome-claude-code submission, community plugin marketplace) clear on/after **2026-06-03**.
> Pick a **Tue–Thu on or after June 3** as the big day. Recommended: **Tue June 9 or Wed June 10**.

---

## Phase 0 — Repo polish (freeze the funnel before anyone arrives)

Do all of this before any public post. The single rule of a launch: never drive traffic to a
page that isn't finished.

### Already done (verified in repo) — do not re-do
- [x] Strong conversion-tuned README with hero, full badge row (npm version, downloads, CI, stars, MIT, 0-deps), and the `npx @veltiq/groundtruth setup` one-liner as the first CTA.
- [x] Two real terminal screenshots (catch vs. clean) in a side-by-side table — load-bearing for npm/email/feed contexts.
- [x] 9-language README i18n (English + 8 translations); well-tuned topics; accurate npm description; MIT license; SLSA provenance (`publishConfig.provenance: true`).
- [x] Discussions enabled; full issue-template set (bug / feature / false_positive / config) + PR template; CODE_OF_CONDUCT, SECURITY, CONTRIBUTING; dependabot.
- [x] 7 tagged releases (v0.1.0 → v0.6.2) with genuine notes; CHANGELOG current.
- [x] Claude Code **plugin manifest** (`.claude-plugin/plugin.json`), **GitHub Action** (`action.yml`, sticky PR comment + PR-description grading), **SARIF** output, **pre-commit** hook (`.pre-commit-hooks.yaml`), `stats --json`, multi-agent adapters (Codex, Gemini, Cursor, OpenCode, Aider).
- [x] `assets/social-card.svg` (1280×640) and `assets/loop-demo.svg` already exist in-repo.

### Highest-leverage gaps — close these first (in priority order)
1. **(OWNER) Upload the custom social preview.** Live OG image is still GitHub's auto-generated
   default (`usesCustomOpenGraphImage: false`) — every HN/X/Reddit/Slack share renders generic.
   Export `assets/social-card.svg` → 1280×640 PNG, upload at **Settings → General → Social preview**.
   _Highest ROI, free, minutes. This is the #1 click-through multiplier; do it before any post._
   - [ ] Done
2. **Record a real terminal demo of the catch.** The README hero (`assets/demo.svg`) is a clean
   animated SVG but stops at the catch. Either (a) extend the hero into the full arc
   (claim → catch → screenshot → fix → re-verify green) — `assets/loop-demo.svg` already shows
   the loop and can seed it — or at minimum (b) record
   `npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git` showing the
   3 red ❌ unsupported claims. A tool people **see catch a lie** beats any prose. _The repo's own
   ROADMAP calls a hero demo of the phantom-change catch "the single highest-leverage gap."_
   - [ ] Done
3. **(OWNER) Make the homepage field add information.** It currently points to the GitHub README
   (`https://github.com/veltiq/groundtruth#readme`) — fine, but it duplicates where most visitors
   already are. Consider repointing it to **https://veltiq.net** (or publish `docs/` via GitHub
   Pages and point there) so the homepage link adds context instead of looping back to the repo.
   - [ ] Done
4. **(OWNER) Open 4–6 scoped `good first issue` tickets** so the Contribute surface isn't empty
   (both existing labeled ones are closed). One per missing/edge-case agent adapter (Aider markdown
   refinement, OpenCode edge cases), a new-claim-pattern ticket, and a standing **"Report a false
   positive (these are gold)"** bounty. Cross-link from CONTRIBUTING.md.
   - [ ] Done
5. **(OWNER) Pin 2–3 issues:** a Roadmap / what's-next tracker, the "Report a false positive"
   thread, and an "Adapters/agents wanted" tracker — so the Issues tab sells the project.
   - [ ] Done

### Pre-flight verification (do not skip — this is an anti-hallucination tool)
- [ ] `npm run check` is green (lint + typecheck + 141 tests pass).
- [ ] `npx @veltiq/groundtruth@latest setup` works from a clean machine/temp dir; the uninstall path works too.
- [ ] `npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git` prints exactly 3 unsupported claims (no signup, no network) — this is the tryable demo for Show HN.
- [ ] Latest npm is **0.6.2** and the version/downloads badges resolve.
- [ ] Every number you plan to post is verifiable today (tests count, deps, the MSR '26 stat with its arXiv id). Delete anything you can't source.

---

## Phase 1 — Soft launch (launch-day minus 7 → minus 1)

Goal: clear the age gates, generate the first honest signal, and prime supporters — without
"launching." Keep self-promo under Reddit's 10% rule throughout.

- [ ] **Freeze the README + demo.** No more churn after this point — momentum dies if the page changes mid-launch.
- [ ] **(OWNER) Run a #buildinpublic cadence on X** (0–2 hashtags max; `#buildinpublic` primary, `#ClaudeCode` situational). 2–3 short build-logs, each = the pain (agents confidently claim work they never did) → a 10–20s screen capture of a flagged `unsupported` claim against the real diff → the one-line install. _Talk about real catches only._
- [ ] **(OWNER) Soft-share in low-friction, share-welcoming spaces** to gather first feedback and catch funnel bugs: **r/SideProject** (`[Launch] groundtruth – <one-liner>`) and the Claude Code Discord/community. Reply to everything fast.
- [ ] **(OWNER) Line up supporters for the big day — notify, never incentivize.** Tell your network when you'll post. PH and HN both penalize solicited/traded upvotes; a simple "I'm launching Tue, here's the link" is the line. Never ask for upvotes.
- [ ] **(OWNER) Pre-write the big-day assets** (see Phase 2 kit) so launch morning is copy-paste only.
- [ ] **Confirm the repo is ≥7 days old** before scheduling awesome-claude-code / plugin-marketplace submissions (clears 2026-06-03).
- [ ] **(OWNER) Self-review for awesome-claude-code:** run its `.claude/commands/evaluate-repository.md` against groundtruth and fix anything it flags, so the eventual submission sails through.

---

## Phase 2 — The big day (a Tuesday–Thursday on/after June 3)

Pick **one** primary channel for the day. **Show HN is the recommended primary** for a free,
open-source, deterministic dev tool (technical audience, no 30-day runway required). Product
Hunt is optional and best run as a *separate* day if you want it, after a ~30-day genuine PH
runway — do **not** split your attention across both in the same 24h unless prepared.

### Pre-open (the night before / 12h out)
- [ ] **Final smoke test:** the tryable command runs with no signup/network; npm install works; social card renders on a test share (paste the repo link into a private Slack/X draft and check the card).
- [ ] **(OWNER) Maker first-comment drafted** (HN) / **maker comment drafted** (PH): the real failure mode → how the deterministic zero-LLM claim check works → what it does **not** do (no false positives, bias toward silence) → the `GROUNDTRUTH_NO_LOOP=1` kill-switch → MIT / zero-deps / SLSA provenance. Honest and technical.

### Show HN (PRIMARY) — **(OWNER)**
- [ ] **Post Tue–Thu, ~7–10am Pacific (14:00–17:00 UTC).**
- [ ] **Title (factual, no superlatives, no "!"):** `Show HN: groundtruth – Catches when an AI coding agent claims work it didn't do (zero LLM calls)`. Avoid best/fastest/first.
- [ ] **Make it tryable with no signup** — link the repo; the demo command is the proof.
- [ ] **Post the substantive maker first comment** immediately after submitting.
- [ ] **Do NOT solicit upvotes or comments** (vote manipulation gets penalized). Just notify your network that it's live.
- [ ] **Be present and reply to every comment fast** for the first few hours and across 48h (most of the star/visibility impact lands in the first 48h).

### Product Hunt (OPTIONAL, separate day) — **(OWNER)**
- [ ] Launch goes live **12:01am PT**; choose **Tue/Wed/Thu** (Mon also strong for dev tools).
- [ ] Assets ready: tagline ≤60 chars, description ≤260 chars, a 45–60s muted auto-play gallery video (1270×760, best feature in first 5s), 5–8 gallery images, 240×240 icon, a 3–5 paragraph honest maker comment, landing page that loads <3s.
- [ ] First 4 hours decide ranking — be present from 12:01am PT; notify (don't incentivize) supporters for the first-2-hour push.

---

## Phase 3 — Follow-ups (Day +1 → +14)

Convert the spike into durable distribution and third-party social proof. Sequence matters:
do the gated submissions first (they have hard rules and lead times), then the content.

### Day +1 to +3
- [ ] **(OWNER) Submit to awesome-claude-code** — **web-UI issue form ONLY**:
      `https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml`.
      **Never open a PR and never use the `gh` CLI — both risk a ban.** Category **Tooling**;
      Primary Link = the GitHub repo; License = MIT; Description = 1–3 plain, non-promotional
      sentences. Fill the 3 mandatory plugin fields: **Validate Claims**, a specific **Task** to
      give Claude, and the exact **Prompt** (e.g. "have Claude claim it added a test, then show
      groundtruth flagging it `unsupported`"). You must have **no other open issue** in that repo.
- [ ] **(OWNER) Submit to the community plugin marketplace** — run `claude plugin validate` locally
      first (the review pipeline runs the same check), then submit at
      **claude.ai/settings/plugins/submit** (or platform.claude.com/plugins/submit). Expect
      SHA-pinning and a nightly-sync delay before it appears in `anthropics/claude-plugins-community`.
      _(The official `claude-plugins-official` marketplace is curated by Anthropic — no application; this form does not add you to it.)_
- [ ] **(OWNER) Publish ONE technical launch article on dev.to** — tags `#showdev` + 3 (e.g. `#ai`, `#claude`, `#opensource`); `canonical_url` → veltiq.net; lead with a GIF of a flagged false claim and the MSR '26 stat. Cross-post to Hashnode with canonical back to your domain.

### Day +3 to +7
- [ ] **(OWNER) Share in r/ClaudeAI** with a demo + at least one sample prompt (use the "Built with Claude" flair if present). Only after you've built genuine comment history; keep self-promo under 10%.
- [ ] **(OWNER) Add the "Mentioned in Awesome Claude Code" badge** to the README once approved (real social proof — your first credible third-party signal).

### Day +7 to +14
- [ ] **(OWNER) Publish the pillar article** — _"Phantom Changes: AI Coding Agents Confidently Report Work They Never Did (and how to catch it)."_ Anchor on the MSR '26 stat (45.4% / 51.7% lower acceptance / 3.5x slower merge, arXiv 2601.04886) with a real groundtruth screenshot catching a phantom claim. Most shareable — it has a number people quote.
- [ ] **(OWNER) Only attempt r/programming** with a genuinely standalone-valuable writeup (e.g. "how we verify AI claims against the git diff deterministically"); expect removal of bare promos.
- [ ] **(OWNER) Post the build-in-public follow-up on X** thanking anyone who featured it; keep posting real catches.

### Truthful social proof to add as it becomes real (never fabricate)
- [ ] Star-history embed — **only once stars actually grow** (premature while the count is tiny).
- [ ] npm-downloads badge already live; add a Trendshift / "as seen in" line **only after** a real listing exists.
- [ ] **Never** add invented stars/downloads/users, "trusted by" logos, or testimonials — that would itself be a phantom, and the brand can't survive one.

---

## Post-launch retro (Day +14)
- [ ] **(OWNER)** Write a short, honest post-mortem: which channel drove installs vs. stars, which copy line converted, and the real numbers. Feed it back into `docs/ROADMAP.md`. Keep every figure verifiable.

---

### Owner-only steps, collected (everything that requires a human identity / repo admin / in-app form)
Repo Social-preview upload · homepage field · open/pin issues · all X / Reddit / Discord / HN / PH posts · maker comments · awesome-claude-code form · plugin-marketplace form · dev.to / Hashnode / article publishing · the retro.
Everything not marked **(OWNER)** — README/demo polish, the asset export source, `npm run check`, smoke tests, badge edits — can be prepared/staged by a contributor or agent, but the **act of posting is always owner-only**.