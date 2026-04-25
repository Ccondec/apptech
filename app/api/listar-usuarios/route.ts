import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthEmpresa } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
  }

  // Validar que el solicitante está autenticado
  const auth = await getAuthEmpresa(req)
  if (!auth) {
    console.error('[listar-usuarios] Auth fallida — header:', req.headers.get('authorization')?.slice(0, 30))
    return NextResponse.json({ error: 'No autorizado', hint: 'Token inválido o sesión expirada' }, { status: 401 })
  }

  const admin = createClient('https://deouxnumhspmollumsoz.supabase.co', SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from('usuarios')
    .select('id, nombre, rol, activo, client_company')
    .eq('empresa_id', auth.empresaId)
    .order('nombre', { ascending: true })

  if (error) {
    console.error('[listar-usuarios] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ usuarios: data ?? [] })
}
