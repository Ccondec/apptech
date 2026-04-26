import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthEmpresa } from '@/lib/api-auth'
import { SUPABASE_URL } from '@/lib/supabase-config'

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) return NextResponse.json({ error: 'Config missing' }, { status: 500 })

  // Validar autenticación y usar empresa_id del JWT
  const auth = await getAuthEmpresa(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const empresa_id = auth.empresaId

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Leer valor actual
  const { data: existing } = await admin
    .from('consecutivos')
    .select('ultimo_numero')
    .eq('empresa_id', empresa_id)
    .eq('tipo_reporte', 'qr')
    .maybeSingle()

  let siguiente: number

  if (existing) {
    // Incrementar
    siguiente = ((existing.ultimo_numero as number) ?? 0) + 1
    await admin
      .from('consecutivos')
      .update({ ultimo_numero: siguiente })
      .eq('empresa_id', empresa_id)
      .eq('tipo_reporte', 'qr')
  } else {
    // Primera vez
    siguiente = 1
    await admin
      .from('consecutivos')
      .insert({ empresa_id, tipo_reporte: 'qr', ultimo_numero: 1 })
  }

  const prefix = (empresa_id as string).replace(/-/g, '').slice(0, 6).toUpperCase()
  const qr = `${prefix}-EQ-${String(siguiente).padStart(4, '0')}`
  return NextResponse.json({ qr })
}
