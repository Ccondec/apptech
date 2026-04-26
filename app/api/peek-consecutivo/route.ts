import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/supabase-config'

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get('empresa_id')
  if (!empresaId) return NextResponse.json({ numero: 1 })

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) return NextResponse.json({ numero: 1 })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data } = await admin
    .from('consecutivos')
    .select('ultimo_numero')
    .eq('empresa_id', empresaId)
    .eq('tipo_reporte', 'global')
    .maybeSingle()

  const numero = ((data?.ultimo_numero as number) ?? 0) + 1
  return NextResponse.json({ numero })
}
