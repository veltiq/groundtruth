<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <b>Español</b> ·
  <a href="README.pt-BR.md">Português</a> ·
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
  <b>El humano en el bucle para programación con IA — automatizado.</b><br>
  Detecta cuando tu agente de IA miente, deja errores tipográficos o se salta trabajo — y oblígalo a demostrar lo que hizo antes de decir "listo."
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

Tu agente dice _"¡Listo! Agregué un `rateLimiter` a `src/server.ts`, corregí el timeout y añadí tests."_ Haces commit y sigues adelante. Dos semanas después, producción falla — el rate limiter nunca se escribió. **El resumen mintió, y nadie lo verificó contra el diff.**

`groundtruth` es el revisor que sí lo hace, en **cada** turno — de forma determinista, con **cero llamadas a LLM** para la comprobación:

<table>
<tr>
<td width="50%" valign="top">

**Cuando el resumen miente** — cada afirmación aquí es un fantasma (todo el "código" fue solo una edición al README):

<img src="../../assets/screenshot-catch.png" alt="groundtruth flags three claims the diff doesn't support" width="100%">

</td>
<td width="50%" valign="top">

**Cuando es honesto** — el mismo tipo de resumen, con cada afirmación respaldada por el diff real:

<img src="../../assets/screenshot-verified.png" alt="groundtruth verifies four honest claims against the diff" width="100%">

</td>
</tr>
</table>

## Por qué

Sin supervisión, los agentes de IA reportan con total confianza trabajo que nunca realizaron — la investigación sobre PRs agentivos encontró que estos **"cambios fantasma" son la inconsistencia más común.** Los tests capturan código _incorrecto_; nada captura código que simplemente _nunca se escribió_ pero se reportó como hecho. Esa es la brecha — y cuanto más rápido codifican los agentes, más se filtra.

groundtruth la cierra en dos etapas:

1. **Verificar las afirmaciones.** Lee el resumen de fin de turno del agente, extrae cada afirmación concreta y la califica contra la **realidad** — qué archivos cambiaron, qué símbolos aparecen en el diff, si los tests o instalaciones realmente se ejecutaron. Todo basado en una regla: _el diff no miente._
2. **Obligar al agente a demostrar que funciona** _(opt-in [verify loop](../verify-loop.md))._ Antes de terminar, el agente debe ejecutar / **capturar pantalla** / testear el cambio contra tu solicitud original, buscar sus propios errores, y corregir-y-reverificar hasta que aguante.

→ salida de mayor calidad que no necesitas vigilar.

## Instalación

Requiere Node ≥ 20. Un solo comando conecta el hook Stop + verify loop + línea de estado, de forma idempotente:

```bash
npx @veltiq/groundtruth setup
```

Reinicia Claude Code (o ejecuta `/hooks`) y comprobará cada turno automáticamente.

<details>
<summary>Pruébalo en 30 segundos · instalación manual · plugin</summary>

```bash
# Ve cómo detecta un cambio fantasma contra una transcripción de ejemplo — sin instalar, sin configurar:
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# Comprueba la sesión actual sin instalar nada:
npx @veltiq/groundtruth verify

# Solo el hook de comprobación (sin loop), en este proyecto o globalmente:
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

¿Prefieres plugins?

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

> El loop nunca puede atraparte: un límite de rondas por sesión siempre permite que un turno termine, y `GROUNDTRUTH_NO_LOOP=1` lo pausa al instante.

## Cómo funciona

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary       diff      prose       per-claim
            + tools    ground truth  parse        check
```

| Veredicto | Significado |
|---|---|
| ✅ **verified** | Hay evidencia concreta en el diff que respalda la afirmación. |
| ❌ **unsupported** | Es verificable concretamente y no hay **ninguna** evidencia — un cambio fantasma. |
| ⚠️ **review** | Vaga o semántica (_"corregí el bug"_) — se muestra para revisión, **nunca** es un fallo. |

**Un sesgo deliberado hacia el silencio:** las falsas alarmas hacen que herramientas como esta se desinstalen, por lo que una afirmación solo es `unsupported` cuando es inequívocamente verificable y nada la respalda. Todo lo ambiguo se convierte en `review`. Prefiere perderse una afirmación antes que acusar erróneamente a una correcta. → [`docs/how-it-works.md`](../how-it-works.md) · [`docs/design.md`](../design.md)

## Verify loop — obliga al agente a demostrarlo (opt-in)

