# Arquitectura — HogarFinance IA

Tres vistas del sistema: arquitectura general (componentes y flujo de datos),
flujo de agentes con su ciclo de retroalimentación, y un diagrama UML de
secuencia de la interacción principal (cargar una factura con OCR).

---

## 1. Diagrama de arquitectura general

Convención: los nodos marcados **[IA]** son componentes de inteligencia
artificial; el resto es lógica tradicional. La **memoria persistente** del
sistema vive en PostgreSQL y Storage (racimo inferior derecho).

```mermaid
flowchart LR
    subgraph Cliente["📱 Cliente (móvil / web)"]
        UI["Frontend Next.js + Tailwind<br/>(React, móvil-first)"]
    end

    subgraph Vercel["☁️ Vercel"]
        PROXY["Proxy de sesión<br/>(protección de rutas)"]
        OCR_API["/api/ocr — Agente OCR [IA]<br/>+ Agente de Aprendizaje [IA]<br/>+ puntaje de confianza por campo"]
        PDF["Generador de PDFs<br/>(evidencia de pago — jsPDF)"]
        MOTOR["Motor de Alertas [IA]<br/>vencimientos · anomalías ·<br/>presupuesto · resumen mensual"]
    end

    OPENAI["🧠 OpenAI GPT-4o-mini<br/>(visión — extracción de facturas)"]

    subgraph Supabase["🗄️ Supabase — memoria persistente"]
        AUTH["Auth<br/>(email + recuperación)"]
        DB[("PostgreSQL + RLS<br/>facturas · comprobantes_pago<br/>proveedores · alertas ·<br/>correcciones_ocr · usuarios")]
        STORAGE[("Storage privado<br/>imágenes de facturas y<br/>comprobantes, por usuario")]
    end

    UI -->|"navegación"| PROXY
    UI -->|"consultas con RLS"| DB
    UI -->|"sube foto/PDF"| STORAGE
    UI -->|"pide extracción"| OCR_API
    UI --> PDF
    UI --> MOTOR
    OCR_API -->|"URL firmada de la imagen"| STORAGE
    OCR_API -->|"prompt + imagen"| OPENAI
    OCR_API -->|"lee correcciones y proveedores<br/>(memoria del aprendizaje)"| DB
    MOTOR -->|"lee facturas/pagos,<br/>escribe alertas"| DB
    PROXY --> AUTH

    classDef ia fill:#eaf1fe,stroke:#1F6FEB,stroke-width:2px
    classDef memoria fill:#e6f4f0,stroke:#0D9276,stroke-width:2px
    class OCR_API,MOTOR,OPENAI ia
    class DB,STORAGE memoria
```

**Flujo de datos de entrada a salida:** el usuario sube una factura (entrada) →
Storage la guarda → `/api/ocr` la envía al modelo de visión y aplica el
aprendizaje → el frontend muestra los campos pre-completados con su confianza →
el humano valida/corrige → PostgreSQL persiste factura, correcciones y
estadísticas → el motor de alertas produce avisos y el generador de PDFs produce
la evidencia (salidas).

---

## 2. Flujo de agentes y ciclo de retroalimentación

```mermaid
flowchart TD
    F["📄 Nueva factura<br/>(foto o PDF)"] --> A1

    subgraph Extraccion["Agente OCR (extracción)"]
        A1["Enviar imagen a GPT-4o-mini<br/>con prompt estructurado"] --> A2["Validar y normalizar JSON<br/>(fechas, monto AR$, categorías)"]
    end

    A2 --> B1

    subgraph Aprendizaje["Agente de Aprendizaje"]
        B1["¿El texto extraído coincide con una<br/>corrección previa del usuario?"] -->|sí| B2["Aplicar corrección aprendida"]
        B1 -->|no| B3["Coincidencia difusa de proveedor<br/>(Levenshtein + normalización)"]
        B2 --> B4["Calcular confianza por campo<br/>(0-100, según historial)"]
        B3 --> B4
    end

    B4 --> H1

    subgraph Humano["👤 Human-in-the-Loop"]
        H1["Usuario revisa campos<br/>(✔ alta · ~ media · ⚠ baja)"] --> H2["Corrige lo necesario y guarda"]
    end

    H2 --> M1["💾 Persistir factura +<br/>registrar correcciones en<br/>correcciones_ocr (memoria)"]
    M1 -.->|"retroalimenta la<br/>próxima extracción"| B1

    M1 --> C1

    subgraph Alertas["Motor de Alertas (corre al abrir la app)"]
        C1["Vencimientos: fecha real de la factura,<br/>anticipación configurable"] --> C4["Deduplicación por mensaje<br/>(60 días) y prioridad formal<br/>S = peso(tipo) − 2·antigüedad"]
        C2["Anomalías: monto > B + U<br/>B = 0.5·μ₃ + 0.5·m₁₂ (estacional)<br/>U = max(0.2·B, σ)"] --> C4
        C3["Presupuesto ≥ 90 % ·<br/>resumen mensual automático"] --> C4
    end

    C4 --> N["🔔 Campana de notificaciones"]
    N --> P["Usuario paga y registra<br/>el comprobante (macheo)"]
    P -.->|"nuevos datos alimentan<br/>anomalías, promedios y resumen"| C2
```

**Qué decide cada agente:** el OCR decide *qué dice la factura*; el aprendizaje
decide *si lo extraído debe ajustarse según el historial del usuario y con
cuánta confianza*; el humano decide *la verdad final* (ninguna escritura ocurre
sin su confirmación); el motor de alertas decide *cuándo avisar y con qué
prioridad*. Se comunican a través de la memoria persistente (PostgreSQL), lo
que hace el ciclo **cíclico**: cada corrección y cada pago mejoran la próxima
iteración.

---

## 3. UML — Diagrama de secuencia: "Cargar una factura con OCR"

```mermaid
sequenceDiagram
    actor U as Usuario
    participant APP as Frontend (Next.js)
    participant ST as Supabase Storage
    participant API as /api/ocr (server)
    participant IA as GPT-4o-mini
    participant DB as PostgreSQL (RLS)

    U->>APP: Sube foto/PDF de la factura
    APP->>ST: Upload a carpeta privada del usuario
    Note over APP: Si es PDF, se renderiza la<br/>1ª página a imagen (pdfjs)
    APP->>API: POST {path | imagenBase64}
    API->>API: Verifica sesión y propiedad del archivo
    API->>ST: Genera URL firmada temporal
    API->>IA: Prompt estructurado + imagen
    IA-->>API: JSON (proveedor, monto, vencimientos…)
    API->>API: Valida y normaliza cada campo
    API->>DB: Lee correcciones_ocr y proveedores
    API->>API: Aplica aprendizaje + confianza por campo
    API-->>APP: Resultado + confianza + ajustes aplicados
    APP-->>U: Formulario pre-completado (✔/~/⚠)
    U->>APP: Corrige campos y guarda
    APP->>DB: INSERT factura (estado: pendiente)
    APP->>DB: INSERT correcciones_ocr (si corrigió)
    APP->>DB: UPSERT proveedor (día habitual, categoría)
    APP->>DB: Evalúa anomalía y crea alerta si corresponde
    APP-->>U: Redirige a Facturas (queda "Por pagar")
```
