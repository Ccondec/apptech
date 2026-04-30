'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Botón flotante "Volver" para la página pública del QR.
 * - Si el usuario llegó desde dentro de la app (tiene history), hace router.back()
 * - Si entró directo (escaneando el QR), redirige al portal cliente
 */
export default function BackButton() {
  const router = useRouter()

  const handleBack = () => {
    // Si hay historial dentro del mismo origen, ir atrás
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/portal')
    }
  }

  return (
    <button
      onClick={handleBack}
      className="fixed top-4 left-4 z-20 inline-flex items-center gap-1.5 px-3 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-white shadow-sm"
    >
      <ArrowLeft className="w-4 h-4" /> Volver
    </button>
  )
}
