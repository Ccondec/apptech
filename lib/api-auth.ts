/**
 * Helper para validar JWT en rutas API de Next.js.
 * Verifica que el usuario esté autenticado y retorna su empresa_id.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const SUPABASE_URL = 'https://deouxnumhspmollumsoz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlb3V4bnVtaHNwbW9sbHVtc296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzU1MDIsImV4cCI6MjA5MjAxMTUwMn0.V4nWluFT7-7zN7y8TCpnOAu01bhMeKpG4eZCc-8eFGw'

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
