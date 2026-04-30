-- ============================================================================
-- Migration 0004: Tickets de servicio (cliente → admin/técnico)
-- ============================================================================
-- Permite al cliente abrir un ticket desde el portal solicitando servicio
-- sobre un equipo específico. El admin lo ve en /admin/tickets, lo asigna,
-- cambia su estado y lo cierra cuando se atendió.
--
-- Aplicar en Supabase Dashboard → SQL Editor.
-- ============================================================================

BEGIN;

-- ── 1. Tabla tickets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tickets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  client_id            UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente              TEXT NOT NULL, -- denormalizado (igual que informes.cliente)
  equipo_id            UUID REFERENCES public.equipos(id) ON DELETE SET NULL,
  qr_code              TEXT,           -- denormalizado para acceso rápido al equipo
  -- Datos del equipo al momento del ticket (snapshot)
  equipo_marca         TEXT,
  equipo_modelo        TEXT,
  equipo_serial        TEXT,
  equipo_ubicacion     TEXT,
  -- Datos del ticket
  categoria            TEXT NOT NULL CHECK (categoria IN ('averia', 'mantenimiento', 'consulta')),
  prioridad            TEXT NOT NULL CHECK (prioridad IN ('alta', 'media', 'baja')) DEFAULT 'media',
  descripcion          TEXT NOT NULL,
  preferencia_horario  TEXT,
  foto_url             TEXT,
  -- Estado y asignación
  estado               TEXT NOT NULL CHECK (estado IN ('nuevo', 'asignado', 'en_proceso', 'resuelto', 'cerrado')) DEFAULT 'nuevo',
  asignado_a           UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  -- Quien creó (auth.uid del cliente)
  creado_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Comentario interno del admin/técnico al cerrar
  resolucion           TEXT,
  resuelto_at          TIMESTAMPTZ,
  -- Timestamps
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_empresa_estado ON public.tickets(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente       ON public.tickets(empresa_id, LOWER(TRIM(cliente)));
CREATE INDEX IF NOT EXISTS idx_tickets_equipo        ON public.tickets(equipo_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at    ON public.tickets(created_at DESC);

-- Trigger para mantener updated_at al día
CREATE OR REPLACE FUNCTION public.tickets_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_updated_at ON public.tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_set_updated_at();

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- SELECT: misma empresa; rol cliente solo ve los suyos (case-insensitive)
DROP POLICY IF EXISTS ticket_select_misma_empresa ON public.tickets;
CREATE POLICY ticket_select_misma_empresa
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      public.current_user_role() <> 'cliente'
      OR LOWER(TRIM(cliente)) = LOWER(TRIM(public.current_client_company()))
    )
  );

-- INSERT: cliente puede insertar para su propio cliente y empresa.
-- Admin/técnico también pueden crear tickets en nombre del cliente.
DROP POLICY IF EXISTS ticket_insert_propio ON public.tickets;
CREATE POLICY ticket_insert_propio
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      public.current_user_role() IN ('admin', 'tecnico')
      OR (
        public.current_user_role() = 'cliente'
        AND LOWER(TRIM(cliente)) = LOWER(TRIM(public.current_client_company()))
      )
    )
  );

-- UPDATE: solo admin/técnico (cliente es read-only sobre sus tickets)
DROP POLICY IF EXISTS ticket_update_admin_tecnico ON public.tickets;
CREATE POLICY ticket_update_admin_tecnico
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_user_role() IN ('admin', 'tecnico')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.current_user_role() IN ('admin', 'tecnico')
  );

-- DELETE: solo admin
DROP POLICY IF EXISTS ticket_delete_admin ON public.tickets;
CREATE POLICY ticket_delete_admin
  ON public.tickets FOR DELETE
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_user_role() = 'admin'
  );

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.tickets CASCADE;
-- DROP FUNCTION IF EXISTS public.tickets_set_updated_at();
-- COMMIT;
