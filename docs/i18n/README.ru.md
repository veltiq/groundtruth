<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <b>Русский</b> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <img src="../../assets/demo.svg" alt="groundtruth — the human-in-the-loop for AI coding" width="820">
</p>

<h1 align="center">groundtruth</h1>

<p align="center">
  <b>Человеческий контроль над AI-кодингом — автоматизированный.</b><br>
  Ловите агента на лжи, опечатках и пропущенной работе — и заставляйте его доказывать результат, прежде чем сказать «готово».
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

Агент говорит: _«Готово! Я добавил `rateLimiter` в `src/server.ts`, исправил таймаут и написал тесты.»_ Вы делаете коммит и идёте дальше. Через две недели прод падает — rate limiter так и не был написан. **Резюме солгало, и никто не сверил его с диффом.**

`groundtruth` — ревьюер, который делает это на **каждом** ходу — детерминированно, **без единого LLM-вызова** для проверки:

<table>
<tr>
<td width="50%" valign="top">

**Когда резюме лжёт** — каждое утверждение здесь фантомное (весь «кодинг» свёлся к одной правке README):

<img src="../../assets/screenshot-catch.png" alt="groundtruth flags three claims the diff doesn't support" width="100%">

</td>
<td width="50%" valign="top">

**Когда всё честно** — аналогичное резюме, каждое утверждение подтверждено реальным диффом:

<img src="../../assets/screenshot-verified.png" alt="groundtruth verifies four honest claims against the diff" width="100%">

</td>
</tr>
</table>

## Зачем

Без присмотра AI-агенты уверенно рапортуют о работе, которую не делали — исследования агентских PR показали: **«фантомные изменения» — самый распространённый тип несоответствий.** Тесты ловят _неправильный_ код; ничто не ловит код, который _просто не был написан_, но отмечен как выполненный. Это и есть пробел — и чем быстрее агенты пишут код, тем больше через него проскальзывает.

groundtruth закрывает его в два этапа:

1. **Проверяет утверждения.** Читает резюме агента по итогам хода, извлекает каждое конкретное утверждение и оценивает его по **ground truth** — какие файлы изменились, какие символы появились в диффе, запускались ли тесты или установка пакетов. Основан на одном правиле: _дифф не лжёт._
2. **Заставляет агента доказать результат** _(опциональный [цикл верификации](../verify-loop.md))._ Прежде чем завершить ход, агент должен запустить / сделать **скриншот** / протестировать изменение, сверить его с вашим исходным запросом, найти собственные ошибки и повторять до тех пор, пока всё не сойдётся.

→ более высокое качество без необходимости постоянно следить за агентом.

## Установка

Требуется Node ≥ 20. Одна команда подключает Stop-хук, цикл верификации и строку статуса — идемпотентно:

```bash
npx @veltiq/groundtruth setup
```

Перезапустите Claude Code (или выполните `/hooks`) — и проверка будет запускаться на каждом ходу автоматически.

<details>
<summary>Попробуйте за 30 секунд · ручная установка · плагин</summary>

```bash
# Посмотрите, как ловится фантомное изменение на примере готового транскрипта — без установки и конфигурации:
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# Проверьте текущую сессию без установки:
npx @veltiq/groundtruth verify

# Только хук проверки утверждений (без цикла), для этого проекта или глобально:
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

Предпочитаете плагины?

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

> Цикл никогда не заблокирует вас намертво: ограничение числа раундов на сессию всегда позволяет ходу завершиться, а `GROUNDTRUTH_NO_LOOP=1` мгновенно ставит его на паузу.

## Как это работает

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary       diff      prose       per-claim
            + tools    ground truth  parse        check
```

| Вердикт | Значение |
|---|---|
| ✅ **verified** | В диффе есть конкретные доказательства, подтверждающие утверждение. |
| ❌ **unsupported** | Утверждение поддаётся проверке, но **никаких** подтверждений нет — фантомное изменение. |
| ⚠️ **review** | Расплывчато или семантически (например, _«исправил баг»_) — выводится для внимания, **никогда** не считается ошибкой. |

**Намеренный уклон в сторону тишины:** ложные срабатывания убивают такой инструмент, поэтому утверждение помечается как `unsupported` только тогда, когда оно однозначно поддаётся проверке и ничто его не подтверждает. Всё нечёткое становится `review`. Инструмент предпочтёт пропустить утверждение, чем ложно обвинить правильное. → [`docs/how-it-works.md`](../how-it-works.md) · [`docs/design.md`](../design.md)

