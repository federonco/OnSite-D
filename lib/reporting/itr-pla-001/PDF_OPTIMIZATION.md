# ITR-PLA-001 PDF — Guía operativa

## Estrategia oficial

- **Renderer por defecto**: React-PDF (modo `auto`)
- **Puppeteer**: Solo casos excepcionales, explícito con `ITR_PDF_RENDERER=puppeteer`
- **Fallback**: Si Puppeteer falla → React-PDF automático
- **Target**: Vercel Hobby 1024 MB

## Cuándo usar cada renderer

| Situación | Renderer |
|-----------|----------|
| Producción Vercel Hobby | React-PDF (default) |
| Máxima estabilidad | React-PDF |
| Fidelidad visual crítica, Vercel Pro | Puppeteer (opcional) |
| Puppeteer falla en prod | `ITR_FORCE_REACT_PDF=true` |

## Env vars

| Var | Default | Descripción |
|-----|---------|-------------|
| `ITR_PDF_RENDERER` | `auto` | `react-pdf` \| `puppeteer` \| `auto` |
| `ITR_FORCE_REACT_PDF` | — | `true` → siempre React-PDF |
| `ITR_PDF_DEBUG` | `false` | `true` → logs detallados |
| `ITR_PDF_TIMEOUT_MS` | 15000 | Timeout Puppeteer (ms) |
| `ITR_PDF_MAX_INPUT_KB` | 256 | Máx payload input |
| `ITR_PDF_MAX_PREPARED_KB` | 128 | Máx datos preparados |
| `ITR_PDF_MAX_HTML_KB` | 64 | Máx HTML (Puppeteer) |
| `ITR_PDF_MAX_IMAGES` | 0 | Máx imágenes |
| `ITR_PDF_MAX_RENDER_MS` | 30000 | Warn si render supera |
| `ITR_PDF_WARN_ONLY` | `true` | Solo warn; `false` → force React-PDF si supera |

## Thresholds

- **input**: Tamaño JSON del request. Superado → warn (o force React-PDF si `WARN_ONLY=false`).
- **prepared**: Datos listos para render.
- **html**: Solo aplica a Puppeteer.
- **images**: ITR actual no usa imágenes (siempre 0).

## Logs

**Producción (debug off):** Una línea por request:
```
[PDF] renderer=react-pdf | reason="Auto: React-PDF (5 rows)" | fallback=no | total_ms=150
```

**Warnings:** `[PDF] Warning: threshold exceeded (max_input_kb)` o `[PDF] Puppeteer failed: stage=setContent | ...`

**Debug on:** Métricas extra (input_kb, prepared_kb, preparation_ms, buffer_kb, etc.)

## Cómo interpretar logs

| Log | Significado |
|-----|-------------|
| `renderer=react-pdf` | Usó React-PDF |
| `renderer=puppeteer` | Usó Puppeteer |
| `fallback=yes` | Puppeteer falló, se usó React-PDF |
| `reason="..."` | Motivo de selección |
| `total_ms=N` | Tiempo total |

## Smoke test

```bash
npm run pdf:smoke
```

Caso liviano (1 fila), medio (5), pesado (9). Muestra renderer elegido y métricas por caso.

```bash
ITR_PDF_DEBUG=true npm run pdf:smoke
```

Con logs detallados.

## Env vars recomendadas para Vercel

Para Vercel Hobby 1024 MB, no configurar nada (defaults son correctos). Opcional:

- `ITR_FORCE_REACT_PDF=true` — si Puppeteer da problemas

## Checklist operativo

### Producción (Vercel Hobby)

- [ ] `ITR_PDF_RENDERER` = `auto` o sin definir
- [ ] `ITR_FORCE_REACT_PDF` = sin definir
- [ ] `ITR_PDF_DEBUG` = `false` o sin definir
- [ ] `ITR_PDF_WARN_ONLY` = `true` o sin definir
- [ ] `vercel.json` memory 1024 para rutas ITR

### Si Puppeteer falla en producción

1. Setear `ITR_FORCE_REACT_PDF=true`
2. Redeploy (o trigger deploy)
3. Verificar logs: debe aparecer `renderer=react-pdf`

### Troubleshooting memoria

- `ITR_FORCE_REACT_PDF=true` → forzar React-PDF
- Reducir `ITR_PDF_MAX_INPUT_KB` si payloads muy grandes

### Troubleshooting timeout

- `ITR_PDF_TIMEOUT_MS=20000` (o mayor)
- O `ITR_FORCE_REACT_PDF=true` para evitar Puppeteer

### Debug local

- `ITR_PDF_DEBUG=true` → ver métricas completas
- `ITR_PDF_RENDERER=puppeteer` → probar Puppeteer explícitamente
