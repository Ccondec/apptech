-- ============================================================================
-- Migration 0002: Firma del cliente sobre informes (PDF)
-- ============================================================================
-- Agrega columnas para guardar el PDF firmado, timestamp de firma, y la
-- posición donde estampar la firma (capturada al generar el PDF).
--
-- Función SECURITY DEFINER para que el cliente registre su firma sin
-- darle UPDATE genérico sobre la tabla.
--
-- Aplicar en Supabase Dashboard → SQL Editor.
-- ============================================================================

BEGIN;

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────
ALTER TABLE public.informes
  ADD COLUMN IF NOT EXISTS pdf_firmado_url TEXT,
  ADD COLUMN IF NOT EXISTS firmado_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS firma_pos       JSONB;

COMMENT ON COLUMN public.informes.pdf_firmado_url IS
  'URL pública del PDF con la firma del cliente estampada (Supabase Storage)';
COMMENT ON COLUMN public.informes.firmado_at IS
  'Timestamp UTC del momento en que el cliente firmó';
COMMENT ON COLUMN public.informes.firma_pos IS
  'Coordenadas de la zona "Firma del Cliente" en el PDF original. Schema: {page, x_mm, y_mm, w_mm, h_mm, page_w_mm, page_h_mm}';

-- ── 2. Función para que el cliente firme su informe ─────────────────────────
-- SECURITY DEFINER: corre con permisos del owner (postgres), bypassea RLS,
-- pero internamente verifica que el caller sea efectivamente el cliente
-- dueño del informe. Solo permite tocar pdf_firmado_url y firmado_at.
CREATE OR REPLACE FUNCTION public.firmar_informe_cliente(
  p_informe_id        UUID,
  p_pdf_firmado_url   TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_cliente    TEXT;
BEGIN
  SELECT empresa_id, cliente INTO v_empresa_id, v_cliente
  FROM public.informes
  WHERE id = p_informe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Informe no encontrado';
  END IF;

  IF v_empresa_id <> public.current_empresa_id() THEN
    RAISE EXCEPTION 'Acceso denegado: empresa no coincide';
  END IF;

  IF public.current_user_role() <> 'cliente'
     OR v_cliente <> public.current_client_company() THEN
    RAISE EXCEPTION 'Acceso denegado: no eres el cliente de este informe';
  END IF;

  UPDATE public.informes
  SET pdf_firmado_url = p_pdf_firmado_url,
      firmado_at      = now()
  WHERE id = p_informe_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.firmar_informe_cliente(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firmar_informe_cliente(UUID, TEXT) TO authenticated;

COMMIT;

-- ============================================================================
-- ROLLBACK (correr manualmente si querés revertir):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.firmar_informe_cliente(UUID, TEXT);
-- ALTER TABLE public.informes
--   DROP COLUMN IF EXISTS pdf_firmado_url,
--   DROP COLUMN IF EXISTS firmado_at,
--   DROP COLUMN IF EXISTS firma_pos;
-- COMMIT;
