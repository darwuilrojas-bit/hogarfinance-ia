# Señales del agente de aprendizaje — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app registre cuándo el OCR no completó un campo, distinga si la factura no lo trae o si el agente falló, y use esa señal para dejar de preguntar lo que es normal y anticipar los campos problemáticos.

**Architecture:** Toda la lógica de decisión vive en un módulo de funciones puras (`senalesOcr.ts`) que no toca la base ni React. El formulario lo llama para saber qué registrar y qué preguntar; la ruta de OCR lee las señales acumuladas para ajustar la confianza. La escritura reutiliza la tabla `correcciones_ocr`, ampliada por migración.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL + RLS), Playwright (tests).

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-11-senales-ocr-design.md`.
- Alias de imports: `@/*` → `./src/*`.
- Los campos rastreados son exactamente dos: `numero_comprobante` y `fecha_vencimiento_2`.
- Un campo de valor único NUNCA se sustituye por una corrección previa. Solo `proveedor` y `categoria` admiten sustitución.
- Umbral para marcar un campo como problemático: **2 o más** señales `no_leido` para ese par (proveedor, campo).
- Confianza de un campo problemático: exactamente **60** (el valor que la especificación analítica ya usa para "revisalo" y que pinta el indicador en ámbar).
- Si falla la escritura de una señal, la factura se guarda igual. La señal es secundaria.
- Tests unitarios: `npx playwright test --project=unit` (no levanta dev server).
- Suite completa: `npx playwright test`.
- Comentarios y textos de interfaz en español rioplatense, como el resto del código.

---

### Task 1: Ejecutar la migración en Supabase

Esta tarea la ejecuta **el usuario**, no un agente. El código de las tareas siguientes falla sin ella: la restricción `correcciones_ocr_campo_check` rechaza el valor `numero_comprobante` y la columna `texto_original` todavía es obligatoria.

**Files:**
- Ya creado (no modificar): `supabase/migracion-senales-ocr.sql`

**Interfaces:**
- Consumes: nada.
- Produces: la tabla `correcciones_ocr` con columnas `tipo text not null default 'correccion'` y `proveedor text`; `texto_original` y `texto_corregido` nullables; `campo` admite `proveedor`, `monto`, `fecha`, `numero_comprobante`, `fecha_vencimiento_2`, `periodo`, `categoria`.

- [ ] **Step 1: Ejecutar el archivo**

Abrir Supabase Dashboard → SQL Editor → New query. Pegar el contenido completo de `supabase/migracion-senales-ocr.sql` y presionar Run.

Es idempotente: si ya se ejecutó, correrla de nuevo no rompe nada.

- [ ] **Step 2: Verificar la estructura resultante**

Ejecutar en el SQL Editor:

```sql
select column_name, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'correcciones_ocr'
 order by ordinal_position;
```

Esperado: aparecen las filas `tipo` y `proveedor`, y `texto_original` / `texto_corregido` figuran con `is_nullable = YES`.

- [ ] **Step 3: Verificar que la restricción admite el campo nuevo**

Ejecutar:

```sql
select 'numero_comprobante'::text = any (
  string_to_array(
    replace(replace(substring(pg_get_constraintdef(oid) from '\((.*)\)$'), '''', ''), ' ', ''),
    ','
  )
) as admite_numero_comprobante
from pg_constraint
where conname = 'correcciones_ocr_campo_check';
```

Esperado: `admite_numero_comprobante = true`.

Si devuelve `false` o no devuelve filas, la migración no se aplicó: repetir el Step 1 y revisar si el SQL Editor reportó un error.

---

### Task 2: Módulo de lógica pura

**Files:**
- Create: `src/features/facturas/lib/senalesOcr.ts`
- Test: `tests/unit/senalesOcr.spec.ts`

**Interfaces:**
- Consumes: nada (funciones puras, sin dependencias del proyecto).
- Produces:
  - `type CampoSenal = "numero_comprobante" | "fecha_vencimiento_2"`
  - `type RespuestaUsuario = "ausente" | "no_leido"`
  - `type LecturaOcr = { numero_comprobante: string | null; fecha_vencimiento_2: string | null }`
  - `type ValoresFormulario = { numero_comprobante: string; fecha_vencimiento_2: string }`
  - `type SenalPrevia = { campo: string; proveedor: string | null; tipo: string }`
  - `type FilaSenal = { usuario_id: string; campo: CampoSenal; tipo: "no_leido" | "ausente"; proveedor: string | null; texto_original: null; texto_corregido: string | null }`
  - `const ETIQUETAS_CAMPO: Record<CampoSenal, string>`
  - `function senalesAutomaticas(ocr: LecturaOcr | null, valores: ValoresFormulario, proveedor: string, usuarioId: string): FilaSenal[]`
  - `function camposAPreguntar(ocr: LecturaOcr | null, valores: ValoresFormulario, previas: SenalPrevia[], proveedor: string): CampoSenal[]`
  - `function registroDeRespuesta(campo: CampoSenal, respuesta: RespuestaUsuario, proveedor: string, usuarioId: string): FilaSenal`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/senalesOcr.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  camposAPreguntar,
  registroDeRespuesta,
  senalesAutomaticas,
  type LecturaOcr,
  type SenalPrevia,
  type ValoresFormulario,
} from "@/features/facturas/lib/senalesOcr";

const USUARIO = "user-1";
const PROVEEDOR = "AySA";

const VACIO: ValoresFormulario = {
  numero_comprobante: "",
  fecha_vencimiento_2: "",
};

test("no genera senal cuando el OCR leyo el campo", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: "0111B15587107",
    fecha_vencimiento_2: "16/07/2026",
  };
  const valores: ValoresFormulario = {
    numero_comprobante: "0111B15587107",
    fecha_vencimiento_2: "2026-07-16",
  };
  expect(senalesAutomaticas(ocr, valores, PROVEEDOR, USUARIO)).toEqual([]);
  expect(camposAPreguntar(ocr, valores, [], PROVEEDOR)).toEqual([]);
});

test("caso A: el OCR no leyo y el usuario lo completo a mano", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const valores: ValoresFormulario = {
    numero_comprobante: "0111B15587107",
    fecha_vencimiento_2: "",
  };

  expect(senalesAutomaticas(ocr, valores, PROVEEDOR, USUARIO)).toEqual([
    {
      usuario_id: USUARIO,
      campo: "numero_comprobante",
      tipo: "no_leido",
      proveedor: PROVEEDOR,
      texto_original: null,
      texto_corregido: "0111B15587107",
    },
  ]);

  // El que completo a mano ya quedo registrado: no se pregunta de nuevo.
  expect(camposAPreguntar(ocr, valores, [], PROVEEDOR)).toEqual([
    "fecha_vencimiento_2",
  ]);
});

test("caso B: el OCR no leyo y el campo quedo vacio", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  expect(senalesAutomaticas(ocr, VACIO, PROVEEDOR, USUARIO)).toEqual([]);
  expect(camposAPreguntar(ocr, VACIO, [], PROVEEDOR)).toEqual([
    "numero_comprobante",
    "fecha_vencimiento_2",
  ]);
});

test("no pregunta por un campo ya marcado ausente para ese proveedor", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "fecha_vencimiento_2", proveedor: "AySA", tipo: "ausente" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, PROVEEDOR)).toEqual([
    "numero_comprobante",
  ]);
});

test("una senal ausente de otro proveedor no aplica", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "fecha_vencimiento_2", proveedor: "Edesur", tipo: "ausente" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, PROVEEDOR)).toEqual([
    "numero_comprobante",
    "fecha_vencimiento_2",
  ]);
});

test("compara proveedores sin distinguir mayusculas ni tildes", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "numero_comprobante", proveedor: "  aysa  ", tipo: "ausente" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, "AySA")).toEqual([
    "fecha_vencimiento_2",
  ]);
});

test("una senal no_leido previa no silencia la pregunta", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "numero_comprobante", proveedor: "AySA", tipo: "no_leido" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, PROVEEDOR)).toEqual([
    "numero_comprobante",
    "fecha_vencimiento_2",
  ]);
});

test("si el OCR no corrio no se pregunta ni se registra nada", () => {
  expect(senalesAutomaticas(null, VACIO, PROVEEDOR, USUARIO)).toEqual([]);
  expect(camposAPreguntar(null, VACIO, [], PROVEEDOR)).toEqual([]);
});

test("cada respuesta produce su fila", () => {
  expect(
    registroDeRespuesta("numero_comprobante", "ausente", PROVEEDOR, USUARIO)
  ).toEqual({
    usuario_id: USUARIO,
    campo: "numero_comprobante",
    tipo: "ausente",
    proveedor: PROVEEDOR,
    texto_original: null,
    texto_corregido: null,
  });

  expect(
    registroDeRespuesta("numero_comprobante", "no_leido", PROVEEDOR, USUARIO)
  ).toEqual({
    usuario_id: USUARIO,
    campo: "numero_comprobante",
    tipo: "no_leido",
    proveedor: PROVEEDOR,
    texto_original: null,
    texto_corregido: null,
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx playwright test --project=unit senalesOcr`
Expected: FAIL — el módulo `@/features/facturas/lib/senalesOcr` no existe.

- [ ] **Step 3: Escribir la implementación**

Crear `src/features/facturas/lib/senalesOcr.ts`:

```ts
/**
 * Señales del agente de aprendizaje sobre los campos que el OCR no completó.
 *
 * Funciones puras: no tocan la base ni React. El formulario las usa para
 * decidir qué registrar en silencio y qué preguntarle al usuario.
 *
 * Spec: docs/superpowers/specs/2026-08-11-senales-ocr-design.md
 */

