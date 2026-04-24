import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
  }

  const { email, password, nombre, rol, empresa_id } = await req.json()

  if (!email || !password || !nombre || !rol || !empresa_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createClient('https://deouxnumhspmollumsoz.supabase.co', SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Crear usuario en Supabase Auth (email confirmado, sin enviar correo)
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr || !authData?.user) {
    return NextResponse.json({ error: authErr?.message ?? 'Error creando usuario en Auth' }, { status: 400 })
  }

  const userId = authData.user.id

  // 2. Insertar en tabla usuarios
  const { error: dbErr } = await admin.from('usuarios').insert({
    id: userId,
    empresa_id,
    nombre,
    rol,
    activo: true,
    must_change_password: true,
  })

  if (dbErr) {
    // Intentar limpiar el usuario de auth si falló el insert
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: dbErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id: userId })
}
