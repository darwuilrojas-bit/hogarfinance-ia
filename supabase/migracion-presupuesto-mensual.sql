-- ============================================================================
-- Migración: presupuesto por mes — HogarFinance IA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- (idempotente: se puede ejecutar más de una vez sin romper nada)
-- ============================================================================
--
-- Hasta ahora el presupuesto era un único número en `usuarios`, así que no
-- había forma de decir "el de junio fue X": cambiarlo lo cambiaba para todos
-- los meses, incluso los ya cerrados.
--
-- Esta tabla guarda un presupuesto por mes. El número global de `usuarios`
-- NO se borra: pasa a funcionar como valor por defecto para los meses que no
-- tengan uno propio, así nada de lo ya configurado deja de andar.
-- ============================================================================


create table if not exists public.presupuestos (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios (id) on delete cascade,
  mes                 int  not null check (mes between 1 and 12),
  anio                int  not null check (anio between 2000 and 2100),
  monto               numeric(12, 2) not null check (monto >= 0),
  fecha_actualizacion timestamptz not null default now(),
  -- Un solo presupuesto por mes y usuario. Es además la clave que usa el
  -- upsert al guardar desde la app.
  unique (usuario_id, mes, anio)
);

create index if not exists idx_presupuestos_usuario_periodo
  on public.presupuestos (usuario_id, anio, mes);


-- ---------------------------------------------------------------------------
-- Seguridad: cada usuario ve y edita solo sus propios presupuestos.
-- ---------------------------------------------------------------------------
alter table public.presupuestos enable row level security;

drop policy if exists "presupuestos_select_propios" on public.presupuestos;
create policy "presupuestos_select_propios" on public.presupuestos
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "presupuestos_insert_propios" on public.presupuestos;
create policy "presupuestos_insert_propios" on public.presupuestos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists "presupuestos_update_propios" on public.presupuestos;
create policy "presupuestos_update_propios" on public.presupuestos
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "presupuestos_delete_propios" on public.presupuestos;
create policy "presupuestos_delete_propios" on public.presupuestos
  for delete to authenticated
  using (usuario_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- Verificación (opcional).
-- ---------------------------------------------------------------------------
-- select mes, anio, monto from public.presupuestos order by anio desc, mes desc;
