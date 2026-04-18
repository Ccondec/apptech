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
  rol: 'admin' | 'tecnico'
  activo: boolean
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

export async function buscarClientes(query: string): Promise<ClienteRecord[]> {
  if (!query.trim()) return []
  const usuario = await getUsuarioActual()
  if (!usuario) return []
  const { data } = await supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', usuario.empresa_id)
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

export async function buscarEquipos(query: string): Promise<EquipoRecord[]> {
  if (!query.trim()) return []
  const usuario = await getUsuarioActual()
  if (!usuario) return []
  const { data } = await supabase
    .from('equipos')
    .select('*, clientes(company, contact, address, email, city, phone)')
    .eq('empresa_id', usuario.empresa_id)
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
  if (error) { console.error('Storage upload error:', error.message); return null }
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

export async function siguienteNumeroInforme(empresaId: string, tipoReporte: string): Promise<number> {
  const { data, error } = await supabase.rpc('siguiente_numero_informe', {
    p_empresa_id: empresaId,
    p_tipo: tipoReporte,
  })
  if (error) { console.error('siguienteNumeroInforme error:', error); return 1 }
  return (data as number) ?? 1
}
