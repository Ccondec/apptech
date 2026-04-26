-- ============================================================================
-- 0001_rollback.sql — Revierte 0001_enable_rls.sql
-- ============================================================================
-- Ejecutar SOLO si la app deja de funcionar tras aplicar 0001_enable_rls.sql.
-- Deshabilita RLS y elimina policies + funciones helper. No toca datos.
-- ============================================================================

BEGIN;

-- 1. Storage policies
DROP POLICY IF EXISTS reportes_insert_misma_empresa ON storage.objects;
DROP POLICY IF EXISTS reportes_update_misma_empresa ON storage.objects;
DROP POLICY IF EXISTS reportes_delete_misma_empresa ON storage.objects;

-- 2. Table policies
DROP POLICY IF EXISTS empresa_select_propia          ON public.empresas;
DROP POLICY IF EXISTS empresa_update_admin           ON public.empresas;

DROP POLICY IF EXISTS usuario_select_misma_empresa   ON public.usuarios;
DROP POLICY IF EXISTS usuario_insert_self            ON public.usuarios;
DROP POLICY IF EXISTS usuario_update_admin_o_self    ON public.usuarios;

DROP POLICY IF EXISTS cliente_all_misma_empresa      ON public.clientes;
DROP POLICY IF EXISTS equipo_all_misma_empresa       ON public.equipos;

DROP POLICY IF EXISTS informe_select_misma_empresa   ON public.informes;
DROP POLICY IF EXISTS informe_insert_admin_tecnico   ON public.informes;
DROP POLICY IF EXISTS informe_update_admin_tecnico   ON public.informes;
DROP POLICY IF EXISTS informe_delete_admin           ON public.informes;

DROP POLICY IF EXISTS marca_all_misma_empresa        ON public.marcas;
DROP POLICY IF EXISTS consecutivo_all_misma_empresa  ON public.consecutivos;
DROP POLICY IF EXISTS form_token_all_misma_empresa   ON public.form_tokens;
DROP POLICY IF EXISTS asignacion_all_misma_empresa   ON public.asignaciones;

-- 3. Disable RLS
ALTER TABLE public.empresas     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.informes     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.consecutivos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_tokens  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones DISABLE ROW LEVEL SECURITY;

-- 4. Drop helper / RPC functions
--    No tocamos email_registrado porque puede haber existido antes con otra
--    definición — si querés revertir esa también, descomentá la línea.
DROP FUNCTION IF EXISTS public.validar_form_token(uuid);
DROP FUNCTION IF EXISTS public.validar_asignacion(uuid);
DROP FUNCTION IF EXISTS public.validar_licencia(text);
DROP FUNCTION IF EXISTS public.current_empresa_id();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_client_company();
-- DROP FUNCTION IF EXISTS public.email_registrado(text);

COMMIT;
