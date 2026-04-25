'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { validarAsignacion, Asignacion, Empresa } from '@/lib/supabase'
import TechnicalForm from '@/components/ui/TechnicalForm'
import { ClipboardCheck, XCircle, CheckCircle2 } from 'lucide-react'

const TIPO_LABEL: Record<string, string> = {
  ups: 'UPS / Baterías',
  aire: 'Aires Acondicionados',
  planta: 'Plantas Eléctricas',
  fotovoltaico: 'Sistema Fotovoltaico',
  impresora: 'Impresoras',
  apantallamiento: 'Apant. / Puesta a Tierra',
  otros: 'Otros Servicios',
}

export default function AsignacionPage() {
  const params = useParams()
  const tokenId = params.token as string

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'done'>('loading')
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [empresaId, setEmpresaId] = useState('')
  const [asignacion, setAsignacion] = useState<Asignacion | null>(null)
  const [started, setStarted] = useState(false)
  const [techName, setTechName] = useState('')

  useEffect(() => {
    if (!tokenId) { setStatus('invalid'); return }
    validarAsignacion(tokenId).then(result => {
      if (!result) { setStatus('invalid'); return }
      setEmpresa(result.empresa)
      setEmpresaId(result.empresaId)
      setAsignacion(result.asignacion)
      // Pre-llenar nombre del técnico si viene en la asignación
      if (result.asignacion.tecnico_nombre) setTechName(result.asignacion.tecnico_nombre)
      setStatus('valid')
    })
  }, [tokenId])

  if (status === 'loading') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Verificando asignación…</p>
      </div>
    </div>
  )

  if (status === 'invalid') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-800">Asignación inválida o expirada</h2>
        <p className="text-sm text-gray-500 mt-1">Solicita una nueva asignación al administrador.</p>
      </div>
    </div>
  )

  if (status === 'done') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-800">Informe enviado correctamente</h2>
        <p className="text-sm text-gray-500 mt-1">El informe fue guardado. Puedes cerrar esta ventana.</p>
      </div>
    </div>
  )

  if (!started) {
    const preset = asignacion?.preset_data ?? {}
    const cliente = String(preset.clientCompany ?? '')
    const tipoLabel = TIPO_LABEL[asignacion?.tipo_reporte ?? ''] ?? asignacion?.tipo_reporte ?? ''

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-600 text-white mb-3 shadow-lg">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">{empresa?.nombre_comercial ?? empresa?.nombre}</h1>
            <p className="text-sm text-gray-500 mt-1">Informe técnico asignado</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            {/* Resumen de la asignación */}
            <div className="space-y-2 text-sm">
              {cliente && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente</span>
                  <span className="font-medium text-gray-800">{cliente}</span>
                </div>
              )}
              {tipoLabel && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo de servicio</span>
                  <span className="font-medium text-gray-800">{tipoLabel}</span>
                </div>
              )}
              {!!preset.equipmentSerial && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Serial equipo</span>
                  <span className="font-medium text-gray-800">{String(preset.equipmentSerial)}</span>
                </div>
              )}
              {!!preset.equipmentBrand && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Marca / Modelo</span>
                  <span className="font-medium text-gray-800">{String(preset.equipmentBrand)}{preset.equipmentModel ? ` / ${String(preset.equipmentModel)}` : ''}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
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
  }

  return (
    <TechnicalForm
      technician={techName}
      empresaId={empresaId}
      asignacionToken={tokenId}
      presetData={asignacion?.preset_data}
      onAsignacionDone={() => setStatus('done')}
    />
  )
}
