<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.fr.md">Français</a> ·
  <b>Deutsch</b> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <img src="../../assets/demo.svg" alt="groundtruth — the human-in-the-loop for AI coding" width="820">
</p>

<h1 align="center">groundtruth</h1>

<p align="center">
  <b>Der Human-in-the-Loop für KI-gestütztes Coden — automatisiert.</b><br>
  Erkennt, wenn dein KI-Agent lügt, Tippfehler hinterlässt oder Arbeit überspringt — und zwingt ihn, die erledigte Arbeit zu beweisen, bevor er „fertig" sagt.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@veltiq/groundtruth"><img src="https://img.shields.io/npm/v/@veltiq/groundtruth?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@veltiq/groundtruth"><img src="https://img.shields.io/npm/dm/@veltiq/groundtruth?color=cb3837&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/veltiq/groundtruth/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/veltiq/groundtruth/ci.yml?branch=main&label=CI" alt="CI"></a>
  <a href="https://github.com/veltiq/groundtruth/stargazers"><img src="https://img.shields.io/github/stars/veltiq/groundtruth?style=flat&color=f5c518" alt="GitHub stars"></a>
  <img src="https://img.shields.io/npm/l/@veltiq/groundtruth?color=blue" alt="MIT license">
  <img src="https://img.shields.io/badge/runtime%20deps-0-3fb950" alt="Zero runtime dependencies">
</p>

```bash
npx @veltiq/groundtruth setup
```

---

Dein Agent sagt _„Fertig! Ich habe einen `rateLimiter` in `src/server.ts` hinzugefügt, den Timeout gefixt und Tests geschrieben."_ Du committest und machst weiter. Zwei Wochen später bricht Production ein — der Rate-Limiter wurde nie geschrieben. **Die Zusammenfassung hat gelogen, und niemand hat sie gegen den Diff geprüft.**

`groundtruth` ist der Reviewer, der das tut — bei **jedem** Turn, deterministisch, ohne **einen einzigen LLM-Aufruf** für den Check:

<table>
<tr>
<td width="50%" valign="top">

