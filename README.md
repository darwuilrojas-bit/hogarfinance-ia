# HogarFinance IA 🏠💰

**Sistema inteligente de gestión de facturas y comprobantes del hogar**, con lectura
automática de facturas por visión artificial (OCR con IA), aprendizaje de correcciones,
alertas de vencimiento y generación de evidencia de pago para disputas de deuda.

Proyecto final del curso **Inteligencia Artificial Aplicada a Organizaciones**
(UTN · Facultad Regional Buenos Aires), desarrollado en co-work con IA
(Claude Code) bajo un enfoque *Human-in-the-Loop*.

| Recurso | Link |
| --- | --- |
| 🌐 **Aplicación en producción** | https://hogarfinance-ia.vercel.app |
| 📐 **Diagramas de arquitectura** | [docs/arquitectura.md](docs/arquitectura.md) |
| 🧮 **Especificación analítica** (fórmulas de anomalías, confianza OCR, prioridad de alertas) | [docs/especificacion-analitica.md](docs/especificacion-analitica.md) |
| 🗄️ **Esquema de base de datos y migraciones** | [supabase/](supabase/) |

---

## ¿Qué problema resuelve?

En Argentina, los servicios del hogar (luz, agua, gas, internet, alquiler, expensas)
generan un flujo constante de facturas en papel y PDF, con **dos vencimientos**,
recargos, y la necesidad de **guardar los comprobantes de pago** por si un proveedor
reclama una deuda ya paga. HogarFinance IA convierte ese caos en un ciclo ordenado:

**Llega la factura → la IA la lee → la app avisa antes del vencimiento → registrás
el pago con su comprobante → factura y pago quedan macheados → si alguien reclama,
generás un reporte de evidencia en PDF en dos toques.**

## Funcionalidades principales

- 📄 **Panel de Facturas** — cargás la foto o PDF de la factura; un agente de OCR
  (GPT-4o-mini con visión) extrae proveedor, monto exacto, período, número de
  factura y **ambos vencimientos**, con un **indicador de confianza por campo**
  (verde/ámbar) para que el humano valide antes de guardar.
- 🧠 **Agente de aprendizaje** — cada corrección que hacés se guarda
  (`correcciones_ocr`) y se aplica automáticamente en lecturas futuras; los nombres
  de proveedor se normalizan con *coincidencia difusa* (distancia de Levenshtein).
- 💳 **Panel de Comprobantes** — al pagar, elegís qué factura estás pagando, subís
  el comprobante y quedan **macheados** (`factura ⇄ comprobante_pago`). Buscador
  con filtros combinables y búsqueda en tiempo real.
- 🔔 **Alertas automáticas** — motor que corre al abrir la app: vencimientos
  próximos (con anticipación configurable), **anomalías de monto** (línea base
  estacional + umbral estadístico), presupuesto al 90 % y resumen mensual.
- 📊 **Gastos y Reportes** — historial mensual de pagos, análisis por categoría,
  evolución de 3/6/12 meses e insights automáticos.
- 🧾 **Reporte de Evidencia de Pago (PDF)** — documento formal con los datos del
  pago, el comprobante incrustado, sello de registro e historial del proveedor,
  generado en el navegador con jsPDF.
- 🔐 **Multiusuario seguro** — registro/login por email, recuperación de
  contraseña, y **Row Level Security**: cada usuario solo ve sus propios datos
  y archivos.

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js 16 (React 19) · Tailwind CSS 4 · TypeScript |
| Backend | Next.js Route Handlers (Node.js) + Proxy de sesión |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Autenticación | Supabase Auth (email/contraseña + recuperación) |
| Archivos | Supabase Storage (bucket privado, carpetas por usuario, URLs firmadas) |
| IA (OCR de facturas) | OpenAI GPT-4o-mini (visión, JSON estructurado) |
| Orquestación | Código propio en TypeScript (pipeline OCR → aprendizaje → validación humana → persistencia → alertas) |
| PDFs | jsPDF + jspdf-autotable (generación) · pdfjs-dist (render de PDF a imagen para OCR) |
| Despliegue | Vercel (build automático, variables de entorno cifradas) |

## Arquitectura

Los diagramas completos —arquitectura general, flujo de agentes y tres vistas UML
(casos de uso, secuencia y clases)— están en
**[docs/arquitectura.md](docs/arquitectura.md)**; GitHub los renderiza
directamente en el navegador.

En resumen: el frontend móvil-first consulta Supabase directamente (protegido por
RLS); la única lógica de servidor sensible es `/api/ocr`, que custodia la clave de
OpenAI, firma URLs temporales del bucket privado y aplica el agente de aprendizaje
antes de devolver el resultado con puntajes de confianza. La **memoria persistente**
del sistema vive en PostgreSQL: `facturas`, `comprobantes_pago`, `proveedores`
(estadísticas aprendidas), `correcciones_ocr` (memoria del agente de aprendizaje)
y `alertas`.

## Cómo correrlo localmente

```bash
git clone https://github.com/darwuilrojas-bit/hogarfinance-ia.git
cd hogarfinance-ia
npm install
```

1. Crear un proyecto gratuito en [Supabase](https://supabase.com) y ejecutar, en
   el SQL Editor y en este orden: `supabase/schema.sql`,
   `supabase/migracion-perfil.sql`, `supabase/migracion-resumen.sql`,
   `supabase/migracion-facturas.sql`, `supabase/migracion-facturas-comprobantes.sql`.
2. Copiar `.env.example` a `.env.local` y completar:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Settings → API)
   - `OPENAI_API_KEY` (para el OCR; sin ella la app funciona con carga manual)
3. `npm run dev` y abrir http://localhost:3000

## Estructura del proyecto

```
src/
├── app/                # Rutas (App Router): (auth), (app), api/ocr
├── components/         # UI compartida (inputs, navegación, confianza OCR)
├── features/           # Código organizado por funcionalidad
│   ├── facturas/       # Alta y listado de facturas con OCR
│   ├── comprobantes/   # Registro de pagos, buscador, evidencia PDF
│   ├── gastos/         # Historial mensual y análisis
│   ├── alertas/        # Motor de alertas, anomalías, vencimientos
│   ├── dashboard/      # Resumen, gráfico por categorías
│   ├── reportes/       # Análisis 3/6/12 meses con insights
│   └── auth/           # Login, registro, perfil, recuperación
├── lib/                # Supabase, formato es-AR, fechas, PDF→imagen
└── proxy.ts            # Protección de rutas y refresco de sesión
docs/                   # Arquitectura y especificación analítica
supabase/               # Esquema SQL, RLS y migraciones
```

## Seguridad

- **RLS en todas las tablas** y en Storage: imposible leer datos de otro usuario
  incluso conociendo sus IDs.
- **Clave de OpenAI solo en el servidor** (`/api/ocr`); `.env*` excluido de git.
- **Salida del modelo tratada como no confiable**: el JSON del OCR se valida y
  normaliza campo por campo (fechas por regex, montos con parser de formato
  argentino, categorías contra lista blanca) antes de tocar la base.
- **Archivos privados** con URLs firmadas de corta duración.
- Eliminación de cuenta con función `SECURITY DEFINER` que solo puede borrar la
  cuenta propia (`auth.uid()`), con borrado en cascada.

---

Hecho con 🤖 + 🧉 — Darwuil Rojas · UTN FRBA · 2026
