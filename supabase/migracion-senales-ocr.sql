-- ============================================================================
-- Migración: señales del agente de aprendizaje — HogarFinance IA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- (idempotente: se puede ejecutar más de una vez sin romper nada)
-- ============================================================================
--
-- Hasta ahora `correcciones_ocr` solo registraba correcciones sobre lo que el
-- OCR SÍ había leído, y únicamente de tres campos. No podía registrar el caso
-- que motivó esta migración: un campo que quedó vacío porque el modelo no lo
-- leyó (o porque la factura realmente no lo trae).
--
-- Se agregan tres clases de registro:
--   'correccion' → el OCR leyó algo y el usuario lo cambió   (lo de siempre)
--   'no_leido'   → quedó vacío y el usuario reportó la falla (señal de error)
--   'ausente'    → quedó vacío y la factura no lo trae       (señal de normal)
--
-- Solo 'correccion' sobre proveedor y categoría se aplica por sustitución.
-- Los identificadores y montos NUNCA se copian de una factura a otra.
-- ============================================================================


-- 1) Admitir todos los campos que el OCR extrae, no solo tres.
alter table public.correcciones_ocr
  drop constraint if exists correcciones_ocr_campo_check;

alter table public.correcciones_ocr
  add constraint correcciones_ocr_campo_check
  check (campo in (
    'proveedor',
    'monto',
    'fecha',
    'numero_comprobante',
    'fecha_vencimiento_2',
    'periodo',
    'categoria'
  ));


-- 2) Un campo no leído no tiene "texto original": ambos pasan a ser opcionales.
alter table public.correcciones_ocr
  alter column texto_original  drop not null,
  alter column texto_corregido drop not null;


-- 3) Clase de registro. Las filas existentes son correcciones.
alter table public.correcciones_ocr
  add column if not exists tipo text not null default 'correccion';

alter table public.correcciones_ocr
  drop constraint if exists correcciones_ocr_tipo_check;

alter table public.correcciones_ocr
  add constraint correcciones_ocr_tipo_check
  check (tipo in ('correccion', 'no_leido', 'ausente'));


-- 4) Proveedor al que corresponde la señal.
--    Es lo que permite aprender "en AySA este campo suele fallar" en vez de
--    "este campo falla siempre".
alter table public.correcciones_ocr
  add column if not exists proveedor text;


-- 5) Consulta típica del agente: señales de un usuario por proveedor y campo.
create index if not exists idx_correcciones_ocr_senal
  on public.correcciones_ocr (usuario_id, proveedor, campo, tipo);


-- ============================================================================
-- Verificación (opcional): mostrá la estructura resultante.
-- ============================================================================
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'correcciones_ocr'
--  order by ordinal_position;
