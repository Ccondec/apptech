/**
 * Helper para validar JWT en rutas API de Next.js.
 * Verifica que el usuario esté autenticado y retorna su empresa_id.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config'

export async function getAuthEmpresa(req: NextRequest): Promise<{ userId: string; empresaId: string } | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  // Validar el JWT usando el anon client con el token del usuario
  // (esta es la forma correcta en Supabase)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return null

  // Obtener empresa_id del perfil usando service role
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) return null

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: perfil } = await admin
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (!perfil?.empresa_id) return null

  return { userId: user.id, empresaId: perfil.empresa_id }
}
