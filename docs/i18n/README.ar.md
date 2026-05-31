<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ru.md">Русский</a> ·
  <b>العربية</b>
</p>

<p align="center">
  <img src="../../assets/demo.svg" alt="groundtruth — the human-in-the-loop for AI coding" width="820">
</p>

<h1 align="center">groundtruth</h1>

<p align="center">
  <b>الإنسان في الحلقة لبرمجة الذكاء الاصطناعي — مؤتمت.</b><br>
  اكتشف متى يكذب وكيلك الذكي، أو يترك أخطاء، أو يتجاهل العمل — ثم اجعله يُثبت ما أنجزه قبل أن يقول "تمّ."
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

<div dir="rtl">

يقول وكيلك _"تمّ! أضفت `rateLimiter` إلى `src/server.ts`، وأصلحت المهلة الزمنية، وأضفت الاختبارات."_ تُودع التغييرات وتمضي. بعد أسبوعين تنهار البيئة الإنتاجية — لم يُكتب محدِّد المعدل قط. **لقد كذب الملخص، ولم يقارنه أحد بالفارق الفعلي.**

`groundtruth` هو المُراجع الذي يفعل ذلك، في **كل** دورة — بشكل حتمي، **دون أي استدعاء لنموذج لغوي** أثناء الفحص:

</div>

<table>
<tr>
<td width="50%" valign="top">

**حين يكذب الملخص** — كل ادعاء هنا وهمي (طوال "قاعدة الكود" كانت تعديلاً واحداً على README):

<img src="../../assets/screenshot-catch.png" alt="groundtruth flags three claims the diff doesn't support" width="100%">

</td>
<td width="50%" valign="top">

**حين يكون صادقاً** — الملخص ذاته، وكل ادعاء مدعوم بالفارق الفعلي:

<img src="../../assets/screenshot-verified.png" alt="groundtruth verifies four honest claims against the diff" width="100%">

</td>
</tr>
</table>

<div dir="rtl">

## لماذا

حين يُترك دون إشراف، يُفيد الوكلاء الذكيون بثقة بعمل لم يُنجز قط — كشفت الأبحاث على PRs العاملة أن هذه **"التغييرات الوهمية" هي أكثر التناقضات شيوعاً.** الاختبارات تمسك بالكود _الخاطئ_؛ لا شيء يمسك بالكود الذي لم يُكتب أصلاً لكن أُفيد بإنجازه. هذه هي الفجوة — وكلما أسرع الوكلاء في البرمجة، زاد ما يتسرب.

يُغلق groundtruth هذه الفجوة في مرحلتين:

1. **التحقق من الادعاءات.** يقرأ ملخص الوكيل في نهاية الدورة، يستخرج كل ادعاء محدد، ويقيّمه مقابل **الحقيقة الأرضية** — أي الملفات تغيرت، أي الرموز تظهر في الفارق، هل الاختبارات أو التثبيتات جرت فعلاً. يقوم على قاعدة واحدة: _الفارق لا يكذب._
2. **إجبار الوكيل على الإثبات** _(اختياري — [حلقة التحقق](../verify-loop.md))._ قبل الانتهاء، يجب على الوكيل تشغيل / **التقاط لقطة شاشة** / اختبار التغيير مقابل طلبك الأصلي، والبحث عن أخطائه بنفسه، والإصلاح وإعادة الفحص حتى يصمد.

→ مخرجات أعلى جودة لا تحتاج إلى مراقبة مستمرة.

## التثبيت

يتطلب Node ≥ 20. أمر واحد يوصّل خطاف Stop + حلقة التحقق + سطر الحالة، بصورة متكاملة:

</div>

```bash
npx @veltiq/groundtruth setup
```

<div dir="rtl">

أعد تشغيل Claude Code (أو نفّذ `/hooks`) وسيفحص كل دورة تلقائياً.

<details>
<summary>جرّبه في 30 ثانية · تثبيت يدوي · إضافة</summary>

</div>

