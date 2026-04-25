'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import TechnicalForm from '@/components/ui/TechnicalForm'
import { Button } from '@/components/ui/button'
import { LogOut, User, ShieldCheck, Zap } from 'lucide-react'

export default function HomePage() {
  const { session, user, loading, mustChangePassword, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) router.push('/login')
    if (!loading && user && mustChangePassword) router.push('/cambiar-password')
    if (!loading && user && user.rol === 'cliente') router.push('/portal')
  }, [loading, session, user, mustChangePassword, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    if (session) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-center space-y-3">
            <p className="text-gray-700 font-medium">Tu cuenta no tiene perfil asignado.</p>
            <p className="text-gray-500 text-sm">Contacta al administrador para que configure tu usuario.</p>
            <button onClick={signOut} className="mt-2 text-sm text-red-500 hover:underline">Cerrar sesión</button>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/icons/icon-192x192.png" className="w-9 h-9 rounded-full object-contain border border-gray-100" alt="Logo" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{user.nombre}</p>
                  <p className="text-xs text-gray-500">{user.empresa?.nombre} · {user.rol}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.rol === 'admin' && (
                <Button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin
                </Button>
              )}
              <Button
                onClick={signOut}
                className="flex items-center gap-2 bg-green-600 hover:bg-red-600 text-white"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="py-6">
        <TechnicalForm technician={user.nombre} empresaId={user.empresa_id} />
      </main>
    </div>
  )
}
