'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { TicketRecord, TicketEstado } from '@/lib/supabase'
import {
  ArrowLeft, Filter, X, RefreshCw, AlertCircle, Loader2,
  Inbox, User as UserIcon, MapPin, Image as ImageIcon, Send,
  CheckCircle2, Clock, PlayCircle, XCircle,
} from 'lucide-react'

const ESTADO_LABELS: Record<TicketEstado, { label: string; cls: string; Icon: any }> = {
  nuevo:      { label: 'Nuevo',       cls: 'bg-blue-50 text-blue-700 border-blue-200',       Icon: Inbox },
  asignado:   { label: 'Asignado',    cls: 'bg-purple-50 text-purple-700 border-purple-200', Icon: UserIcon },
  en_proceso: { label: 'En proceso',  cls: 'bg-amber-50 text-amber-700 border-amber-200',    Icon: PlayCircle },
  resuelto:   { label: 'Resuelto',    cls: 'bg-green-50 text-green-700 border-green-200',    Icon: CheckCircle2 },
  cerrado:    { label: 'Cerrado',     cls: 'bg-gray-100 text-gray-600 border-gray-200',      Icon: XCircle },
}

const PRIORIDAD_LABELS: Record<string, { label: string; cls: string }> = {
  alta:  { label: '🔴 Alta',  cls: 'bg-red-50 text-red-700' },
  media: { label: '🟡 Media', cls: 'bg-amber-50 text-amber-700' },
  baja:  { label: '🟢 Baja',  cls: 'bg-green-50 text-green-700' },
}

const CATEGORIA_LABELS: Record<string, string> = {
  averia: 'Avería', mantenimiento: 'Mantenimiento', consulta: 'Consulta',
}

const ESTADOS_ORDER: TicketEstado[] = ['nuevo', 'asignado', 'en_proceso', 'resuelto', 'cerrado']