```bash
# See it catch a phantom change against a canned transcript — no install, no config:
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git

# Check the current session without installing anything:
npx @veltiq/groundtruth verify

# Just the claim-check hook (no loop), this project or globally:
npx @veltiq/groundtruth install
npx @veltiq/groundtruth install --global
```

<div dir="rtl">

تُفضّل الإضافات؟

</div>

```text
/plugin marketplace add veltiq/groundtruth
/plugin install groundtruth
```

</details>

<div dir="rtl">

> لا يمكن للحلقة أن تحاصرك: حدٌّ أقصى لعدد الجولات في الجلسة يضمن دائماً إنهاء الدورة، و`GROUNDTRUTH_NO_LOOP=1` يوقفها فوراً.

## كيف يعمل

</div>

```text
transcript ─▶ Turn ─▶ ( Evidence + Claims ) ─▶ Verdicts ─▶ Report
            summary       diff      prose       per-claim
            + tools    ground truth  parse        check
```

<div dir="rtl">

| الحكم | المعنى |
|---|---|
| ✅ **verified** | يوجد دليل ملموس في الفارق يدعم الادعاء. |
| ❌ **unsupported** | قابل للفحص بشكل ملموس و**لا** دليل مطابق — تغيير وهمي. |
| ⚠️ **review** | غامض أو دلالي (_"أصلحتُ الخطأ"_) — يُعرض للانتباه، **لا** يُعدّ فشلاً. |

**تحيّز متعمد نحو الصمت:** الإنذارات الكاذبة تُؤدي إلى إلغاء تثبيت مثل هذه الأدوات، لذا لا يُعدّ الادعاء `unsupported` إلا عندما يكون قابلاً للفحص بشكل لا لبس فيه ولا يدعمه شيء. كل ما هو ضبابي يصبح `review`. الأداة تُفضّل الإغفال على الاتهام الخاطئ. → [`docs/how-it-works.md`](../how-it-works.md) · [`docs/design.md`](../design.md)

## حلقة التحقق — اجعل الوكيل يُثبت عمله (اختياري)

</div>

<p align="center">
  <img src="../../assets/loop-demo.svg" alt="The loop screenshots a page, catches an invisible button, fixes it, and re-verifies — no human needed" width="760">
</p>

<div dir="rtl">

فحص الادعاءات يقيّم _كلمات_ الدورة؛ الحلقة تقيّم _سلوكها_. عند تفعيلها (`setup` تُفعّلها، أو `GROUNDTRUTH_LOOP=1`)، تُوقَف الدورة التي غيّرت شيئاً عند حدث Stop ويجب على الوكيل التحقق **حسب نوع العمل** — فتح الصفحة في المتصفح وقراءة لقطة شاشة (ويب)، تشغيل الأمر (CLI)، إرسال طلب للنقطة النهائية (API)، تشغيل الاختبارات (مكتبة) — والمقارنة مع **طلبك الأصلي**، وإصلاح أي أخطاء، وإنهاء الدورة فقط حين تصمد. لا تحكم على العمل بحد ذاته (بلا إيجابيات كاذبة خاصة بها) وحدٌّ أقصى للجولات يمنع التكرار إلى الأبد. → [`docs/verify-loop.md`](../verify-loop.md)

## المزيد

<details>
<summary><b>استخدام CLI والخيارات</b></summary>

</div>

```bash
groundtruth verify                       # check the latest session for this project
groundtruth verify --transcript x.jsonl  # a specific transcript
groundtruth verify --markdown            # markdown (great as a PR comment)
groundtruth verify --json | --sarif      # machine-readable / GitHub code scanning
groundtruth verify --strict              # exit non-zero if anything is unsupported
groundtruth stats [--all]                # local tally: verified / unsupported / review
groundtruth install --events Stop,SubagentStop,SessionEnd --statusline
```

<div dir="rtl">

افتراضياً الخطاف **غير محجوب** — يطبع تقريراً ثم يتنحى. `--strict` (أو `GROUNDTRUTH_STRICT=1`) يجعله يحجب على الادعاءات غير المدعومة.

</div>

