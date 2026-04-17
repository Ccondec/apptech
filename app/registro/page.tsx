'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registrarConLicencia } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { UserPlus, Eye, EyeOff, Zap, CheckCircle, ShieldCheck, Wrench } from 'lucide-react'

export default function RegistroPage() {
  const router = useRouter()
  const [nombre, setNombre]         = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [password2, setPassword2]   = useState('')
  const [licencia, setLicencia]     = useState('')
  const [rol, setRol]               = useState<'admin' | 'tecnico'>('tecnico')
  const [showPass, setShowPass]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== password2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres.')
      return
    }

    setLoading(true)
    const result = await registrarConLicencia(email, password, nombre, licencia, rol)
    setLoading(false)

    if (!result.ok) {
      setError(result.error ?? 'Error al registrarse.')
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/'), 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">¡Cuenta creada!</h2>
          <p className="text-sm text-gray-500 mt-2">Redirigiendo…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-600 text-white mb-4 shadow-lg">
            <Zap className="w-9 h-9" />
          </div>
          <p className="text-sm text-gray-500 mt-1">Sistema de Informes Técnicos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Crear cuenta</h2>

          <form onSubmit={handleRegistro} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password2">Confirmar contraseña</Label>
              <Input
                id="password2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repite la contraseña"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de cuenta</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRol('tecnico')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors text-sm font-medium ${
                    rol === 'tecnico'
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                  Técnico
                </button>
                <button
                  type="button"
                  onClick={() => setRol('admin')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors text-sm font-medium ${
                    rol === 'admin'
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                  Administrador
                </button>
              </div>
              {rol === 'admin' && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  Solo puede haber un administrador por empresa.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="licencia">Clave de licencia</Label>
              <Input
                id="licencia"
                value={licencia}
                onChange={(e) => setLicencia(e.target.value.toUpperCase())}
                placeholder="IONENERGY-XXXX-XXXX"
                required
              />
              <p className="text-xs text-gray-400">Proporcionada por el administrador de tu empresa</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? 'Registrando…' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              ¿Ya tienes cuenta?{' '}
              <a href="/login" className="text-green-600 font-medium hover:underline">
                Inicia sesión
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
