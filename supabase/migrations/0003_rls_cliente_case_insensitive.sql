-- ============================================================================
-- Migration 0003: RLS de informes — match cliente case-insensitive + trim
-- ============================================================================
-- Bug: la policy informe_select_misma_empresa usa "cliente = current_client_company()"
-- con equality exacta. Si el técnico guarda el informe con casing distinto al
-- del usuario cliente (ej. "Universidad X" vs "UNIVERSIDAD X"), el cliente NO
-- ve sus propios informes.
--
-- Fix: comparar normalizando con LOWER + TRIM en ambos lados.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS informe_select_misma_empresa ON public.informes;
CREATE POLICY informe_select_misma_empresa
  ON public.informes FOR SELECT
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      public.current_user_role() <> 'cliente'
      OR LOWER(TRIM(cliente)) = LOWER(TRIM(public.current_client_company()))
    )
  );

-- También actualizamos la función firmar_informe_cliente con la misma normalización
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
     OR LOWER(TRIM(v_cliente)) <> LOWER(TRIM(public.current_client_company())) THEN
    RAISE EXCEPTION 'Acceso denegado: no eres el cliente de este informe';
  END IF;

  UPDATE public.informes
  SET pdf_firmado_url = p_pdf_firmado_url,
      firmado_at      = now()
  WHERE id = p_informe_id;

  RETURN TRUE;
END;
$$;

COMMIT;
