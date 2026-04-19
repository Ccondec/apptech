'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { listarInformesEmpresa, listarTecnicos, getEmpresaConfig, InformeRecord, Usuario, EmpresaConfig } from '@/lib/supabase'
import { ArrowLeft, FileText, Download, RefreshCw, Filter, X, BarChart2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const TIPOS: Record<string, string> = {
  ups: 'UPS / Baterías', aire: 'Aires Acondicionados',
  planta: 'Plantas Eléctricas', fotovoltaico: 'Sistema Fotovoltaico', otros: 'Otros',
}
const TIPOS_OPT = [{ id: '', label: 'Todos los tipos' }, ...Object.entries(TIPOS).map(([id, label]) => ({ id, label }))]

// ── Generador de PDF ejecutivo ────────────────────────────────

async function generarInformeEjecutivoPDF(opts: {
  informes: InformeRecord[]
  empresa: { nombre: string; logo?: string; telefono?: string; email?: string; ciudad?: string }
  titulo: string
  intro: string
  conclusion: string
  periodo: string
}) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const margin = 15
  const cw = W - margin * 2
  const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  const NAVY  = [22,  43,  90]  as [number,number,number]
  const GREEN = [22,  163, 74]  as [number,number,number]
  const GRAY  = [110, 110, 110] as [number,number,number]
  const LGRAY = [240, 242, 245] as [number,number,number]
  const WHITE = [255, 255, 255] as [number,number,number]
  const AMBER = [217, 119, 6]   as [number,number,number]

  let page = 1

  const addHeader = () => {
    pdf.setFillColor(...NAVY)
    pdf.rect(0, 0, W, 14, 'F')
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...WHITE)
    pdf.text(opts.empresa.nombre.toUpperCase(), margin, 9)
    pdf.setFont('helvetica', 'normal')
    pdf.text(opts.titulo, W / 2, 9, { align: 'center' })
    pdf.text(`Pág. ${page}`, W - margin, 9, { align: 'right' })
    pdf.setTextColor(0, 0, 0)
  }

  const addFooter = () => {
    pdf.setFillColor(...LGRAY)
    pdf.rect(0, H - 10, W, 10, 'F')
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRAY)
    const parts = [opts.empresa.telefono, opts.empresa.email, opts.empresa.ciudad].filter(Boolean)
    pdf.text(parts.join('  ·  '), margin, H - 4)
    pdf.text(`Generado el ${fechaHoy}`, W - margin, H - 4, { align: 'right' })
    pdf.setTextColor(0, 0, 0)
  }

  const newPage = () => {
    addFooter(); pdf.addPage(); page++; addHeader()
    return 22
  }

  const sectionTitle = (title: string, y: number) => {
    pdf.setFillColor(...GREEN)
    pdf.rect(margin, y, 3, 7, 'F')
    pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 30, 30)
    pdf.text(title, margin + 6, y + 5.5)
    return y + 13
  }

  // ── PORTADA ──────────────────────────────────────────────────
  pdf.setFillColor(...NAVY)
  pdf.rect(0, 0, W, H * 0.44, 'F')

  if (opts.empresa.logo) {
    try { pdf.addImage(opts.empresa.logo, 'JPEG', W / 2 - 27, 16, 54, 27) } catch { /* sin logo */ }
  }

  pdf.setFillColor(...GREEN)
  pdf.rect(0, H * 0.44, W, 2.5, 'F')

  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...WHITE)
  pdf.text(opts.empresa.nombre.toUpperCase(), W / 2, 54, { align: 'center' })
  pdf.setFontSize(24); pdf.text('INFORME EJECUTIVO', W / 2, 76, { align: 'center' })
  pdf.setFontSize(14); pdf.setFont('helvetica', 'normal')
  pdf.text('DE MANTENIMIENTO', W / 2, 86, { align: 'center' })

  const tiposPresentes = [...new Set(opts.informes.map(i => i.tipo_reporte).filter(Boolean))]
  if (tiposPresentes.length) {
    pdf.setFontSize(9); pdf.setTextColor(180, 220, 180)
    pdf.text(tiposPresentes.map(t => TIPOS[t!] ?? t!).join('  ·  '), W / 2, 97, { align: 'center' })
  }

  // Caja resumen en portada
  const equiposUnicos = [...new Set(opts.informes.map(i => i.serial).filter(Boolean))]
  const boxY = H * 0.44 + 10
  pdf.setFillColor(...LGRAY)
  pdf.roundedRect(margin, boxY, cw, 42, 3, 3, 'F')

  const col1 = margin + 8, col2 = W / 2 + 4
  const infoField = (label: string, val: string, x: number, y: number) => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(...GRAY)
    pdf.text(label, x, y)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(25, 25, 25)
    pdf.text(val || '—', x, y + 6)
  }
  infoField('PERÍODO', opts.periodo || fechaHoy, col1, boxY + 10)
  infoField('FECHA DE EMISIÓN', fechaHoy, col2, boxY + 10)
  infoField('N° DE VISITAS', String(opts.informes.length), col1, boxY + 26)
  infoField('EQUIPOS ATENDIDOS', String(equiposUnicos.length || opts.informes.length), col2, boxY + 26)

  addFooter()
  pdf.addPage(); page = 2; addHeader()
  let y = 22

  // ── INTRODUCCIÓN + STATS ─────────────────────────────────────
  y = sectionTitle('RESUMEN EJECUTIVO', y)

  if (opts.intro) {
    pdf.setFontSize(9.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(60, 60, 60)
    const lines = pdf.splitTextToSize(opts.intro, cw)
    pdf.text(lines, margin, y)
    y += lines.length * 5.2 + 6
  }

  // Tarjetas de cifras clave
  const clientes = [...new Set(opts.informes.map(i => i.cliente).filter(Boolean))]
  const conRec    = opts.informes.filter(i => i.recomendaciones).length
  const cards = [
    { label: 'Visitas realizadas',     val: String(opts.informes.length),                           color: NAVY  },
    { label: 'Equipos únicos',         val: String(equiposUnicos.length || opts.informes.length),   color: GREEN },
    { label: 'Clientes',               val: String(clientes.length),                                color: [80, 80, 180] as [number,number,number] },
    { label: 'Con recomendaciones',    val: String(conRec),                                          color: AMBER },
  ]
  const cw4 = (cw - 9) / 4
  cards.forEach((c, i) => {
    const cx = margin + i * (cw4 + 3)
    pdf.setFillColor(...c.color)
    pdf.roundedRect(cx, y, cw4, 20, 2, 2, 'F')
    pdf.setTextColor(...WHITE); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17)
    pdf.text(c.val, cx + cw4 / 2, y + 12, { align: 'center' })
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
    pdf.text(c.label, cx + cw4 / 2, y + 17.5, { align: 'center' })
  })
  y += 28

  // ── CARDS POR EQUIPO ──────────────────────────────────────────
  if (y > H - 60) y = newPage()
  y = sectionTitle('ESTADO Y RECOMENDACIONES POR EQUIPO', y)

  for (const inf of opts.informes) {
    const equipo    = [inf.marca, inf.modelo].filter(Boolean).join(' ') || 'Equipo sin identificar'
    const hasObs    = !!inf.observaciones
    const hasRec    = !!inf.recomendaciones
    const obsLines  = hasObs ? pdf.splitTextToSize(inf.observaciones!, cw - 10) : []
    const recLines  = hasRec ? pdf.splitTextToSize(inf.recomendaciones!, cw - 14) : []

    // Altura estimada del card
    const cardH = 10
      + (hasObs ? obsLines.length * 4.5 + 8 : 0)
      + (hasRec ? recLines.length * 4.5 + 10 : 0)
      + 4

    if (y + cardH > H - 18) y = newPage()

    // Borde izquierdo de color según si tiene recomendaciones
    pdf.setFillColor(...(hasRec ? AMBER : GREEN))
    pdf.rect(margin, y, 2.5, cardH, 'F')

    // Fondo card
    pdf.setFillColor(...LGRAY)
    pdf.rect(margin + 2.5, y, cw - 2.5, cardH, 'F')

    // Cabecera del card: equipo + serial + fecha + N°
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...NAVY)
    pdf.text(equipo.toUpperCase(), margin + 6, y + 6)

    const meta = [
      inf.serial     ? `S/N: ${inf.serial}`           : null,
      inf.capacidad  ? inf.capacidad                   : null,
      inf.ubicacion  ? `📍 ${inf.ubicacion}`           : null,
      inf.fecha      ? inf.fecha                       : null,
      inf.numero_informe ? `#${inf.numero_informe}`    : null,
    ].filter(Boolean).join('   ·   ')

    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRAY)
    pdf.text(meta, margin + 6, y + 11)

    let cy = y + 16

    // Observaciones
    if (hasObs) {
      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...GRAY)
      pdf.text('OBSERVACIONES', margin + 6, cy)
      cy += 5
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(50, 50, 50)
      pdf.text(obsLines, margin + 6, cy)
      cy += obsLines.length * 4.5 + 4
    }

    // Recomendaciones — destacadas
    if (hasRec) {
      // Fondo amber suave para recomendaciones
      pdf.setFillColor(255, 237, 213)
      pdf.roundedRect(margin + 4, cy - 1, cw - 6, recLines.length * 4.5 + 10, 1.5, 1.5, 'F')

      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...AMBER)
      pdf.text('⚠  RECOMENDACIONES', margin + 7, cy + 4)
      cy += 9
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 60, 0)
      pdf.text(recLines, margin + 7, cy)
      cy += recLines.length * 4.5 + 2
    }

    y += cardH + 4
  }

  // ── CONCLUSIONES ─────────────────────────────────────────────
  if (opts.conclusion) {
    if (y > H - 55) y = newPage()
    y = sectionTitle('CONCLUSIONES Y PRÓXIMOS PASOS', y)
    pdf.setFontSize(9.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(60, 60, 60)
    const lines = pdf.splitTextToSize(opts.conclusion, cw)
    pdf.text(lines, margin, y)
    y += lines.length * 5 + 10
  }

  // ── FIRMAS ───────────────────────────────────────────────────
  if (y > H - 42) y = newPage()
  y += 8
  pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.4)
  pdf.line(margin,          y + 18, margin + 65,          y + 18)
  pdf.line(W - margin - 65, y + 18, W - margin,           y + 18)
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRAY)
  pdf.text('Responsable técnico', margin, y + 23)
  pdf.text(opts.empresa.nombre, margin, y + 28)
  pdf.text('Recibido conforme', W - margin - 65, y + 23)

  addFooter()

  const fname = `IE_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(fname)
}

// ── Componente principal ──────────────────────────────────────

export default function InformesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [informes, setInformes]     = useState<InformeRecord[]>([])
  const [tecnicos, setTecnicos]     = useState<Usuario[]>([])
  const [empresaConfig, setEmpresaConfig] = useState<EmpresaConfig | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  // Filtros
  const [tipo,    setTipo]    = useState('')
  const [tecnico, setTecnico] = useState('')
  const [cliente, setCliente] = useState('')
  const [desde,   setDesde]   = useState('')
  const [hasta,   setHasta]   = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Modal informe ejecutivo
  const [showModal,   setShowModal]   = useState(false)
  const [modalTitulo, setModalTitulo] = useState('Informe Ejecutivo de Mantenimiento')
  const [modalPeriodo,setModalPeriodo]= useState('')
  const [modalIntro,  setModalIntro]  = useState('')
  const [modalConcl,  setModalConcl]  = useState('')
  const [generating,  setGenerating]  = useState(false)

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

  useEffect(() => {
    if (user?.empresa_id) {
      getEmpresaConfig(user.empresa_id).then(setEmpresaConfig)
    }
  }, [user])

  // Pre-rellenar modal al abrirlo
  const abrirModal = () => {
    const parts = []
    if (desde) parts.push(new Date(desde + 'T12:00').toLocaleDateString('es-CO'))
    if (hasta)  parts.push(new Date(hasta  + 'T12:00').toLocaleDateString('es-CO'))
    setModalPeriodo(parts.join(' — '))
    setShowModal(true)
  }

  const generarEjecutivo = async () => {
    if (informes.length === 0) return
    setGenerating(true)
    try {
      await generarInformeEjecutivoPDF({
        informes,
        empresa: {
          nombre:   empresaConfig?.nombre_comercial || user?.empresa?.nombre || 'Mi Empresa',
          logo:     empresaConfig?.logo,
          telefono: empresaConfig?.telefono,
          email:    empresaConfig?.email_contacto,
          ciudad:   (empresaConfig as any)?.ciudad,
        },
        titulo:     modalTitulo,
        intro:      modalIntro,
        conclusion: modalConcl,
        periodo:    modalPeriodo,
      })
    } finally {
      setGenerating(false)
      setShowModal(false)
    }
  }

  const limpiarFiltros = () => { setTipo(''); setTecnico(''); setCliente(''); setDesde(''); setHasta('') }
  const hayFiltros = tipo || tecnico || cliente || desde || hasta

  const agrupadosPorCliente = informes.reduce<Record<string, InformeRecord[]>>((acc, inf) => {
    const key = inf.cliente || 'Sin cliente'
    acc[key] = [...(acc[key] ?? []), inf]
    return acc
  }, {})

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Modal informe ejecutivo ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-green-600" /> Informe ejecutivo
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-gray-400">
                Se generará un PDF ejecutivo con los <strong>{informes.length} informe{informes.length !== 1 ? 's' : ''}</strong> actualmente filtrados.
              </p>

              <div className="space-y-1">
                <Label>Título del informe</Label>
                <Input value={modalTitulo} onChange={e => setModalTitulo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Período</Label>
                <Input value={modalPeriodo} onChange={e => setModalPeriodo(e.target.value)} placeholder="Ej: Enero — Marzo 2026" />
              </div>
              <div className="space-y-1">
                <Label>Presentación / Introducción</Label>
                <textarea
                  value={modalIntro}
                  onChange={e => setModalIntro(e.target.value)}
                  rows={3}
                  placeholder="Breve descripción del trabajo realizado o contexto del informe…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="space-y-1">
                <Label>Conclusiones y próximos pasos</Label>
                <textarea
                  value={modalConcl}
                  onChange={e => setModalConcl(e.target.value)}
                  rows={3}
                  placeholder="Estado general de los equipos, recomendaciones globales, próxima visita…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button onClick={() => setShowModal(false)} className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                Cancelar
              </Button>
              <Button
                onClick={generarEjecutivo}
                disabled={generating || informes.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <><Download className="w-4 h-4" /> Generar PDF</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => router.push('/admin')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <FileText className="w-5 h-5 text-green-600" />
          <h1 className="text-lg font-semibold text-gray-800">Informes técnicos</h1>
          <span className="text-sm text-gray-400 hidden sm:inline">— {user.empresa?.nombre}</span>
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
            <Button
              onClick={abrirModal}
              disabled={informes.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 text-sm"
            >
              <BarChart2 className="w-4 h-4" /> Informe ejecutivo
            </Button>
          </div>
        </div>
      </header>

      {/* ── Filtros ── */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo de equipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full h-9 border border-gray-200 rounded-md px-3 text-sm bg-white">
                {TIPOS_OPT.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Técnico</label>
              <select value={tecnico} onChange={e => setTecnico(e.target.value)} className="w-full h-9 border border-gray-200 rounded-md px-3 text-sm bg-white">
                <option value="">Todos los técnicos</option>
                {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cliente</label>
              <Input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Buscar por cliente…" className="h-9 text-sm" />
            </div>
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

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total informes',    value: informes.length },
            { label: 'Con PDF guardado',  value: informes.filter(i => i.pdf_url).length },
            { label: 'Clientes distintos', value: Object.keys(agrupadosPorCliente).length },
            { label: 'Técnicos activos',  value: [...new Set(informes.map(i => i.tecnico).filter(Boolean))].length },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabla */}
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
            <div className="hidden sm:grid grid-cols-[1fr_1.2fr_1fr_0.7fr_0.7fr_auto] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>N° / Fecha</span><span>Cliente</span><span>Técnico</span><span>Equipo</span><span>Tipo</span><span>PDF</span>
            </div>
            <div className="divide-y divide-gray-50">
              {informes.map(inf => (
                <div key={inf.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_1fr_0.7fr_0.7fr_auto] gap-1 sm:gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-blue-700">{inf.numero_informe ?? inf.reporte_numero ?? '—'}</p>
                    <p className="text-[11px] text-gray-400">{inf.fecha}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">{inf.cliente || '—'}</p>
                    {inf.serial && <p className="text-[11px] text-gray-400">S/N: {inf.serial}</p>}
                  </div>
                  <p className="text-sm text-gray-700 truncate self-center">{inf.tecnico ?? '—'}</p>
                  <div className="self-center">
                    <p className="text-xs text-gray-700 truncate">{[inf.marca, inf.modelo].filter(Boolean).join(' ') || '—'}</p>
                    {inf.capacidad && <p className="text-[11px] text-gray-400">{inf.capacidad}</p>}
                  </div>
                  <p className="text-xs text-gray-500 capitalize self-center">{inf.tipo_reporte ?? '—'}</p>
                  <div className="self-center">
                    {inf.pdf_url ? (
                      <a href={inf.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1 rounded-lg transition-colors font-medium">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </a>
                    ) : <span className="text-[11px] text-gray-300">—</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex justify-between items-center">
              <span>{informes.length} resultado{informes.length !== 1 ? 's' : ''}</span>
              <button
                onClick={abrirModal}
                className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
              >
                <BarChart2 className="w-3.5 h-3.5" /> Generar informe ejecutivo
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
