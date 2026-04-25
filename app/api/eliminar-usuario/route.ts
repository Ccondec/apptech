import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthEmpresa } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
  }

  const auth = await getAuthEmpresa(req)
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
  }

  // No permitir que el admin se elimine a sí mismo
  if (userId === auth.userId) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
  }

  const admin = createClient('https://deouxnumhspmollumsoz.supabase.co', SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verificar que el usuario pertenece a la misma empresa
  const { data: perfil } = await admin
    .from('usuarios')
    .select('empresa_id')
    .eq('id', userId)
    .maybeSingle()

  if (!perfil || perfil.empresa_id !== auth.empresaId) {
    return NextResponse.json({ error: 'Usuario no encontrado o sin permiso' }, { status: 403 })
  }

  // Eliminar perfil de la tabla usuarios primero
  await admin.from('usuarios').delete().eq('id', userId)

  // Eliminar de Supabase Auth
  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
