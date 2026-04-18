'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { listarInformesEmpresa, listarTecnicos, InformeRecord, Usuario } from '@/lib/supabase'
import { ArrowLeft, FileText, Download, Search, RefreshCw, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TIPOS = [
  { id: '', label: 'Todos los tipos' },
  { id: 'ups',          label: 'UPS / Baterías' },
  { id: 'aire',         label: 'Aires Acondicionados' },
  { id: 'planta',       label: 'Plantas Eléctricas' },
  { id: 'fotovoltaico', label: 'Sistema Fotovoltaico' },
  { id: 'otros',        label: 'Otros' },
]

export default function InformesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [informes, setInformes] = useState<InformeRecord[]>([])
  const [tecnicos, setTecnicos] = useState<Usuario[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Filtros
  const [tipo, setTipo] = useState('')
  const [tecnico, setTecnico] = useState('')
  const [cliente, setCliente] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user?.rol !== 'admin') { router.push('/'); return }
  }, [loading, user, router])

  const cargar = useCallback(async () => {
    setLoadingData(true)
    const data = await listarInformesEmpresa({ tipo, tecnico, cliente, desde, hasta })
    setInformes(data)
    setLoadingData(false)
  }, [tipo, tecnico, cliente, desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    listarTecnicos().then(setTecnicos)
  }, [])

  const limpiarFiltros = () => {
    setTipo(''); setTecnico(''); setCliente(''); setDesde(''); setHasta('')
  }

  const hayFiltros = tipo || tecnico || cliente || desde || hasta

  const agrupadosPorCliente = informes.reduce<Record<string, InformeRecord[]>>((acc, inf) => {
    const key = inf.cliente || 'Sin cliente'
    acc[key] = [...(acc[key] ?? []), inf]
    return acc
  }, {})

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <FileText className="w-5 h-5 text-green-600" />
          <h1 className="text-lg font-semibold text-gray-800">Informes técnicos</h1>
          <span className="text-sm text-gray-400 ml-1">— {user.empresa?.nombre}</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={cargar} className="text-gray-400 hover:text-gray-600" title="Recargar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 text-sm ${hayFiltros ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Filter className="w-4 h-4" />
              Filtros {hayFiltros && `(${[tipo, tecnico, cliente, desde, hasta].filter(Boolean).length})`}
            </Button>
          </div>
        </div>
      </header>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Tipo */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo de equipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full h-9 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            {/* Técnico */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Técnico</label>
              <select
                value={tecnico}
                onChange={e => setTecnico(e.target.value)}
                className="w-full h-9 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Todos los técnicos</option>
                {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>

            {/* Cliente */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cliente</label>
              <Input
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                placeholder="Buscar por cliente…"
                className="h-9 text-sm"
              />
            </div>

            {/* Rango de fechas */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Desde</label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="flex items-end">
              {hayFiltros && (
                <button onClick={limpiarFiltros} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                  <X className="w-4 h-4" /> Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total informes', value: informes.length },
            { label: 'Con PDF guardado', value: informes.filter(i => i.pdf_url).length },
            { label: 'Clientes distintos', value: Object.keys(agrupadosPorCliente).length },
            { label: 'Técnicos activos', value: [...new Set(informes.map(i => i.tecnico).filter(Boolean))].length },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Lista */}
        {loadingData ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
            Cargando informes…
          </div>
        ) : informes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
            No se encontraron informes con los filtros actuales.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Cabecera tabla */}
            <div className="hidden sm:grid grid-cols-[1fr_1.2fr_1fr_0.7fr_0.7fr_auto] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>N° / Fecha</span>
              <span>Cliente</span>
              <span>Técnico</span>
              <span>Equipo</span>
              <span>Tipo</span>
              <span>PDF</span>
            </div>

            <div className="divide-y divide-gray-50">
              {informes.map(inf => (
                <div
                  key={inf.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_1fr_0.7fr_0.7fr_auto] gap-1 sm:gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  {/* N° / Fecha */}
                  <div>
                    <p className="text-xs font-bold text-blue-700">{inf.numero_informe ?? inf.reporte_numero ?? '—'}</p>
                    <p className="text-[11px] text-gray-400">{inf.fecha}</p>
                  </div>

                  {/* Cliente */}
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">{inf.cliente || '—'}</p>
                    {inf.serial && <p className="text-[11px] text-gray-400">S/N: {inf.serial}</p>}
                  </div>

                  {/* Técnico */}
                  <p className="text-sm text-gray-700 truncate self-center">{inf.tecnico ?? '—'}</p>

                  {/* Equipo */}
                  <div className="self-center">
                    <p className="text-xs text-gray-700 truncate">{[inf.marca, inf.modelo].filter(Boolean).join(' ') || '—'}</p>
                    {inf.capacidad && <p className="text-[11px] text-gray-400">{inf.capacidad}</p>}
                  </div>

                  {/* Tipo */}
                  <p className="text-xs text-gray-500 capitalize self-center">{inf.tipo_reporte ?? '—'}</p>

                  {/* PDF */}
                  <div className="self-center">
                    {inf.pdf_url ? (
                      <a
                        href={inf.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1 rounded-lg transition-colors font-medium"
                        title="Descargar PDF"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-300">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
              {informes.length} resultado{informes.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
