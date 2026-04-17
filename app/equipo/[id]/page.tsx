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
    title: `Equipo ${id} — Historial Técnico`,
    description: `Historial de informes técnicos del equipo ${id}`,
  }
}

const fields = [
  { key: 'cliente',   label: 'Cliente',      Icon: User          },
  { key: 'serial',    label: 'N° de Serie',  Icon: Hash          },
  { key: 'marca',     label: 'Marca',        Icon: Tag           },
  { key: 'modelo',    label: 'Modelo',       Icon: Cpu           },
  { key: 'capacidad', label: 'Capacidad',    Icon: Zap           },
  { key: 'ubicacion', label: 'Ubicación',    Icon: MapPin        },
  { key: 'tecnico',   label: 'Técnico',      Icon: ClipboardList },
] as const

export default async function EquipoPage({ params }: Props) {
  const { id } = await params
  const qrCode = decodeURIComponent(id)

  const { data: informes, error } = await supabase
    .from('informes')
    .select('*')
    .eq('qr_code', qrCode)
    .order('created_at', { ascending: false })

  if (error || !informes || informes.length === 0) {
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

  const ultimo = informes[0]

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Historial Técnico</h1>
        <p className="text-sm text-gray-500 mt-1">Código: <strong>{qrCode}</strong></p>
      </div>

      {/* Datos del equipo (del último informe) */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="bg-green-600 px-6 py-4 text-white">
          <p className="text-xs font-medium opacity-80 uppercase tracking-wide">Datos del Equipo</p>
          <p className="text-lg font-bold mt-0.5">{ultimo.marca} {ultimo.modelo}</p>
        </div>
        <div className="divide-y divide-gray-50">
          {fields.map(({ key, label, Icon }) => {
            const value = ultimo[key]
            if (!value) return null
            return (
              <div key={key} className="flex items-center gap-4 px-6 py-3">
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
      </div>

      {/* Historial de visitas */}
      <div className="w-full max-w-md">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Historial de visitas ({informes.length})
        </h2>
        <div className="space-y-3">
          {informes.map((inf: any, i: number) => (
            <div key={inf.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  N° {inf.numero_informe || '—'}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" /> {inf.fecha || '—'}
                </span>
              </div>
              {inf.tecnico && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <ClipboardList className="w-3 h-3" /> Técnico: <span className="font-medium text-gray-700">{inf.tecnico}</span>
                </p>
              )}
              {inf.tipo_reporte && (
                <p className="text-xs text-gray-400 mt-1 capitalize">{inf.tipo_reporte}</p>
              )}
              {inf.observaciones && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <p className="text-xs font-medium text-gray-500">Observaciones</p>
                  <p className="text-xs text-gray-700 mt-0.5">{inf.observaciones}</p>
                </div>
              )}
              {inf.recomendaciones && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-gray-500">Recomendaciones</p>
                  <p className="text-xs text-gray-700 mt-0.5">{inf.recomendaciones}</p>
                </div>
              )}
              {i === 0 && (
                <span className="inline-block mt-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Último servicio</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center">
        Sistema de Informes Técnicos<br />
        Para más información contacte a su técnico asignado.
      </p>
    </main>
  )
}
