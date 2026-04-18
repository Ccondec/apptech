import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const SUPABASE_URL = 'https://deouxnumhspmollumsoz.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { token: tokenId, informe } = await req.json()

    // Validate token
    const { data: tokenData, error: tokenErr } = await admin
      .from('form_tokens')
      .select('empresa_id, activo, expires_at, usos')
      .eq('id', tokenId)
      .single()

    if (tokenErr || !tokenData) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    if (!tokenData.activo) return NextResponse.json({ error: 'Enlace desactivado' }, { status: 401 })
    if (new Date(tokenData.expires_at) < new Date()) return NextResponse.json({ error: 'Enlace expirado' }, { status: 401 })

    // Obtener número consecutivo atómico para técnico externo
    const { data: nextNum } = await admin.rpc('siguiente_numero_informe', {
      p_empresa_id: tokenData.empresa_id,
      p_tipo: informe.tipo_reporte ?? 'ups',
    })
    const TIPO_PREFIX: Record<string, string> = {
      ups: 'UPS', aire: 'AIR', planta: 'PLT', fotovoltaico: 'FTV', otros: 'OTR',
    }
    const numeroConsecutivo = nextNum ?? 1
    const tipo = String(informe.tipo_reporte ?? 'ups')
    const prefix = TIPO_PREFIX[tipo] ?? 'RPT'
    const numero_informe = `${prefix}-${String(numeroConsecutivo).padStart(4, '0')}`

    // Save informe with atomic number
    const { error: informeErr } = await admin.from('informes').insert({
      ...informe,
      empresa_id: tokenData.empresa_id,
      numero_informe,
    })
    if (informeErr) return NextResponse.json({ error: informeErr.message }, { status: 500 })

    // Increment usage
    await admin.from('form_tokens').update({ usos: tokenData.usos + 1 }).eq('id', tokenId)

    return NextResponse.json({ ok: true, numero_informe })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
