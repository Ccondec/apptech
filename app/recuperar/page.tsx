'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { solicitarRecuperacion } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function RecuperarPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await solicitarRecuperacion(email.trim())
    if (!res.ok) {
      setError(res.error ?? 'No se pudo enviar el correo. Verifica la dirección ingresada.')
    } else {
      setSent(true)
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
          <button
            onClick={() => router.push('/login')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-5"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al login
          </button>

          {sent ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">Correo enviado</h2>
              <p className="text-sm text-gray-500">
                Revisa tu bandeja de entrada en <strong>{email}</strong>.
                El enlace expira en 1 hora.
              </p>
              <p className="text-xs text-gray-400">Si no lo ves, revisa la carpeta de spam.</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Recuperar contraseña</h2>
              <p className="text-sm text-gray-500 mb-5">
                Te enviaremos un enlace para crear una nueva contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="correo@empresa.com"
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
                  <Mail className="w-4 h-4 mr-2" />
                  {loading ? 'Enviando…' : 'Enviar enlace'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
