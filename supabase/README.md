# Base de datos — HogarFinance IA

## Cómo aplicar el esquema

1. Abrí el dashboard de tu proyecto:
   https://supabase.com/dashboard/project/xzvauozbwdfwczqzoujj
2. Menú lateral → **SQL Editor** → **New query**
3. Copiá todo el contenido de [`schema.sql`](./schema.sql) y pegalo
4. Botón **Run** (o `Ctrl+Enter`)

El script es **idempotente**: podés ejecutarlo de nuevo sin duplicar nada.

## Qué crea

| Objeto | Descripción |
| --- | --- |
| `usuarios` | Perfil de cada usuario (extiende `auth.users`), con presupuesto mensual |
| `gastos` | Gastos/facturas con período, categoría, estado y link al comprobante |
| `proveedores` | Proveedores habituales con día de vencimiento y monto promedio |
| `alertas` | Avisos de vencimiento, anomalía o presupuesto excedido |
| `correcciones_ocr` | Correcciones del usuario a lecturas de la IA (para aprender) |
| Trigger `on_auth_user_created` | Crea el perfil automáticamente al registrarse |
| Trigger `gastos_set_fecha_actualizacion` | Mantiene `fecha_actualizacion` al día |
| RLS en todas las tablas | Cada usuario solo ve y modifica sus propios datos |
| Bucket `comprobantes` (privado) | Imágenes en carpetas `{usuario_id}/...`, cada uno accede solo a la suya |

## Convención de Storage

Las imágenes de comprobantes se suben al bucket `comprobantes` con la ruta:

```
{usuario_id}/{nombre-del-archivo}
```

Las políticas de seguridad dependen de esa estructura de carpetas: si el
primer segmento de la ruta no es el `auth.uid()` del usuario, la operación
se rechaza.
