'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registrarConLicencia } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { UserPlus, Eye, EyeOff, CheckCircle, ShieldCheck, Wrench, Lock } from 'lucide-react'

// PIN de acceso — configurable por el administrador en .env
// Si no está definido, no se pide PIN (compatibilidad hacia atrás)
const ACCESS_PIN = process.env.NEXT_PUBLIC_REGISTRO_PIN ?? ''

export default function RegistroPage() {
  const router = useRouter()

  // ── PIN de acceso ──────────────────────────────────────────
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinOk, setPinOk] = useState(!ACCESS_PIN) // si no hay PIN configurado, saltar

  const handleVerificarPin = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput.trim() === ACCESS_PIN) {
      setPinOk(true)
    } else {
      setPinError('Código incorrecto. Contacta al administrador.')
    }
  }

  // ── Formulario de registro ─────────────────────────────────
  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [licencia, setLicencia]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [rolAsignado, setRolAsignado] = useState<'admin' | 'tecnico' | null>(null)

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6)    { setError('La contraseña debe tener mínimo 6 caracteres.'); return }
    setLoading(true)
    const result = await registrarConLicencia(email, password, nombre, licencia)
    setLoading(false)
    if (!result.ok) { setError(result.error ?? 'Error al registrarse.'); return }
    setRolAsignado(result.rol ?? 'tecnico')
    setSuccess(true)
    setTimeout(() => router.push('/'), 2500)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">¡Cuenta creada!</h2>
          {rolAsignado === 'admin' ? (
            <div className="flex items-center justify-center gap-2 mt-2 text-green-700">
              <ShieldCheck className="w-4 h-4" />
              <p className="text-sm font-medium">Fuiste registrado como Administrador</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-2 text-blue-600">
              <Wrench className="w-4 h-4" />
              <p className="text-sm font-medium">Fuiste registrado como Técnico</p>
            </div>
          )}
          <p className="text-sm text-gray-400 mt-2">Redirigiendo…</p>
        </div>
      </div>
    )
  }

  // ── Pantalla de PIN ────────────────────────────────────────
  if (!pinOk) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <img src="/icons/icon-192x192.png" className="w-20 h-20 rounded-2xl object-contain shadow-lg mx-auto mb-4" alt="Logo" />
            <p className="text-sm text-gray-500">Sistema de Informes Técnicos</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">Acceso restringido</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Ingresa el código de acceso proporcionado por tu administrador para crear una cuenta.
            </p>
            <form onSubmit={handleVerificarPin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">Código de acceso</Label>
                <Input
                  id="pin"
                  type="password"
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value); setPinError('') }}
                  placeholder="••••••••"
                  autoFocus
                  required
                />
              </div>
              {pinError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{pinError}</p>
              )}
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
                Continuar
              </Button>
            </form>
            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-green-600 hover:underline">Ya tengo cuenta</a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario de registro ─────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icons/icon-192x192.png" className="w-20 h-20 rounded-2xl object-contain shadow-lg mx-auto mb-4" alt="Logo" />
          <p className="text-sm text-gray-500 mt-1">Sistema de Informes Técnicos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Crear cuenta</h2>
          <p className="text-xs text-gray-400 mb-5">
            El primer usuario registrado con la licencia será el <strong>Administrador</strong>.
            Los siguientes serán <strong>Técnicos</strong>.
          </p>

          <form onSubmit={handleRegistro} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password2">Confirmar contraseña</Label>
              <Input id="password2" type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="Repite la contraseña" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="licencia">Clave de licencia</Label>
              <Input
                id="licencia"
                value={licencia}
                onChange={e => setLicencia(e.target.value.toUpperCase())}
                placeholder="Ingresa tu clave de licencia"
                required
              />
              <p className="text-xs text-gray-400">Proporcionada por el administrador del sistema.</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? 'Registrando…' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              ¿Ya tienes cuenta?{' '}
              <a href="/login" className="text-green-600 font-medium hover:underline">Inicia sesión</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
