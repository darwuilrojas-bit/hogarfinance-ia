-- ============================================================================
-- Migración: Perfil y Configuración — HogarFinance IA
-- ----------------------------------------------------------------------------
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- (idempotente: se puede volver a ejecutar sin problemas)
-- ============================================================================

-- 1. Preferencias de alertas del usuario
alter table public.usuarios
  add column if not exists alertas_vencimiento boolean not null default true,
  add column if not exists alertas_dias_anticipacion smallint not null default 7
    check (alertas_dias_anticipacion in (3, 5, 7, 10)),
  add column if not exists alertas_anomalia boolean not null default true,
  add column if not exists alertas_presupuesto boolean not null default true;

comment on column public.usuarios.alertas_dias_anticipacion is
  'Días de anticipación con que se avisa un vencimiento (3, 5, 7 o 10).';

-- 2. Eliminación de la propia cuenta
--    Borra los archivos del bucket, la fila de auth.users y, en cascada,
--    todos los datos del usuario (usuarios, gastos, proveedores, alertas,
--    correcciones_ocr). Solo puede ejecutarla el usuario autenticado
--    sobre SU propia cuenta.
create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Registros de archivos del usuario en el bucket de comprobantes
  delete from storage.objects
   where bucket_id = 'comprobantes'
     and (storage.foldername(name))[1] = auth.uid()::text;

  -- La cuenta en sí; el resto cae en cascada
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.eliminar_mi_cuenta() from public;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
