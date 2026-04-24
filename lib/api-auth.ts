/**
 * Helper para validar JWT en rutas API de Next.js.
 * Verifica que el usuario esté autenticado y retorna su empresa_id.
 * Úsalo en cualquier ruta API que maneje datos sensibles.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const SUPABASE_URL = 'https://deouxnumhspmollumsoz.supabase.co'

export async function getAuthEmpresa(req: NextRequest): Promise<{ userId: string; empresaId: string } | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) return null

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verificar el JWT contra Supabase Auth
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null

  // Obtener empresa_id del perfil del usuario
  const { data: perfil } = await admin
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (!perfil?.empresa_id) return null

  return { userId: user.id, empresaId: perfil.empresa_id }
}
