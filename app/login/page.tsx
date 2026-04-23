'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LogIn, Eye, EyeOff, Zap } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/icons/icon-192x192.png" className="w-20 h-20 rounded-2xl object-contain shadow-lg mx-auto mb-4" alt="Logo" />
          <p className="text-sm text-gray-500 mt-1">Sistema de Informes Técnicos</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Iniciar sesión</h2>

          <form onSubmit={handleLogin} className="space-y-4">
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
                  placeholder="••••••••"
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

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            <a href="/recuperar" className="block text-sm text-gray-400 hover:text-gray-600">
              ¿Olvidaste tu contraseña?
            </a>
            <p className="text-sm text-gray-500">
              ¿No tienes cuenta?{' '}
              <a href="/registro" className="text-green-600 font-medium hover:underline">
                Regístrate con tu clave
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
