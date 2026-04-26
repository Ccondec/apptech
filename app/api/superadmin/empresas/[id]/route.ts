import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthenticated } from '@/lib/superadmin-session'
import { SUPABASE_URL } from '@/lib/supabase-config'

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (typeof body.activa === 'boolean') update.activa = body.activa
  if ('fecha_expiracion' in body) update.fecha_expiracion = body.fecha_expiracion || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay cambios' }, { status: 400 })
  }

  const { data, error } = await adminClient()
    .from('empresas')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ empresa: data })
}
