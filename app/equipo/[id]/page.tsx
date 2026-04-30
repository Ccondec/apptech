import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { CheckCircle, Hash, User, Tag, Cpu, Zap, MapPin, ClipboardList, AlertCircle } from 'lucide-react'
import HistorialTabs from './HistorialTabs'
import BackButton from './BackButton'
import { SUPABASE_URL } from '@/lib/supabase-config'

// Usar service role para que RLS no bloquee la consulta pública del QR
function getAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(SUPABASE_URL, key)
}

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

  const admin = getAdmin()

  // Buscar equipo por QR exacto; si no existe, buscar por sufijo (compatibilidad con QR antiguos)
  let resolvedQr = qrCode
  let { data: equipo } = await admin
    .from('equipos')
    .select('empresa_id, qr_code')
    .eq('qr_code', qrCode)
    .maybeSingle()

  if (!equipo) {
    // QR antiguo (ej: EQ-0001) — buscar equipo cuyo qr_code termina en ese sufijo
    const { data: equipoFallback } = await admin
      .from('equipos')
      .select('empresa_id, qr_code')
      .ilike('qr_code', `%-${qrCode}`)
      .maybeSingle()
    if (equipoFallback) {
      equipo = equipoFallback
      resolvedQr = equipoFallback.qr_code // usar el QR actualizado
    }
  }

  // Filtrar informes por qr_code (nuevo o viejo) Y empresa_id
  const query = admin
    .from('informes')
    .select('*')
    .order('created_at', { ascending: false })

  if (equipo?.empresa_id) {
    // Buscar por QR actualizado O por QR viejo (ambos pueden estar en informes)
    query.eq('empresa_id', equipo.empresa_id)
    if (resolvedQr !== qrCode) {
      query.or(`qr_code.eq.${resolvedQr},qr_code.eq.${qrCode}`)
    } else {
      query.eq('qr_code', resolvedQr)
    }
  } else {
    query.eq('qr_code', qrCode)
  }

  const { data: informes, error } = await query

  if (error || !informes || informes.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <BackButton />
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
      <BackButton />
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

      <HistorialTabs informes={informes} />

      <p className="mt-8 text-xs text-gray-400 text-center">
        Sistema de Informes Técnicos<br />
        Para más información contacte a su técnico asignado.
      </p>
    </main>
  )
}
