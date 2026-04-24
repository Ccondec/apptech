import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://deouxnumhspmollumsoz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlb3V4bnVtaHNwbW9sbHVtc296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzU1MDIsImV4cCI6MjA5MjAxMTUwMn0.V4nWluFT7-7zN7y8TCpnOAu01bhMeKpG4eZCc-8eFGw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Tipos ─────────────────────────────────────────────────────

export interface Empresa {
  id: string
  nombre: string
  license_key: string
  activa: boolean
  fecha_expiracion: string | null
  nombre_comercial?: string
  telefono?: string
  direccion?: string
  email_contacto?: string
  logo?: string
}

export interface EmpresaConfig {
  nombre_comercial: string
  telefono: string
  direccion: string
  ciudad: string
  email_contacto: string
  logo: string
}

export interface Usuario {
  id: string
  empresa_id: string
  nombre: string
  rol: 'admin' | 'tecnico' | 'cliente'
  activo: boolean
  must_change_password?: boolean
  client_company?: string
}

export interface ClienteRecord {
  id: string
  empresa_id: string
  company: string
  contact?: string
  address?: string
  email?: string
  city?: string
  phone?: string
}

export interface MarcaRecord {
  id: string
  empresa_id: string
  nombre: string
  logo_url: string | null
  telefono?: string | null
  direccion?: string | null
  ciudad?: string | null
  email?: string | null
  activo: boolean
  created_at: string
}

export interface EquipoRecord {
  id: string
  empresa_id: string
  client_id?: string
  brand?: string
  model?: string
  capacity?: string
  serial?: string
  qr_code?: string
  ubicacion?: string
  client_company?: string
  client_contact?: string
  client_address?: string
  client_email?: string
  client_city?: string
  client_phone?: string
}

// ── Auth helpers ──────────────────────────────────────────────

