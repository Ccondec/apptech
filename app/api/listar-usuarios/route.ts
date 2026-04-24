import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
  }

  // Leer empresa_id del header (enviado por el cliente autenticado)
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })
  }

  const admin = createClient('https://deouxnumhspmollumsoz.supabase.co', SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from('usuarios')
    .select('id, nombre, rol, activo, email, client_company')
    .eq('empresa_id', empresa_id)
    .order('nombre', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ usuarios: data ?? [] })
}
