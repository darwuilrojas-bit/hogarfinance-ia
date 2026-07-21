-- ============================================================================
-- HogarFinance IA — Esquema completo de base de datos
-- ----------------------------------------------------------------------------
-- Cómo ejecutarlo:
--   Supabase Dashboard → SQL Editor → New query → pegar todo → Run
-- El script es idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ============================================================================
-- 1. TABLA: usuarios
--    Perfil de cada usuario. Extiende auth.users (misma id) y se crea
--    automáticamente al registrarse gracias al trigger de más abajo.
-- ============================================================================
create table if not exists public.usuarios (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text not null unique,
  nombre              text,
  presupuesto_mensual numeric(12, 2) check (presupuesto_mensual >= 0),
  fecha_creacion      timestamptz not null default now()
);

comment on table public.usuarios is
  'Perfil del usuario del hogar. La id coincide con auth.users.id.';

-- Crea el perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- 2. TABLA: gastos
--    Cada gasto o factura del hogar, con su período, categoría y estado.
-- ============================================================================
create table if not exists public.gastos (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios (id) on delete cascade,
  proveedor           text not null,
  monto               numeric(12, 2) not null check (monto >= 0),
  fecha_pago          date,
  periodo_mes         smallint not null check (periodo_mes between 1 and 12),
  periodo_anio        smallint not null check (periodo_anio between 2000 and 2100),
  categoria           text not null default 'otro'
                      check (categoria in ('electricidad', 'agua', 'gas', 'internet', 'alquiler', 'expensas', 'otro')),
  estado              text not null default 'pendiente'
                      check (estado in ('pagado', 'pendiente', 'reclamado')),
  metodo_pago         text,
  numero_comprobante  text,
  notas               text,
  imagen_url          text,
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

comment on table public.gastos is
  'Gastos y facturas del hogar. imagen_url apunta al comprobante en Storage.';

-- Mantiene fecha_actualizacion al día en cada UPDATE
create or replace function public.set_fecha_actualizacion()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists gastos_set_fecha_actualizacion on public.gastos;
create trigger gastos_set_fecha_actualizacion
  before update on public.gastos
  for each row execute function public.set_fecha_actualizacion();


-- ============================================================================
-- 3. TABLA: proveedores
--    Proveedores habituales del usuario, con estadísticas para que la IA
--    sugiera montos y fechas de vencimiento.
-- ============================================================================
create table if not exists public.proveedores (
  id                          uuid primary key default gen_random_uuid(),
  usuario_id                  uuid not null references public.usuarios (id) on delete cascade,
  nombre                      text not null,
  categoria                   text not null default 'otro'
                              check (categoria in ('electricidad', 'agua', 'gas', 'internet', 'alquiler', 'expensas', 'otro')),
  -- Día del mes (1 a 31) en que suele vencer la factura de este proveedor
  fecha_vencimiento_habitual  smallint check (fecha_vencimiento_habitual between 1 and 31),
  monto_promedio              numeric(12, 2) check (monto_promedio >= 0),
  veces_registrado            integer not null default 0 check (veces_registrado >= 0),
  unique (usuario_id, nombre)
);

comment on column public.proveedores.fecha_vencimiento_habitual is
  'Día del mes (1-31) en que habitualmente vence la factura.';


-- ============================================================================
-- 4. TABLA: alertas
--    Notificaciones al usuario: vencimientos próximos, montos anómalos
--    detectados por la IA y avisos de presupuesto excedido.
-- ============================================================================
create table if not exists public.alertas (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.usuarios (id) on delete cascade,
  gasto_id     uuid references public.gastos (id) on delete cascade,
  tipo         text not null check (tipo in ('vencimiento', 'anomalia', 'presupuesto')),
  mensaje      text not null,
  leida        boolean not null default false,
  fecha_alerta timestamptz not null default now()
);


-- ============================================================================
-- 5. TABLA: correcciones_ocr
--    Correcciones que el usuario hace sobre lo que la IA leyó de un
--    comprobante. Sirven para mejorar las lecturas futuras.
-- ============================================================================
create table if not exists public.correcciones_ocr (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.usuarios (id) on delete cascade,
  texto_original   text not null,
  texto_corregido  text not null,
  campo            text not null check (campo in ('proveedor', 'monto', 'fecha')),
  fecha_correccion timestamptz not null default now()
);


-- ============================================================================
-- 6. ÍNDICES
-- ============================================================================
create index if not exists gastos_usuario_periodo_idx
  on public.gastos (usuario_id, periodo_anio, periodo_mes);
create index if not exists gastos_usuario_estado_idx
  on public.gastos (usuario_id, estado);
create index if not exists proveedores_usuario_idx
  on public.proveedores (usuario_id);
create index if not exists alertas_usuario_leida_idx
  on public.alertas (usuario_id, leida);
create index if not exists alertas_gasto_idx
  on public.alertas (gasto_id);
create index if not exists correcciones_ocr_usuario_idx
  on public.correcciones_ocr (usuario_id);


-- ============================================================================
-- 7. ROW LEVEL SECURITY
--    Cada usuario solo puede ver y modificar SUS propios datos.
-- ============================================================================
alter table public.usuarios         enable row level security;
alter table public.gastos           enable row level security;
alter table public.proveedores      enable row level security;
alter table public.alertas          enable row level security;
alter table public.correcciones_ocr enable row level security;

-- ---- usuarios: cada uno ve y edita solo su propio perfil ----
drop policy if exists "usuarios_select_propio" on public.usuarios;
create policy "usuarios_select_propio" on public.usuarios
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "usuarios_update_propio" on public.usuarios;
create policy "usuarios_update_propio" on public.usuarios
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- (El INSERT lo hace el trigger handle_new_user y el DELETE llega en
--  cascada al borrar la cuenta en auth.users; no se exponen políticas.)

-- ---- gastos ----
drop policy if exists "gastos_select_propios" on public.gastos;
create policy "gastos_select_propios" on public.gastos
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "gastos_insert_propios" on public.gastos;
create policy "gastos_insert_propios" on public.gastos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists "gastos_update_propios" on public.gastos;
create policy "gastos_update_propios" on public.gastos
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "gastos_delete_propios" on public.gastos;
create policy "gastos_delete_propios" on public.gastos
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---- proveedores ----
drop policy if exists "proveedores_select_propios" on public.proveedores;
create policy "proveedores_select_propios" on public.proveedores
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "proveedores_insert_propios" on public.proveedores;
create policy "proveedores_insert_propios" on public.proveedores
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists "proveedores_update_propios" on public.proveedores;
create policy "proveedores_update_propios" on public.proveedores
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "proveedores_delete_propios" on public.proveedores;
create policy "proveedores_delete_propios" on public.proveedores
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---- alertas ----
drop policy if exists "alertas_select_propias" on public.alertas;
create policy "alertas_select_propias" on public.alertas
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "alertas_insert_propias" on public.alertas;
create policy "alertas_insert_propias" on public.alertas
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists "alertas_update_propias" on public.alertas;
create policy "alertas_update_propias" on public.alertas
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "alertas_delete_propias" on public.alertas;
create policy "alertas_delete_propias" on public.alertas
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---- correcciones_ocr ----
drop policy if exists "correcciones_select_propias" on public.correcciones_ocr;
create policy "correcciones_select_propias" on public.correcciones_ocr
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "correcciones_insert_propias" on public.correcciones_ocr;
create policy "correcciones_insert_propias" on public.correcciones_ocr
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists "correcciones_update_propias" on public.correcciones_ocr;
create policy "correcciones_update_propias" on public.correcciones_ocr
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "correcciones_delete_propias" on public.correcciones_ocr;
create policy "correcciones_delete_propias" on public.correcciones_ocr
  for delete to authenticated
  using (usuario_id = (select auth.uid()));


-- ============================================================================
-- 8. STORAGE: bucket "comprobantes" (privado, una carpeta por usuario)
--    Las imágenes se guardan como:  {usuario_id}/{nombre-archivo}
--    y cada usuario solo puede acceder a su propia carpeta.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

drop policy if exists "comprobantes_select_propios" on storage.objects;
create policy "comprobantes_select_propios" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "comprobantes_insert_propios" on storage.objects;
create policy "comprobantes_insert_propios" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "comprobantes_update_propios" on storage.objects;
create policy "comprobantes_update_propios" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "comprobantes_delete_propios" on storage.objects;
create policy "comprobantes_delete_propios" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================================
-- Fin del esquema — HogarFinance IA
-- ============================================================================
