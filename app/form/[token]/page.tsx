'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { validarFormToken, Empresa } from '@/lib/supabase'
import TechnicalForm from '@/components/ui/TechnicalForm'
import { Zap, XCircle, Clock } from 'lucide-react'

export default function ExternalFormPage() {
  const params = useParams()
  const tokenId = params.token as string

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [empresaId, setEmpresaId] = useState<string>('')
  const [techName, setTechName] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!tokenId) { setStatus('invalid'); return }
    validarFormToken(tokenId).then(result => {
      if (!result) { setStatus('invalid'); return }
      setEmpresa(result.empresa)
      setEmpresaId(result.empresaId)
      setStatus('valid')
    })
  }, [tokenId])

  if (status === 'loading') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Verificando enlace…</p>
      </div>
    </div>
  )

  if (status === 'invalid') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-800">Enlace inválido o expirado</h2>
        <p className="text-sm text-gray-500 mt-1">Solicita un nuevo enlace al administrador.</p>
      </div>
    </div>
  )

  if (!started) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-600 text-white mb-3 shadow-lg">
            <Zap className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">{empresa?.nombre_comercial ?? empresa?.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">Informe Técnico — Acceso externo</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            <Clock className="w-4 h-4 flex-shrink-0" />
            Este enlace es temporal. Úsalo antes de que expire.
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tu nombre completo</label>
            <input
              type="text"
              value={techName}
              onChange={e => setTechName(e.target.value)}
              placeholder="Nombre del técnico"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            onClick={() => { if (techName.trim()) setStarted(true) }}
            disabled={!techName.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Comenzar informe
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <TechnicalForm
      technician={techName}
      empresaId={empresaId}
      externalToken={tokenId}
    />
  )
}
