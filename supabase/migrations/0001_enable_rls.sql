-- ============================================================================
-- 0001_enable_rls.sql — Multi-tenant hardening (RLS + helpers + RPCs)
-- ============================================================================
-- Aplicar en Supabase Studio > SQL Editor en una sola transacción.
-- Si algo falla, ejecutar 0001_rollback.sql para revertir.
--
-- Antes de aplicar:
--   1. Backup de la base (Supabase > Database > Backups)
--   2. Verificar que las API routes server-side usan SUPABASE_SERVICE_ROLE_KEY
--      (RLS no aplica al service role)
--   3. Desplegar PRIMERO los cambios de app/lib que acompañan esta migración
--      (las RPCs validar_form_token, validar_asignacion, validar_licencia
--      son consumidas por la nueva versión de lib/supabase.ts)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Funciones helper para policies (SECURITY DEFINER evita recursión)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_client_company()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_company FROM public.usuarios WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_empresa_id()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_client_company() TO authenticated;

-- ============================================================================
-- 2. RPCs para flujos públicos (anon) — reemplazan reads directos a tablas
-- ============================================================================

-- Validar form_token público sin exponer la tabla a anon.
-- Devuelve NULL si el token es inválido/expirado/inactivo.
CREATE OR REPLACE FUNCTION public.validar_form_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.form_tokens%ROWTYPE;
  v_emp   public.empresas%ROWTYPE;
BEGIN
  SELECT * INTO v_token
  FROM public.form_tokens
  WHERE id = p_token
    AND activo = true
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_emp FROM public.empresas WHERE id = v_token.empresa_id;

  RETURN jsonb_build_object(
    'token', jsonb_build_object(
      'id',          v_token.id,
      'empresa_id',  v_token.empresa_id,
      'descripcion', v_token.descripcion,
      'expires_at',  v_token.expires_at,
      'activo',      v_token.activo,
      'usos',        v_token.usos,
      'created_at',  v_token.created_at
    ),
    'empresa', jsonb_build_object(
      'id',               v_emp.id,
      'nombre',           v_emp.nombre,
      'nombre_comercial', v_emp.nombre_comercial,
      'logo',             v_emp.logo,
      'telefono',         v_emp.telefono,
      'direccion',        v_emp.direccion,
      'email_contacto',   v_emp.email_contacto,
      'activa',           v_emp.activa,
      'fecha_expiracion', v_emp.fecha_expiracion
      -- license_key se omite intencionalmente
    )
  );
END;
$$;

-- Validar asignación pública sin exponer la tabla a anon.
CREATE OR REPLACE FUNCTION public.validar_asignacion(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asig public.asignaciones%ROWTYPE;
  v_emp  public.empresas%ROWTYPE;
BEGIN
  SELECT * INTO v_asig
  FROM public.asignaciones
  WHERE id = p_token
    AND estado = 'pendiente'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_emp FROM public.empresas WHERE id = v_asig.empresa_id;

  RETURN jsonb_build_object(
    'asignacion', to_jsonb(v_asig),
    'empresa', jsonb_build_object(
      'id',               v_emp.id,
      'nombre',           v_emp.nombre,
      'nombre_comercial', v_emp.nombre_comercial,
      'logo',             v_emp.logo,
      'telefono',         v_emp.telefono,
      'direccion',        v_emp.direccion,
      'email_contacto',   v_emp.email_contacto,
      'activa',           v_emp.activa,
      'fecha_expiracion', v_emp.fecha_expiracion
    )
  );
END;
$$;

-- Validar license_key durante el registro (anon).
-- Devuelve { ok, empresa_id, rol_sugerido } o { ok: false, error }
CREATE OR REPLACE FUNCTION public.validar_licencia(p_license_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp         public.empresas%ROWTYPE;
  v_admin_count int;
BEGIN
  SELECT * INTO v_emp
  FROM public.empresas
  WHERE license_key = upper(trim(p_license_key));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  IF NOT v_emp.activa THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inactive');
  END IF;

  IF v_emp.fecha_expiracion IS NOT NULL
     AND v_emp.fecha_expiracion::timestamptz < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT count(*) INTO v_admin_count
  FROM public.usuarios
  WHERE empresa_id = v_emp.id AND rol = 'admin';

  RETURN jsonb_build_object(
    'ok',           true,
    'empresa_id',   v_emp.id,
    'rol_sugerido', CASE WHEN v_admin_count = 0 THEN 'admin' ELSE 'tecnico' END
  );
END;
$$;

-- email_registrado: aseguramos SECURITY DEFINER (puede haber existido sin él)
CREATE OR REPLACE FUNCTION public.email_registrado(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))
  )
$$;

