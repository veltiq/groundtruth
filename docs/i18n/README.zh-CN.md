<p align="center">
  <img src="../../assets/hero.svg" alt="groundtruth" width="820">
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.ar.md">العربية</a>
</p>

# groundtruth

> **一句话** — 你的 AI 说“完成！我添加了 X、修复了 Y、写了测试。”groundtruth 会对照真实 diff 逐条核对，并标出那些根本没发生的声明。一条命令：`npx @veltiq/groundtruth install`。

**在 AI 编程助手谎称完成了某项工作时，及时发现。**

你的助手在一轮结束时说：_“完成！我在 `src/server.ts` 中添加了 `rateLimiter` 中间件、修复了超时 bug，并补了测试。”_ 你相信这段总结、提交、继续。两周后线上出问题——那个限流器从未被写过。groundtruth 会读取这段总结，提取每一条具体声明，并对照**真实发生的改动**（即 ground truth）逐条核对。

```text
groundtruth — claim check

  ❌ unsupported  symbol `rateLimiter`
  ❌ unsupported  file src/server.ts
  ❌ unsupported  tests

  3 claims · 0 verified · 3 unsupported
```

> 上面整个改动其实只是编辑了 README，groundtruth 抓出了三条不实声明。

## 为什么需要它

“幽灵改动”——总结里声称做了、却从未实现的工作——是 AI 代理最常见的不一致类型。测试能发现“写错的代码”，却无法发现“根本没写的代码”。groundtruth 的唯一原则是：**diff 不会说谎。**

## 30 秒试用

```bash
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

## 安装

需要 Node ≥ 20。无需全局安装，hook 通过 `npx` 运行。

```bash
# 作为 Claude Code 的 Stop hook 安装到当前项目
npx @veltiq/groundtruth install

# …或对所有项目生效
npx @veltiq/groundtruth install --global
```

重启 Claude Code（或运行 `/hooks`），groundtruth 就会自动检查每一轮对话。

## 工作原理

读取本轮对话 → 从工具调用与 git diff 收集证据 → 从总结中提取声明 → 逐条核对并给出判定：

| 判定 | 含义 |
|---|---|
| ✅ **已验证** | 有具体证据支持该声明。 |
| ❌ **不支持** | 声明可被明确核对，但没有任何匹配证据——即幽灵改动。 |
| ⚠️ **待复查** | 语义性或模糊的声明（如“修复了 bug”），仅作提示，绝不判为失败。 |

设计上非常保守：只有在声明明确可核对且毫无证据支持时，才会判为**不支持**——宁可漏判，也不误报。

## 诚实的局限

它验证“声明的工作是否存在于 diff 中”，而非“是否正确”——后者由测试负责。

## 📖 完整文档

完整文档为英文：[README](../../README.md) · [工作原理](../how-it-works.md) · [设计说明](../design.md)

## 许可证

[MIT](../../LICENSE) © Veltiq
