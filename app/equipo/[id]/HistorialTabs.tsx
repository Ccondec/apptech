'use client'
import { useState } from 'react'
import { ClipboardList } from 'lucide-react'

interface Informe {
  id: string
  fecha?: string
  numero_informe?: string
  reporte_numero?: string
  tecnico?: string
  tipo_reporte?: string
  ubicacion?: string
  observaciones?: string
  recomendaciones?: string
}

const fmtFecha = (fecha?: string) => {
  if (!fecha) return '—'
  // "17/04/2026" → "17/04/26"
  return fecha.replace(/(\d{2})\/(\d{2})\/(\d{4})/, (_, d, m, y) => `${d}/${m}/${y.slice(-2)}`)
}

export default function HistorialTabs({ informes }: { informes: Informe[] }) {
  const [tab, setTab] = useState(0)
  const v = informes[tab]

  return (
    <div className="w-full max-w-md">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
        <ClipboardList className="w-4 h-4" /> Historial de visitas ({informes.length})
      </h2>

      {/* Pestañas horizontales */}
      <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
        {informes.map((inf, i) => (
          <button
            key={inf.id ?? i}
            onClick={() => setTab(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === i
                ? 'bg-white border-green-600 text-green-700'
                : 'bg-gray-100 border-transparent text-gray-500 hover:bg-white'
            }`}
          >
            {inf.numero_informe ?? fmtFecha(inf.fecha) ?? `Visita ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Contenido de la pestaña activa */}
      {v && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-gray-100 shadow-sm px-5 py-4">
          {/* Datos principales en 2 columnas */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Informe</p>
              <p className="text-xs font-bold text-green-700">
                N° {v.numero_informe ?? v.reporte_numero ?? '—'}
                {v.fecha && <span className="ml-1 font-normal text-gray-400">· {fmtFecha(v.fecha)}</span>}
              </p>
            </div>
            {v.tipo_reporte && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tipo</p>
                <p className="text-xs font-medium text-gray-700 capitalize">{v.tipo_reporte}</p>
              </div>
            )}
            {v.tecnico && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Técnico</p>
                <p className="text-xs font-medium text-gray-800">{v.tecnico}</p>
              </div>
            )}
            {v.ubicacion && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Ubicación</p>
                <p className="text-xs text-gray-700 truncate">{v.ubicacion}</p>
              </div>
            )}
          </div>

          {/* Observaciones y Recomendaciones en 2 columnas */}
          {(v.observaciones || v.recomendaciones) && (
            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {v.observaciones && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Observaciones</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{v.observaciones}</p>
                </div>
              )}
              {v.recomendaciones && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Recomendaciones</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{v.recomendaciones}</p>
                </div>
              )}
            </div>
          )}

          {tab === 0 && (
            <span className="inline-block mt-3 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              Último servicio
            </span>
          )}
        </div>
      )}
    </div>
  )
}
