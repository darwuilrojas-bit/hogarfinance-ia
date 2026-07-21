# Especificación analítica — HogarFinance IA

Formalización de los componentes analíticos del sistema: detección de
anomalías con estacionalidad, cálculo de confianza del OCR y
priorización de alertas. Cada sección define el mecanismo matemático
y referencia el archivo que lo implementa.

---

## 1. Detección de anomalías (con estacionalidad)

**Implementación:** `src/features/alertas/lib/anomalias.ts` →
`evaluarAnomalia()`. La usan el guardado de gastos
(`NuevoComprobanteForm`) y el motor de alertas (`generarAlertas`),
compartiendo el mismo mensaje para que el deduplicado evite avisos
dobles.

### Definiciones

Para un gasto de monto `x` del proveedor `p` en el período de
referencia `t` (mes/año):

- **Ventana reciente** `V = {x₍t₋₁₎, x₍t₋₂₎, x₍t₋₃₎}`: montos del mismo
  proveedor en los 3 períodos anteriores (los que existan).
- **μ₃** = media aritmética de `V`.
- **σ** = desviación estándar muestral de `V` (0 si `|V| < 2`).
- **m₁₂** = media de los montos del mismo proveedor en el **mismo mes
  del año anterior** (componente estacional), si existe.

### Línea base esperada (B)

```
B = 0.5·μ₃ + 0.5·m₁₂    si existe m₁₂
B = μ₃                  si no existe historial del año anterior
```

La mezcla 50/50 incorpora la estacionalidad: una factura de gas de
julio se compara también contra el julio anterior, no solo contra el
otoño reciente. Con menos de un año de datos, el sistema degrada con
gracia a la ventana reciente.

### Umbral de tolerancia (U)

```
U = max(0.2·B, σ)
```

- El piso relativo (20 % de la línea base) mantiene el criterio de
  producto original ("+20 % sobre el promedio").
- El término `σ` evita falsos positivos en proveedores con montos
  naturalmente volátiles: si el servicio siempre varía mucho, hace
  falta un desvío mayor para considerarlo anómalo.

### Decisión

```
esAnomalía(x) ⇔ x > B + U
```

Si no hay historial (`V = ∅`), no se evalúa (sin línea base no hay
anomalía definible). El mensaje reporta el desvío relativo
`Δ% = (x/B − 1)·100` y el valor esperado `B`.

---

## 2. Confianza del OCR por campo

**Implementación:** `src/app/api/ocr/route.ts` → `puntuarConfianza()`.
El puntaje se calcula **después** de aplicar el agente de aprendizaje
(correcciones conocidas y coincidencia difusa de proveedores).

### Fórmula

Para cada campo extraído `c`:

```
C(c) = 0                                  si el campo es null
C(c) = 75 + 25·k − 15·(1−k)               si el campo fue extraído
```

donde los 75 puntos base corresponden a extracción exitosa (50) más
validación de formato superada (25 — el pipeline descarta valores mal
formados antes de puntuar), y `k ∈ {0, 1}` indica **consistencia con
el historial del usuario** según el criterio del campo. Si no hay
historial para evaluar, el término de consistencia se omite y
`C = 75`. El resultado se recorta a `[0, 100]`.

### Criterios de consistencia por campo

| Campo | k = 1 cuando… |
| --- | --- |
| `proveedor` | coincide (exacto o difuso) con un proveedor registrado |
| `monto` | está entre 0.5× y 1.5× del promedio histórico del proveedor |
| `fecha_pago` | no es futura (>7 días) ni anterior a 120 días |
| `periodo` | dista ≤ 1 mes del mes de la fecha de pago extraída |
| `numero_comprobante` | tiene formato de comprobante (≥ 6 caracteres numéricos/guiones) |
| `categoria` | coincide con la categoría registrada del proveedor |

### Interpretación en la interfaz (Human in the Loop)

| Puntaje | Nivel | Indicador |
| --- | --- | --- |
| ≥ 75 | Alta | ✔ verde |
| 50–74 | Media | ~ ámbar |
| 1–49 | Baja | ⚠ ámbar |
| 0 (null) | No leído | ⚠ ámbar — requiere al usuario |

El usuario siempre puede editar cualquier campo; sus correcciones se
registran en `correcciones_ocr` y retroalimentan al agente de
aprendizaje (fuzzy matching + correcciones exactas), cerrando el ciclo.

---

## 3. Priorización de alertas y resolución de conflictos

**Implementación:** `src/features/alertas/lib/prioridad.ts` →
`puntajeUrgencia()` / `ordenarPorUrgencia()`. Lo usa el panel de
notificaciones.

### Puntaje de urgencia

```
S(a) = W(tipo) − 2·d(a)
```

- `W`: peso por tipo — presupuesto 100, vencimiento 80, anomalía 60,
  resumen 40. Refleja el impacto económico de ignorar cada aviso.
- `d(a)`: antigüedad de la alerta en días. El decaimiento de 2
  puntos/día hace que una alerta urgente vieja no tape indefinidamente
  a una nueva de menor tipo (p. ej., un vencimiento de hoy supera a un
  aviso de presupuesto de hace dos semanas).

Orden final del panel: no leídas primero (por `S` descendente), luego
leídas (por fecha descendente).

### Resolución de conflictos (por qué no se duplican avisos)

1. **Deduplicado por mensaje canónico**: cada regla construye un
   mensaje determinístico; antes de insertar se compara contra los
   mensajes de los últimos 60 días. La misma condición nunca genera
   dos alertas.
2. **Una alerta por (proveedor, período, tramo)**: los mensajes de
   vencimiento incluyen la fecha concreta, por lo que el tramo urgente
   (≤3 días) y el preventivo (≤ días configurados) no colisionan.
3. **Fuente única de anomalías**: el guardado de gastos y el motor
   comparten `evaluarAnomalia` + `mensajeAnomalia`, así ambas vías
   producen el mismo texto y el deduplicado los unifica.
4. **Preferencias del usuario**: cada familia de alertas puede
   apagarse por separado (`usuarios.alertas_*`), y el aviso preventivo
   de vencimiento usa `alertas_dias_anticipacion` (3/5/7/10).

---

## 4. Otras garantías ya implementadas

- **Aprendizaje del OCR**: correcciones exactas (tabla
  `correcciones_ocr`) + coincidencia difusa de proveedores
  (normalización + distancia de Levenshtein con tolerancia 1–2 según
  longitud). `src/app/api/ocr/route.ts`.
- **Evidencia**: reporte PDF con datos del pago, imagen incrustada,
  sello de fecha de registro e historial (`generarReportePdf.ts`).
- **Aislamiento de datos**: RLS en todas las tablas y bucket privado
  con carpetas por usuario (`supabase/schema.sql`).