/** Campos opcionales que el OCR completa y que vale la pena rastrear. */
export type CampoSenal = "numero_comprobante" | "fecha_vencimiento_2";

/** Lo que el usuario responde cuando un campo quedó vacío. */
export type RespuestaUsuario = "ausente" | "no_leido";

/** Lo que devolvió el OCR para los campos rastreados. */
export type LecturaOcr = {
  numero_comprobante: string | null;
  fecha_vencimiento_2: string | null;
};

/** Lo que quedó cargado en el formulario al momento de guardar. */
export type ValoresFormulario = {
  numero_comprobante: string;
  fecha_vencimiento_2: string;
};

/** Una señal ya registrada, como viene de la base. */
export type SenalPrevia = {
  campo: string;
  proveedor: string | null;
  tipo: string;
};

/** Fila lista para insertar en correcciones_ocr. */
export type FilaSenal = {
  usuario_id: string;
  campo: CampoSenal;
  tipo: "no_leido" | "ausente";
  proveedor: string | null;
  texto_original: null;
  texto_corregido: string | null;
};

export const CAMPOS_RASTREADOS: CampoSenal[] = [
  "numero_comprobante",
  "fecha_vencimiento_2",
];

/** Cómo se nombra cada campo en el aviso al usuario. */
export const ETIQUETAS_CAMPO: Record<CampoSenal, string> = {
  numero_comprobante: "número de factura",
  fecha_vencimiento_2: "segundo vencimiento",
};

