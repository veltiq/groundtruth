<p align="center">
  <img src="../../assets/hero.svg" alt="groundtruth" width="820">
</p>

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

<div dir="rtl">

# groundtruth

> **باختصار** — يقول الذكاء الاصطناعي: _«تمّ! أضفتُ X، وأصلحتُ Y، وكتبتُ اختبارات.»_ يتحقّق groundtruth من كل ادّعاء مقابل التغيير الفعلي (diff) ويُعلِّم ما لم يحدث منها. أمر واحد: `npx @veltiq/groundtruth install`.

**اكتشف عندما يدّعي مساعد البرمجة بالذكاء الاصطناعي أنه أنجز عملاً لم ينجزه فعلاً.**

ينهي وكيلك دوره قائلاً: _«تمّ! أضفتُ وسيطًا باسم `rateLimiter` في `src/server.ts`، وأصلحتُ خلل المهلة، وأضفتُ اختبارات.»_ تثق بالملخّص، وتعمل commit، وتمضي. بعد أسبوعين ينهار الإنتاج — إذ لم يُكتب محدِّد المعدّل (rate limiter) قط. يقرأ groundtruth الملخّص، ويستخرج كل ادّعاء ملموس، ويتحقّق منه مقابل ما تغيّر فعليًا — أي **الحقيقة الأساسية** (ground truth).

</div>

```text
groundtruth — claim check

  ❌ unsupported  symbol `rateLimiter`
  ❌ unsupported  file src/server.ts
  ❌ unsupported  tests

  3 claims · 0 verified · 3 unsupported
```

<div dir="rtl">

> كان التغيير أعلاه بأكمله مجرّد تعديل واحد على ملف README، ومع ذلك ضبط groundtruth الادّعاءات الثلاثة الكاذبة.

## لماذا هذه الأداة

«التغييرات الوهمية» — عملٌ يدّعيه الملخّص لكنه لا يُنفَّذ أبدًا — هي أكثر أنواع التناقض شيوعًا لدى وكلاء الذكاء الاصطناعي. الاختبارات تكتشف الكود _الخاطئ_؛ لكن لا شيء يكتشف الكود الذي _لم يُكتب أساسًا_. المبدأ واحد: **التغيير (diff) لا يكذب.**

## جرّبها في 30 ثانية

</div>

```bash
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

<div dir="rtl">

## التثبيت

يتطلّب Node ≥ 20. لا حاجة لتثبيت عام — يعمل الـ hook عبر `npx`.

</div>

```bash
# التثبيت كـ Stop hook لـ Claude Code في هذا المشروع
npx @veltiq/groundtruth install

# …أو لكل المشاريع
npx @veltiq/groundtruth install --global
```

<div dir="rtl">

أعد تشغيل Claude Code (أو نفّذ `/hooks`)، وسيفحص groundtruth كل دور تلقائيًا.

## كيف تعمل

تقرأ الدور ← تجمع الأدلّة من استدعاءات الأدوات ومن git diff ← تستخرج الادّعاءات من الملخّص ← تتحقّق من كل ادّعاء وتُصدر حُكمًا:

- ✅ **verified** — هناك دليل ملموس يدعم الادّعاء.
- ❌ **unsupported** — الادّعاء قابل للتحقّق ولا يوجد أيّ دليل يدعمه — تغيير وهمي.
- ⚠️ **review** — دلالي أو غامض (مثل _«أصلحتُ الخلل»_)؛ يُعرض للتنبيه فقط، ولا يُحتسب فشلاً أبدًا.

محافِظة بالتصميم: لا تُعلِّم ادّعاءً بأنه **unsupported** إلا إذا كان قابلاً للتحقّق بوضوح ولا يدعمه شيء — تُفضّل التجاوز على الاتّهام الخاطئ.

## حدود صريحة

تتحقّق من أن العمل المُدّعى **موجود في الـ diff**، لا من أنه **صحيح** — فذلك دور الاختبارات.

## 📖 التوثيق الكامل

التوثيق الكامل بالإنجليزية: [README](../../README.md) · [كيف تعمل](../how-it-works.md) · [التصميم](../design.md)

## الرخصة

[MIT](../../LICENSE) © Veltiq

</div>
