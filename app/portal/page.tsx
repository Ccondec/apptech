'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import {
  LogOut, Search, Filter, X, MapPin, Cpu, Settings2, Calendar,
  PenLine, History, Send, ChevronRight,
} from 'lucide-react'

interface Equipo {
  id: string
  qr_code: string
  brand: string | null
  model: string | null
  serial: string | null
  capacity: string | null
  ubicacion: string | null
}

interface InformeMin {
  id: string
  qr_code: string
  numero_informe: string | null
  tipo_reporte: string | null
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

  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [informes, setInformes] = useState<InformeMin[]>([])
  const [cargando, setCargando] = useState(true)

  // Filtros (los mismos que ya existían, adaptados a equipos)
  const [busqueda, setBusqueda] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Modales
  const [modalFirmar, setModalFirmar] = useState<Equipo | null>(null)
  const [modalSolicitar, setModalSolicitar] = useState<Equipo | null>(null)

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user && user.rol !== 'cliente') { router.push('/'); return }
  }, [loading, user, router])

  useEffect(() => {
    if (!user || user.rol !== 'cliente' || !user.client_company) return
    cargarDatos()
  }, [user])

  const cargarDatos = async () => {
    setCargando(true)

    // 1) Resolver client_id a partir del nombre de empresa del usuario
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('empresa_id', user!.empresa_id)
      .ilike('company', user!.client_company!)
      .maybeSingle()

    if (!cliente) {
      setEquipos([])
      setInformes([])
      setCargando(false)
      return
    }

    // 2) Equipos del cliente + informes en paralelo
    const [resEq, resInf] = await Promise.all([
      supabase
        .from('equipos')
        .select('id, qr_code, brand, model, serial, capacity, ubicacion')
        .eq('empresa_id', user!.empresa_id)
        .eq('client_id', cliente.id)
        .order('ubicacion', { ascending: true }),
      supabase
        .from('informes')
        .select('id, qr_code, numero_informe, tipo_reporte, created_at, pdf_url')
        .eq('empresa_id', user!.empresa_id)
        .ilike('cliente', user!.client_company!) // case-insensitive: el técnico puede guardar con casing distinto
        .order('created_at', { ascending: false }),
    ])

    if (resEq.error) console.error('Error cargando equipos:', resEq.error)
    if (resInf.error) console.error('Error cargando informes:', resInf.error)

    console.log(`[portal] cliente=${user!.client_company} | equipos=${resEq.data?.length ?? 0} | informes=${resInf.data?.length ?? 0}`)
    if (resInf.data?.length) {
      console.log('[portal] qrs en informes:', [...new Set(resInf.data.map((i: any) => i.qr_code))])
    }
    if (resEq.data?.length) {
      console.log('[portal] qrs en equipos:', resEq.data.map((e: any) => e.qr_code))
    }

    setEquipos((resEq.data as Equipo[]) ?? [])
    setInformes((resInf.data as InformeMin[]) ?? [])
    setCargando(false)
  }

  // Mapa qr_code → informes (para badge "Firmar (N)" y modal de informes)
  const informesPorQr = useMemo(() => {
    const map = new Map<string, InformeMin[]>()
    for (const inf of informes) {
      if (!inf.qr_code) continue
      const arr = map.get(inf.qr_code) ?? []
      arr.push(inf)
      map.set(inf.qr_code, arr)
    }
    return map
  }, [informes])

  // Por equipo: tipo y última fecha (derivados de sus informes)
  const metaPorQr = useMemo(() => {
    const map = new Map<string, { tipo?: string; lastDate?: string }>()
    for (const [qr, infs] of informesPorQr) {
      // Tipo más frecuente
      const counts = new Map<string, number>()
      for (const i of infs) {
        if (i.tipo_reporte) counts.set(i.tipo_reporte, (counts.get(i.tipo_reporte) ?? 0) + 1)
      }
      const tipo = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      const lastDate = infs[0]?.created_at // ya vienen ordenados desc
      map.set(qr, { tipo, lastDate })
    }
    return map
  }, [informesPorQr])

  // Opciones únicas para filtros
  const ubicaciones = useMemo(
    () => [...new Set(equipos.map(e => e.ubicacion).filter(Boolean) as string[])].sort(),
    [equipos]
  )
  const tipos = useMemo(
    () => [...new Set([...metaPorQr.values()].map(m => m.tipo).filter(Boolean) as string[])].sort(),
    [metaPorQr]
  )

  // Equipos filtrados
  const equiposFiltrados = useMemo(() => {
    return equipos.filter(eq => {
      const meta = metaPorQr.get(eq.qr_code)
      if (filtroUbicacion && eq.ubicacion !== filtroUbicacion) return false
      if (filtroTipo && meta?.tipo !== filtroTipo) return false

      if (filtroFechaDesde || filtroFechaHasta) {
        // Filtra por equipos con AL MENOS un informe en el rango
        const infs = informesPorQr.get(eq.qr_code) ?? []
        const hit = infs.some(i => {
          const fecha = i.created_at.slice(0, 10)
          if (filtroFechaDesde && fecha < filtroFechaDesde) return false
          if (filtroFechaHasta && fecha > filtroFechaHasta) return false
          return true
        })
        if (!hit) return false
      }

      if (busqueda) {
        const q = busqueda.toLowerCase()
        return (
          eq.brand?.toLowerCase().includes(q) ||
          eq.model?.toLowerCase().includes(q) ||
          eq.serial?.toLowerCase().includes(q) ||
          eq.ubicacion?.toLowerCase().includes(q) ||
          eq.qr_code?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [equipos, filtroUbicacion, filtroTipo, filtroFechaDesde, filtroFechaHasta, busqueda, metaPorQr, informesPorQr])

  const limpiarFiltros = () => {
    setFiltroUbicacion('')
    setFiltroTipo('')
    setFiltroFechaDesde('')
    setFiltroFechaHasta('')
    setBusqueda('')
  }

  const hayFiltros = filtroUbicacion || filtroTipo || filtroFechaDesde || filtroFechaHasta || busqueda

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
              <p className="text-xs text-gray-400">Portal de Equipos</p>
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
                placeholder="Buscar por marca, modelo, serial, QR…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => setMostrarFiltros(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                mostrarFiltros ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-100">
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
            {cargando
              ? 'Cargando…'
              : `${equiposFiltrados.length} equipo${equiposFiltrados.length !== 1 ? 's' : ''}`}
            {hayFiltros && <span className="ml-1 text-green-600 font-medium">(filtrado)</span>}
          </p>
        </div>

        {/* Lista de equipos */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : equiposFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <Cpu className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No se encontraron equipos</p>
            {hayFiltros
              ? <p className="text-sm text-gray-400 mt-1">Intenta ajustar los filtros</p>
              : <p className="text-sm text-gray-400 mt-1">Aún no se han registrado equipos para tu empresa</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {equiposFiltrados.map(eq => {
              const infs = informesPorQr.get(eq.qr_code) ?? []
              const countInformes = infs.length
              return (
                <div key={eq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info del equipo */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Settings2 className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-gray-800">
                          {eq.brand || '—'} {eq.model || ''}
                        </p>
                        {eq.capacity && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{eq.capacity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {eq.serial && <span className="text-xs text-gray-500">S/N: {eq.serial}</span>}
                        {eq.ubicacion && (
                          <span className="text-xs text-gray-500 flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />{eq.ubicacion}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">QR: {eq.qr_code}</p>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0 sm:justify-end">
                    {/* Firmar */}
                    <button
                      onClick={() => setModalFirmar(eq)}
                      disabled={countInformes === 0}
                      title={countInformes === 0 ? 'Sin informes para firmar' : `${countInformes} informe(s)`}
                      className="relative flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
                    >
                      <PenLine className="w-3.5 h-3.5" /> Firmar
                      {countInformes > 0 && (
                        <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-gray-800 text-white rounded-full">
                          {countInformes}
                        </span>
                      )}
                    </button>

                    {/* Historial → /equipo/[qr_code] */}
                    <Link
                      href={`/equipo/${encodeURIComponent(eq.qr_code)}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      <History className="w-3.5 h-3.5" /> Historial
                    </Link>

                    {/* Solicitar servicio */}
                    <button
                      onClick={() => setModalSolicitar(eq)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-white rounded-md"
                    >
                      <Send className="w-3.5 h-3.5" /> Solicitar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal Firmar — lista de informes del equipo */}
      {modalFirmar && (
        <ModalFirmar
          equipo={modalFirmar}
          informes={informesPorQr.get(modalFirmar.qr_code) ?? []}
          onClose={() => setModalFirmar(null)}
        />
      )}

      {/* Modal Solicitar servicio — stub */}
      {modalSolicitar && (
        <ModalSolicitar
          equipo={modalSolicitar}
          onClose={() => setModalSolicitar(null)}
        />
      )}
    </div>
  )
}

// ── Modal: Firmar (lista informes para firmar — stub de firma) ─────────────
function ModalFirmar({
  equipo, informes, onClose,
}: { equipo: Equipo; informes: InformeMin[]; onClose: () => void }) {
  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Firmar informe</p>
            <p className="text-xs text-gray-500">{equipo.brand} {equipo.model} · {equipo.serial}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {informes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No hay informes para este equipo.</p>
          ) : (
            informes.map(inf => (
              <Link
                key={inf.id}
                href={`/firmar/${inf.id}`}
                onClick={onClose}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
              >
                <PenLine className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {inf.numero_informe ? `N° ${inf.numero_informe}` : 'Informe sin número'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {inf.tipo_reporte ? (TIPO_LABELS[inf.tipo_reporte] ?? inf.tipo_reporte) : 'Informe técnico'} · {formatFecha(inf.created_at)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal: Solicitar servicio (stub) ───────────────────────────────────────
function ModalSolicitar({
  equipo, onClose,
}: { equipo: Equipo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Solicitar servicio</p>
            <p className="text-xs text-gray-500">{equipo.brand} {equipo.model} · {equipo.serial}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
            <Send className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-800">Sistema de tickets en desarrollo</p>
          <p className="text-xs text-gray-500">
            Pronto podrás reportar emergencias y solicitar servicio técnico directamente desde el portal.
            Por ahora, contactá al equipo técnico por los canales habituales.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
