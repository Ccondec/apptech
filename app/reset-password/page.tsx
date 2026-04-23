'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, actualizarPassword } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router  = useRouter()
  const [ready, setReady]         = useState(false)
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  // Supabase redirige aquí con el token en el hash (#access_token=...)
  // onAuthStateChange captura el evento PASSWORD_RECOVERY automáticamente
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm)  { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    const res = await actualizarPassword(password)
    if (!res.ok) {
      setError(res.error ?? 'Error al actualizar la contraseña.')
    } else {
      setDone(true)
      setTimeout(() => router.push('/'), 2500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icons/icon-192x192.png" className="w-20 h-20 rounded-2xl object-contain shadow-lg mx-auto mb-4" alt="Logo" />
          <p className="text-sm text-gray-500">Sistema de Informes Técnicos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {done ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">¡Contraseña actualizada!</h2>
              <p className="text-sm text-gray-500">Redirigiendo al inicio…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-400">Verificando enlace…</p>
              <p className="text-xs text-gray-400 mt-4">
                Si este mensaje no desaparece, el enlace puede haber expirado.{' '}
                <a href="/recuperar" className="text-green-600 hover:underline">Solicitar uno nuevo</a>
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Nueva contraseña</h2>
              <p className="text-sm text-gray-500 mb-5">Elige una contraseña segura para tu cuenta.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
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
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {loading ? 'Guardando…' : 'Guardar contraseña'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
