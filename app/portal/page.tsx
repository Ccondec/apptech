'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { LogOut, Search, FileText, Download, Filter, X, Building2, MapPin, Cpu, Calendar } from 'lucide-react'

interface Informe {
  id: string
  qr_code: string
  cliente: string
  marca: string
  modelo: string
  serial: string
  ubicacion: string
  ciudad: string
  tipo_reporte: string
  numero_informe: string
  created_at: string
  pdf_url: string | null
}

const TIPO_LABELS: Record<string, string> = {
  ups: 'UPS / Baterías',
  aire: 'Aires Acondicionados',
  planta: 'Plantas Eléctricas',
  fotovoltaico: 'Sistema Fotovoltaico',
  impresora: 'Impresoras',
  apantallamiento: 'Sistema de Apantallamiento',
  otros: 'Otros Servicios',
}

export default function PortalPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  const [informes, setInformes] = useState<Informe[]>([])
  const [cargando, setCargando] = useState(true)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroCiudad, setFiltroCiudad] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user && user.rol !== 'cliente') { router.push('/'); return }
  }, [loading, user, router])

  useEffect(() => {
    if (!user || user.rol !== 'cliente' || !user.client_company) return
    cargarInformes()
  }, [user])

  const cargarInformes = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('informes')
      .select('id, qr_code, cliente, marca, modelo, serial, ubicacion, ciudad, tipo_reporte, numero_informe, created_at, pdf_url')
      .eq('empresa_id', user!.empresa_id)
      .eq('cliente', user!.client_company)
      .order('created_at', { ascending: false })
    setInformes((data as Informe[]) ?? [])
    setCargando(false)
  }

  // Opciones únicas para filtros
  const ciudades = useMemo(() => [...new Set(informes.map(i => i.ciudad).filter(Boolean))].sort(), [informes])
  const ubicaciones = useMemo(() => {
    const base = filtroCiudad ? informes.filter(i => i.ciudad === filtroCiudad) : informes
    return [...new Set(base.map(i => i.ubicacion).filter(Boolean))].sort()
  }, [informes, filtroCiudad])
  const tipos = useMemo(() => [...new Set(informes.map(i => i.tipo_reporte).filter(Boolean))].sort(), [informes])

  // Informes filtrados
  const informesFiltrados = useMemo(() => {
    return informes.filter(inf => {
      if (filtroCiudad && inf.ciudad !== filtroCiudad) return false
      if (filtroUbicacion && inf.ubicacion !== filtroUbicacion) return false
      if (filtroTipo && inf.tipo_reporte !== filtroTipo) return false
      if (filtroFechaDesde && inf.created_at < filtroFechaDesde) return false
      if (filtroFechaHasta && inf.created_at.slice(0, 10) > filtroFechaHasta) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        return (
          inf.marca?.toLowerCase().includes(q) ||
          inf.modelo?.toLowerCase().includes(q) ||
          inf.serial?.toLowerCase().includes(q) ||
          inf.ubicacion?.toLowerCase().includes(q) ||
          inf.numero_informe?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [informes, filtroCiudad, filtroUbicacion, filtroTipo, filtroFechaDesde, filtroFechaHasta, busqueda])

  const limpiarFiltros = () => {
    setFiltroCiudad(''); setFiltroUbicacion(''); setFiltroTipo('')
    setFiltroFechaDesde(''); setFiltroFechaHasta(''); setBusqueda('')
  }

  const hayFiltros = filtroCiudad || filtroUbicacion || filtroTipo || filtroFechaDesde || filtroFechaHasta || busqueda

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192x192.png" className="w-8 h-8 rounded-full object-contain border border-gray-100" alt="Logo" />
            <div>
              <p className="font-semibold text-sm text-gray-800">{user.client_company}</p>
              <p className="text-xs text-gray-400">Portal de Informes Técnicos</p>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Barra de búsqueda + filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por marca, modelo, serial o N° informe…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => setMostrarFiltros(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${mostrarFiltros ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {hayFiltros && <span className="w-2 h-2 rounded-full bg-red-400" />}
            </button>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>

          {mostrarFiltros && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1 border-t border-gray-100">
              {/* Ciudad */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Ciudad
                </label>
                <select
                  value={filtroCiudad}
                  onChange={e => { setFiltroCiudad(e.target.value); setFiltroUbicacion('') }}
                  className="w-full h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
                >
                  <option value="">Todas</option>
                  {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Ubicación / Sede */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Sede / Ubicación
                </label>
                <select
                  value={filtroUbicacion}
                  onChange={e => setFiltroUbicacion(e.target.value)}
                  className="w-full h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
                >
                  <option value="">Todas</option>
                  {ubicaciones.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Tipo de informe */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Tipo de equipo
                </label>
                <select
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value)}
                  className="w-full h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
                >
                  <option value="">Todos</option>
                  {tipos.map(t => <option key={t} value={t}>{TIPO_LABELS[t] ?? t}</option>)}
                </select>
              </div>

              {/* Fecha desde */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Desde
                </label>
                <input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={e => setFiltroFechaDesde(e.target.value)}
                  className="w-full h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
                />
              </div>

              {/* Fecha hasta */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Hasta
                </label>
                <input
                  type="date"
                  value={filtroFechaHasta}
                  onChange={e => setFiltroFechaHasta(e.target.value)}
                  className="w-full h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-500">
            {cargando ? 'Cargando…' : `${informesFiltrados.length} informe${informesFiltrados.length !== 1 ? 's' : ''} encontrado${informesFiltrados.length !== 1 ? 's' : ''}`}
            {hayFiltros && <span className="ml-1 text-green-600 font-medium">(filtrado)</span>}
          </p>
        </div>

        {/* Lista de informes */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : informesFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No se encontraron informes</p>
            {hayFiltros && <p className="text-sm text-gray-400 mt-1">Intenta ajustar los filtros</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {informesFiltrados.map(inf => (
              <div key={inf.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                {/* Ícono tipo */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-lg">
                  {inf.tipo_reporte === 'ups' ? '🔋' :
                   inf.tipo_reporte === 'aire' ? '❄️' :
                   inf.tipo_reporte === 'planta' ? '⚡' :
                   inf.tipo_reporte === 'fotovoltaico' ? '☀️' :
                   inf.tipo_reporte === 'impresora' ? '🖨️' :
                   inf.tipo_reporte === 'apantallamiento' ? '⛈️' : '📋'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-gray-800">{inf.marca} {inf.modelo}</p>
                    {inf.numero_informe && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{inf.numero_informe}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {inf.serial && <span className="text-xs text-gray-400">S/N: {inf.serial}</span>}
                    {inf.ubicacion && (
                      <span className="text-xs text-gray-400 flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />{inf.ubicacion}
                      </span>
                    )}
                    {inf.ciudad && (
                      <span className="text-xs text-gray-400 flex items-center gap-0.5">
                        <Building2 className="w-3 h-3" />{inf.ciudad}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatFecha(inf.created_at)}</span>
                  </div>
                  <p className="text-xs text-green-600 mt-0.5">{TIPO_LABELS[inf.tipo_reporte] ?? inf.tipo_reporte}</p>
                </div>

                {/* Botón PDF */}
                {inf.pdf_url ? (
                  <a
                    href={inf.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </a>
                ) : (
                  <span className="flex-shrink-0 text-xs text-gray-300 px-3 py-2">Sin PDF</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