## Цикл верификации — заставьте агента доказать результат (опционально)

<p align="center">
  <img src="../../assets/loop-demo.svg" alt="The loop screenshots a page, catches an invisible button, fixes it, and re-verifies — no human needed" width="760">
</p>

Проверка утверждений оценивает _слова_ хода; цикл оценивает _поведение_. При включённом режиме (`setup` активирует его, или `GROUNDTRUTH_LOOP=1`) ход, изменивший что-либо, задерживается на событии Stop — агент должен верифицировать работу **в соответствии с её типом**: открыть страницу в браузере и прочитать скриншот (веб), выполнить команду (CLI), обратиться к эндпоинту (API), запустить тесты (библиотека) — сверить с **исходным запросом**, исправить ошибки и завершить ход только после успешной проверки. Он не оценивает саму работу (никаких собственных ложных срабатываний), а ограничение раундов исключает бесконечный цикл. → [`docs/verify-loop.md`](../verify-loop.md)

## Подробнее

<details>
<summary><b>CLI — использование и флаги</b></summary>

```bash
groundtruth verify                       # проверить последнюю сессию этого проекта
groundtruth verify --transcript x.jsonl  # конкретный транскрипт
groundtruth verify --markdown            # Markdown (отлично подходит для комментария к PR)
groundtruth verify --json | --sarif      # машиночитаемый / GitHub code scanning
groundtruth verify --strict              # ненулевой выход при наличии unsupported-утверждений
groundtruth stats [--all]                # локальная статистика: verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

По умолчанию хук **неблокирующий** — он выводит отчёт и не мешает работе. `--strict` (или `GROUNDTRUTH_STRICT=1`) блокирует выполнение при наличии unsupported-утверждений.

</details>

<details>
<summary><b>Что проверяется</b></summary>

| Утверждение | Пример | Считается подтверждённым, если… |
|---|---|---|
| **file** | _«обновил `src/auth.ts`»_ | этот файл был изменён в данном ходу |
| **symbol** | _«добавил `validateInput`»_ | идентификатор присутствует в добавленном/удалённом коде |
| **test** | _«добавил тесты»_ | изменился тестовый файл или была выполнена тестовая команда |
| **dependency** | _«установил `zod`»_ | изменился манифест или была выполнена команда установки |
| **command** | _«запустил сборку»_ | соответствующая команда была выполнена через Bash (информационно) |
| **action** | _«исправил баг с таймаутом»_ | не поддаётся машинной проверке → помечается для ревью |

Подробности в [`docs/claim-types.md`](../claim-types.md).

</details>

<details>
<summary><b>Использование в CI · коммит-сообщения · pre-commit</b></summary>

Проверьте **описание PR против его диффа** в виде закреплённого комментария (работает для любого PR, без настройки агента):

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
      - uses: veltiq/groundtruth@v0.6.1   # добавьте  with: { strict: true }  чтобы блокировать мёрджи
```

Проверяйте коммит-сообщение против стейджед-диффа — добавьте в `.git/hooks/commit-msg` или через [pre-commit](https://pre-commit.com):

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
<summary><b>Другие агенты · конфигурация · API библиотеки</b></summary>

`verify` также читает транскрипты других агентов — движок проверки утверждений агентонезависим:

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

Опциональный `.groundtruthrc.json` (или ключ `"groundtruth"` в package.json):

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

`ignore` — ваш escape-хэтч для любого ложного срабатывания. Использование как библиотеки:

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>Приватность и честные ограничения</b></summary>

- **Работает полностью локально.** Читает транскрипт и `git`, не пишет ничего, кроме как при `install`. Никаких сетевых запросов, никаких runtime-зависимостей. Локальная статистика (`~/.groundtruth/ledger.jsonl`) хранит только счётчики — никакого кода и промптов.
- Проверяет, что заявленная работа **существует в диффе**, а не то, что она **корректна** — для этого нужны тесты (и цикл верификации).
- Извлечение утверждений предпочитает точность полноте охвата: лучше пропустить расплывчатое утверждение, чем рискнуть ложным обвинением.

</details>

## Участие в проекте

Задачи и PR приветствуются — особенно новые шаблоны утверждений, адаптеры агентов и сообщения о ложных срабатываниях (это бесценно). Смотрите [CONTRIBUTING.md](../../CONTRIBUTING.md).

Если groundtruth когда-нибудь поймает вашего агента на лжи, ⭐ поможет другим его найти.

## Лицензия

[MIT](../../LICENSE) © [Veltiq](https://veltiq.net)
