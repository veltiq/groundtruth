<p align="center">
  <img src="../../assets/hero.svg" alt="groundtruth" width="820">
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <b>Português</b> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.ar.md">العربية</a>
</p>

# groundtruth

> **Resumo** — Sua IA diz _"Pronto! Adicionei X, corrigi Y, escrevi testes."_ O groundtruth confere cada afirmação contra o diff real e marca as que nunca aconteceram. Um comando: `npx @twarc_net/groundtruth install`.

**Descubra quando seu assistente de IA diz ter feito um trabalho que não fez.**

Seu agente termina um turno com _"Pronto! Adicionei um middleware `rateLimiter` em `src/server.ts`, corrigi o bug de timeout e adicionei testes."_ Você confia no resumo, faz commit e segue. Duas semanas depois a produção quebra — o rate limiter nunca foi escrito. O groundtruth lê o resumo, extrai cada afirmação concreta e a verifica contra o que realmente mudou — a **verdade fundamental** (ground truth).

```text
groundtruth — claim check

  ❌ unsupported  symbol `rateLimiter`
  ❌ unsupported  file src/server.ts
  ❌ unsupported  tests

  3 claims · 0 verified · 3 unsupported
```

> Toda a mudança acima foi uma única edição no README. O groundtruth pegou as três afirmações falsas.

## Por que existe

"Mudanças fantasma" — trabalho que o resumo afirma mas nunca implementa — são o tipo de inconsistência mais comum em agentes de IA. Testes pegam código _errado_; nada pega código que simplesmente _nunca foi escrito_. O princípio é um só: **o diff não mente.**

## Experimente em 30 segundos

```bash
npx @twarc_net/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

## Instalação

Requer Node ≥ 20. Sem instalação global — o hook roda via `npx`.

```bash
# Instale como Stop hook do Claude Code neste projeto
npx @twarc_net/groundtruth install

# …ou para todos os projetos
npx @twarc_net/groundtruth install --global
```

Reinicie o Claude Code (ou rode `/hooks`) e o groundtruth verificará cada turno automaticamente.

## Como funciona

Lê o turno → reúne evidências das chamadas de ferramentas e do diff do git → extrai afirmações do resumo → verifica cada uma e atribui um veredito:

| Veredito | Significado |
|---|---|
| ✅ **verified** | Há evidência concreta sustentando a afirmação. |
| ❌ **unsupported** | A afirmação é verificável e não há **nenhuma** evidência — uma mudança fantasma. |
| ⚠️ **review** | Semântico ou ambíguo (ex.: _"corrigi o bug"_); mostrado para sua atenção, nunca conta como falha. |

Conservador por design: só marca **unsupported** quando a afirmação é claramente verificável e nada a sustenta — prefere omitir a acusar sem fundamento.

## Limitações honestas

Ele verifica que o trabalho afirmado **existe no diff**, não que está **correto** — para isso servem os testes.

## 📖 Documentação completa

A documentação completa está em inglês: [README](../../README.md) · [como funciona](../how-it-works.md) · [design](../design.md)

## Licença

[MIT](../../LICENSE) © youcefzemmar
