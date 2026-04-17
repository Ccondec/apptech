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
            {inf.fecha ?? `Visita ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Contenido de la pestaña activa */}
      {v && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              N° {v.numero_informe ?? v.reporte_numero ?? '—'}
            </span>
            {v.tipo_reporte && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                {v.tipo_reporte}
              </span>
            )}
          </div>

          {v.tecnico && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              Técnico: <span className="font-medium text-gray-700">{v.tecnico}</span>
            </p>
          )}
          {v.ubicacion && (
            <p className="text-xs text-gray-400">Ubicación: {v.ubicacion}</p>
          )}
          {v.observaciones && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-0.5">Observaciones</p>
              <p className="text-xs text-gray-700 leading-relaxed">{v.observaciones}</p>
            </div>
          )}
          {v.recomendaciones && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-0.5">Recomendaciones</p>
              <p className="text-xs text-gray-700 leading-relaxed">{v.recomendaciones}</p>
            </div>
          )}
          {tab === 0 && (
            <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              Último servicio
            </span>
          )}
        </div>
      )}
    </div>
  )
}
