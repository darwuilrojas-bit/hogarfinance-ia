# Señales del agente de aprendizaje: campos que el OCR no completó

**Fecha:** 2026-08-11
**Estado:** aprobado, pendiente de implementar

---

## Problema

Una factura de AySA se guardó con el número de factura vacío y nadie se enteró
hasta revisarla a mano. El sistema tenía la información para avisar —el campo
había quedado en blanco después de correr el OCR— pero no hacía nada con ella.

Hay dos causas posibles cuando un campo queda vacío, y hoy son
indistinguibles:

1. **La factura realmente no lo trae.** Muchas facturas no tienen segundo
   vencimiento. No hay nada que arreglar.
2. **El agente no lo leyó.** Es un defecto: o el prompt es ambiguo, o el
   modelo falla con el formato de ese proveedor.

Sin distinguirlas, no se puede ni avisar bien al usuario ni saber qué
proveedores le cuestan al OCR.

## Objetivo

Que al guardar una factura con campos vacíos el usuario decida cuál de las dos
causas es, y que esa respuesta alimente al agente de aprendizaje.

## Restricción de diseño: dos clases de campo

El agente de aprendizaje actual funciona por **sustitución exacta**: si el OCR
lee `X` y el usuario alguna vez lo corrigió a `Y`, la próxima vez reemplaza `X`
por `Y`.

Ese mecanismo sirve para un campo cuyo valor es un mapeo estable:

```
"Agua y Saneamientos Argentinos S.A." → "AySA"     ← siempre, en toda factura
```

Y es **destructivo** para un campo cuyo valor cambia en cada factura:

```
"LSP" → "0111B15587107"    ← estamparía el número de junio en la factura de julio
```

De ahí la distinción que estructura todo el diseño:

| Clase | Campos | Sustitución |
| --- | --- | --- |
| **Mapeo estable** | `proveedor`, `categoria` | Sí — comportamiento actual |
| **Valor único** | `numero_comprobante`, `monto`, fechas, `periodo` | **Nunca** |

Para los campos de valor único, lo aprendible no es el valor sino el **patrón
de falla**: *"en facturas de AySA, el número de comprobante falla seguido"*.

## Modelo de datos

Migración: `supabase/migracion-senales-ocr.sql` (escrita, sin ejecutar).

`correcciones_ocr` pasa a registrar tres clases de fila:

| `tipo` | Cuándo se registra | `texto_original` | `texto_corregido` |
| --- | --- | --- | --- |
| `correccion` | El OCR leyó algo y el usuario lo cambió | lo que leyó el OCR | lo que puso el usuario |
| `no_leido` | El OCR no lo leyó: el usuario lo completó a mano, o reportó la falla | `null` | lo que puso el usuario, o `null` si lo dejó vacío |
| `ausente` | El OCR no lo leyó y la factura no lo trae | `null` | `null` |

Cambios sobre la tabla:

- `campo` admite además `numero_comprobante`, `fecha_vencimiento_2`,
  `periodo` y `categoria`. La restricción admite más campos de los que la
  interfaz rastrea hoy: como cada migración la ejecuta el usuario a mano,
  conviene dejar la lista completa y no pedirle otra migración por cada campo
  que se sume después.
- `texto_original` y `texto_corregido` pasan a ser opcionales: un campo no
  leído no tiene texto original.
- Nueva columna `tipo`, con default `'correccion'` para que las filas
  existentes queden clasificadas sin tocarlas.
- Nueva columna `proveedor`: es lo que permite aprender *"en AySA este campo
  falla"* en lugar de *"este campo falla siempre"*.
- Índice sobre `(usuario_id, proveedor, campo, tipo)`, que es la consulta del
  agente.

Las políticas RLS filtran por `usuario_id` y no se ven afectadas.

## Flujo de la interfaz

El disparador es **lo que devolvió el OCR**, no lo que quedó en el formulario.
Si el OCR no leyó un campo, hay dos caminos según qué hizo el usuario:

**Caso A — el usuario lo completó a mano.** El campo no está vacío, pero el
agente igual falló: que el usuario haya tenido que escribirlo *es* la
evidencia. Se registra `no_leido` con lo que escribió, en silencio y sin
preguntar nada. Es la señal más valiosa y la que menos molesta.

**Caso B — el campo quedó vacío.** Ahí sí hace falta preguntar, porque la app
no puede saber si falta en la factura o si el agente falló. El aviso aparece
**apenas termina la lectura**, mientras el usuario revisa los datos, y no al
guardar: que el botón «Guardar factura» no guarde se lee como un error de la
app. Si el usuario escribe el dato a mano, el aviso desaparece solo y el caso
pasa a ser el A.