**Wenn die Zusammenfassung lügt** — jede Behauptung hier ist ein Phantom (die ganze „Codebase" war eine einzige README-Änderung):

<img src="../../assets/screenshot-catch.png" alt="groundtruth flags three claims the diff doesn't support" width="100%">

</td>
<td width="50%" valign="top">

**Wenn sie ehrlich ist** — die gleiche Art von Zusammenfassung, jede Behauptung durch den echten Diff belegt:

<img src="../../assets/screenshot-verified.png" alt="groundtruth verifies four honest claims against the diff" width="100%">

</td>
</tr>
</table>

## Warum

Ohne Aufsicht melden KI-Agenten selbstbewusst Arbeit, die sie nie erledigt haben — Forschung zu agentischen PRs zeigt, dass diese **„Phantom-Änderungen" die häufigste Art von Inkonsistenz sind.** Tests fangen Code, der _falsch_ ist; nichts fängt Code, der schlicht _nie geschrieben_ wurde, aber als erledigt gemeldet wurde. Das ist die Lücke — und je schneller Agenten coden, desto mehr rutscht durch.

groundtruth schließt diese Lücke in zwei Stufen:

1. **Behauptungen prüfen.** Es liest die End-of-Turn-Zusammenfassung des Agents, extrahiert jede konkrete Behauptung und bewertet sie gegen die **Ground Truth** — welche Dateien geändert wurden, welche Symbole im Diff erscheinen, ob Tests oder Installs tatsächlich liefen. Aufgebaut auf einer Regel: _Der Diff lügt nicht._
2. **Den Agenten beweisen lassen, dass es funktioniert** _(opt-in [verify loop](../verify-loop.md))._ Vor dem Abschluss muss der Agent die Änderung ausführen / **screenshotten** / testen, gegen deine ursprüngliche Anfrage abgleichen, eigene Fehler suchen und nachbessern, bis es standhält.

→ Höhere Output-Qualität, ohne ständig hinschauen zu müssen.

## Installation

Erfordert Node ≥ 20. Ein einziger Befehl richtet den Stop-Hook, den Verify-Loop und die Statuszeile idempotent ein:

```bash
npx @veltiq/groundtruth setup
```

Starte Claude Code neu (oder führe `/hooks` aus) — ab dann wird jeder Turn automatisch geprüft.

<details>
<summary>In 30 Sekunden ausprobieren · manuelle Installation · Plugin</summary>

```bash
# Phantom-Änderung gegen ein vorgefertigtes Transcript erkennen — kein Install, keine Config:
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# Aktuelle Session prüfen ohne irgendetwas zu installieren:
npx @veltiq/groundtruth verify

# Nur den Claim-Check-Hook (kein Loop), für dieses Projekt oder global:
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

Lieber Plugins?

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

> Der Loop kann dich nie einsperren: ein Rundendeckel pro Session lässt jeden Turn immer abschließen, und `GROUNDTRUTH_NO_LOOP=1` pausiert ihn sofort.

## Wie es funktioniert

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary       diff      prose       per-claim
            + tools    ground truth  parse        check
```

| Verdict | Bedeutung |
|---|---|
| ✅ **verified** | Konkrete Belege im Diff stützen die Behauptung. |
| ❌ **unsupported** | Konkret prüfbar und **null** passende Belege — eine Phantom-Änderung. |
| ⚠️ **review** | Vage oder semantisch (_„den Bug gefixt"_) — zur Aufmerksamkeit angezeigt, **niemals** ein Fehler. |

**Eine bewusste Neigung zur Stille:** Fehlalarme sorgen dafür, dass ein Tool wie dieses deinstalliert wird. Eine Behauptung wird nur als `unsupported` markiert, wenn sie eindeutig prüfbar ist und nichts sie stützt. Alles Unklare wird `review`. Es verpasst lieber eine Behauptung, als eine korrekte fälschlich anzuklagen. → [`docs/how-it-works.md`](../how-it-works.md) · [`docs/design.md`](../design.md)

## Verify Loop — den Agenten beweisen lassen (opt-in)

<p align="center">
  <img src="../../assets/loop-demo.svg" alt="The loop screenshots a page, catches an invisible button, fixes it, and re-verifies — no human needed" width="760">
</p>

Der Claim-Check bewertet die _Worte_ eines Turns; der Loop bewertet sein _Verhalten_. Mit aktiviertem Loop (`setup` aktiviert ihn, oder `GROUNDTRUTH_LOOP=1`) wird ein Turn, der etwas geändert hat, beim Stop-Event angehalten — der Agent muss die Änderung dann **der Art der Arbeit entsprechend** verifizieren: die Seite im Browser öffnen und einen Screenshot auswerten (Web), den Befehl ausführen (CLI), den Endpoint aufrufen (API), die Tests laufen lassen (Library) — dann gegen deine **ursprüngliche Anfrage** prüfen, Fehler beheben und erst abschließen, wenn es hält. Er beurteilt die Arbeit selbst nicht (keine eigenen False Positives), und ein Rundendeckel verhindert endlose Schleifen. → [`docs/verify-loop.md`](../verify-loop.md)

## Mehr

<details>
<summary><b>CLI-Nutzung & Flags</b></summary>

```bash
groundtruth verify                       # aktuelle Session für dieses Projekt prüfen
groundtruth verify --transcript x.jsonl  # ein bestimmtes Transcript
groundtruth verify --markdown            # Markdown-Ausgabe (toll als PR-Kommentar)
groundtruth verify --json | --sarif      # maschinenlesbar / GitHub Code Scanning
groundtruth verify --strict              # Exit non-zero bei unsupported-Behauptungen
groundtruth stats [--all]                # lokale Zählung: verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

Standardmäßig ist der Hook **nicht-blockierend** — er gibt einen Bericht aus und tritt zur Seite. `--strict` (oder `GROUNDTRUTH_STRICT=1`) lässt ihn bei unsupported-Behauptungen blockieren.

</details>

<details>
<summary><b>Was geprüft wird</b></summary>

| Behauptung | Beispiel | Verifiziert wenn… |
|---|---|---|
| **file** | _„`src/auth.ts` aktualisiert"_ | diese Datei in diesem Turn angefasst wurde |
| **symbol** | _„`validateInput` hinzugefügt"_ | der Bezeichner im hinzugefügten/entfernten Code erscheint |
| **test** | _„Tests hinzugefügt"_ | eine Test-Datei geändert wurde oder ein Test-Befehl lief |
| **dependency** | _„`zod` installiert"_ | ein Manifest geändert wurde oder ein Install-Befehl lief |
| **command** | _„den Build ausgeführt"_ | ein passender Befehl via Bash lief (hinweisend) |
| **action** | _„den Timeout-Bug gefixt"_ | nicht maschinell prüfbar → zur Überprüfung markiert |

Vollständige Details in [`docs/claim-types.md`](../claim-types.md).

</details>

<details>
<summary><b>In CI · Commit-Messages · Pre-Commit verwenden</b></summary>

**PR-Beschreibung gegen ihren Diff** als haftender Kommentar bewerten (funktioniert bei jedem PR, kein Agent-Setup nötig):

```yaml
# .github/workflows/groundtruth.yml
name: groundtruth
on: pull_request
permissions: { contents: read, pull-requests: write }
jobs:
  claim-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { fetch-depth: 0 }
      - uses: veltiq/groundtruth@v0.6.1   # mit  with: { strict: true }  Merges sperren
```

Commit-Message gegen den gestageten Diff prüfen — in `.git/hooks/commit-msg` ablegen, oder via [pre-commit](https://pre-commit.com):

```yaml
repos:
  - repo: https://github.com/veltiq/groundtruth
    rev: v0.6.1
    hooks:
      - id: groundtruth
```

→ [docs/github-action.md](../github-action.md)

</details>

<details>
<summary><b>Andere Agenten · Konfiguration · Library-API</b></summary>

`verify` liest auch Transcripts anderer Agenten — die Claim-Engine ist agent-neutral:

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

Optionale `.groundtruthrc.json` (oder ein `"groundtruth"`-Schlüssel in package.json):

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

`ignore` ist dein Fluchtweg für jeden False Positive. Als Library verwenden:

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>Datenschutz & ehrliche Einschränkungen</b></summary>

- **Läuft vollständig lokal.** Liest dein Transcript und `git`, schreibt nichts außer bei `install`. Keine Netzwerkaufrufe, keine Runtime-Deps. Das lokale Tally (`~/.groundtruth/ledger.jsonl`) speichert nur Zählungen — niemals Code oder Prompts.
- Es verifiziert, ob behauptete Arbeit **im Diff existiert**, nicht ob sie **korrekt** ist — dafür sind Tests (und der Verify-Loop) zuständig.
- Die Extraktion bevorzugt Präzision vor Vollständigkeit: lieber eine vage Behauptung verpassen als riskieren, eine falsche Anschuldigung zu machen.

</details>

## Mitmachen

Issues und PRs willkommen — besonders neue Claim-Muster, Agent-Adapter und False-Positive-Meldungen (die sind Gold wert). Siehe [CONTRIBUTING.md](../../CONTRIBUTING.md).

Falls groundtruth deinen Agenten jemals beim Lügen erwischt, hilft ein ⭐ anderen, es zu finden.

## Lizenz

[MIT](../../LICENSE) © [Veltiq](https://veltiq.net)
