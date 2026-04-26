// Server-only: firma y verifica un cookie de sesión para el panel de licencias.
// El cookie es { exp }.{ hmac }, httpOnly, SameSite=Strict.
// Se invalida solo o cuando cambia SUPERADMIN_KEY.

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const SUPERADMIN_COOKIE = 'snel_superadmin'
const TTL_SECONDS = 15 * 60 // 15 min, alineado con la inactividad del cliente

function secret(): string {
  const k = process.env.SUPERADMIN_KEY
  if (!k) throw new Error('SUPERADMIN_KEY no configurada')
  return k
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function issueSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const payload = String(exp)
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payload, sig] = parts
  const expected = sign(payload)
  if (sig.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  const exp = Number(payload)
  if (!Number.isFinite(exp)) return false
  return exp * 1000 > Date.now()
}

export function setSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: SUPERADMIN_COOKIE,
    value: issueSessionToken(),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: SUPERADMIN_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export function isAuthenticated(req: NextRequest): boolean {
  return verifySessionToken(req.cookies.get(SUPERADMIN_COOKIE)?.value)
}
