import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { SUPABASE_URL } from '@/lib/supabase-config'
import { getSiteUrl } from '@/lib/site-url'

const PRIORIDAD_LABELS: Record<string, string> = {
  alta: '🔴 Alta', media: '🟡 Media', baja: '🟢 Baja',
}
const CATEGORIA_LABELS: Record<string, string> = {
  averia: 'Avería', mantenimiento: 'Mantenimiento', consulta: 'Consulta',
}

export async function POST(req: NextRequest) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_KEY) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })

  // Auth: JWT del cliente
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userRes?.user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
  const authUserId = userRes.user.id

  const { data: usuario } = await admin
    .from('usuarios')
    .select('rol, empresa_id, client_company, nombre')
    .eq('id', authUserId)
    .maybeSingle()
  if (!usuario) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
  if (usuario.rol !== 'cliente' || !usuario.client_company) {
    return NextResponse.json({ error: 'Solo clientes pueden crear tickets' }, { status: 403 })
  }

  // Parse body
  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const equipoId = String(formData.get('equipo_id') ?? '').trim() || null
  const categoria = String(formData.get('categoria') ?? '').trim()
  const prioridad = String(formData.get('prioridad') ?? 'media').trim()
  const descripcion = String(formData.get('descripcion') ?? '').trim()
  const preferenciaHorario = String(formData.get('preferencia_horario') ?? '').trim() || null
  const foto = formData.get('foto')

  if (!['averia', 'mantenimiento', 'consulta'].includes(categoria)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  }
  if (!['alta', 'media', 'baja'].includes(prioridad)) {
    return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 })
  }
  if (!descripcion || descripcion.length < 10) {
    return NextResponse.json({ error: 'La descripción debe tener al menos 10 caracteres' }, { status: 400 })
  }

  // Snapshot del equipo (si aplica)
  let equipoSnap: { qr_code?: string; brand?: string; model?: string; serial?: string; ubicacion?: string } = {}
  let clientId: string | null = null
  if (equipoId) {
    const { data: eq } = await admin
      .from('equipos')
      .select('qr_code, brand, model, serial, ubicacion, client_id, empresa_id')
      .eq('id', equipoId)
      .maybeSingle()
    if (eq && eq.empresa_id === usuario.empresa_id) {
      equipoSnap = eq
      clientId = eq.client_id ?? null
    }
  }

  // Upload de foto (opcional)
  let fotoUrl: string | null = null
  if (foto instanceof Blob && foto.size > 0) {
    if (foto.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Foto muy grande (máx 8MB)' }, { status: 400 })
    }
    const ext = (foto.type === 'image/png') ? 'png' : 'jpg'
    const path = `${usuario.empresa_id}/tickets/${Date.now()}.${ext}`
    const { error: upErr } = await admin.storage
      .from('reportes')
      .upload(path, await foto.arrayBuffer(), { contentType: foto.type || 'image/jpeg', upsert: false })
    if (!upErr) {
      const { data: pub } = admin.storage.from('reportes').getPublicUrl(path)
      fotoUrl = pub.publicUrl
    }
  }

  // Insert ticket
  const { data: ticket, error: insErr } = await admin
    .from('tickets')
    .insert({
      empresa_id: usuario.empresa_id,
      client_id: clientId,
      cliente: usuario.client_company,
      equipo_id: equipoId,
      qr_code: equipoSnap.qr_code,
      equipo_marca: equipoSnap.brand,
      equipo_modelo: equipoSnap.model,
      equipo_serial: equipoSnap.serial,
      equipo_ubicacion: equipoSnap.ubicacion,
      categoria,
      prioridad,
      descripcion,
      preferencia_horario: preferenciaHorario,
      foto_url: fotoUrl,
      creado_por: authUserId,
    })
    .select()
    .single()

  if (insErr || !ticket) {
    return NextResponse.json({ error: `Insert: ${insErr?.message || 'desconocido'}` }, { status: 500 })
  }

  // ── Notificar al admin por email — ahora awaiteado para devolver estado ──
  let emailStatus: { ok: boolean; reason?: string; sent_to?: string[] } = { ok: false, reason: 'not_attempted' }
  try {
    emailStatus = await notificarAdminPorEmail(admin, usuario.empresa_id, ticket, usuario.client_company, usuario.nombre)
  } catch (err) {
    console.error('[crear-ticket] email error:', err)
    emailStatus = { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }

  return NextResponse.json({ ok: true, ticket_id: ticket.id, email: emailStatus })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notificarAdminPorEmail(
  admin: any,
  empresaId: string,
  ticket: any,
  clienteEmpresa: string,
  clienteNombre: string,
): Promise<{ ok: boolean; reason?: string; sent_to?: string[] }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, reason: 'RESEND_API_KEY missing in env' }

  // 1) Admins de la empresa
  const { data: adminUsuarios, error: adminErr } = await admin
    .from('usuarios')
    .select('id, nombre')
    .eq('empresa_id', empresaId)
    .eq('rol', 'admin')
    .eq('activo', true)
  if (adminErr) return { ok: false, reason: `query usuarios: ${adminErr.message}` }
  if (!adminUsuarios?.length) return { ok: false, reason: 'no admin users in empresa' }

  // 2) Emails desde auth.users
  const emails: string[] = []
  for (const u of adminUsuarios) {
    const { data } = await admin.auth.admin.getUserById(u.id)
    if (data?.user?.email) emails.push(data.user.email)
  }
  if (!emails.length) return { ok: false, reason: 'no auth emails for admin users' }

  // 3) Empresa name (branding)
  const { data: empresa } = await admin
    .from('empresas')
    .select('nombre_comercial')
    .eq('id', empresaId)
    .maybeSingle()
  const empresaNombre = (empresa as any)?.nombre_comercial ?? 'Sistema de Tickets'

  // 4) Send via Resend
  const resend = new Resend(apiKey)
  const verifiedFrom = process.env.RESEND_FROM ?? 'noreply@snelapp.com'
  const adminUrl = `${getSiteUrl()}/admin/tickets`

  const equipoTexto = [ticket.equipo_marca, ticket.equipo_modelo, ticket.equipo_serial && `S/N ${ticket.equipo_serial}`]
    .filter(Boolean).join(' · ') || '—'

  const { error: sendErr } = await resend.emails.send({
    from: `${empresaNombre} <${verifiedFrom}>`,
    to: emails,
    subject: `[${PRIORIDAD_LABELS[ticket.prioridad] ?? ticket.prioridad}] Nuevo ticket de ${clienteEmpresa} — ${CATEGORIA_LABELS[ticket.categoria]}`,
    html: `
      <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background: #16a34a; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px;">Nuevo ticket de servicio</h1>
          <p style="color: #dcfce7; margin: 4px 0 0; font-size: 13px;">${empresaNombre}</p>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0; color: #6b7280; width: 130px;">Cliente</td><td><strong>${clienteEmpresa}</strong></td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Solicitado por</td><td>${clienteNombre || '—'}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Equipo</td><td>${equipoTexto}</td></tr>
            ${ticket.equipo_ubicacion ? `<tr><td style="padding: 4px 0; color: #6b7280;">Ubicación</td><td>${ticket.equipo_ubicacion}</td></tr>` : ''}
            <tr><td style="padding: 4px 0; color: #6b7280;">Categoría</td><td>${CATEGORIA_LABELS[ticket.categoria]}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Prioridad</td><td>${PRIORIDAD_LABELS[ticket.prioridad]}</td></tr>
            ${ticket.preferencia_horario ? `<tr><td style="padding: 4px 0; color: #6b7280;">Horario preferido</td><td>${ticket.preferencia_horario}</td></tr>` : ''}
          </table>
          <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-left: 3px solid #16a34a; border-radius: 4px;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Descripción</p>
            <p style="margin: 0; color: #1f2937; font-size: 14px; white-space: pre-wrap;">${escapeHtml(ticket.descripcion)}</p>
          </div>
          ${ticket.foto_url ? `<p style="margin: 16px 0 0;"><a href="${ticket.foto_url}" style="color: #16a34a;">📎 Ver foto adjunta</a></p>` : ''}
          <p style="margin-top: 24px; text-align: center;">
            <a href="${adminUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Atender ticket
            </a>
          </p>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 11px; margin: 16px 0 0;">
          Este es un mensaje automático del sistema.
        </p>
      </div>
    `,
  })

  if (sendErr) {
    console.error('[crear-ticket] Resend error:', JSON.stringify(sendErr))
    return { ok: false, reason: `Resend: ${sendErr.message}`, sent_to: emails }
  }
  return { ok: true, sent_to: emails }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
