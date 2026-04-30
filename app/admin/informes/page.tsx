'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { listarInformesEmpresa, listarTecnicos, getEmpresaConfig, InformeRecord, Usuario, EmpresaConfig } from '@/lib/supabase'
import { ArrowLeft, FileText, Download, RefreshCw, Filter, X, BarChart2, Loader2, CheckCircle2 } from 'lucide-react'
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
  empresa: { nombre: string; logo?: string; telefono?: string; email?: string; direccion?: string; ciudad?: string }
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
  const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  // Colores
  const NAVY   = [22, 43, 90]   as [number,number,number]
  const GREEN  = [22, 163, 74]  as [number,number,number]
  const GRAY   = [100, 100, 100] as [number,number,number]
  const LGRAY  = [240, 242, 245] as [number,number,number]
  const WHITE  = [255, 255, 255] as [number,number,number]

  const addPageHeader = (pageNum: number, totalHint = '') => {
    pdf.setFillColor(...NAVY)
    pdf.rect(0, 0, W, 14, 'F')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...WHITE)
    pdf.setFont('helvetica', 'bold')
    pdf.text(opts.empresa.nombre.toUpperCase(), margin, 9)
    pdf.setFont('helvetica', 'normal')
    pdf.text(opts.titulo, W / 2, 9, { align: 'center' })
    pdf.text(`Pág. ${pageNum}${totalHint}`, W - margin, 9, { align: 'right' })
    pdf.setTextColor(0, 0, 0)
  }

  const addPageFooter = () => {
    pdf.setFillColor(...LGRAY)
    pdf.rect(0, H - 10, W, 10, 'F')
    pdf.setFontSize(7)
    pdf.setTextColor(...GRAY)
    pdf.setFont('helvetica', 'normal')
    const contactParts = [opts.empresa.telefono, opts.empresa.email, opts.empresa.ciudad].filter(Boolean)
    pdf.text(contactParts.join('  ·  '), margin, H - 4)
    pdf.text(`Generado el ${fechaHoy}`, W - margin, H - 4, { align: 'right' })
    pdf.setTextColor(0, 0, 0)
  }

  // ── PORTADA — página completa ────────────────────────────────
  const equiposUnicos = [...new Set(opts.informes.map(i => i.serial).filter(Boolean))]
  const clientes      = [...new Set(opts.informes.map(i => i.cliente).filter(Boolean))]
  const tecnicos      = [...new Set(opts.informes.map(i => i.tecnico).filter(Boolean))]
  const tiposPresentes = [...new Set(opts.informes.map(i => i.tipo_reporte).filter(Boolean))]

  // Fondo navy página completa
  pdf.setFillColor(...NAVY)
  pdf.rect(0, 0, W, H, 'F')

  // Franja verde en la parte superior (acento)
  pdf.setFillColor(...GREEN)
  pdf.rect(0, 0, W, 4, 'F')

  // Logo centrado en la parte superior
  if (opts.empresa.logo) {
    try {
      pdf.addImage(opts.empresa.logo, 'JPEG', W / 2 - 30, 18, 60, 30)
    } catch { /* sin logo */ }
  }

  // Nombre empresa
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...WHITE)
  pdf.text(opts.empresa.nombre.toUpperCase(), W / 2, 58, { align: 'center' })

  // Línea decorativa central
  pdf.setDrawColor(...GREEN); pdf.setLineWidth(0.5)
  pdf.line(W / 2 - 25, 64, W / 2 + 25, 64)

  // Título grande centrado en la página
  pdf.setFontSize(28); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...WHITE)
  pdf.text('INFORME', W / 2, H * 0.42, { align: 'center' })
  pdf.setFontSize(28)
  pdf.text('EJECUTIVO', W / 2, H * 0.42 + 12, { align: 'center' })
  pdf.setFontSize(13); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(180, 210, 180)
  pdf.text('DE MANTENIMIENTO', W / 2, H * 0.42 + 22, { align: 'center' })

  // Tipos de equipo
  if (tiposPresentes.length > 0) {
    pdf.setFontSize(8.5); pdf.setTextColor(140, 180, 140)
    pdf.text(tiposPresentes.map(t => TIPOS[t!] ?? t!).join('  ·  '), W / 2, H * 0.42 + 31, { align: 'center' })
  }

  // ── Tarjeta gris en la parte inferior ────────────────────────
  const cardH  = 62
  const cardY  = H - cardH - 28
  const col1   = margin + 8
  const col2   = W / 2 + 4

  pdf.setFillColor(230, 233, 240)
  pdf.roundedRect(margin, cardY, W - margin * 2, cardH, 3, 3, 'F')

  // Franja verde izquierda en la tarjeta
  pdf.setFillColor(...GREEN)
  pdf.roundedRect(margin, cardY, 3, cardH, 1, 1, 'F')

  const field = (label: string, value: string, x: number, y: number) => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(...GRAY)
    pdf.text(label, x, y)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(20, 20, 20)
    pdf.text(value || '—', x, y + 5.5)
  }

  let cy = cardY + 11
  field('PERÍODO', opts.periodo || fechaHoy, col1, cy)
  field('FECHA DE EMISIÓN', fechaHoy, col2, cy)
  cy += 14

  field('N° DE VISITAS', String(opts.informes.length), col1, cy)
  field('EQUIPOS ATENDIDOS', String(equiposUnicos.length || opts.informes.length), col2, cy)
  cy += 14

  // Personal técnico en la última fila
  field('PERSONAL TÉCNICO', tecnicos.join('  ·  ') || '—', col1, cy)
  field('CLIENTES', clientes.slice(0, 3).join(', ') || '—', col2, cy)

  addPageFooter()
  pdf.addPage()

  // ── PÁGINA 2: RESUMEN EJECUTIVO ───────────────────────────────
  let page = 2
  addPageHeader(page)
  let y = 22

  // Título sección
  pdf.setFillColor(...GREEN)
  pdf.rect(margin, y, 3, 7, 'F')
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 30, 30)
  pdf.text('RESUMEN EJECUTIVO', margin + 6, y + 5.5)
  y += 14

  // Texto de presentación
  if (opts.intro) {
    pdf.setFontSize(9.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)
    const lines = pdf.splitTextToSize(opts.intro, W - margin * 2)
    pdf.text(lines, margin, y)
    y += lines.length * 5 + 6
  }

  // Tarjetas de stats
  const stats = [
    { label: 'Total de visitas',       val: String(opts.informes.length),                                                          color: NAVY },
    { label: 'Equipos únicos',         val: String(equiposUnicos.length || opts.informes.length),                                  color: GREEN },
    { label: 'Con recomendaciones',    val: String(opts.informes.filter(i => i.recomendaciones).length),                          color: [217, 119, 6] as [number,number,number] },
    { label: 'Clientes',               val: String([...new Set(opts.informes.map(i => i.cliente).filter(Boolean))].length),        color: [160, 80, 20] as [number,number,number] },
  ]
  const cardW = (W - margin * 2 - 9) / 4
  stats.forEach((s, i) => {
    const cx = margin + i * (cardW + 3)
    pdf.setFillColor(...s.color)
    pdf.roundedRect(cx, y, cardW, 20, 2, 2, 'F')
    pdf.setTextColor(...WHITE)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(s.val, cx + cardW / 2, y + 12, { align: 'center' })
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.text(s.label, cx + cardW / 2, y + 17.5, { align: 'center' })
  })
  y += 28

  // ── TABLA UNIFICADA: equipo + recomendaciones en la misma fila ──
  pdf.setFillColor(...GREEN)
  pdf.rect(margin, y, 3, 7, 'F')
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 30, 30)
  pdf.text('DETALLE DE EQUIPOS ATENDIDOS', margin + 6, y + 5.5)
  y += 12

  // Columnas: N°(20) Fecha(18) Ubicación(28) Equipo(32) Serial(24) Recomendaciones(resto)
  const cols = [
    { label: 'N° Informe',       w: 20 },
    { label: 'Fecha',            w: 18 },
    { label: 'Ubicación',        w: 28 },
    { label: 'Equipo',           w: 33 },
    { label: 'Serial',           w: 24 },
    { label: 'Recomendaciones',  w: 57 },
  ]
  const tableW = cols.reduce((s, c) => s + c.w, 0)  // 180mm = W - 2*margin

  const drawTableHeader = () => {
    pdf.setFillColor(...NAVY)
    pdf.rect(margin, y, tableW, 8, 'F')
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...WHITE)
    let cx = margin
    cols.forEach(col => { pdf.text(col.label, cx + 2, y + 5.5); cx += col.w })
    pdf.setTextColor(0, 0, 0)
  }

  drawTableHeader()
  y += 8

  let rowAlt = false

  for (const inf of opts.informes) {
    const hasRec = !!inf.recomendaciones
    const hasObs = !!inf.observaciones
    const recText = hasRec ? inf.recomendaciones! : (hasObs ? inf.observaciones! : '—')
    const recW    = cols[5].w - 4
    pdf.setFontSize(7.5)
    const recLines = pdf.splitTextToSize(recText, recW)
    const rowH = Math.max(6, recLines.length * 4 + 3)

    if (y + rowH > H - 18) {
      addPageFooter(); pdf.addPage(); page++; addPageHeader(page); y = 22
      drawTableHeader(); y += 8
    }

    // Fondo fila completa: ámbar suave si hay rec, verde suave si solo obs, alternado si nada
    if (hasRec) {
      pdf.setFillColor(255, 237, 213)
    } else if (hasObs) {
      pdf.setFillColor(220, 252, 231)
    } else {
      pdf.setFillColor(...(rowAlt ? [232, 235, 240] as [number,number,number] : WHITE))
    }
    pdf.rect(margin, y, tableW, rowH, 'F')

    // Borde izquierdo de color (3mm)
    if (hasRec) {
      pdf.setFillColor(217, 119, 6)    // ámbar
    } else if (hasObs) {
      pdf.setFillColor(...GREEN)        // verde
    } else {
      pdf.setFillColor(200, 200, 200)  // gris neutro
    }
    pdf.rect(margin, y, 3, rowH, 'F')

    // Posición Y centrada verticalmente para todas las celdas
    const textStartY = y + rowH / 2 - (recLines.length * 4) / 2 + 2.5

    // Texto columnas info — centrado verticalmente igual que rec
    const midY = y + rowH / 2 + 2
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
    if (hasRec) { pdf.setTextColor(120, 53, 15) } else { pdf.setTextColor(30, 30, 30) }
    const infoCells = [
      inf.numero_informe ?? inf.reporte_numero ?? '—',
      inf.fecha ?? '—',
      (inf.ubicacion ?? '—').substring(0, 16),
      ([inf.marca, inf.modelo].filter(Boolean).join(' ') || '—').substring(0, 18),
      (inf.serial ?? '—').substring(0, 14),
    ]
    let cx = margin + 3
    infoCells.forEach((cell, i) => {
      pdf.text(String(cell), cx + 2, midY)
      cx += cols[i].w
    })

    // Texto recomendaciones / observaciones — centrado verticalmente
    const recX = margin + tableW - cols[5].w + 2
    if (hasRec) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(120, 53, 15)
      pdf.text(recLines, recX, textStartY)
    } else if (hasObs) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(22, 101, 52)
      pdf.text(recLines, recX, textStartY)
    } else {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(180, 180, 180)
      pdf.text('—', recX, midY)
    }

    // Línea separadora inferior
    pdf.setDrawColor(210, 215, 220); pdf.setLineWidth(0.1)
    pdf.line(margin, y + rowH, margin + tableW, y + rowH)

    y += rowH
    rowAlt = !rowAlt
  }

  y += 6

  // ── CONCLUSIONES ──────────────────────────────────────────────
  if (opts.conclusion) {
    if (y > H - 55) { addPageFooter(); pdf.addPage(); page++; addPageHeader(page); y = 22 }

    pdf.setFillColor(...GREEN)
    pdf.rect(margin, y, 3, 7, 'F')
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    pdf.text('CONCLUSIONES Y PRÓXIMOS PASOS', margin + 6, y + 5.5)
    y += 14

    pdf.setFontSize(9.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)
    const lines = pdf.splitTextToSize(opts.conclusion, W - margin * 2)
    pdf.text(lines, margin, y)
    y += lines.length * 5 + 10
  }

  // ── FIRMA ─────────────────────────────────────────────────────
  if (y > H - 45) { addPageFooter(); pdf.addPage(); page++; addPageHeader(page); y = 22 }

  y += 6
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  // Línea firma técnico
  pdf.line(margin, y + 20, margin + 65, y + 20)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(...GRAY)
  pdf.text('Responsable técnico', margin, y + 25)
  pdf.text(opts.empresa.nombre, margin, y + 30)

  // Línea firma cliente
  pdf.line(W - margin - 65, y + 20, W - margin, y + 20)
  pdf.text('Recibido conforme', W - margin - 65, y + 25)

  addPageFooter()

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
  const [showModal,    setShowModal]   = useState(false)
  const [modalTitulo,  setModalTitulo] = useState('Informe Ejecutivo de Mantenimiento')
  const [modalPeriodo, setModalPeriodo]= useState('')
  const [modalIntro,   setModalIntro]  = useState('')
  const [modalConcl,   setModalConcl]  = useState('')
  const [generating,   setGenerating]  = useState(false)

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
            { label: 'Total informes',       value: informes.length },
            { label: 'Firmados por cliente', value: informes.filter(i => i.firmado_at).length },
            { label: 'Clientes distintos',   value: Object.keys(agrupadosPorCliente).length },
            { label: 'Técnicos activos',     value: [...new Set(informes.map(i => i.tecnico).filter(Boolean))].length },
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
            <div className="hidden sm:grid grid-cols-[1fr_1.2fr_1fr_0.7fr_0.7fr_auto_auto] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>N° / Fecha</span><span>Cliente</span><span>Técnico</span><span>Equipo</span><span>Tipo</span><span>Firma</span><span>PDF</span>
            </div>
            <div className="divide-y divide-gray-50">
              {informes.map(inf => (
                <div key={inf.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_1fr_0.7fr_0.7fr_auto_auto] gap-1 sm:gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
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
                    {inf.firmado_at ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium" title={`Firmado ${new Date(inf.firmado_at).toLocaleString('es-CO')}`}>
                        <CheckCircle2 className="w-3 h-3" /> Firmado
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">Pendiente</span>
                    )}
                  </div>
                  <div className="self-center">
                    {inf.pdf_url ? (
                      <a href={inf.pdf_url} target="_blank" rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
                          inf.firmado_at
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                        }`}
                        title={inf.firmado_at ? 'PDF con firma del cliente' : 'Descargar PDF'}>
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
