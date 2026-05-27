<p align="center">
  <img src="../../assets/hero.svg" alt="groundtruth" width="820">
</p>

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

# groundtruth

> **En breve** — Tu IA dice _"¡Listo! Añadí X, arreglé Y, escribí tests."_ groundtruth comprueba cada afirmación contra el diff real y marca las que nunca ocurrieron. Un comando: `npx @veltiq/groundtruth install`.

**Detecta cuando tu asistente de IA dice haber hecho un trabajo que en realidad no hizo.**

Tu agente termina un turno con _"¡Listo! Añadí un middleware `rateLimiter` a `src/server.ts`, arreglé el bug de timeout y agregué tests."_ Confías en el resumen, haces commit y sigues. Dos semanas después producción falla: el rate limiter nunca se escribió. groundtruth lee el resumen, extrae cada afirmación concreta y la verifica contra lo que realmente cambió — la **verdad de base** (ground truth).

```text
groundtruth — claim check

  ❌ unsupported  symbol `rateLimiter`
  ❌ unsupported  file src/server.ts
  ❌ unsupported  tests

  3 claims · 0 verified · 3 unsupported
```

> Todo el cambio anterior fue una sola edición del README. groundtruth detectó las tres afirmaciones falsas.

## Por qué existe

Los "cambios fantasma" — trabajo que el resumen afirma pero nunca implementa — son el tipo de inconsistencia más común en los agentes de IA. Los tests detectan código _incorrecto_; nada detecta código que simplemente _nunca se escribió_. El principio es uno: **el diff no miente.**

## Pruébalo en 30 segundos

```bash
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

## Instalación

Requiere Node ≥ 20. No necesitas instalación global — el hook se ejecuta con `npx`.

```bash
# Instálalo como Stop hook de Claude Code en este proyecto
npx @veltiq/groundtruth install

# …o para todos los proyectos
npx @veltiq/groundtruth install --global
```

Reinicia Claude Code (o ejecuta `/hooks`) y groundtruth revisará cada turno automáticamente.

## Cómo funciona

Lee el turno → reúne evidencia de las llamadas a herramientas y del diff de git → extrae afirmaciones del resumen → verifica cada una y asigna un veredicto:

| Veredicto | Significado |
|---|---|
| ✅ **verified** | Hay evidencia concreta que respalda la afirmación. |
| ❌ **unsupported** | La afirmación es comprobable y no hay **ninguna** evidencia — un cambio fantasma. |
| ⚠️ **review** | Semántico o ambiguo (p. ej. _"arreglé el bug"_); se muestra para tu atención, nunca cuenta como fallo. |

Conservador por diseño: solo marca **unsupported** cuando la afirmación es claramente comprobable y nada la respalda — prefiere omitir antes que acusar en falso.

## Limitaciones honestas

Verifica que el trabajo afirmado **existe en el diff**, no que sea **correcto** — para eso están los tests.

## 📖 Documentación completa

La documentación completa está en inglés: [README](../../README.md) · [cómo funciona](../how-it-works.md) · [diseño](../design.md)

## Licencia

[MIT](../../LICENSE) © Veltiq