```
El número de factura quedó vacío.
¿La factura no lo trae, o no se pudo leer?

[ La factura no lo trae ]   [ No se pudo leer ]
```

Reglas:

- **No bloquea.** El botón guarda siempre, se haya respondido o no.
  Responder es opcional y toma un toque.
- Elegir *"La factura no lo trae"* registra `ausente`.
- Elegir *"No se pudo leer"* registra `no_leido`.
- El aviso aparece solo si el OCR corrió. Si el usuario cargó la factura a
  mano, no tiene sentido preguntarle si el agente falló.

**Campos rastreados:** `numero_comprobante` y `fecha_vencimiento_2`. Son los
únicos campos opcionales que el OCR completa. Los obligatorios (proveedor,
monto, primer vencimiento, categoría) ya bloquean el guardado hoy y no
cambian.

## Uso de la señal

Dos usos concretos. Nada especulativo.

**1. Dejar de preguntar por lo que es normal.** Si para un proveedor y un
campo existe al menos una señal `ausente`, el aviso no vuelve a aparecer para
esa combinación. Si las facturas de internet nunca traen segundo vencimiento,
el usuario lo dice una vez.

Esto es lo que evita que la funcionalidad se vuelva molesta con el uso, y es
la razón por la que `ausente` se registra en vez de descartarse.

**2. Anticipar el campo problemático.** Si para un proveedor y un campo hay
**dos o más** señales `no_leido`, la ruta de OCR agrega una nota al arreglo
`aprendizaje` que ya devuelve —*"En AySA este campo suele fallar: revisalo"*—
y limita la confianza de ese campo a **60**, aunque el modelo haya devuelto
algo con buen formato.

Sesenta es el puntaje que la especificación analítica ya usa para "contradice
el historial", y es el que renderiza el indicador en ámbar. No se inventa una
categoría nueva: se reutiliza la que significa *revisalo*.

El umbral es dos para no reaccionar a una falla aislada.

## Estructura del código

`NuevaFacturaForm.tsx` ya es un archivo grande. La lógica nueva va a un módulo
propio, `src/features/facturas/lib/senalesOcr.ts`, con funciones puras:

- `camposNoLeidos(ocr)` → qué campos rastreados no devolvió el OCR.
- `senalesAutomaticas(ocr, valores, proveedor)` → las filas `no_leido` del
  caso A, que se registran sin preguntar.
- `camposAPreguntar(ocr, valores, señalesPrevias, proveedor)` → los del caso
  B, filtrando los ya marcados `ausente` para ese proveedor.
- `registroDeRespuesta(campo, respuesta, proveedor, usuarioId)` → la fila que
  produce cada botón del aviso.

El formulario solo llama a estas funciones y renderiza. La escritura en la
base sigue el patrón actual: se inserta junto con las correcciones, después de
guardar la factura.

## Alcance

**Incluye:** la migración, el módulo de lógica, el aviso en el formulario de
facturas, y los dos usos de la señal.

**No incluye:**

- El formulario de comprobantes de pago. Mismo patrón, pero se hace después
  de validar este.
- Una pantalla para ver las señales acumuladas. La consulta se puede hacer
  desde Supabase mientras tanto.
- Ajuste automático del prompt a partir de las señales. La señal informa a una
  persona; no se reescribe el prompt solo.

## Testing

Unitarios sobre las tres funciones puras, sin navegador, en `tests/unit/`:

- Un campo que el OCR completó no se pregunta ni genera señal.
- Un campo que el OCR no leyó y el usuario completó a mano genera `no_leido`
  automático, sin preguntar (caso A).
- Un campo que el OCR no leyó y quedó vacío se pregunta (caso B).
- Un campo vacío con señal `ausente` previa para ese proveedor no se pregunta.
- Un campo vacío con señal `ausente` de **otro** proveedor sí se pregunta.
- Cada respuesta produce la fila correcta.
- Si el OCR no corrió, no se pregunta nada ni se genera señal.

## Riesgos

**La migración la ejecuta el usuario.** Si el código llega a producción antes
que la migración, las inserciones fallan por la restricción `campo`. Mitigación:
correr la migración antes de desplegar, y que un fallo al insertar la señal no
impida guardar la factura —la señal es secundaria, la factura es el dato real.

**El aviso puede resultar molesto.** Mitigado por la regla de `ausente`: cada
respuesta reduce las preguntas futuras. Si aun así molesta, el umbral y los
campos rastreados están en un solo módulo y son fáciles de ajustar.
