'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, PenLine, RotateCcw, Check, AlertCircle, Loader2 } from 'lucide-react'

interface InformeDetail {
  id: string
  qr_code: string | null
  numero_informe: string | null
  cliente: string
  marca: string | null
  modelo: string | null
  serial: string | null
  pdf_url: string | null
  pdf_firmado_url: string | null
  firma_pos: {
    page: number
    x_mm: number
    y_mm: number
    w_mm: number
    h_mm: number
    page_w_mm: number
    page_h_mm: number
  } | null
}

export default function FirmarPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const informeId = String(params?.informe_id ?? '')

  const [informe, setInforme] = useState<InformeDetail | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [firmaSaved, setFirmaSaved] = useState<string | null>(null) // dataURL

  // Auth + carga
  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user && user.rol !== 'cliente') { router.push('/'); return }
  }, [loading, user, router])

  useEffect(() => {
    if (!user || !informeId) return
    cargarInforme()
  }, [user, informeId])

  const cargarInforme = async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('informes')
      .select('id, qr_code, numero_informe, cliente, marca, modelo, serial, pdf_url, pdf_firmado_url, firma_pos')
      .eq('id', informeId)
      .maybeSingle()
    if (err || !data) {
      setError('Informe no encontrado o sin acceso')
      setCargando(false)
      return
    }
    setInforme(data as InformeDetail)
    setCargando(false)
  }

  // Firma → enviar al endpoint
  const handleFirmar = async () => {
    if (!informe || !firmaSaved) return
    if (!informe.pdf_url) { setError('El informe no tiene PDF generado'); return }
    if (!informe.firma_pos) { setError('Este informe se generó antes de la firma digital. Pedí un nuevo informe al técnico.'); return }

    setEnviando(true)
    setError(null)
    try {
      // 1. Descargar PDF original
      const pdfRes = await fetch(informe.pdf_url)
      if (!pdfRes.ok) throw new Error('No se pudo descargar el PDF')
      const pdfBytes = await pdfRes.arrayBuffer()

      // 2. Estampar firma con pdf-lib
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const sigImg = await pdfDoc.embedPng(firmaSaved)

      const pos = informe.firma_pos
      const page = pdfDoc.getPage(pos.page - 1) // pdf-lib es 0-indexed
      const { height: pageHeightPt } = page.getSize()

      // Convertir mm → pt (1mm = 2.83465 pt)
      const MM_TO_PT = 2.83465
      const xPt = pos.x_mm * MM_TO_PT
      const wPt = pos.w_mm * MM_TO_PT
      const hPt = pos.h_mm * MM_TO_PT
      // jsPDF usa Y desde arriba; pdf-lib desde abajo. y_pdfLib = pageHeight - y_jsPDF - h
      const yPt = pageHeightPt - (pos.y_mm * MM_TO_PT) - hPt

      page.drawImage(sigImg, { x: xPt, y: yPt, width: wPt, height: hPt })

      const signedBytes = await pdfDoc.save()

      // 3. Obtener JWT y enviar al endpoint
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesión expirada — recargá la página')

      const formData = new FormData()
      formData.append('informe_id', informe.id)
      formData.append('pdf', new Blob([signedBytes as BlobPart], { type: 'application/pdf' }), 'firmado.pdf')

      const res = await fetch('/api/firmar-informe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Error al firmar')

      // 4. Listo — volver al portal
      alert('Informe firmado correctamente.')
      router.push('/portal')
    } catch (e) {
      console.error('handleFirmar:', e)
      setError(e instanceof Error ? e.message : 'Error desconocido al firmar')
    } finally {
      setEnviando(false)
    }
  }

  if (loading || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!informe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-gray-700 font-medium">{error || 'Informe no encontrado'}</p>
        <Link href="/portal" className="mt-4 text-sm text-green-600 hover:underline">Volver al portal</Link>
      </div>
    )
  }

  const yaFirmado = !!informe.pdf_firmado_url

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/portal" className="p-1.5 rounded-md hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-800 truncate">
              Firmar informe {informe.numero_informe ? `N° ${informe.numero_informe}` : ''}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {informe.marca} {informe.modelo} · S/N: {informe.serial}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {yaFirmado && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">Este informe ya fue firmado</p>
              <p className="text-xs mt-1">
                <a href={informe.pdf_firmado_url!} target="_blank" rel="noopener noreferrer" className="underline">
                  Descargar PDF firmado
                </a>
              </p>
            </div>
          </div>
        )}

        {!informe.firma_pos && !yaFirmado && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">No se puede firmar este informe</p>
              <p className="text-xs mt-1">
                Fue generado antes de la función de firma digital. Pedí un nuevo informe al técnico.
              </p>
            </div>
          </div>
        )}

        {/* Preview del PDF — usa firmado si existe, sino el original */}
        {(informe.pdf_firmado_url || informe.pdf_url) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">
                Vista previa {informe.pdf_firmado_url ? '(firmado)' : 'del informe'}
              </p>
              <a
                href={informe.pdf_firmado_url || informe.pdf_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline"
              >
                Abrir en pestaña
              </a>
            </div>
            <iframe
              src={informe.pdf_firmado_url || informe.pdf_url!}
              className="w-full h-[60vh] bg-gray-100"
              title="Vista previa del PDF"
            />
          </div>
        )}

        {/* Canvas de firma + acción */}
        {!yaFirmado && informe.firma_pos && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-medium text-gray-700">Firmá en el recuadro</p>
            </div>
            <SignaturePad onSave={setFirmaSaved} initial={firmaSaved} />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleFirmar}
              disabled={!firmaSaved || enviando}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Firmando…</>
              ) : (
                <><Check className="w-4 h-4" /> Firmar y enviar</>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Componente de firma con canvas ─────────────────────────────────────────
function SignaturePad({
  onSave, initial,
}: { onSave: (dataUrl: string | null) => void; initial: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasInk, setHasInk] = useState(!!initial)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    // Ajustar resolución física al tamaño visual con DPR
    const rect = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#111'
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    const p = getPoint(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    setDrawing(true)
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const p = getPoint(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasInk(true)
  }
  const onUp = () => {
    setDrawing(false)
    if (hasInk) onSave(canvasRef.current!.toDataURL('image/png'))
  }

  const limpiar = () => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
    onSave(null)
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none block"
          style={{ height: 180 }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        />
      </div>
      <button
        onClick={limpiar}
        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
      >
        <RotateCcw className="w-3 h-3" /> Limpiar
      </button>
    </div>
  )
}