export default function AdminTicketsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<TicketEstado | ''>('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [detalle, setDetalle] = useState<TicketRecord | null>(null)
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([])

  // Notification sound for new tickets (in-app)
  const lastSeenIdRef = useRef<string | null>(null)
  const [nuevoCount, setNuevoCount] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [notifEnabled, setNotifEnabled] = useState(false)

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user && user.rol !== 'admin') { router.push('/'); return }
  }, [loading, user, router])

  useEffect(() => {
    if (!user || user.rol !== 'admin') return
    cargarTickets()
    cargarTecnicos()
    // Detectar si las notificaciones ya están permitidas (sesiones previas)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      setNotifEnabled(true)
    }
  }, [user])

  // Realtime: nuevos tickets
  useEffect(() => {
    if (!user || user.rol !== 'admin') return
    const channel = supabase
      .channel('tickets-empresa')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets', filter: `empresa_id=eq.${user.empresa_id}` },
        (payload) => {
          const nuevo = payload.new as TicketRecord
          setTickets(prev => [nuevo, ...prev])
          setNuevoCount(c => c + 1)
          // Notificación del sistema + beep (requiere haber tocado "Activar")
          notificarNuevoTicket(nuevo, audioCtxRef.current)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `empresa_id=eq.${user.empresa_id}` },
        (payload) => {
          const upd = payload.new as TicketRecord
          setTickets(prev => prev.map(t => t.id === upd.id ? upd : t))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const cargarTickets = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) console.error('Error cargando tickets:', error)
    setTickets((data as TicketRecord[]) ?? [])
    if (data && data.length) lastSeenIdRef.current = data[0].id
    setCargando(false)
  }

  const cargarTecnicos = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('rol', 'tecnico')
      .eq('activo', true)
    setTecnicos((data as any) ?? [])
  }

  const cambiarEstado = async (ticket: TicketRecord, nuevoEstado: TicketEstado, resolucion?: string) => {
    const upd: any = { estado: nuevoEstado }
    if (nuevoEstado === 'resuelto' || nuevoEstado === 'cerrado') {
      upd.resuelto_at = new Date().toISOString()
      if (resolucion !== undefined) upd.resolucion = resolucion
    }
    const { error } = await supabase.from('tickets').update(upd).eq('id', ticket.id)
    if (error) { alert(`Error: ${error.message}`); return }
    setDetalle(prev => prev && prev.id === ticket.id ? { ...prev, ...upd } : prev)
  }

  const asignarA = async (ticket: TicketRecord, tecnicoId: string | null) => {
    const { error } = await supabase
      .from('tickets')
      .update({ asignado_a: tecnicoId, estado: tecnicoId ? 'asignado' : ticket.estado })
      .eq('id', ticket.id)
    if (error) { alert(`Error: ${error.message}`); return }
    setDetalle(prev => prev && prev.id === ticket.id ? { ...prev, asignado_a: tecnicoId, estado: tecnicoId ? 'asignado' : prev.estado } : prev)
  }

  const ticketsFiltrados = useMemo(() => {
    return tickets.filter(t => {
      if (filtroEstado && t.estado !== filtroEstado) return false
      if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false
      if (filtroCliente && !t.cliente.toLowerCase().includes(filtroCliente.toLowerCase())) return false
      return true
    })
  }, [tickets, filtroEstado, filtroPrioridad, filtroCliente])

  const stats = useMemo(() => ({
    total: tickets.length,
    nuevos: tickets.filter(t => t.estado === 'nuevo').length,
    enProceso: tickets.filter(t => t.estado === 'en_proceso' || t.estado === 'asignado').length,
    resueltos: tickets.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado').length,
  }), [tickets])

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="p-1.5 rounded-md hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-800">Tickets de servicio</p>
            <p className="text-xs text-gray-500">Solicitudes de los clientes</p>
          </div>
          {nuevoCount > 0 && (
            <button
              onClick={() => setNuevoCount(0)}
              className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium animate-pulse"
            >
              {nuevoCount} nuevo{nuevoCount !== 1 ? 's' : ''} ✨
            </button>
          )}
          <button
            onClick={() => activarNotificaciones(audioCtxRef, setNotifEnabled)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${
              notifEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            }`}
            title={notifEnabled ? 'Notificaciones activas' : 'Click para activar alertas sonoras'}
          >
            {notifEnabled ? '🔔 Activo' : '🔕 Activar'}
          </button>
          <button onClick={cargarTickets} className="p-1.5 rounded-md hover:bg-gray-100">
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',      value: stats.total,     cls: 'text-gray-800' },
            { label: 'Nuevos',     value: stats.nuevos,    cls: 'text-blue-600' },
            { label: 'En proceso', value: stats.enProceso, cls: 'text-amber-600' },
            { label: 'Resueltos',  value: stats.resueltos, cls: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as any)}
              className="h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
            >
              <option value="">Todos los estados</option>
              {ESTADOS_ORDER.map(e => <option key={e} value={e}>{ESTADO_LABELS[e].label}</option>)}
            </select>
            <select
              value={filtroPrioridad}
              onChange={e => setFiltroPrioridad(e.target.value)}
              className="h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
            >
              <option value="">Todas las prioridades</option>
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Media</option>
              <option value="baja">🟢 Baja</option>
            </select>
            <input
              type="text"
              value={filtroCliente}
              onChange={e => setFiltroCliente(e.target.value)}
              placeholder="Filtrar por cliente…"
              className="h-9 px-3 border border-gray-200 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Lista */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : ticketsFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay tickets</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ticketsFiltrados.map(t => {
              const E = ESTADO_LABELS[t.estado]
              return (
                <button
                  key={t.id}
                  onClick={() => setDetalle(t)}
                  className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${E.cls}`}>
                          <E.Icon className="w-3 h-3" /> {E.label}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_LABELS[t.prioridad]?.cls}`}>
                          {PRIORIDAD_LABELS[t.prioridad]?.label}
                        </span>
                        <span className="text-[11px] text-gray-400">{CATEGORIA_LABELS[t.categoria]}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{t.cliente}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {[t.equipo_marca, t.equipo_modelo, t.equipo_serial && `S/N ${t.equipo_serial}`].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-sm text-gray-700 mt-2 line-clamp-2">{t.descripcion}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[11px] text-gray-400">{formatFecha(t.created_at)}</span>
                      {t.foto_url && <ImageIcon className="w-3.5 h-3.5 text-gray-300" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal de detalle */}
      {detalle && (
        <ModalDetalle
          ticket={detalle}
          tecnicos={tecnicos}
          onClose={() => setDetalle(null)}
          onCambiarEstado={cambiarEstado}
          onAsignar={asignarA}
        />
      )}
    </div>
  )
}

// ── Modal: Detalle de ticket + acciones ────────────────────────────────────
function ModalDetalle({
  ticket, tecnicos, onClose, onCambiarEstado, onAsignar,
}: {
  ticket: TicketRecord
  tecnicos: { id: string; nombre: string }[]
  onClose: () => void
  onCambiarEstado: (t: TicketRecord, e: TicketEstado, resolucion?: string) => Promise<void>
  onAsignar: (t: TicketRecord, tid: string | null) => Promise<void>
}) {
  const [resolucion, setResolucion] = useState(ticket.resolucion ?? '')
  const E = ESTADO_LABELS[ticket.estado]
  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${E.cls}`}>
                <E.Icon className="w-3 h-3" /> {E.label}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_LABELS[ticket.prioridad]?.cls}`}>
                {PRIORIDAD_LABELS[ticket.prioridad]?.label}
              </span>
            </div>
            <p className="font-semibold text-gray-800 truncate">{ticket.cliente}</p>
            <p className="text-xs text-gray-500">{formatFecha(ticket.created_at)} · {CATEGORIA_LABELS[ticket.categoria]}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Equipo */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Equipo</p>
            <p className="text-sm font-medium text-gray-800">
              {[ticket.equipo_marca, ticket.equipo_modelo].filter(Boolean).join(' ') || '—'}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              {ticket.equipo_serial && <span>S/N: {ticket.equipo_serial}</span>}
              {ticket.equipo_ubicacion && (
                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{ticket.equipo_ubicacion}</span>
              )}
              {ticket.qr_code && <span className="text-[11px] text-gray-400">QR: {ticket.qr_code}</span>}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Descripción</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>

          {ticket.preferencia_horario && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">
                <Clock className="w-3 h-3 inline mr-1" />Horario preferido
              </p>
              <p className="text-sm text-gray-800">{ticket.preferencia_horario}</p>
            </div>
          )}

          {ticket.foto_url && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Foto adjunta</p>
              <a href={ticket.foto_url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={ticket.foto_url} alt="Adjunto" className="rounded-lg max-h-64 border border-gray-200" />
              </a>
            </div>
          )}

          {/* Asignación */}
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Asignar técnico</p>
            <select
              value={ticket.asignado_a ?? ''}
              onChange={e => onAsignar(ticket, e.target.value || null)}
              className="w-full h-9 px-2 border border-gray-200 rounded-md text-sm bg-white"
            >
              <option value="">— Sin asignar —</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          {/* Resolución (si está resuelto/cerrado) */}
          {(ticket.estado === 'resuelto' || ticket.estado === 'cerrado') && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Resolución</p>
              <textarea
                value={resolucion}
                onChange={e => setResolucion(e.target.value)}
                rows={3}
                placeholder="Qué se hizo para resolver…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              />
              <button
                onClick={() => onCambiarEstado(ticket, ticket.estado, resolucion)}
                className="mt-2 text-xs text-green-600 hover:underline"
              >
                Guardar resolución
              </button>
            </div>
          )}
        </div>

        {/* Acciones de estado */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 flex-shrink-0">
          {ticket.estado === 'nuevo' && (
            <button onClick={() => onCambiarEstado(ticket, 'en_proceso')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium">
              <PlayCircle className="w-3.5 h-3.5" /> Marcar en proceso
            </button>
          )}
          {(ticket.estado === 'asignado' || ticket.estado === 'nuevo') && (
            <button onClick={() => onCambiarEstado(ticket, 'en_proceso')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium">
              <PlayCircle className="w-3.5 h-3.5" /> En proceso
            </button>
          )}
          {(ticket.estado === 'en_proceso' || ticket.estado === 'asignado') && (
            <button onClick={() => onCambiarEstado(ticket, 'resuelto', resolucion)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Marcar resuelto
            </button>
          )}
          {ticket.estado === 'resuelto' && (
            <button onClick={() => onCambiarEstado(ticket, 'cerrado', resolucion)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-md font-medium">
              <XCircle className="w-3.5 h-3.5" /> Cerrar
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-xs px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Activar notificaciones: pide permiso + ceba AudioContext ───────────────
// Debe llamarse desde un click del usuario para evitar bloqueo de autoplay.
async function activarNotificaciones(
  ctxRef: React.MutableRefObject<AudioContext | null>,
  setEnabled: (v: boolean) => void,
) {
  // 1) Pedir permiso de Notification API (si está disponible)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch { /* ignore */ }
    }
  }

  // 2) Cebar AudioContext con un click silencioso (gain=0 por 1ms)
  try {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    const ctx = new Ctor()
    if (ctx.state === 'suspended') await ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.001)
    ctxRef.current = ctx
  } catch (e) {
    console.warn('AudioContext init failed:', e)
  }

  setEnabled(true)
}

// ── Notificar un ticket nuevo: Notification + beep ─────────────────────────
function notificarNuevoTicket(t: TicketRecord, ctx: AudioContext | null) {
  // Notificación del sistema (si fue autorizada)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`Nuevo ticket — ${t.cliente}`, {
        body: t.descripcion.slice(0, 120),
        icon: '/icons/icon-192x192.png',
        tag: `ticket-${t.id}`,
      })
    } catch { /* ignore */ }
  }

  // Beep dual-tone
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(freq, now + start)
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.01)
      gain.gain.linearRampToValueAtTime(0, now + start + dur)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.02)
    }
    beep(880,  0,    0.12)
    beep(1100, 0.18, 0.12)
  } catch { /* ignore */ }
}
