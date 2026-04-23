import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servicio de correo no configurado' }, { status: 503 })
  const resend = new Resend(apiKey)
  try {
    const { to, subject, clientName, technicianName, date, pdfBase64, pdfUrl, filename, companyName, companyEmail } = await req.json()

    if (!to || (!pdfBase64 && !pdfUrl)) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Validar formato email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: 'Correo destinatario inválido' }, { status: 400 })
    }

    // Obtener contenido del PDF: desde URL (Storage) o desde base64
    let pdfBuffer: Buffer
    if (pdfUrl) {
      const response = await fetch(pdfUrl)
      if (!response.ok) return NextResponse.json({ error: 'No se pudo obtener el PDF' }, { status: 500 })
      pdfBuffer = Buffer.from(await response.arrayBuffer())
    } else {
      pdfBuffer = Buffer.from(pdfBase64, 'base64')
    }

    // Construir el from con el nombre de la empresa pero usando el dominio verificado
    const verifiedFrom = process.env.RESEND_FROM ?? 'comercial@ionenergy.com.co'
    const fromAddress = companyName
      ? `${companyName} <${verifiedFrom}>`
      : `Notificaciones <${verifiedFrom}>`

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      replyTo: companyEmail ?? undefined,
      to: [to],
      subject: subject ?? 'Reporte Técnico',
      attachments: [{ filename: filename ?? 'reporte_tecnico.pdf', content: pdfBuffer, contentType: 'application/pdf' }],
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #16a34a; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">${companyName ?? 'Reporte Técnico'}</h1>
            <p style="color: #dcfce7; margin: 4px 0 0; font-size: 14px;">Reporte Técnico</p>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #374151; margin: 0 0 16px;">Estimado/a ${clientName ?? 'cliente'},</p>
            <p style="color: #374151; margin: 0 0 16px;">
              Adjunto encontrará el reporte técnico generado el <strong>${date}</strong>
              por el técnico <strong>${technicianName ?? ''}</strong>.
            </p>
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              Este es un mensaje automático. Para consultas, contáctenos directamente.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error full:', JSON.stringify(error))
      return NextResponse.json({ error: error.message, details: JSON.stringify(error) }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
