<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <b>Français</b> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <img src="../../assets/demo.svg" alt="groundtruth — the human-in-the-loop for AI coding" width="820">
</p>

<h1 align="center">groundtruth</h1>

<p align="center">
  <b>Le superviseur humain du développement assisté par IA — automatisé.</b><br>
  Détectez quand votre agent IA ment, laisse des coquilles ou omet du travail — puis obligez-le à prouver ce qu'il a fait avant de déclarer « terminé ».
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

Votre agent déclare _« Terminé ! J'ai ajouté un `rateLimiter` dans `src/server.ts`, corrigé le timeout et ajouté des tests. »_ Vous commitez et passez à autre chose. Deux semaines plus tard, la production plante — le rate limiter n'a jamais été écrit. **Le résumé mentait, et rien ne l'a confronté au diff.**

`groundtruth` est le relecteur qui le fait, à **chaque** tour — de façon déterministe, avec **zéro appel LLM** pour la vérification :

<table>
<tr>
<td width="50%" valign="top">

**Quand le résumé ment** — chaque affirmation ici est un fantôme (tout le « codebase » n'était qu'une édition du README) :

<img src="../../assets/screenshot-catch.png" alt="groundtruth signale trois affirmations que le diff ne confirme pas" width="100%">

</td>
<td width="50%" valign="top">

**Quand il est honnête** — le même type de résumé, chaque affirmation appuyée par le vrai diff :

<img src="../../assets/screenshot-verified.png" alt="groundtruth vérifie quatre affirmations honnêtes contre le diff" width="100%">

</td>
</tr>
</table>

## Pourquoi

Livrés à eux-mêmes, les agents IA rapportent avec assurance des travaux qu'ils n'ont jamais effectués — les recherches sur les PR agentiques montrent que ces **« modifications fantômes » sont l'incohérence la plus fréquente.** Les tests détectent du code _incorrect_ ; rien ne détecte du code simplement _jamais écrit_ mais déclaré comme fait. C'est ce manque — et plus les agents codent vite, plus il s'élargit.

groundtruth le comble en deux étapes :

1. **Vérifier les affirmations.** Il lit le résumé de fin de tour de l'agent, extrait chaque affirmation concrète et la note contre la **vérité terrain** — quels fichiers ont changé, quels symboles apparaissent dans le diff, si des tests ou des installations ont vraiment eu lieu. Une seule règle : _le diff ne ment pas._
2. **Obliger l'agent à prouver que ça fonctionne** _(opt-in [boucle de vérification](../verify-loop.md))._ Avant de terminer, l'agent doit exécuter / **capturer** / tester la modification par rapport à votre demande initiale, traquer ses propres erreurs, corriger et revérifier jusqu'à ce que ça tienne.

→ une sortie de meilleure qualité que vous n'avez pas à surveiller.

## Installation

Nécessite Node ≥ 20. Une seule commande configure le hook Stop + la boucle de vérification + la ligne de statut, de façon idempotente :

```bash
npx @veltiq/groundtruth setup
```

Redémarrez Claude Code (ou exécutez `/hooks`) et la vérification se fait automatiquement à chaque tour.

<details>
<summary>Essayer en 30 secondes · installation manuelle · plugin</summary>

```bash
# Voir la détection d'une modification fantôme sur une transcript en boîte — sans install ni config :
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# Vérifier la session en cours sans rien installer :
npx @veltiq/groundtruth verify

# Uniquement le hook de vérification des affirmations (sans boucle), ce projet ou globalement :
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

Vous préférez les plugins ?

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

> La boucle ne peut jamais vous bloquer : un plafond de tours par session permet toujours à un tour de se terminer, et `GROUNDTRUTH_NO_LOOP=1` la suspend instantanément.

## Fonctionnement

```text
transcript ─▶ Tour ─▶ ( Preuves + Affirmations ) ─▶ Verdicts ─▶ Rapport
            résumé       diff        prose         par affirmation
            + outils   vérité terrain  analyse          vérification
