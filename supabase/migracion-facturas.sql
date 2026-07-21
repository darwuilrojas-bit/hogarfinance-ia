-- ============================================================================
-- Migración: ciclo factura → pago — HogarFinance IA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- (idempotente)
-- ============================================================================

alter table public.gastos
  -- Primer vencimiento de la factura (prioridad sobre el día habitual
  -- del proveedor en avisos y pantalla de vencimientos)
  add column if not exists fecha_vencimiento date,
  -- Segundo vencimiento (facturas argentinas con recargo), si existe
  add column if not exists fecha_vencimiento_2 date,
  -- Imagen del comprobante de PAGO (imagen_url guarda la factura);
  -- juntas machean la factura con su pago
  add column if not exists imagen_pago_url text;
