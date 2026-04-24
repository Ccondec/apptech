import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) return NextResponse.json({ error: 'Config missing' }, { status: 500 })

  const { empresa_id } = await req.json()
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })

  const admin = createClient('https://deouxnumhspmollumsoz.supabase.co', SERVICE_KEY, {
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
