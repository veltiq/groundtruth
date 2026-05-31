<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <b>日本語</b> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <img src="../../assets/demo.svg" alt="groundtruth — the human-in-the-loop for AI coding" width="820">
</p>

<h1 align="center">groundtruth</h1>

<p align="center">
  <b>AI コーディングのヒューマン・イン・ザ・ループを、自動化。</b><br>
  AIエージェントが嘘をつき、タイポを残し、作業を省略したときに検知し、「完了」と言う前に証明させる。
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

エージェントが _「完了！`src/server.ts` に `rateLimiter` を追加し、タイムアウトを修正して、テストも書きました。」_ と言う。あなたはコミットして先へ進む。2週間後、本番が壊れる — レートリミッターは一度も書かれていなかった。**サマリーは嘘をついていて、それをdiffと照合するものが何もなかった。**

`groundtruth` は、**あらゆる**ターンにおいて確定的に、**LLM呼び出しゼロ**でそれを行うレビュアーだ:

<table>
<tr>
<td width="50%" valign="top">

**サマリーが嘘をついているとき** — ここに挙げた全クレームは幻（コードベース全体がREADMEの一箇所の編集だった）:

<img src="../../assets/screenshot-catch.png" alt="groundtruth flags three claims the diff doesn't support" width="100%">

</td>
<td width="50%" valign="top">

**正直なとき** — 同種のサマリーで、各クレームが実際のdiffに裏付けられている:

<img src="../../assets/screenshot-verified.png" alt="groundtruth verifies four honest claims against the diff" width="100%">

</td>
</tr>
</table>

## なぜ必要か

監視なしに放置すると、AIエージェントは実行していない作業を自信を持って報告する — agentic PRの研究では、これらの**「ファントム変更」が最も一般的な不整合**であることが判明している。テストは_誤っている_コードを検知するが、_書かれなかったのに完了と報告された_コードを検知するものは何もない。それがギャップだ — そしてエージェントがコーディングを速くするほど、より多くのものが抜け落ちる。

groundtruth はそれを2段階で塞ぐ:

1. **クレームを検証する。** エージェントのターン末サマリーを読み、各具体的クレームを抽出し、**ground truth** — どのファイルが変更されたか、どのシンボルがdiffに現れるか、テストやインストールが実際に走ったか — と照合して採点する。ルールは一つ: _diffは嘘をつかない。_
2. **エージェントに動作を証明させる** _(オプトイン [verify loop](../verify-loop.md))。_ 完了前に、エージェントは変更を元のリクエストに対してrun / **スクリーンショット** / テストし、自身のミスを探し、合格するまで修正と再確認を繰り返さなければならない。

→ 目を光らせなくても品質の高いアウトプットが得られる。

## インストール

Node ≥ 20 が必要。1コマンドで Stop フック + verify loop + ステータス行を冪等に設定:

```bash
npx @veltiq/groundtruth setup
```

Claude Code を再起動（または `/hooks` を実行）すれば、毎ターン自動でチェックが走る。

<details>
<summary>30秒で試す · 手動インストール · プラグイン</summary>

```bash
# キャッシュされたトランスクリプトに対してファントム変更を検知する — インストール不要、設定不要:
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# 何もインストールせず現在のセッションをチェック:
npx @veltiq/groundtruth verify

# クレームチェックフックのみ（ループなし）、このプロジェクトまたはグローバル:
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

プラグインが好みの場合:

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

> ループに閉じ込められることはない: セッションごとのラウンド上限によって常にターンは終了でき、`GROUNDTRUTH_NO_LOOP=1` で即座に一時停止できる。

## 仕組み

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary       diff      prose       per-claim
            + tools    ground truth  parse        check
```

| 判定 | 意味 |
|---|---|
| ✅ **verified** | diffに具体的な根拠があり、クレームが裏付けられている。 |
| ❌ **unsupported** | 具体的に検証可能であるにもかかわらず、一致する根拠が**ゼロ** — ファントム変更。 |
| ⚠️ **review** | 曖昧または意味論的（_「バグを修正した」_）— 注意喚起のために表示されるが、**絶対に**失敗扱いにはならない。 |

**意図的にサイレント側に偏っている:** 誤報があればこのようなツールはアンインストールされるため、クレームが `unsupported` になるのは、明確に検証可能であり何も裏付けるものがない場合だけだ。曖昧なものはすべて `review` になる。正しいクレームを誤って告発するくらいなら、見逃す方を選ぶ。→ [`../how-it-works.md`](../how-it-works.md) · [`../design.md`](../design.md)

## Verify ループ — エージェントに証明させる（オプトイン）