GRANT EXECUTE ON FUNCTION public.validar_form_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_asignacion(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_licencia(text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_registrado(text)   TO anon, authenticated;

-- ============================================================================
-- 3. Habilitar RLS en todas las tablas multi-tenant
-- ============================================================================

ALTER TABLE public.empresas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consecutivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Policies por tabla
-- ============================================================================

-- ── empresas ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS empresa_select_propia ON public.empresas;
CREATE POLICY empresa_select_propia
  ON public.empresas FOR SELECT
  TO authenticated
  USING (id = public.current_empresa_id());

DROP POLICY IF EXISTS empresa_update_admin ON public.empresas;
CREATE POLICY empresa_update_admin
  ON public.empresas FOR UPDATE
  TO authenticated
  USING (id = public.current_empresa_id() AND public.current_user_role() = 'admin')
  WITH CHECK (id = public.current_empresa_id() AND public.current_user_role() = 'admin');

-- INSERT/DELETE: sin policy → bloqueado salvo service_role (super-admin via API)

-- ── usuarios ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS usuario_select_misma_empresa ON public.usuarios;
CREATE POLICY usuario_select_misma_empresa
  ON public.usuarios FOR SELECT
  TO authenticated
  USING (empresa_id = public.current_empresa_id());

-- INSERT solo del propio perfil (signup). El cliente debe pasar id = auth.uid()
DROP POLICY IF EXISTS usuario_insert_self ON public.usuarios;
CREATE POLICY usuario_insert_self
  ON public.usuarios FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: admin de la empresa o el propio usuario
DROP POLICY IF EXISTS usuario_update_admin_o_self ON public.usuarios;
CREATE POLICY usuario_update_admin_o_self
  ON public.usuarios FOR UPDATE
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (public.current_user_role() = 'admin' OR id = auth.uid())
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (public.current_user_role() = 'admin' OR id = auth.uid())
  );

-- DELETE: solo via service_role (API /api/eliminar-usuario)

-- ── clientes ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cliente_all_misma_empresa ON public.clientes;
CREATE POLICY cliente_all_misma_empresa
  ON public.clientes FOR ALL
  TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- ── equipos ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS equipo_all_misma_empresa ON public.equipos;
CREATE POLICY equipo_all_misma_empresa
  ON public.equipos FOR ALL
  TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- ── informes ────────────────────────────────────────────────────────────────
-- Lectura: misma empresa; rol cliente solo ve los informes de su company
DROP POLICY IF EXISTS informe_select_misma_empresa ON public.informes;
CREATE POLICY informe_select_misma_empresa
  ON public.informes FOR SELECT
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      public.current_user_role() <> 'cliente'
      OR cliente = public.current_client_company()
    )
  );

-- Escritura: admin/tecnico; cliente es read-only
DROP POLICY IF EXISTS informe_insert_admin_tecnico ON public.informes;
CREATE POLICY informe_insert_admin_tecnico
  ON public.informes FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.current_user_role() IN ('admin', 'tecnico')
  );

DROP POLICY IF EXISTS informe_update_admin_tecnico ON public.informes;
CREATE POLICY informe_update_admin_tecnico
  ON public.informes FOR UPDATE
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_user_role() IN ('admin', 'tecnico')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.current_user_role() IN ('admin', 'tecnico')
  );

DROP POLICY IF EXISTS informe_delete_admin ON public.informes;
CREATE POLICY informe_delete_admin
  ON public.informes FOR DELETE
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_user_role() = 'admin'
  );

-- ── marcas ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS marca_all_misma_empresa ON public.marcas;
CREATE POLICY marca_all_misma_empresa
  ON public.marcas FOR ALL
  TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- ── consecutivos ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS consecutivo_all_misma_empresa ON public.consecutivos;
CREATE POLICY consecutivo_all_misma_empresa
  ON public.consecutivos FOR ALL
  TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- ── form_tokens ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS form_token_all_misma_empresa ON public.form_tokens;
CREATE POLICY form_token_all_misma_empresa
  ON public.form_tokens FOR ALL
  TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- ── asignaciones ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS asignacion_all_misma_empresa ON public.asignaciones;
CREATE POLICY asignacion_all_misma_empresa
  ON public.asignaciones FOR ALL
  TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- ============================================================================
-- 5. Storage: bucket "reportes" — paths con prefijo {empresa_id}/{filename}
-- ============================================================================
-- Lectura: si el bucket es público, getPublicUrl funciona sin policy.
-- Escritura/borrado: solo dentro del folder de la empresa del usuario.

DROP POLICY IF EXISTS reportes_insert_misma_empresa ON storage.objects;
CREATE POLICY reportes_insert_misma_empresa
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reportes'
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
  );

DROP POLICY IF EXISTS reportes_update_misma_empresa ON storage.objects;
CREATE POLICY reportes_update_misma_empresa
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'reportes'
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
  )
  WITH CHECK (
    bucket_id = 'reportes'
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
  );

DROP POLICY IF EXISTS reportes_delete_misma_empresa ON storage.objects;
CREATE POLICY reportes_delete_misma_empresa
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reportes'
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
  );

COMMIT;