/** Normaliza un nombre de proveedor para compararlo. */
function normalizarProveedor(nombre: string | null): string {
  return (nombre ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Señales que se registran sin preguntar: el OCR no leyó el campo y el
 * usuario lo completó a mano. Que haya tenido que escribirlo es la
 * evidencia de que el agente falló.
 */
export function senalesAutomaticas(
  ocr: LecturaOcr | null,
  valores: ValoresFormulario,
  proveedor: string,
  usuarioId: string
): FilaSenal[] {
  if (!ocr) return [];
  return CAMPOS_RASTREADOS.filter(
    (campo) => ocr[campo] === null && valores[campo].trim() !== ""
  ).map((campo) => ({
    usuario_id: usuarioId,
    campo,
    tipo: "no_leido" as const,
    proveedor: proveedor.trim() || null,
    texto_original: null,
    texto_corregido: valores[campo].trim(),
  }));
}

/**
 * Campos por los que hay que preguntar: el OCR no los leyó, quedaron vacíos
 * y el usuario no marcó antes que ese proveedor no los trae.
 */
export function camposAPreguntar(
  ocr: LecturaOcr | null,
  valores: ValoresFormulario,
  previas: SenalPrevia[],
  proveedor: string
): CampoSenal[] {
  if (!ocr) return [];
  const actual = normalizarProveedor(proveedor);
  const yaMarcados = new Set(
    previas
      .filter(
        (s) => s.tipo === "ausente" && normalizarProveedor(s.proveedor) === actual
      )
      .map((s) => s.campo)
  );
  return CAMPOS_RASTREADOS.filter(
    (campo) =>
      ocr[campo] === null &&
      valores[campo].trim() === "" &&
      !yaMarcados.has(campo)
  );
}

/** La fila que produce cada botón del aviso. */
export function registroDeRespuesta(
  campo: CampoSenal,
  respuesta: RespuestaUsuario,
  proveedor: string,
  usuarioId: string
): FilaSenal {
  return {
    usuario_id: usuarioId,
    campo,
    tipo: respuesta,
    proveedor: proveedor.trim() || null,
    texto_original: null,
    texto_corregido: null,
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx playwright test --project=unit senalesOcr`
Expected: PASS — 9 tests.

- [ ] **Step 5: Verificar que el test detecta el bug**

Cambiar temporalmente en `camposAPreguntar` la línea `!yaMarcados.has(campo)` por `true`, correr el test y confirmar que falla el caso *"no pregunta por un campo ya marcado ausente"*. Restaurar la línea y volver a correr.

Un test que nunca falló no prueba nada.

- [ ] **Step 6: Commit**

```bash
git add src/features/facturas/lib/senalesOcr.ts tests/unit/senalesOcr.spec.ts
git commit -m "Agregar logica de senales del agente sobre campos no leidos por el OCR"
```

---

### Task 3: Registrar las señales automáticas al guardar

Solo el caso A: el OCR no leyó y el usuario completó a mano. Sin interfaz nueva. Al terminar esta tarea la app ya aprende de las correcciones manuales.

**Files:**
- Modify: `src/features/facturas/components/NuevaFacturaForm.tsx` (bloque de aprendizaje, alrededor de la línea 352)

**Interfaces:**
- Consumes: `senalesAutomaticas`, `type FilaSenal` de `@/features/facturas/lib/senalesOcr`.
- Produces: filas `no_leido` en `correcciones_ocr`. Nada que consuman tareas posteriores.

- [ ] **Step 1: Importar el módulo**

En el bloque de imports de `NuevaFacturaForm.tsx`, agregar:

```ts
import { senalesAutomaticas } from "@/features/facturas/lib/senalesOcr";
```

- [ ] **Step 2: Registrar las señales junto con las correcciones**

Reemplazar este bloque (línea ~352):

```ts
      if (correcciones.length > 0) {
        await supabase.from("correcciones_ocr").insert(correcciones);
      }
    }
```

por:

```ts
      // El OCR no leyó el campo y el usuario lo completó a mano: esa es la
      // evidencia de que el agente falló. Se registra sin preguntar.
      const automaticas = senalesAutomaticas(
        {
          numero_comprobante: ocr.numero_comprobante,
          fecha_vencimiento_2: ocr.fecha_vencimiento_2,
        },
        {
          numero_comprobante: numeroFactura,
          fecha_vencimiento_2: fechaVencimiento2,
        },
        proveedor,
        user.id
      );

      const filas = [...correcciones, ...automaticas];
      if (filas.length > 0) {
        // Si falla, la factura ya se guardó: la señal es secundaria.
        const { error: errorSenal } = await supabase
          .from("correcciones_ocr")
          .insert(filas);
        if (errorSenal) {
          console.error("No se pudieron registrar las señales:", errorSenal);
        }
      }
    }
```

- [ ] **Step 3: Verificar que compila y que el lint pasa**

Run: `npm run lint && npm run build`
Expected: sin errores; el build lista 19 rutas.

- [ ] **Step 4: Verificar en la app real**

Con la migración de la Task 1 ya ejecutada:

1. `npm run dev` y entrar con tu cuenta.
2. Cargar una factura por foto y borrar a mano el número que el OCR haya completado — o usar una factura cuyo número no lea.
3. Escribir el número a mano y guardar.
4. En Supabase → Table Editor → `correcciones_ocr`, confirmar que apareció una fila con `tipo = 'no_leido'`, `campo = 'numero_comprobante'` y el `proveedor` correspondiente.

Si la fila no aparece, mirar la consola del navegador: el `console.error` del Step 2 indica si la inserción fue rechazada (típicamente porque falta la migración).

- [ ] **Step 5: Commit**

```bash
git add src/features/facturas/components/NuevaFacturaForm.tsx
git commit -m "Registrar como senal los campos que el OCR no leyo y el usuario completo"
```

---

### Task 4: Aviso en el formulario para los campos que quedaron vacíos

El caso B. Aparece al tocar Guardar, no bloquea, y desaparece para siempre cuando el usuario marca un campo como ausente para ese proveedor.

**Files:**
- Create: `src/features/facturas/components/AvisoCamposVacios.tsx`
- Modify: `src/features/facturas/components/NuevaFacturaForm.tsx`

**Interfaces:**
- Consumes: `camposAPreguntar`, `registroDeRespuesta`, `ETIQUETAS_CAMPO`, `type CampoSenal`, `type RespuestaUsuario`, `type SenalPrevia` de `@/features/facturas/lib/senalesOcr`.
- Produces: componente `<AvisoCamposVacios campos onResponder />` donde `onResponder: (campo: CampoSenal, respuesta: RespuestaUsuario) => void`.

- [ ] **Step 1: Crear el componente del aviso**

Crear `src/features/facturas/components/AvisoCamposVacios.tsx`:

```tsx
"use client";

import {
  ETIQUETAS_CAMPO,
  type CampoSenal,
  type RespuestaUsuario,
} from "@/features/facturas/lib/senalesOcr";

/**
 * Aviso de los campos que el OCR no completó y quedaron vacíos.
 * No bloquea el guardado: responder es opcional.
 */
export function AvisoCamposVacios({
  campos,
  respondidos,
  onResponder,
}: {
  campos: CampoSenal[];
  respondidos: Partial<Record<CampoSenal, RespuestaUsuario>>;
  onResponder: (campo: CampoSenal, respuesta: RespuestaUsuario) => void;
}) {
  if (campos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-amber-50 px-4 py-3">
      {campos.map((campo) => {
        const respuesta = respondidos[campo];
        return (
          <div key={campo} className="flex flex-col gap-2">
            <p className="text-xs leading-relaxed text-amber-800">
              El <strong>{ETIQUETAS_CAMPO[campo]}</strong> quedó vacío.
              ¿La factura no lo trae, o no se pudo leer?
            </p>
            {respuesta ? (
              <p className="text-xs font-semibold text-amber-700">
                {respuesta === "ausente"
                  ? "✓ Anotado: esta factura no lo trae. No te lo volvemos a preguntar."
                  : "✓ Gracias, lo registramos para mejorar la lectura."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onResponder(campo, "ausente")}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 active:bg-amber-100"
                >
                  La factura no lo trae
                </button>
                <button
                  type="button"
                  onClick={() => onResponder(campo, "no_leido")}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 active:bg-amber-100"
                >
                  No se pudo leer
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Cargar las señales previas en el formulario**

En `NuevaFacturaForm.tsx`, ampliar el import de la Task 3:

```ts
import {
  camposAPreguntar,
  registroDeRespuesta,
  senalesAutomaticas,
  type CampoSenal,
  type RespuestaUsuario,
  type SenalPrevia,
} from "@/features/facturas/lib/senalesOcr";
import { AvisoCamposVacios } from "@/features/facturas/components/AvisoCamposVacios";
```

Agregar el estado, junto a los demás `useState` (alrededor de la línea 52):

```ts
  const [senalesPrevias, setSenalesPrevias] = useState<SenalPrevia[]>([]);
  const [camposVacios, setCamposVacios] = useState<CampoSenal[]>([]);
  const [respondidos, setRespondidos] = useState<
    Partial<Record<CampoSenal, RespuestaUsuario>>
  >({});
```

Y el efecto que las carga una sola vez al montar:

```ts
  useEffect(() => {
    let cancelado = false;
    async function cargarSenales() {
      const supabase = createClient();
      const { data } = await supabase
        .from("correcciones_ocr")
        .select("campo, proveedor, tipo")
        .eq("tipo", "ausente");
      if (!cancelado && data) setSenalesPrevias(data);
    }
    cargarSenales();
    return () => {
      cancelado = true;
    };
  }, []);
```

RLS ya limita la consulta a las filas del usuario: no hace falta filtrar por `usuario_id`.

- [ ] **Step 3: Mostrar el aviso en el primer intento de guardar**

En `guardar`, justo después de las validaciones de campos obligatorios (después de `if (!categoria) return setError("Elegí una categoría.");`), insertar:

```ts
    // Primer intento: si hay campos que el OCR no completó, avisar una vez.
    // No bloquea — el segundo toque guarda igual, se haya respondido o no.
    const aPreguntar = camposAPreguntar(
      ocr
        ? {
            numero_comprobante: ocr.numero_comprobante,
            fecha_vencimiento_2: ocr.fecha_vencimiento_2,
          }
        : null,
      {
        numero_comprobante: numeroFactura,
        fecha_vencimiento_2: fechaVencimiento2,
      },
      senalesPrevias,
      proveedor
    );
    if (aPreguntar.length > 0 && camposVacios.length === 0) {
      setCamposVacios(aPreguntar);
      return;
    }
```

- [ ] **Step 4: Renderizar el aviso y cambiar el texto del botón**

Reemplazar el bloque final del formulario (alrededor de la línea 539):

```tsx
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" loading={guardando} disabled={procesando !== null}>
        {editando ? "Guardar cambios" : "Guardar factura"}
      </Button>
```

por:

```tsx
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <AvisoCamposVacios
        campos={camposVacios}
        respondidos={respondidos}
        onResponder={(campo, respuesta) =>
          setRespondidos((r) => ({ ...r, [campo]: respuesta }))
        }
      />

      <Button type="submit" loading={guardando} disabled={procesando !== null}>
        {camposVacios.length > 0
          ? "Guardar igual"
          : editando
            ? "Guardar cambios"
            : "Guardar factura"}
      </Button>
```

- [ ] **Step 5: Guardar las respuestas junto con las demás señales**

En el bloque de aprendizaje modificado en la Task 3, cambiar:

```ts
      const filas = [...correcciones, ...automaticas];
```

por:

```ts
      const respuestas = (
        Object.entries(respondidos) as [CampoSenal, RespuestaUsuario][]
      ).map(([campo, respuesta]) =>
        registroDeRespuesta(campo, respuesta, proveedor, user.id)
      );

      const filas = [...correcciones, ...automaticas, ...respuestas];
```

- [ ] **Step 6: Verificar que compila y que el lint pasa**

Run: `npm run lint && npm run build`
Expected: sin errores.

Si el lint reporta `react-hooks/set-state-in-effect`, revisar que el `useState` de `senalesPrevias` esté declarado **antes** del `useEffect` que lo usa: es el error que ya apareció antes en este proyecto.

- [ ] **Step 7: Verificar en la app real**

1. `npm run dev`, cargar una factura y dejar el número vacío.
2. Tocar **Guardar factura** → aparece el aviso y el botón pasa a **Guardar igual**. La factura no se guardó todavía.
3. Tocar **Guardar igual** sin responder → la factura se guarda.
4. Repetir, esta vez tocando **La factura no lo trae** antes de guardar. Confirmar en Supabase que se insertó una fila `tipo = 'ausente'`.
5. Cargar otra factura del mismo proveedor con el mismo campo vacío → el aviso **ya no aparece** para ese campo.

- [ ] **Step 8: Commit**

```bash
git add src/features/facturas/components/AvisoCamposVacios.tsx src/features/facturas/components/NuevaFacturaForm.tsx
git commit -m "Avisar al guardar cuando el OCR dejo campos sin completar"
```

---

### Task 5: Usar la señal en la ruta de OCR

Cierra el ciclo: las señales acumuladas vuelven a la extracción.

**Files:**
- Modify: `src/app/api/ocr/route.ts` (consulta de correcciones ~línea 277, cálculo de confianza ~línea 403)

**Interfaces:**
- Consumes: filas `no_leido` de `correcciones_ocr` escritas por las Tasks 3 y 4.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Traer tipo y proveedor en la consulta**

En la consulta de `correcciones_ocr` (~línea 279), cambiar:

```ts
      .select("campo, texto_original, texto_corregido")
```

por:

```ts
      .select("campo, texto_original, texto_corregido, tipo, proveedor")
```

- [ ] **Step 2: Contar las fallas del proveedor leído**

Inmediatamente después del bloque de correcciones exactas (después del `if (resultado.fecha_pago) { ... }` que termina alrededor de la línea 336), agregar:

```ts
  // Señales de campos que este proveedor viene fallando. Dos o más fallas
  // marcan el campo como problemático: una sola puede ser un mal escaneo.
  const UMBRAL_CAMPO_PROBLEMATICO = 2;
  const proveedorLeido = normalizar(resultado.proveedor ?? "");
  const fallasNumero = correcciones.filter(
    (c) =>
      c.tipo === "no_leido" &&
      c.campo === "numero_comprobante" &&
      normalizar(c.proveedor ?? "") === proveedorLeido
  ).length;
  const numeroEsProblematico =
    proveedorLeido !== "" && fallasNumero >= UMBRAL_CAMPO_PROBLEMATICO;

  if (numeroEsProblematico) {
    resultado.aprendizaje.push(
      `En ${resultado.proveedor} el número de factura suele fallar: revisalo.`
    );
  }
```

La consulta ya pide 200 filas ordenadas por fecha, así que no hace falta otra ida a la base.

- [ ] **Step 3: Limitar la confianza del campo problemático**

En el objeto de confianza (~línea 403), reemplazar:

```ts
    numero_comprobante: puntuar(
      resultado.numero_comprobante !== null,
      resultado.numero_comprobante
        ? // Los identificadores reales combinan letras y números
          // (el LSP de AySA, por ejemplo: 0111B15587107).
          /^[A-Za-z0-9\-./ ]{6,}$/.test(resultado.numero_comprobante)
        : null
    ),
```

por:

```ts
    numero_comprobante: numeroEsProblematico
      ? // Aunque el formato sea válido, este proveedor viene fallando:
        // 60 es el puntaje de "revisalo" y pinta el indicador en ámbar.
        Math.min(
          60,
          puntuar(
            resultado.numero_comprobante !== null,
            resultado.numero_comprobante
              ? /^[A-Za-z0-9\-./ ]{6,}$/.test(resultado.numero_comprobante)
              : null
          )
        )
      : puntuar(
          resultado.numero_comprobante !== null,
          resultado.numero_comprobante
            ? // Los identificadores reales combinan letras y números
              // (el LSP de AySA, por ejemplo: 0111B15587107).
              /^[A-Za-z0-9\-./ ]{6,}$/.test(resultado.numero_comprobante)
            : null
        ),
```

`Math.min` preserva el 0 cuando el campo no se leyó: un campo ausente no debe subir a 60.

- [ ] **Step 4: Verificar que compila y que el lint pasa**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificar el ciclo completo en la app real**

1. Registrar dos señales `no_leido` de `numero_comprobante` para el mismo proveedor (cargando dos facturas de ese proveedor y completando el número a mano, como en la Task 3).
2. Cargar una tercera factura del mismo proveedor.
3. Confirmar que aparece el mensaje *"En AySA el número de factura suele fallar: revisalo"* en el bloque de aprendizaje, y que el indicador del número queda en ámbar aunque se haya leído bien.

- [ ] **Step 6: Correr la suite completa**

Run: `npx playwright test`
Expected: PASS — los 5 unitarios de `campos.spec.ts`, los 9 de `senalesOcr.spec.ts` y los 16 e2e.

- [ ] **Step 7: Commit y despliegue**

```bash
git add src/app/api/ocr/route.ts
git commit -m "Usar las senales acumuladas para anticipar campos problematicos en el OCR"
git push
npx vercel --prod --yes
```

---

## Verificación final

- [ ] La migración está aplicada en Supabase.
- [ ] `npx playwright test` pasa entero.
- [ ] Cargar una factura con el número vacío muestra el aviso y no bloquea.
- [ ] Responder "La factura no lo trae" hace que no vuelva a preguntar para ese proveedor.
- [ ] Completar a mano un campo no leído registra la señal sin preguntar nada.
- [ ] Producción responde 200 y sirve el build nuevo.
