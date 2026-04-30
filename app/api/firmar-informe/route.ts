import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/supabase-config'

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })
  }

  // Auth: leer JWT del cliente
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // Validar JWT y obtener auth.user
  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
  }
  const authUserId = userRes.user.id

  // Buscar perfil del usuario (rol + client_company + empresa_id)
  const { data: usuario, error: usuarioErr } = await admin
    .from('usuarios')
    .select('rol, empresa_id, client_company')
    .eq('id', authUserId)
    .maybeSingle()
  if (usuarioErr || !usuario) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
  }
  if (usuario.rol !== 'cliente' || !usuario.client_company) {
    return NextResponse.json({ error: 'Solo clientes pueden firmar' }, { status: 403 })
  }

  // Leer multipart form
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const informeId = formData.get('informe_id')
  const file = formData.get('pdf')
  if (typeof informeId !== 'string' || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Faltan campos: informe_id, pdf' }, { status: 400 })
  }

  // Validar que el informe pertenece al cliente
  const { data: informe, error: infErr } = await admin
    .from('informes')
    .select('id, empresa_id, cliente, qr_code, pdf_url, pdf_firmado_url')
    .eq('id', informeId)
    .maybeSingle()
  if (infErr || !informe) {
    return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
  }
  if (informe.empresa_id !== usuario.empresa_id) {
    return NextResponse.json({ error: 'Acceso denegado: empresa' }, { status: 403 })
  }
  if (informe.cliente.trim().toLowerCase() !== usuario.client_company.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Acceso denegado: no eres el cliente' }, { status: 403 })
  }

  // Subir PDF firmado a Storage
  const arrayBuffer = await file.arrayBuffer()
  const filename = `firmado_${informe.qr_code ?? informeId}_${Date.now()}.pdf`
  const path = `${informe.empresa_id}/firmados/${filename}`

  const { error: uploadErr } = await admin.storage
    .from('reportes')
    .upload(path, arrayBuffer, { contentType: 'application/pdf', upsert: true })
  if (uploadErr) {
    return NextResponse.json({ error: `Upload: ${uploadErr.message}` }, { status: 500 })
  }
  const { data: pub } = admin.storage.from('reportes').getPublicUrl(path)
  const pdfFirmadoUrl = pub.publicUrl

  // Update: el firmado sobrescribe al original. pdf_url ahora apunta al
  // PDF firmado y firmado_at marca el estado. pdf_firmado_url se mantiene
  // por compatibilidad con UI ya desplegada (mismo valor que pdf_url).
  const { error: updErr } = await admin
    .from('informes')
    .update({
      pdf_url: pdfFirmadoUrl,
      pdf_firmado_url: pdfFirmadoUrl,
      firmado_at: new Date().toISOString(),
    })
    .eq('id', informeId)
  if (updErr) {
    return NextResponse.json({ error: `Update: ${updErr.message}` }, { status: 500 })
  }

  // Borrar el PDF original de Storage (best-effort, no rompe si falla)
  if (informe.pdf_url) {
    const m = informe.pdf_url.match(/\/storage\/v1\/object\/public\/reportes\/(.+)$/)
    if (m && m[1]) {
      const originalPath = decodeURIComponent(m[1])
      // Defensa: solo borrar si la ruta pertenece a la misma empresa
      if (originalPath.startsWith(`${informe.empresa_id}/`)) {
        admin.storage.from('reportes').remove([originalPath]).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, pdf_url: pdfFirmadoUrl })
}
