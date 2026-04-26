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

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await adminClient()
    .from('empresas')
    .select('id, nombre, nombre_comercial, license_key, activa, fecha_expiracion, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ empresas: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, nombre_comercial, license_key, fecha_expiracion } = body ?? {}

  if (!nombre?.trim() || !license_key?.trim()) {
    return NextResponse.json({ error: 'nombre y license_key son requeridos' }, { status: 400 })
  }

  const { data, error } = await adminClient()
    .from('empresas')
    .insert({
      nombre: nombre.trim(),
      nombre_comercial: nombre_comercial?.trim() || null,
      license_key: license_key.trim().toUpperCase(),
      activa: true,
      fecha_expiracion: fecha_expiracion || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ empresa: data })
}
