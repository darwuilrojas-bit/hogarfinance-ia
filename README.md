# HogarFinance IA 🏠💰

Sistema inteligente de gestión de finanzas y comprobantes del hogar.
Aplicación web móvil construida con **Next.js 16**, **Supabase** y
**Tailwind CSS 4**, con interfaz completamente en español.

## Estado actual

- ✅ Estructura base del proyecto organizada por funcionalidad
- ✅ Conexión a Supabase configurada (auth + base de datos + storage)
- ✅ Registro e inicio de sesión por email y contraseña
- ✅ Protección de rutas privadas (proxy de Next.js)
- ✅ Navegación inferior móvil con 5 secciones
- 🔜 Funcionalidades de gastos, comprobantes, vencimientos y reportes

## Requisitos

- Node.js 20.9 o superior
- Una cuenta gratuita en [Supabase](https://supabase.com)

## Puesta en marcha

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Configurar Supabase**

   - Creá un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard)
   - En **Settings → API** copiá la *Project URL* y la *anon public key*
   - Pegalas en `.env.local`:

     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
     ```

   > Mientras no configures las credenciales, la app corre en **modo
   > demostración**: se puede navegar toda la interfaz sin iniciar sesión.

3. **Levantar el servidor de desarrollo**

   ```bash
   npm run dev
   ```

   Abrí [http://localhost:3000](http://localhost:3000) — idealmente con las
   herramientas de desarrollo del navegador en modo móvil (por ejemplo,
   iPhone 14) para ver la experiencia como app nativa.

## Estructura del proyecto

```
src/
├── app/                      # Rutas (App Router)
│   ├── (auth)/               # Rutas públicas de autenticación
│   │   ├── login/            # Inicio de sesión
│   │   └── registro/         # Creación de cuenta
│   ├── (app)/                # Rutas privadas (requieren sesión)
│   │   ├── page.tsx          # Inicio (dashboard)
│   │   ├── gastos/
│   │   ├── vencimientos/
│   │   ├── comprobantes/
│   │   └── perfil/
│   ├── layout.tsx            # Layout raíz (fuente, metadatos, idioma)
│   ├── manifest.ts           # Manifiesto PWA
│   └── globals.css           # Tema de colores y estilos globales
├── components/
│   ├── navigation/           # BottomNav (barra inferior de 5 secciones)
│   ├── layout/               # PageHeader
│   └── ui/                   # Button, Input, EmptyState
├── features/                 # Código organizado por funcionalidad
│   ├── auth/                 # Formularios de login/registro/logout
│   ├── dashboard/
│   ├── gastos/
│   ├── comprobantes/
│   ├── alertas/              # Vencimientos y recordatorios
│   └── reportes/
├── lib/
│   └── supabase/             # Clientes de Supabase
│       ├── client.ts         # Navegador (componentes "use client")
│       ├── server.ts         # Server Components / Actions
│       ├── proxy.ts          # Refresco de sesión y rutas protegidas
│       └── config.ts         # Detección de credenciales configuradas
└── proxy.ts                  # Proxy de Next.js 16 (ex middleware)
```

## Tema visual

| Elemento         | Valor      |
| ---------------- | ---------- |
| Azul primario    | `#1F6FEB`  |
| Verde secundario | `#0D9276`  |
| Fondo            | `#FFFFFF`  |
| Tipografía       | Geist Sans |

Los colores están definidos como tokens de Tailwind en
`src/app/globals.css` (`text-primary`, `bg-secondary`, etc.).

## Scripts

| Comando         | Descripción                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Servidor de desarrollo       |
| `npm run build` | Compilación para producción  |
| `npm run start` | Servidor de producción       |
| `npm run lint`  | Análisis estático con ESLint |
