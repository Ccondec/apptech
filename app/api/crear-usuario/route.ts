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

  let userId: string

  // 1. Intentar crear usuario en Supabase Auth
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr) {
    // Si ya existe en Auth, buscar su ID por email
    if (authErr.message?.toLowerCase().includes('already registered') ||
        authErr.message?.toLowerCase().includes('already exists')) {
      const { data: listData } = await admin.auth.admin.listUsers()
      const existing = listData?.users?.find(u => u.email === email)
      if (!existing) {
        return NextResponse.json({ error: 'Usuario ya existe en Auth pero no se pudo obtener su ID' }, { status: 400 })
      }
      userId = existing.id
      // Actualizar contraseña por si la anterior era diferente
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    } else {
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }
  } else if (authData?.user) {
    userId = authData.user.id
  } else {
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 400 })
  }

  // 2. Verificar si ya tiene perfil en usuarios
  const { data: perfilExistente } = await admin
    .from('usuarios')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (perfilExistente) {
    // Ya tiene perfil — actualizar datos
    await admin.from('usuarios').update({
      nombre,
      rol,
      empresa_id,
      activo: true,
      must_change_password: true,
    }).eq('id', userId)
  } else {
    // Insertar perfil nuevo
    const { error: dbErr } = await admin.from('usuarios').insert({
      id: userId,
      empresa_id,
      nombre,
      rol,
      activo: true,
      must_change_password: true,
    })

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true, id: userId })
}
