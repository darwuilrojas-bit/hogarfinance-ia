-- ============================================================================
-- Migración: separar Facturas y Comprobantes de pago — HogarFinance IA
-- ----------------------------------------------------------------------------
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- Requiere las migraciones anteriores ya ejecutadas (migracion-facturas.sql,
-- que agregó fecha_vencimiento / fecha_vencimiento_2 / imagen_pago_url a
-- la tabla `gastos`).
--
-- Qué hace:
--  1. Crea la tabla `facturas` (una factura/comprobante que llega, con su
--     vencimiento) y `comprobantes_pago` (el pago de una factura, con su
--     propio comprobante adjunto — quedan "macheados" por factura_id).
--  2. RLS igual que el resto del proyecto.
--  3. Migra los datos existentes de `gastos` sin perder nada: cada gasto
--     se convierte en una factura (misma id, para no romper referencias),
--     y los que estaban pagados/reclamados generan además su comprobante.
--  4. La tabla `gastos` NO se borra: queda como respaldo histórico. La
--     app deja de usarla a partir de este cambio.
--
-- Es idempotente: se puede volver a ejecutar sin duplicar nada.
-- ============================================================================

-- ============================================================================
-- 1. TABLA: facturas
-- ============================================================================
create table if not exists public.facturas (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references public.usuarios (id) on delete cascade,
  proveedor             text not null,
  categoria             text not null default 'otro'
                        check (categoria in ('electricidad', 'agua', 'gas', 'internet', 'alquiler', 'expensas', 'otro')),
  monto                 numeric(12, 2) not null check (monto >= 0),
  periodo_mes           smallint not null check (periodo_mes between 1 and 12),
  periodo_anio          smallint not null check (periodo_anio between 2000 and 2100),
  -- Primer y segundo vencimiento (facturas argentinas con recargo)
  fecha_vencimiento     date,
  fecha_vencimiento_2   date,
  numero_comprobante    text,
  imagen_url            text,
  estado                text not null default 'pendiente'
                        check (estado in ('pagado', 'pendiente', 'reclamado')),
  notas                 text,
  fecha_creacion        timestamptz not null default now(),
  fecha_actualizacion   timestamptz not null default now()
);

comment on table public.facturas is
  'Facturas del hogar: lo que llega para pagar, con su vencimiento.';

drop trigger if exists facturas_set_fecha_actualizacion on public.facturas;
create trigger facturas_set_fecha_actualizacion
  before update on public.facturas
  for each row execute function public.set_fecha_actualizacion();

-- ============================================================================
-- 2. TABLA: comprobantes_pago
--    El pago de una factura. Queda macheado con ella por factura_id.
-- ============================================================================
create table if not exists public.comprobantes_pago (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references public.usuarios (id) on delete cascade,
  factura_id        uuid not null references public.facturas (id) on delete cascade,
  monto             numeric(12, 2) not null check (monto >= 0),
  fecha_pago        date not null,
  metodo_pago       text,
  -- N° de operación del PAGO en sí (ej. de home banking), distinto del
  -- número de la factura que se está pagando
  numero_operacion  text,
  imagen_url        text,
  notas             text,
  fecha_creacion    timestamptz not null default now()
);

comment on table public.comprobantes_pago is
  'Pago de una factura, con su propio comprobante. factura_id la machea.';

-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================
create index if not exists facturas_usuario_periodo_idx
  on public.facturas (usuario_id, periodo_anio, periodo_mes);
create index if not exists facturas_usuario_estado_idx
  on public.facturas (usuario_id, estado);
create index if not exists comprobantes_pago_usuario_idx
  on public.comprobantes_pago (usuario_id);
create index if not exists comprobantes_pago_factura_idx
  on public.comprobantes_pago (factura_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
alter table public.facturas          enable row level security;
alter table public.comprobantes_pago enable row level security;

drop policy if exists "facturas_select_propias" on public.facturas;
create policy "facturas_select_propias" on public.facturas
  for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists "facturas_insert_propias" on public.facturas;
create policy "facturas_insert_propias" on public.facturas
  for insert to authenticated with check (usuario_id = (select auth.uid()));

drop policy if exists "facturas_update_propias" on public.facturas;
create policy "facturas_update_propias" on public.facturas
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "facturas_delete_propias" on public.facturas;
create policy "facturas_delete_propias" on public.facturas
  for delete to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists "comprobantes_pago_select_propios" on public.comprobantes_pago;
create policy "comprobantes_pago_select_propios" on public.comprobantes_pago
  for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists "comprobantes_pago_insert_propios" on public.comprobantes_pago;
create policy "comprobantes_pago_insert_propios" on public.comprobantes_pago
  for insert to authenticated with check (usuario_id = (select auth.uid()));

drop policy if exists "comprobantes_pago_update_propios" on public.comprobantes_pago;
create policy "comprobantes_pago_update_propios" on public.comprobantes_pago
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "comprobantes_pago_delete_propios" on public.comprobantes_pago;
create policy "comprobantes_pago_delete_propios" on public.comprobantes_pago
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- ============================================================================
-- 5. alertas.gasto_id deja de exigir integridad referencial contra `gastos`:
--    de ahora en más puede apuntar a una factura o a un comprobante_pago
--    según el tipo de alerta (uso informal, ya lo era antes).
-- ============================================================================
alter table public.alertas drop constraint if exists alertas_gasto_id_fkey;
comment on column public.alertas.gasto_id is
  'Referencia informal (sin FK): id de facturas o de comprobantes_pago según el tipo de alerta.';

-- ============================================================================
-- 6. MIGRACIÓN DE DATOS: gastos → facturas + comprobantes_pago
--    Conserva la misma id en facturas (así no se pierden referencias).
-- ============================================================================
insert into public.facturas (
  id, usuario_id, proveedor, categoria, monto, periodo_mes, periodo_anio,
  fecha_vencimiento, fecha_vencimiento_2, numero_comprobante, imagen_url,
  estado, notas, fecha_creacion, fecha_actualizacion
)
select
  g.id, g.usuario_id, g.proveedor, g.categoria, g.monto, g.periodo_mes, g.periodo_anio,
  g.fecha_vencimiento, g.fecha_vencimiento_2, g.numero_comprobante,
  case
    when g.estado = 'pendiente' then g.imagen_url
    when g.imagen_pago_url is not null then g.imagen_url
    else null -- imagen única de un gasto pagado: se trata como comprobante de pago
  end,
  g.estado, g.notas, g.fecha_creacion, g.fecha_actualizacion
from public.gastos g
on conflict (id) do nothing;

insert into public.comprobantes_pago (
  usuario_id, factura_id, monto, fecha_pago, metodo_pago, imagen_url, notas, fecha_creacion
)
select
  g.usuario_id, g.id, g.monto,
  coalesce(g.fecha_pago, g.fecha_creacion::date),
  g.metodo_pago,
  coalesce(g.imagen_pago_url, g.imagen_url),
  g.notas, g.fecha_creacion
from public.gastos g
where g.estado in ('pagado', 'reclamado')
  and not exists (
    select 1 from public.comprobantes_pago cp where cp.factura_id = g.id
  );

-- ============================================================================
-- Fin de la migración
-- ============================================================================