export async function solicitarRecuperacion(email: string): Promise<{ ok: boolean; error?: string }> {
  // Verificar que el correo está registrado en la plataforma antes de enviar
  const { data: registrado, error: rpcErr } = await supabase.rpc('email_registrado', {
    p_email: email.trim().toLowerCase(),
  })
  if (rpcErr || !registrado) {
    return { ok: false, error: 'Este correo no está registrado en la plataforma.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://snelapp.com'}/reset-password`,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function actualizarPassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }

  // Limpiar el flag via API route (service role bypasa RLS)
  try {
    const session = await getSession()
    if (session) {
      await fetch('/api/clear-must-change-password', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
    }
  } catch (_) { /* no crítico */ }

  return { ok: true }
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUsuarioActual(): Promise<(Usuario & { empresa: Empresa }) | null> {
  const session = await getSession()
  if (!session) return null

  const { data } = await supabase
    .from('usuarios')
    .select('*, empresa:empresas(*)')
    .eq('id', session.user.id)
    .single()

  return data ?? null
}

// ── Registro con clave de licencia ────────────────────────────

export async function registrarConLicencia(
  email: string,
  password: string,
  nombre: string,
  licenseKey: string,
): Promise<{ ok: boolean; error?: string; rol?: 'admin' | 'tecnico' }> {
  // 1. Validar clave de licencia
  const { data: empresa, error: empErr } = await supabase
    .from('empresas')
    .select('id, activa, fecha_expiracion')
    .eq('license_key', licenseKey.trim().toUpperCase())
    .single()

  if (empErr || !empresa) return { ok: false, error: 'Clave de licencia inválida.' }
  if (!empresa.activa) return { ok: false, error: 'La licencia está inactiva.' }
  if (empresa.fecha_expiracion && new Date(empresa.fecha_expiracion) < new Date()) {
    return { ok: false, error: 'La licencia ha expirado.' }
  }

  // 2. Auto-determinar rol: el primero en registrarse con esta licencia es admin
  const { count } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresa.id)
    .eq('rol', 'admin')

  const rol: 'admin' | 'tecnico' = (count ?? 0) === 0 ? 'admin' : 'tecnico'

  // 3. Crear usuario en Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  })

  if (authErr || !authData.user) return { ok: false, error: authErr?.message ?? 'Error al crear cuenta.' }

  // 4. Crear perfil en tabla usuarios
  const { error: profileErr } = await supabase.from('usuarios').insert({
    id: authData.user.id,
    empresa_id: empresa.id,
    nombre,
    rol,
  })

  if (profileErr) return { ok: false, error: 'Error al crear perfil.' }
  return { ok: true, rol }
}

// ── Clientes ──────────────────────────────────────────────────

export async function buscarClientes(query: string, empresaId?: string): Promise<ClienteRecord[]> {
  if (!query.trim()) return []
  const eid = empresaId ?? (await getUsuarioActual())?.empresa_id
  if (!eid) return []
  const { data } = await supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', eid)
    .ilike('company', `%${query}%`)
    .limit(8)
  return data ?? []
}

export async function guardarCliente(data: Omit<ClienteRecord, 'id' | 'empresa_id'>): Promise<ClienteRecord | null> {
  const usuario = await getUsuarioActual()
  if (!usuario) return null

  const { data: saved } = await supabase
    .from('clientes')
    .upsert({ ...data, empresa_id: usuario.empresa_id }, { onConflict: 'company,empresa_id' })
    .select()
    .single()

  return saved ?? null
}

// ── Equipos ───────────────────────────────────────────────────

export async function buscarEquipos(query: string, empresaId?: string): Promise<EquipoRecord[]> {
  if (!query.trim()) return []
  const eid = empresaId ?? (await getUsuarioActual())?.empresa_id
  if (!eid) return []
  const { data } = await supabase
    .from('equipos')
    .select('*, clientes(company, contact, address, email, city, phone)')
    .eq('empresa_id', eid)
    .ilike('serial', `%${query}%`)
    .limit(8)

  return (data ?? []).map((e: any) => ({
    ...e,
    client_company:  e.clientes?.company  ?? '',
    client_contact:  e.clientes?.contact  ?? '',
    client_address:  e.clientes?.address  ?? '',
    client_email:    e.clientes?.email    ?? '',
    client_city:     e.clientes?.city     ?? '',
    client_phone:    e.clientes?.phone    ?? '',
  }))
}

export async function guardarEquipo(data: Omit<EquipoRecord, 'id' | 'empresa_id' | 'client_company' | 'client_contact' | 'client_address' | 'client_email' | 'client_city' | 'client_phone'>): Promise<EquipoRecord | null> {
  const usuario = await getUsuarioActual()
  if (!usuario) return null

  const { data: saved } = await supabase
    .from('equipos')
    .upsert({ ...data, empresa_id: usuario.empresa_id }, { onConflict: 'serial,empresa_id' })
    .select()
    .single()

  return saved ?? null
}

// ── Informes ──────────────────────────────────────────────────

export interface InformeRecord {
  id: string
  empresa_id: string
  equipo_id?: string
  qr_code?: string
  numero_informe?: string
  reporte_numero?: string
  fecha: string
  cliente: string
  serial?: string
  marca?: string
  modelo?: string
  capacidad?: string
  ubicacion?: string
  tecnico?: string
  tipo_reporte?: string
  observaciones?: string
  recomendaciones?: string
  pdf_url?: string
  created_at: string
}

export async function guardarInforme(informe: {
  qr_code?: string
  numero_informe: string
  fecha: string
  cliente: string
  serial: string
  marca: string
  modelo: string
  capacidad: string
  ubicacion: string
  tecnico: string
  equipo_id?: string
  tipo_reporte?: string
  empresa_id?: string
  observaciones?: string
  recomendaciones?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  let empresaId = informe.empresa_id
  if (!empresaId) {
    const usuario = await getUsuarioActual()
    if (!usuario) return { ok: false, error: 'No autenticado.' }
    empresaId = usuario.empresa_id
  }

  const { empresa_id: _, ...rest } = informe
  const { data, error } = await supabase.from('informes').insert({
    ...rest,
    empresa_id: empresaId,
  }).select('id').single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id }
}

export async function actualizarPdfUrl(informeId: string, pdfUrl: string): Promise<void> {
  await supabase.from('informes').update({ pdf_url: pdfUrl }).eq('id', informeId)
}

export async function listarInformesEmpresa(opts: {
  limite?: number
  tipo?: string
  tecnico?: string
  cliente?: string
  desde?: string
  hasta?: string
}): Promise<InformeRecord[]> {
  const usuario = await getUsuarioActual()
  if (!usuario) return []

  let query = supabase
    .from('informes')
    .select('*')
    .eq('empresa_id', usuario.empresa_id)
    .order('created_at', { ascending: false })
    .limit(opts.limite ?? 100)

  if (opts.tipo)    query = query.eq('tipo_reporte', opts.tipo)
  if (opts.tecnico) query = query.ilike('tecnico', `%${opts.tecnico}%`)
  if (opts.cliente) query = query.ilike('cliente', `%${opts.cliente}%`)
  // Filtrar por created_at (ISO) en lugar de fecha (string localizado)
  if (opts.desde)   query = query.gte('created_at', `${opts.desde}T00:00:00`)
  if (opts.hasta)   query = query.lte('created_at', `${opts.hasta}T23:59:59`)

  const { data } = await query
  return data ?? []
}

export async function listarHistorialEquipo(equipoId: string, qrCode?: string): Promise<InformeRecord[]> {
  let query = supabase
    .from('informes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  if (qrCode) {
    // Traer por equipo_id O por qr_code para no perder informes viejos
    query = query.or(`equipo_id.eq.${equipoId},qr_code.eq.${qrCode}`)
  } else {
    query = query.eq('equipo_id', equipoId)
  }

  const { data } = await query
  return data ?? []
}

// ── Storage: subir PDF de reporte ────────────────────────────

export async function uploadReportePdf(
  arrayBuffer: ArrayBuffer,
  empresaId: string,
  filename: string
): Promise<string | null> {
  const path = `${empresaId}/${filename}`
  const { error } = await supabase.storage
    .from('reportes')
    .upload(path, arrayBuffer, { contentType: 'application/pdf', upsert: true })
  if (error) { return null }
  const { data } = supabase.storage.from('reportes').getPublicUrl(path)
  return data.publicUrl
}

// ── Configuración de empresa ──────────────────────────────────

export async function getEmpresaConfig(empresaId: string): Promise<EmpresaConfig | null> {
  const { data } = await supabase
    .from('empresas')
    .select('nombre_comercial, telefono, direccion, ciudad, email_contacto, logo')
    .eq('id', empresaId)
    .single()
  return data ?? null
}

export async function updateEmpresaConfig(empresaId: string, config: Partial<EmpresaConfig>): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('empresas')
    .update(config)
    .eq('id', empresaId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Usuarios de la empresa (para lista de técnicos) ───────────

export async function listarTecnicos(): Promise<Usuario[]> {
  const usuario = await getUsuarioActual()
  if (!usuario) return []

  const { data } = await supabase
    .from('usuarios')
    .select('*')
    .eq('empresa_id', usuario.empresa_id)
    .eq('activo', true)

  return data ?? []
}

// ── Tokens de formulario externo ──────────────────────────────

export interface FormToken {
  id: string
  empresa_id: string
  descripcion: string
  expires_at: string
  activo: boolean
  usos: number
  created_at: string
}

export async function crearFormToken(descripcion: string): Promise<FormToken | null> {
  const usuario = await getUsuarioActual()
  if (!usuario || usuario.rol !== 'admin') return null
  const { data } = await supabase
    .from('form_tokens')
    .insert({
      empresa_id: usuario.empresa_id,
      created_by: usuario.id,
      descripcion: descripcion || 'Técnico externo',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()
  return data ?? null
}

export async function listarFormTokens(): Promise<FormToken[]> {
  const usuario = await getUsuarioActual()
  if (!usuario) return []
  const { data } = await supabase
    .from('form_tokens')
    .select('*')
    .eq('empresa_id', usuario.empresa_id)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function desactivarFormToken(tokenId: string): Promise<boolean> {
  const { error } = await supabase.from('form_tokens').update({ activo: false }).eq('id', tokenId)
  return !error
}

export async function validarFormToken(tokenId: string): Promise<{ empresaId: string; empresa: Empresa; token: FormToken } | null> {
  const { data } = await supabase
    .from('form_tokens')
    .select('*, empresa:empresas(*)')
    .eq('id', tokenId)
    .eq('activo', true)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (!data) return null
  return { empresaId: data.empresa_id, empresa: data.empresa as Empresa, token: data as FormToken }
}

// ── Consecutivos de informes por empresa y tipo ───────────────

// Lee el próximo número sin incrementarlo (para mostrarlo en el encabezado)
// Usa el API route con service role para evitar bloqueos de RLS
export async function obtenerNumeroActual(empresaId: string): Promise<number> {
  const res = await fetch(`/api/peek-consecutivo?empresa_id=${encodeURIComponent(empresaId)}`)
  if (!res.ok) return 1
  const json = await res.json()
  return (json.numero as number) ?? 1
}

// Un único consecutivo global por empresa — el tipo solo afecta el prefijo del formato
export async function siguienteNumeroInforme(empresaId: string, _tipoReporte?: string): Promise<number> {
  const { data, error } = await supabase.rpc('siguiente_numero_informe', {
    p_empresa_id: empresaId,
    p_tipo: 'global',
  })
  if (error) { return 1 }
  return (data as number) ?? 1
}

// Formato: TIPO/AA-NNNN  (ej: UPS/26-0001)
export function formatearNumeroInforme(n: number, tipo: string): string {
  const TIPO_PREFIX: Record<string, string> = {
    ups: 'UPS', aire: 'AIR', planta: 'PLT', fotovoltaico: 'FTV', otros: 'OTR',
  }
  const prefix = TIPO_PREFIX[tipo] ?? 'RPT'
  const yy = String(new Date().getFullYear()).slice(-2)
  return `${prefix}-${yy}${String(n).padStart(4, '0')}`
}

// ── QR consecutivo por empresa ────────────────────────────────

export async function siguienteQrEquipo(empresaId: string): Promise<string> {
  try {
    const res = await fetch('/api/siguiente-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id: empresaId }),
    })
    if (!res.ok) throw new Error('API error')
    const { qr } = await res.json()
    return qr ?? 'EQ-0001'
  } catch {
    // Fallback con timestamp para evitar colisiones
    const prefix = empresaId.replace(/-/g, '').slice(0, 6).toUpperCase()
    return `${prefix}-EQ-${Date.now().toString().slice(-4)}`
  }
}

export async function buscarEquipoPorSerial(serial: string, empresaId?: string): Promise<EquipoRecord | null> {
  const eid = empresaId ?? (await getUsuarioActual())?.empresa_id
  if (!eid) return null
  const { data } = await supabase
    .from('equipos')
    .select('*, clientes(company, contact, address, email, city, phone)')
    .eq('empresa_id', eid)
    .ilike('serial', serial.trim())
    .maybeSingle()
  if (!data) return null
  return {
    ...data,
    client_company: data.clientes?.company ?? '',
    client_contact: data.clientes?.contact ?? '',
    client_address: data.clientes?.address ?? '',
    client_email:   data.clientes?.email   ?? '',
    client_city:    data.clientes?.city    ?? '',
    client_phone:   data.clientes?.phone   ?? '',
  }
}

// ── Consecutivo inicial (administrable) ──────────────────────

// Consecutivo global único — el tipo ya no diferencia el contador
export async function setConsecutivoInicial(empresaId: string, _tipo: string, valor: number): Promise<void> {
  await supabase
    .from('consecutivos')
    .upsert({ empresa_id: empresaId, tipo_reporte: 'global', ultimo_numero: valor - 1 }, { onConflict: 'empresa_id,tipo_reporte' })
}

// ── Validar que un correo está registrado como cliente ────────

export async function validarEmailCliente(
  email: string,
  empresaId: string,
): Promise<{ valido: boolean; nombre?: string }> {
  if (!email.trim()) return { valido: false }
  const { data } = await supabase
    .from('clientes')
    .select('id, company')
    .eq('empresa_id', empresaId)
    .ilike('email', email.trim())
    .maybeSingle()
  if (!data) return { valido: false }
  return { valido: true, nombre: data.company }
}

// ── Importar clientes desde array ────────────────────────────

export async function importarClientes(filas: Omit<ClienteRecord, 'id' | 'empresa_id'>[]): Promise<{ ok: number; errores: number }> {
  const usuario = await getUsuarioActual()
  if (!usuario) return { ok: 0, errores: filas.length }
  let ok = 0; let errores = 0
  for (const fila of filas) {
    const { error } = await supabase
      .from('clientes')
      .upsert({ ...fila, empresa_id: usuario.empresa_id }, { onConflict: 'company,empresa_id' })
    if (error) errores++; else ok++
  }
  return { ok, errores }
}

// ── Importar equipos desde array ──────────────────────────────

export interface ImportEquipoRow {
  serial: string
  brand?: string
  model?: string
  capacity?: string
  ubicacion?: string
  qr_code?: string
  /** Nombre del cliente tal como aparece en la hoja Clientes (para auto-vincular) */
  company?: string
}

export async function importarEquipos(filas: ImportEquipoRow[], onProgress?: (done: number, total: number) => void): Promise<{ ok: number; errores: number; detalle?: string[] }> {
  const usuario = await getUsuarioActual()
  if (!usuario) return { ok: 0, errores: filas.length, detalle: ['Usuario no autenticado'] }

  // Cargar todos los clientes de la empresa de una sola vez
  const { data: clientesDB } = await supabase
    .from('clientes')
    .select('id, company')
    .eq('empresa_id', usuario.empresa_id)

  // Mapa nombre (minúsculas) → id para búsqueda rápida
  const clienteMap = new Map<string, string>(
    (clientesDB ?? []).map(c => [c.company.toLowerCase().trim(), c.id])
  )

  let ok = 0; let errores = 0
  const detalle: string[] = []

  // Pre-cargar equipos existentes para conservar su qr_code
  const serialesImport = filas.map(f => f.serial.trim()).filter(Boolean)
  const { data: equiposExistentes } = await supabase
    .from('equipos')
    .select('serial, qr_code')
    .eq('empresa_id', usuario.empresa_id)
    .in('serial', serialesImport)

  const qrExistenteMap = new Map<string, string>(
    (equiposExistentes ?? []).map(e => [e.serial, e.qr_code])
  )

  for (const fila of filas) {
    try {
      if (!fila.serial?.trim()) {
        errores++
        detalle.push(`Fila sin serial — omitida`)
        continue
      }

      // Resolver client_id a partir del nombre de empresa
      const client_id = fila.company
        ? clienteMap.get(fila.company.toLowerCase().trim())
        : undefined

      if (fila.company && !client_id) {
        detalle.push(`Serial ${fila.serial}: cliente "${fila.company}" no encontrado — se importa sin cliente`)
      }

      // Prioridad QR: 1) el que trae el archivo, 2) el que ya tiene en BD, 3) generar nuevo
      const qr_code = fila.qr_code?.trim()
        || qrExistenteMap.get(fila.serial.trim())
        || await siguienteQrEquipo(usuario.empresa_id)

      const { company: _c, ...resto } = fila
      const { error } = await supabase
        .from('equipos')
        .upsert(
          { ...resto, qr_code, client_id, empresa_id: usuario.empresa_id },
          { onConflict: 'serial,empresa_id' }
        )
      if (error) {
        errores++
        detalle.push(`Serial ${fila.serial}: ${error.message}`)
      } else {
        ok++
      }
    } catch (e: unknown) {
      errores++
      detalle.push(`Serial ${fila.serial}: ${e instanceof Error ? e.message : 'error desconocido'}`)
    }
    onProgress?.(ok + errores, filas.length)
  }

  return { ok, errores, detalle }
}

// ── Marcas (empresas representadas) ──────────────────────────

export async function listarMarcas(empresaId: string): Promise<MarcaRecord[]> {
  const { data } = await supabase
    .from('marcas')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('nombre')
  return data ?? []
}

export async function guardarMarca(
  empresaId: string,
  campos: { nombre: string; logo_url: string | null; telefono?: string; direccion?: string; ciudad?: string; email?: string }
): Promise<MarcaRecord | null> {
  const { data } = await supabase
    .from('marcas')
    .insert({ empresa_id: empresaId, ...campos })
    .select()
    .single()
  return data ?? null
}

export async function actualizarMarca(
  id: string,
  campos: { nombre: string; logo_url: string | null; telefono?: string; direccion?: string; ciudad?: string; email?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from('marcas')
    .update(campos)
    .eq('id', id)
  return !error
}

export async function eliminarMarca(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('marcas')
    .update({ activo: false })
    .eq('id', id)
  return !error
}
