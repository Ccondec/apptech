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

    // Save informe
    const { error: informeErr } = await admin.from('informes').insert({
      ...informe,
      empresa_id: tokenData.empresa_id,
    })
    if (informeErr) return NextResponse.json({ error: informeErr.message }, { status: 500 })

    // Increment usage
    await admin.from('form_tokens').update({ usos: tokenData.usos + 1 }).eq('id', tokenId)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