</details>

<details>
<summary><b>ما الذي يفحصه</b></summary>

<div dir="rtl">

| الادعاء | مثال | يُتحقق منه حين… |
|---|---|---|
| **file** | _"updated `src/auth.ts`"_ | لُمس هذا الملف في هذه الدورة |
| **symbol** | _"added `validateInput`"_ | يظهر المعرِّف في الكود المضاف/المحذوف |
| **test** | _"added tests"_ | تغيّر ملف اختبار أو جرى أمر اختبار |
| **dependency** | _"installed `zod`"_ | تغيّر ملف التبعيات أو جرى أمر تثبيت |
| **command** | _"ran the build"_ | جرى أمر مطابق عبر Bash (استشاري) |
| **action** | _"fixed the timeout bug"_ | غير قابل للفحص آلياً → يُعلَّم للمراجعة |

تفاصيل كاملة في [`docs/claim-types.md`](../claim-types.md).

</div>

</details>

<details>
<summary><b>الاستخدام في CI · رسائل الإيداع · pre-commit</b></summary>

<div dir="rtl">

قيّم **وصف PR مقابل فارقه** كتعليق ثابت (يعمل على أي PR، دون إعداد وكيل):

</div>

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
      - uses: veltiq/groundtruth@v0.6.1   # add  with: { strict: true }  to gate merges
```

<div dir="rtl">

تحقق من رسالة إيداع مقابل الفارق المرحلي — ضعها في `.git/hooks/commit-msg`، أو عبر [pre-commit](https://pre-commit.com):

</div>

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
<summary><b>وكلاء آخرون · الإعداد · واجهة المكتبة</b></summary>

<div dir="rtl">

`verify` يقرأ نصوص وكلاء آخرين أيضاً — محرك الادعاءات محايد تجاه الوكلاء:

</div>

```bash
groundtruth verify --agent codex|gemini|cursor|opencode|aider|auto
```

<div dir="rtl">

ملف `.groundtruthrc.json` اختياري (أو مفتاح `"groundtruth"` في package.json):

</div>

```json
{
  "strict": false,
  "ignore": ["CHANGELOG.md", "*.generated.ts"],
  "ignoreKinds": ["command"],
  "loop": { "enabled": false, "maxRounds": 6 }
}
```

<div dir="rtl">

`ignore` هو مفر فوري لأي إيجابي كاذب. الاستخدام كمكتبة:

</div>

```ts
import { runPipeline, renderMarkdown } from "@veltiq/groundtruth";
const report = runPipeline({ transcriptPath: "session.jsonl", cwd: process.cwd() });
console.log(renderMarkdown(report));
```

</details>

<details>
<summary><b>الخصوصية والقيود الصريحة</b></summary>

<div dir="rtl">

- **يعمل محلياً بالكامل.** يقرأ نص الجلسة و`git`، لا يكتب شيئاً إلا عند `install`. لا استدعاءات شبكة، لا تبعيات وقت تشغيل. السجل المحلي (`~/.groundtruth/ledger.jsonl`) يخزن الأعداد فقط — لا كوداً ولا موجّهات.
- يتحقق من أن العمل المُدّعى **موجود في الفارق**، لا أنه **صحيح** — ذاك دور الاختبارات (وحلقة التحقق).
- الاستخراج يُفضّل الدقة على الشمولية: يُغفل الادعاءات الغامضة بدلاً من المخاطرة باتهام كاذب.

</div>

</details>

<div dir="rtl">

## المساهمة

المشكلات وطلبات PR موضع ترحيب — خاصة أنماط الادعاءات الجديدة، ومحوّلات الوكلاء، وتقارير الإيجابيات الكاذبة (تلك تُعدّ ذهباً). انظر [CONTRIBUTING.md](../../CONTRIBUTING.md).

إن أمسك groundtruth وكيلك متلبساً بالكذب، نجمة ⭐ تساعد الآخرين على إيجاده.

## الرخصة

[MIT](../../LICENSE) © [Veltiq](https://veltiq.net)

</div>
