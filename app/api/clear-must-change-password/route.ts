import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-config'

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  }

  // Verificar que el usuario está autenticado con el anon key
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Actualizar con service role (bypasa RLS)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin
    .from('usuarios')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
