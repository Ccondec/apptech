import { NextRequest, NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/superadmin-session'

export async function POST(req: NextRequest) {
  const masterKey = process.env.SUPERADMIN_KEY
  if (!masterKey) {
    return NextResponse.json({ error: 'No configurado' }, { status: 500 })
  }
  const { key } = await req.json()
  if (key !== masterKey) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  setSessionCookie(res)
  return res
}
