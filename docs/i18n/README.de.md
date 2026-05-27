<p align="center">
  <img src="../../assets/hero.svg" alt="groundtruth" width="820">
</p>

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

# groundtruth

> **Kurz gesagt** — Deine KI sagt _„Fertig! Ich habe X hinzugefügt, Y behoben, Tests geschrieben."_ groundtruth prüft jede Behauptung gegen den echten Diff und markiert die, die nie passiert sind. Ein Befehl: `npx @twarc_net/groundtruth install`.

**Erkenne, wenn dein KI-Coding-Assistent behauptet, Arbeit erledigt zu haben, die er nie gemacht hat.**

Dein Agent beendet einen Zug mit _„Fertig! Ich habe eine `rateLimiter`-Middleware in `src/server.ts` ergänzt, den Timeout-Bug behoben und Tests hinzugefügt."_ Du vertraust der Zusammenfassung, committest und machst weiter. Zwei Wochen später bricht die Produktion zusammen — der Rate Limiter wurde nie geschrieben. groundtruth liest die Zusammenfassung, extrahiert jede konkrete Behauptung und prüft sie gegen das, was sich tatsächlich geändert hat — die **Grundwahrheit** (ground truth).

```text
groundtruth — claim check

  ❌ unsupported  symbol `rateLimiter`
  ❌ unsupported  file src/server.ts
  ❌ unsupported  tests

  3 claims · 0 verified · 3 unsupported
```

> Die gesamte Änderung oben war eine einzige README-Bearbeitung. groundtruth hat alle drei falschen Behauptungen erkannt.

## Warum es das gibt

„Phantom-Änderungen" — Arbeit, die die Zusammenfassung behauptet, aber nie umsetzt — sind die häufigste Inkonsistenz bei KI-Agenten. Tests finden _falschen_ Code; nichts findet Code, der schlicht _nie geschrieben_ wurde. Das Prinzip ist eines: **der Diff lügt nicht.**

## In 30 Sekunden ausprobieren

```bash
npx @twarc_net/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

## Installation

Erfordert Node ≥ 20. Keine globale Installation nötig — der Hook läuft über `npx`.

```bash
# Als Stop-Hook von Claude Code für dieses Projekt installieren
npx @twarc_net/groundtruth install

# …oder für alle Projekte
npx @twarc_net/groundtruth install --global
```

Starte Claude Code neu (oder führe `/hooks` aus), und groundtruth prüft jeden Zug automatisch.

## Funktionsweise

Liest den Zug → sammelt Belege aus Tool-Aufrufen und dem git-Diff → extrahiert Behauptungen aus der Zusammenfassung → prüft jede und vergibt ein Urteil:

| Urteil | Bedeutung |
|---|---|
| ✅ **verified** | Konkrete Belege stützen die Behauptung. |
| ❌ **unsupported** | Die Behauptung ist prüfbar und **kein** Beleg stützt sie — eine Phantom-Änderung. |
| ⚠️ **review** | Semantisch oder mehrdeutig (z. B. _„Bug behoben"_); nur zur Info, nie als Fehler gewertet. |

Konservativ ausgelegt: **unsupported** nur, wenn eine Behauptung klar prüfbar ist und nichts sie stützt — lieber auslassen als falsch beschuldigen.

## Ehrliche Grenzen

Es prüft, ob die behauptete Arbeit **im Diff existiert**, nicht ob sie **korrekt** ist — dafür sind Tests da.

## 📖 Vollständige Dokumentation

Die vollständige Dokumentation ist auf Englisch: [README](../../README.md) · [Funktionsweise](../how-it-works.md) · [Design](../design.md)

## Lizenz

[MIT](../../LICENSE) © youcefzemmar
