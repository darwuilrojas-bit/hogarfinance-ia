-- ============================================================================
-- Migración: alertas tipo "resumen" — HogarFinance IA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- (idempotente)
-- ============================================================================

-- Permite el nuevo tipo de alerta "resumen" (resumen mensual automático)
alter table public.alertas drop constraint if exists alertas_tipo_check;
alter table public.alertas add constraint alertas_tipo_check
  check (tipo in ('vencimiento', 'anomalia', 'presupuesto', 'resumen'));
