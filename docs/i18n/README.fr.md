<p align="center">
  <img src="../../assets/hero.svg" alt="groundtruth" width="820">
</p>

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

# groundtruth

> **En bref** — Votre IA dit _« Terminé ! J'ai ajouté X, corrigé Y, écrit des tests. »_ groundtruth vérifie chaque affirmation par rapport au diff réel et signale celles qui n'ont jamais eu lieu. Une commande : `npx @twarc_net/groundtruth install`.

**Détectez quand votre assistant de code IA prétend avoir fait un travail qu'il n'a pas fait.**

Votre agent termine un tour par _« Terminé ! J'ai ajouté un middleware `rateLimiter` dans `src/server.ts`, corrigé le bug de timeout et ajouté des tests. »_ Vous faites confiance au résumé, vous committez, vous passez à autre chose. Deux semaines plus tard, la production casse — le rate limiter n'a jamais été écrit. groundtruth lit le résumé, en extrait chaque affirmation concrète et la vérifie face à ce qui a réellement changé — la **vérité terrain** (ground truth).

```text
groundtruth — claim check

  ❌ unsupported  symbol `rateLimiter`
  ❌ unsupported  file src/server.ts
  ❌ unsupported  tests

  3 claims · 0 verified · 3 unsupported
```

> Tout le changement ci-dessus n'était qu'une seule modification du README. groundtruth a repéré les trois fausses affirmations.

## Pourquoi cet outil

Les « changements fantômes » — du travail que le résumé affirme mais n'implémente jamais — sont le type d'incohérence le plus fréquent chez les agents IA. Les tests détectent le code _faux_ ; rien ne détecte le code qui n'a tout simplement _jamais été écrit_. Le principe est unique : **le diff ne ment pas.**

## Essayez en 30 secondes

```bash
npx @twarc_net/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

## Installation

Nécessite Node ≥ 20. Aucune installation globale — le hook s'exécute via `npx`.

```bash
# Installer comme Stop hook de Claude Code pour ce projet
npx @twarc_net/groundtruth install

# …ou pour tous les projets
npx @twarc_net/groundtruth install --global
```

Redémarrez Claude Code (ou lancez `/hooks`) et groundtruth vérifiera chaque tour automatiquement.

## Fonctionnement

Lit le tour → rassemble les preuves depuis les appels d'outils et le diff git → extrait les affirmations du résumé → vérifie chacune et attribue un verdict :

| Verdict | Signification |
|---|---|
| ✅ **verified** | Une preuve concrète appuie l'affirmation. |
| ❌ **unsupported** | L'affirmation est vérifiable et **aucune** preuve ne l'appuie — un changement fantôme. |
| ⚠️ **review** | Sémantique ou ambigu (ex. _« corrigé le bug »_) ; affiché pour information, jamais compté comme échec. |

Conservateur par conception : il ne marque **unsupported** que lorsqu'une affirmation est clairement vérifiable et que rien ne l'appuie — il préfère ignorer plutôt qu'accuser à tort.

## Limites assumées

Il vérifie que le travail annoncé **existe dans le diff**, pas qu'il est **correct** — c'est le rôle des tests.

## 📖 Documentation complète

La documentation complète est en anglais : [README](../../README.md) · [fonctionnement](../how-it-works.md) · [conception](../design.md)

## Licence

[MIT](../../LICENSE) © youcefzemmar
