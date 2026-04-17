import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { CheckCircle, Calendar, Hash, User, Tag, Cpu, Zap, MapPin, ClipboardList, Clock, AlertCircle } from 'lucide-react'

const supabase = createClient(
  'https://deouxnumhspmollumsoz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlb3V4bnVtaHNwbW9sbHVtc296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzU1MDIsImV4cCI6MjA5MjAxMTUwMn0.V4nWluFT7-7zN7y8TCpnOAu01bhMeKpG4eZCc-8eFGw'
)

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Equipo ${id} | Ion Energy`,
    description: `Información técnica del equipo ${id}`,
  }
}

const fields = [
  { key: 'cliente',   label: 'Cliente',      Icon: User        },
  { key: 'serial',    label: 'N° de Serie',  Icon: Hash        },
  { key: 'marca',     label: 'Marca',        Icon: Tag         },
  { key: 'modelo',    label: 'Modelo',       Icon: Cpu         },
  { key: 'capacidad', label: 'Capacidad',    Icon: Zap         },
  { key: 'ubicacion', label: 'Ubicación',    Icon: MapPin      },
  { key: 'tecnico',   label: 'Técnico',      Icon: ClipboardList },
] as const

export default async function EquipoPage({ params }: Props) {
  const { id } = await params
  const qrCode = decodeURIComponent(id)

  const { data, error } = await supabase
    .from('informes')
    .select('*')
    .eq('qr_code', qrCode)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-lg font-semibold text-gray-800">Equipo no encontrado</p>
          <p className="text-sm text-gray-500 mt-1">El código <strong>{qrCode}</strong> no tiene informes registrados.</p>
        </div>
      </main>
    )
  }

  const fechaRegistro = new Date(data.created_at).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Informe Técnico Verificado</h1>
        <p className="text-sm text-gray-500 mt-1">Ion Energy S.A.S</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header verde */}
        <div className="bg-green-600 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-medium opacity-80 uppercase tracking-wide">Reporte N°</p>
            <p className="text-2xl font-bold">{data.numero_informe || '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium opacity-80 uppercase tracking-wide flex items-center gap-1 justify-end">
              <Calendar className="w-3 h-3" /> Fecha
            </p>
            <p className="text-base font-semibold">{data.fecha || '—'}</p>
          </div>
        </div>

        {/* Código QR */}
        <div className="flex items-center gap-3 px-6 py-3 bg-green-50 border-b border-green-100">
          <Hash className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Código de equipo:</span>
          <span className="text-sm font-bold text-green-800">{qrCode}</span>
        </div>

        {/* Datos */}
        <div className="divide-y divide-gray-50">
          {fields.map(({ key, label, Icon }) => {
            const value = data[key]
            if (!value) return null
            return (
              <div key={key} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Fecha de registro */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-t border-gray-100">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">Último informe registrado: {fechaRegistro}</span>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center">
        Documento generado por el sistema Servtech de Ion Energy S.A.S.<br />
        Para más información contacte a su técnico asignado.
      </p>
    </main>
  )
}
