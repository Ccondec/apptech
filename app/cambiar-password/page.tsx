'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { actualizarPassword } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const { user, loading, mustChangePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // Si el usuario no necesita cambiar contraseña, redirigir
  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && user && !mustChangePassword) router.push('/')
  }, [loading, user, mustChangePassword, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm)  { setError('Las contraseñas no coinciden.'); return }

    setSaving(true)
    const res = await actualizarPassword(password)
    if (!res.ok) {
      setError(res.error ?? 'Error al actualizar la contraseña.')
      setSaving(false)
      return
    }
    // Hard reload para forzar reinicio del AuthContext con must_change_password = false
    window.location.replace('/')
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icons/icon-192x192.png" className="w-20 h-20 rounded-2xl object-contain shadow-lg mx-auto mb-4" alt="Logo" />
          <p className="text-sm text-gray-500">Sistema de Informes Técnicos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">Cambia tu contraseña</h2>
              <p className="text-xs text-gray-400">Hola {user.nombre} — debes elegir una contraseña personal antes de continuar.</p>
            </div>
          </div>

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
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {saving ? 'Guardando…' : 'Establecer contraseña'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