```

| Verdict | Signification |
|---|---|
| ✅ **verified** | Une preuve concrète dans le diff appuie l'affirmation. |
| ❌ **unsupported** | Vérifiable concrètement et **zéro** preuve correspondante — une modification fantôme. |
| ⚠️ **review** | Vague ou sémantique (_« corrigé le bug »_) — signalé pour attention, **jamais** un échec. |

**Un biais délibéré vers le silence :** les fausses alertes font désinstaller un tel outil, donc une affirmation n'est `unsupported` que si elle est sans ambiguïté vérifiable et rien ne la confirme. Tout ce qui est flou devient `review`. Il préfère rater une affirmation plutôt qu'accuser à tort une affirmation correcte. → [`docs/how-it-works.md`](../how-it-works.md) · [`docs/design.md`](../design.md)

## Boucle de vérification — obliger l'agent à prouver (opt-in)

<p align="center">
  <img src="../../assets/loop-demo.svg" alt="La boucle capture une page, détecte un bouton invisible, le corrige et revérifie — sans intervention humaine" width="760">
</p>

La vérification des affirmations note les _mots_ d'un tour ; la boucle note son _comportement_. Activée (`setup` l'active, ou `GROUNDTRUTH_LOOP=1`), un tour ayant modifié quelque chose est retenu à l'événement Stop et l'agent doit vérifier selon le **type de travail** — ouvrir la page dans un navigateur et lire une capture d'écran (web), exécuter la commande (CLI), appeler l'endpoint (API), lancer les tests (bibliothèque) — vérifier contre votre **demande originale**, corriger les erreurs, et ne terminer qu'une fois que ça passe. Elle ne juge jamais le travail lui-même (pas de faux positifs) et un plafond de tours empêche toute boucle infinie. → [`docs/verify-loop.md`](../verify-loop.md)

## Pour aller plus loin

<details>
<summary><b>Utilisation CLI & options</b></summary>

```bash
groundtruth verify                       # vérifier la dernière session de ce projet
groundtruth verify --transcript x.jsonl  # une transcript spécifique
groundtruth verify --markdown            # markdown (idéal en commentaire de PR)
groundtruth verify --json | --sarif      # lisible par machine / analyse de code GitHub
groundtruth verify --strict              # sortie non nulle si quoi que ce soit est non étayé
groundtruth stats [--all]                # comptage local : verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

Par défaut, le hook est **non bloquant** — il affiche un rapport et s'efface. `--strict` (ou `GROUNDTRUTH_STRICT=1`) le rend bloquant sur les affirmations non étayées.

</details>

<details>
<summary><b>Ce qu'il vérifie</b></summary>

| Affirmation | Exemple | Vérifié quand… |
|---|---|---|
| **fichier** | _« mis à jour `src/auth.ts` »_ | ce fichier a été touché ce tour |
| **symbole** | _« ajouté `validateInput` »_ | l'identifiant apparaît dans le code ajouté/supprimé |
| **test** | _« ajouté des tests »_ | un fichier de test a changé ou une commande de test a été exécutée |
| **dépendance** | _« installé `zod` »_ | un manifeste a changé ou une commande d'installation a été exécutée |
| **commande** | _« lancé le build »_ | une commande correspondante a été exécutée via Bash (indicatif) |
| **action** | _« corrigé le bug de timeout »_ | non vérifiable par machine → signalé pour review |

Détails complets dans [`docs/claim-types.md`](../claim-types.md).

</details>

<details>
<summary><b>Utilisation en CI · messages de commit · pre-commit</b></summary>

Noter une **description de PR contre son diff** sous forme de commentaire persistant (fonctionne sur toute PR, sans configuration d'agent) :

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
      - uses: veltiq/groundtruth@v0.6.1   # ajoutez  with: { strict: true }  pour bloquer les merges
```

Vérifier un message de commit contre le diff stagé — à déposer dans `.git/hooks/commit-msg`, ou via [pre-commit](https://pre-commit.com) :

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
<summary><b>Autres agents · configuration · API bibliothèque</b></summary>

`verify` lit aussi les transcripts d'autres agents — le moteur d'affirmations est agnostique :

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

Fichier `.groundtruthrc.json` optionnel (ou une clé `"groundtruth"` dans package.json) :

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

`ignore` est votre échappatoire pour tout faux positif. Utilisation comme bibliothèque :

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>Confidentialité & limites honnêtes</b></summary>

- **Fonctionne entièrement en local.** Lit votre transcript et `git`, n'écrit rien sauf lors d'un `install`. Zéro appel réseau, zéro dépendance d'exécution. Le comptage local (`~/.groundtruth/ledger.jsonl`) stocke des compteurs uniquement — jamais du code ni des prompts.
- Il vérifie que le travail déclaré **existe dans le diff**, pas qu'il est **correct** — c'est le rôle des tests (et de la boucle de vérification).
- L'extraction privilégie la précision au rappel : elle rate les affirmations vagues plutôt que de risquer une fausse accusation.

</details>

## Contribution

Issues et PRs bienvenues — surtout de nouveaux patterns d'affirmations, des adaptateurs d'agents, et des rapports de faux positifs (ceux-là sont en or). Voir [CONTRIBUTING.md](../../CONTRIBUTING.md).

Si groundtruth attrape votre agent en flagrant délit de mensonge, une ⭐ aide d'autres à le trouver.

## Licence

[MIT](../../LICENSE) © [Veltiq](https://veltiq.net)
