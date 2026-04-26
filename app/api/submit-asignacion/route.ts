import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/supabase-config'

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { token: asignacionId, informe } = await req.json()

    // Validar asignación
    const { data: asig, error: asigErr } = await admin
      .from('asignaciones')
      .select('empresa_id, estado, expires_at')
      .eq('id', asignacionId)
      .single()

    if (asigErr || !asig) return NextResponse.json({ error: 'Asignación inválida' }, { status: 401 })
    if (asig.estado !== 'pendiente') return NextResponse.json({ error: 'Asignación ya completada' }, { status: 401 })
    if (new Date(asig.expires_at) < new Date()) return NextResponse.json({ error: 'Asignación expirada' }, { status: 401 })

    // Número consecutivo atómico
    const { data: nextNum } = await admin.rpc('siguiente_numero_informe', {
      p_empresa_id: asig.empresa_id,
      p_tipo: 'global',
    })
    const TIPO_PREFIX: Record<string, string> = {
      ups: 'UPS', aire: 'AIR', planta: 'PLT', fotovoltaico: 'FTV',
      impresora: 'IMP', apantallamiento: 'APT', otros: 'OTR',
    }
    const tipo = String(informe.tipo_reporte ?? 'ups')
    const prefix = TIPO_PREFIX[tipo] ?? 'RPT'
    const yy = String(new Date().getFullYear()).slice(-2)
    const numero_informe = `${prefix}-${yy}${String(nextNum ?? 1).padStart(4, '0')}`

    // Guardar informe
    const { data: saved, error: informeErr } = await admin
      .from('informes')
      .insert({ ...informe, empresa_id: asig.empresa_id, numero_informe })
      .select('id')
      .single()

    if (informeErr) return NextResponse.json({ error: informeErr.message }, { status: 500 })

    // Marcar asignación como completada
    await admin
      .from('asignaciones')
      .update({ estado: 'completado', informe_id: saved.id })
      .eq('id', asignacionId)

    return NextResponse.json({ ok: true, numero_informe })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
