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

<p align="center">
  <img src="../../assets/demo.svg" alt="groundtruth — the human-in-the-loop for AI coding" width="820">
</p>

<h1 align="center">groundtruth</h1>

<p align="center">
  <b>O humano no loop da programação com IA — automatizado.</b><br>
  Detecte quando seu agente de IA mente, deixa typos ou pula etapas — e faça-o provar o trabalho antes de dizer "pronto".
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

Seu agente diz _"Pronto! Adicionei um `rateLimiter` em `src/server.ts`, corrigi o timeout e escrevi os testes."_ Você commita e segue em frente. Duas semanas depois a produção cai — o rate limiter nunca foi escrito. **O resumo mentiu, e nada o confrontou com o diff.**

`groundtruth` é o revisor que faz isso em **cada** turno — deterministicamente, com **zero chamadas a LLMs** para a verificação:

<table>
<tr>
<td width="50%" valign="top">

**Quando o resumo mente** — cada afirmação aqui é um fantasma (toda a "codebase" foi uma edição no README):

<img src="../../assets/screenshot-catch.png" alt="groundtruth flags three claims the diff doesn't support" width="100%">

</td>
<td width="50%" valign="top">

**Quando é honesto** — o mesmo tipo de resumo, cada afirmação respaldada pelo diff real:

<img src="../../assets/screenshot-verified.png" alt="groundtruth verifies four honest claims against the diff" width="100%">

</td>
</tr>
</table>

## Por que

Sem supervisão, agentes de IA reportam com confiança trabalhos que nunca realizaram — pesquisas sobre PRs agênticos constataram que essas **"mudanças fantasmas" são a inconsistência mais comum.** Testes detectam código _errado_; nada detecta código que simplesmente _nunca foi escrito_ mas foi reportado como feito. Essa é a lacuna — e quanto mais rápido os agentes codificam, mais escapa.

groundtruth fecha essa lacuna em duas etapas:

1. **Verifica as afirmações.** Lê o resumo do agente ao fim do turno, extrai cada afirmação concreta e a avalia contra a **verdade dos fatos** — quais arquivos foram alterados, quais símbolos aparecem no diff, se testes ou instalações realmente rodaram. Baseado em uma única regra: _o diff não mente._
2. **Faz o agente provar que funciona** _(opcional: [verify loop](../verify-loop.md))._ Antes de concluir, o agente deve executar / **fazer screenshot** / testar a mudança contra sua solicitação original, procurar seus próprios erros e corrigir-e-reverificar até que tudo se sustente.

→ saída de maior qualidade que você não precisa babysitar.

## Instalação

Requer Node ≥ 20. Um único comando conecta o hook Stop + verify loop + linha de status, de forma idempotente:

```bash
npx @veltiq/groundtruth setup
```

Reinicie o Claude Code (ou execute `/hooks`) e ele verificará cada turno automaticamente.

<details>
<summary>Experimente em 30 segundos · instalação manual · plugin</summary>

```bash
# Veja-o detectar uma mudança fantasma em um transcript fixo — sem instalar nem configurar:
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# Verifique a sessão atual sem instalar nada:
npx @veltiq/groundtruth verify

# Somente o hook de verificação de afirmações (sem loop), neste projeto ou globalmente:
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

Prefere plugins?

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

> O loop nunca pode te prender: um limite de rodadas por sessão sempre permite que um turno termine, e `GROUNDTRUTH_NO_LOOP=1` o pausa instantaneamente.

## Como funciona

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary       diff      prose       per-claim
            + tools    ground truth  parse        check
```

| Veredito | Significado |
|---|---|
| ✅ **verified** | Evidência concreta no diff sustenta a afirmação. |
| ❌ **unsupported** | Verificável concretamente e **nenhuma** evidência correspondente — uma mudança fantasma. |
| ⚠️ **review** | Vaga ou semântica (_"corrigiu o bug"_) — exibida para atenção, **nunca** uma falha. |

**Um viés deliberado pelo silêncio:** falsos alarmes fazem ferramentas como esta serem desinstaladas, então uma afirmação só é marcada como `unsupported` quando é inequivocamente verificável e nada a suporta. Tudo que é ambíguo vira `review`. Prefere perder uma afirmação a acusar erroneamente uma correta. → [`docs/how-it-works.md`](../how-it-works.md) · [`docs/design.md`](../design.md)