<p align="center">
  <img src="../../assets/loop-demo.svg" alt="The loop screenshots a page, catches an invisible button, fixes it, and re-verifies — no human needed" width="760">
</p>

La comprobación de afirmaciones califica las _palabras_ de un turno; el loop califica su _comportamiento_. Con él activo (`setup` lo habilita, o `GROUNDTRUTH_LOOP=1`), un turno que cambió algo queda retenido en el evento Stop y el agente debe verificar según el **tipo de trabajo** — abrir la página en un navegador y leer una captura de pantalla (web), ejecutar el comando (CLI), llamar al endpoint (API), correr los tests (librería) — comprobarlo contra tu **solicitud original**, corregir los errores y solo terminar una vez que pase. Nunca juzga el trabajo en sí (sin falsos positivos propios) y un límite de rondas impide que se repita indefinidamente. → [`docs/verify-loop.md`](../verify-loop.md)

## Más

<details>
<summary><b>Uso de CLI y flags</b></summary>

```bash
groundtruth verify                       # comprueba la última sesión para este proyecto
groundtruth verify --transcript x.jsonl  # una transcripción específica
groundtruth verify --markdown            # markdown (ideal como comentario de PR)
groundtruth verify --json | --sarif      # legible por máquina / GitHub code scanning
groundtruth verify --strict              # sale con código no-cero si algo es unsupported
groundtruth stats [--all]                # conteo local: verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

Por defecto, el hook es **no bloqueante** — imprime un informe y se aparta. `--strict` (o `GROUNDTRUTH_STRICT=1`) lo hace bloquear en afirmaciones no respaldadas.

</details>

<details>
<summary><b>Qué comprueba</b></summary>

| Afirmación | Ejemplo | Verificado cuando… |
|---|---|---|
| **file** | _"actualicé `src/auth.ts`"_ | ese archivo se tocó en este turno |
| **symbol** | _"añadí `validateInput`"_ | el identificador aparece en el código añadido/eliminado |
| **test** | _"añadí tests"_ | un archivo de test cambió o se ejecutó un comando de test |
| **dependency** | _"instalé `zod`"_ | un manifiesto cambió o se ejecutó un comando de instalación |
| **command** | _"ejecuté el build"_ | se ejecutó un comando coincidente via Bash (informativo) |
| **action** | _"corregí el bug del timeout"_ | no es verificable por máquina → marcado para revisión |

Detalles completos en [`docs/claim-types.md`](../claim-types.md).

</details>

<details>
<summary><b>Uso en CI · mensajes de commit · pre-commit</b></summary>

Califica una **descripción de PR contra su diff** como comentario fijo (funciona en cualquier PR, sin configuración de agente):

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
      - uses: veltiq/groundtruth@v0.6.1   # agrega  with: { strict: true }  para bloquear merges
```

Verifica un mensaje de commit contra el diff en staging — colócalo en `.git/hooks/commit-msg`, o via [pre-commit](https://pre-commit.com):

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
<summary><b>Otros agentes · configuración · API de librería</b></summary>

`verify` también lee transcripciones de otros agentes — el motor de afirmaciones es agnóstico al agente:

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

`.groundtruthrc.json` opcional (o una clave `"groundtruth"` en package.json):

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

`ignore` es tu válvula de escape para cualquier falso positivo. Úsalo como librería:

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>Privacidad y limitaciones honestas</b></summary>

- **Se ejecuta completamente en local.** Lee tu transcripción y `git`, no escribe nada excepto en `install`. Cero llamadas de red, cero dependencias en tiempo de ejecución. El conteo local (`~/.groundtruth/ledger.jsonl`) almacena solo cifras — nunca código ni prompts.
- Verifica que el trabajo afirmado **existe en el diff**, no que sea **correcto** — para eso están los tests (y el verify loop).
- La extracción prioriza precisión sobre exhaustividad: prefiere perderse afirmaciones vagas antes que arriesgarse a una falsa acusación.

</details>

## Contribuir

Issues y PRs bienvenidos — especialmente nuevos patrones de afirmaciones, adaptadores para agentes e informes de falsos positivos (esos son oro). Ver [CONTRIBUTING.md](../../CONTRIBUTING.md).

Si groundtruth alguna vez atrapa a tu agente en una mentira, una ⭐ ayuda a otros a encontrarlo.

## Licencia

[MIT](../../LICENSE) © [Veltiq](https://veltiq.net)
