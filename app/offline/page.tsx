'use client'
import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false)

  const retry = () => {
    setRetrying(true)
    // Try to navigate to home — if network is back it will load
    window.location.href = '/'
  }

  useEffect(() => {
    // If we come back online, redirect automatically
    const handleOnline = () => { window.location.href = '/' }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center space-y-6">

        <div className="flex justify-center">
          <div className="bg-gray-100 rounded-full p-5">
            <WifiOff className="w-10 h-10 text-gray-400" />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Sin conexión</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            No hay acceso a internet en este momento. Los informes que generes se guardarán
            localmente y se sincronizarán automáticamente cuando vuelva la conexión.
          </p>
        </div>

        <button
          onClick={retry}
          disabled={retrying}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Reconectando…' : 'Intentar de nuevo'}
        </button>

        <p className="text-xs text-gray-400">
          La aplicación funciona sin conexión. Tus datos están seguros.
        </p>
      </div>
    </div>
  )
}