<p align="center">
  <img src="../../assets/loop-demo.svg" alt="The loop screenshots a page, catches an invisible button, fixes it, and re-verifies — no human needed" width="760">
</p>

クレームチェックはターンの_言葉_を採点するが、ループはその_動作_を採点する。有効化すると（`setup` が有効化するか `GROUNDTRUTH_LOOP=1`）、何かを変更したターンは Stop イベントで保留され、エージェントは**作業の種類**に応じて検証しなければならない — ブラウザでページを開いてスクリーンショットを読む（Web）、コマンドを実行する（CLI）、エンドポイントを叩く（API）、テストを走らせる（ライブラリ）— そして**元のリクエスト**と照合し、ミスを修正し、合格して初めて終了できる。作業そのものを判定しない（独自の誤検知なし）し、ラウンド上限があるので永久ループは起きない。→ [`../verify-loop.md`](../verify-loop.md)

## その他

<details>
<summary><b>CLI の使い方とフラグ</b></summary>

```bash
groundtruth verify                       # このプロジェクトの最新セッションをチェック
groundtruth verify --transcript x.jsonl  # 特定のトランスクリプト
groundtruth verify --markdown            # Markdown形式（PRコメントに最適）
groundtruth verify --json | --sarif      # 機械可読 / GitHub コードスキャン
groundtruth verify --strict              # unsupportedがあれば非ゼロで終了
groundtruth stats [--all]                # ローカル集計: verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

デフォルトではフックは**ノンブロッキング** — レポートを出力して邪魔しない。`--strict`（または `GROUNDTRUTH_STRICT=1`）を使うと unsupported なクレームでブロックするようになる。

</details>

<details>
<summary><b>何をチェックするか</b></summary>

| クレーム | 例 | 検証される条件 |
|---|---|---|
| **file** | _"`src/auth.ts` を更新した"_ | そのファイルが今ターン変更されていた |
| **symbol** | _"`validateInput` を追加した"_ | その識別子が追加/削除されたコードに現れる |
| **test** | _"テストを追加した"_ | テストファイルが変更されたか、テストコマンドが実行された |
| **dependency** | _"`zod` をインストールした"_ | マニフェストが変更されたか、インストールコマンドが実行された |
| **command** | _"ビルドを実行した"_ | 一致するコマンドが Bash で実行された（参考情報） |
| **action** | _"タイムアウトのバグを修正した"_ | 機械的に検証不可 → レビュー対象としてフラグ |

詳細は [`../claim-types.md`](../claim-types.md) を参照。

</details>

<details>
<summary><b>CI · コミットメッセージ · pre-commit での利用</b></summary>

**PRの説明文をdiffと照合**してスティッキーコメントとして採点する（あらゆるPRで動作、エージェントのセットアップ不要）:

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
      - uses: veltiq/groundtruth@v0.6.1   # マージをゲートするには  with: { strict: true }  を追加
```

コミットメッセージをステージされたdiffと照合して検証する — `.git/hooks/commit-msg` に追加するか、[pre-commit](https://pre-commit.com) 経由で:

```yaml
repos:
  - repo: https://github.com/veltiq/groundtruth
    rev: v0.6.1
    hooks:
      - id: groundtruth
```

→ [../github-action.md](../github-action.md)

</details>

<details>
<summary><b>他のエージェント · 設定 · ライブラリ API</b></summary>

`verify` は他のエージェントのトランスクリプトも読む — クレームエンジンはエージェント非依存:

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

オプションの `.groundtruthrc.json`（または package.json の `"groundtruth"` キー）:

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

`ignore` は誤検知に対するエスケープハッチだ。ライブラリとして使う場合:

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>プライバシーと正直な限界</b></summary>

- **完全にローカルで動作する。** トランスクリプトと `git` を読み、`install` 時以外は何も書き込まない。ネットワーク呼び出しゼロ、ランタイム依存ゼロ。ローカル集計（`~/.groundtruth/ledger.jsonl`）はカウントのみを記録 — コードやプロンプトは一切保存しない。
- クレームされた作業が**diffに存在するか**を検証するが、それが**正しいか**は検証しない — それはテスト（とverifyループ）の仕事だ。
- 抽出は再現率より精度を優先する: 誤検知のリスクを冒すより曖昧なクレームを見逃す方を選ぶ。

</details>

## コントリビューション

Issueおよびプルリクエスト歓迎 — 特に新しいクレームパターン、エージェントアダプター、誤検知レポート（これらは貴重）。[CONTRIBUTING.md](../../CONTRIBUTING.md) を参照。

groundtruth がエージェントの嘘を捕まえたら、⭐ で他の人が見つけやすくなる。

## ライセンス

[MIT](../../LICENSE) © [Veltiq](https://veltiq.net)