## Verify loop — faça o agente provar (opcional)

<p align="center">
  <img src="../../assets/loop-demo.svg" alt="The loop screenshots a page, catches an invisible button, fixes it, and re-verifies — no human needed" width="760">
</p>

A verificação de afirmações avalia as _palavras_ de um turno; o loop avalia seu _comportamento_. Com ele ativo (`setup` o habilita, ou `GROUNDTRUTH_LOOP=1`), um turno que alterou algo é retido no evento Stop e o agente deve verificar conforme o **tipo de trabalho** — abrir a página no navegador e ler um screenshot (web), rodar o comando (CLI), chamar o endpoint (API), executar os testes (biblioteca) — checar contra sua **solicitação original**, corrigir erros e só concluir quando passar. Ele nunca julga o trabalho em si (sem falsos positivos próprios) e um limite de rodadas garante que não entre em loop infinito. → [`docs/verify-loop.md`](../verify-loop.md)

## Mais

<details>
<summary><b>Uso da CLI e flags</b></summary>

```bash
groundtruth verify                       # verifica a sessão mais recente deste projeto
groundtruth verify --transcript x.jsonl  # um transcript específico
groundtruth verify --markdown            # markdown (ótimo como comentário de PR)
groundtruth verify --json | --sarif      # legível por máquina / GitHub code scanning
groundtruth verify --strict              # sai com código não-zero se algo for unsupported
groundtruth stats [--all]                # contagem local: verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

Por padrão o hook é **não-bloqueante** — imprime um relatório e sai do caminho. `--strict` (ou `GROUNDTRUTH_STRICT=1`) faz com que bloqueie em afirmações sem suporte.

</details>

<details>
<summary><b>O que ele verifica</b></summary>

| Afirmação | Exemplo | Verificado quando… |
|---|---|---|
| **file** | _"atualizou `src/auth.ts`"_ | esse arquivo foi tocado neste turno |
| **symbol** | _"adicionou `validateInput`"_ | o identificador aparece no código adicionado/removido |
| **test** | _"adicionou testes"_ | um arquivo de teste mudou ou um comando de teste rodou |
| **dependency** | _"instalou `zod`"_ | um manifesto mudou ou um comando de instalação rodou |
| **command** | _"rodou o build"_ | um comando correspondente rodou via Bash (informativo) |
| **action** | _"corrigiu o bug de timeout"_ | não verificável por máquina → marcado para revisão |

Detalhes completos em [`docs/claim-types.md`](../claim-types.md).

</details>

<details>
<summary><b>Uso em CI · commit messages · pre-commit</b></summary>

Avalie uma **descrição de PR contra seu diff** como um comentário fixo (funciona em qualquer PR, sem configuração de agente):

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
      - uses: veltiq/groundtruth@v0.6.1   # adicione  with: { strict: true }  para bloquear merges
```

Verifique uma commit message contra o diff staged — adicione em `.git/hooks/commit-msg`, ou via [pre-commit](https://pre-commit.com):

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
<summary><b>Outros agentes · configuração · API de biblioteca</b></summary>

`verify` também lê transcritos de outros agentes — o motor de afirmações é neutro ao agente:

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

`.groundtruthrc.json` opcional (ou chave `"groundtruth"` no package.json):

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

`ignore` é sua válvula de escape para qualquer falso positivo. Use como biblioteca:

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>Privacidade e limitações honestas</b></summary>

- **Executa inteiramente localmente.** Lê seu transcript e o `git`, não grava nada exceto no `install`. Zero chamadas de rede, zero dependências de runtime. O registro local (`~/.groundtruth/ledger.jsonl`) armazena apenas contagens — nunca código nem prompts.
- Ele verifica se o trabalho afirmado **existe no diff**, não se está **correto** — para isso servem os testes (e o verify loop).
- A extração favorece precisão em detrimento de recall: prefere perder afirmações vagas a arriscar uma acusação falsa.

</details>

## Contribuindo

Issues e PRs são bem-vindos — especialmente novos padrões de afirmações, adaptadores de agentes e relatórios de falsos positivos (esses são ouro). Veja [CONTRIBUTING.md](../../CONTRIBUTING.md).

Se o groundtruth pegar seu agente mentindo, uma ⭐ ajuda outros a encontrá-lo.

## Licença

[MIT](../../LICENSE) © [Veltiq](https://veltiq.net)
