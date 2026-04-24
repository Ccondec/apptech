'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase, Usuario, importarClientes, importarEquipos, setConsecutivoInicial, ImportEquipoRow } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Users, UserCheck, UserX, RefreshCw, Copy, CheckCircle, Settings, Link2, FileText, Upload, Hash, Download, DatabaseBackup } from 'lucide-react'
import { crearFormToken, listarFormTokens, desactivarFormToken, FormToken } from '@/lib/supabase'

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [copied, setCopied] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserNombre, setNewUserNombre] = useState('')
  const [newUserRol, setNewUserRol] = useState<'tecnico' | 'admin' | 'cliente'>('tecnico')
  const [newUserClientCompany, setNewUserClientCompany] = useState('')
  const [newUserPass, setNewUserPass] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

  const [tokens, setTokens] = useState<FormToken[]>([])
  const [tokenDesc, setTokenDesc] = useState('')
  const [generatingToken, setGeneratingToken] = useState(false)
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null)

  // Excel import — dos archivos separados
  const fileClientesRef = useRef<HTMLInputElement>(null)
  const fileEquiposRef  = useRef<HTMLInputElement>(null)
  const [importandoClientes, setImportandoClientes] = useState(false)
  const [importandoEquipos,  setImportandoEquipos]  = useState(false)
  const [progresoCl, setProgresoCl] = useState(0)   // 0-100
  const [progresoEq, setProgresoEq] = useState(0)   // 0-100
  const [progresoEqTexto, setProgresoEqTexto] = useState('')
  const [resultClientes, setResultClientes] = useState<{ ok: number; errores: number } | null>(null)
  const [resultEquipos,  setResultEquipos]  = useState<{ ok: number; errores: number; detalle?: string[] } | null>(null)

  // Consecutivo global único
  const [consecValue, setConsecValue] = useState('')
  const [consecSaving, setConsecSaving] = useState(false)
  const [consecSaved, setConsecSaved] = useState(false)

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user?.rol !== 'admin') { router.push('/'); return }
  }, [loading, user, router])

  const cargarUsuarios = useCallback(async () => {
    if (!user) return
    setLoadingUsers(true)
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('empresa_id', user.empresa_id)
      .order('created_at', { ascending: false })
    setUsuarios(data ?? [])
    setLoadingUsers(false)
  }, [user])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  const cargarTokens = useCallback(async () => {
    const data = await listarFormTokens()
    setTokens(data)
  }, [])

  useEffect(() => { cargarTokens() }, [cargarTokens])

  const generarToken = async () => {
    setGeneratingToken(true)
    const token = await crearFormToken(tokenDesc || 'Técnico externo')
    if (token) {
      setTokenDesc('')
      cargarTokens()
    }
    setGeneratingToken(false)
  }

  const copiarEnlaceToken = (tokenId: string) => {
    navigator.clipboard.writeText(`https://apptech-one.vercel.app/form/${tokenId}`)
    setCopiedTokenId(tokenId)
    setTimeout(() => setCopiedTokenId(null), 2000)
  }

  const desactivar = async (tokenId: string) => {
    await desactivarFormToken(tokenId)
    cargarTokens()
  }

  const toggleActivo = async (u: Usuario) => {
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id)
    cargarUsuarios()
  }

  const copiarLicencia = () => {
    if (!user?.empresa?.license_key) return
    navigator.clipboard.writeText(user.empresa.license_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const crearUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)

    const res = await fetch('/api/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newUserEmail,
        password: newUserPass,
        nombre: newUserNombre,
        rol: newUserRol,
        empresa_id: user!.empresa_id,
        ...(newUserRol === 'cliente' ? { client_company: newUserClientCompany } : {}),
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      setCreateError(json.error ?? 'Error al crear usuario')
      setCreating(false)
      return
    }

    setCreating(false)
    setCreateSuccess(true)
    setNewUserEmail(''); setNewUserNombre(''); setNewUserPass(''); setNewUserClientCompany('')
    setTimeout(() => setCreateSuccess(false), 3000)
    cargarUsuarios()
  }

  // ── Descargar plantilla Excel ────────────────────────────────
  // ── Descargar plantilla clientes ────────────────────────────
  const descargarPlantillaClientes = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['company', 'contact', 'address', 'email', 'city', 'phone'],
      ['Empresa Ejemplo S.A.', 'Juan Pérez', 'Calle 123 #45-67', 'contacto@empresa.com', 'Bogotá', '3001234567'],
      ['Distribuidora XYZ', 'María López', 'Av. Principal 789', 'info@xyz.com', 'Medellín', '3109876543'],
    ])
    ws['!cols'] = [24,18,26,28,14,14].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, 'plantilla_clientes.xlsx')
  }

  // ── Descargar plantilla equipos ──────────────────────────────
  const descargarPlantillaEquipos = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['serial', 'company', 'brand', 'model', 'capacity', 'ubicacion', 'qr_code'],
      ['SN-001234', 'Empresa Ejemplo S.A.', 'APC', 'Smart-UPS 3000', '3000VA', 'Sala de servidores', ''],
      ['SN-005678', 'Empresa Ejemplo S.A.', 'Schneider', 'Galaxy 5000', '10kVA', 'Data center', ''],
      ['SN-009999', 'Distribuidora XYZ',    'Vertiv',    'Liebert GXT5', '6kVA', 'Oficina piso 3', ''],
    ])
    ws['!cols'] = [16,24,14,20,12,22,14].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos')
    XLSX.writeFile(wb, 'plantilla_equipos.xlsx')
  }

  // ── Importar archivo de clientes ─────────────────────────────
  const handleImportClientes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    setImportandoClientes(true); setResultClientes(null); setProgresoCl(10)
    try {
      const XLSX = await import('xlsx')
      setProgresoCl(30)
      const wb = XLSX.read(await file.arrayBuffer())
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const filas = rows.map(r => ({
        company: String(r.company ?? r.empresa ?? r.nombre ?? '').trim(),
        contact: String(r.contact ?? r.contacto ?? '').trim(),
        address: String(r.address ?? r.direccion ?? '').trim(),
        email:   String(r.email   ?? '').trim(),
        city:    String(r.city    ?? r.ciudad ?? '').trim(),
        phone:   String(r.phone   ?? r.telefono ?? '').trim(),
      })).filter(f => f.company)
      setProgresoCl(60)
      setResultClientes(filas.length > 0 ? await importarClientes(filas) : { ok: 0, errores: 0 })
      setProgresoCl(100)
    } catch (err) {
      console.error('Import clientes error:', err)
      alert(`Error al importar clientes: ${err instanceof Error ? err.message : String(err)}`)
      setResultClientes({ ok: 0, errores: 1 }); setProgresoCl(100)
    } finally { setImportandoClientes(false); setTimeout(() => setProgresoCl(0), 800) }
  }

  // ── Importar archivo de equipos ──────────────────────────────
  const handleImportEquipos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    setImportandoEquipos(true); setResultEquipos(null); setProgresoEq(5); setProgresoEqTexto('Leyendo archivo…')
    try {
      const XLSX = await import('xlsx')
      setProgresoEq(15); setProgresoEqTexto('Procesando filas…')
      const wb = XLSX.read(await file.arrayBuffer())
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const filas: ImportEquipoRow[] = rows.map(r => ({
        serial:    String(r.serial    ?? '').trim(),
        company:   String(r.company   ?? r.empresa  ?? r.cliente  ?? '').trim() || undefined,
        brand:     String(r.brand     ?? r.marca     ?? '').trim() || undefined,
        model:     String(r.model     ?? r.modelo    ?? '').trim() || undefined,
        capacity:  String(r.capacity  ?? r.capacidad ?? '').trim() || undefined,
        ubicacion: String(r.ubicacion ?? r.location  ?? '').trim() || undefined,
        qr_code:   String(r.qr_code   ?? r.qr        ?? '').trim() || undefined,
      })).filter(f => f.serial)
      setProgresoEq(30); setProgresoEqTexto(`Importando ${filas.length} equipos…`)
      const result = await importarEquipos(filas, (done, total) => {
        setProgresoEq(30 + Math.round((done / total) * 65))
        setProgresoEqTexto(`${done} / ${total} equipos…`)
      })
      setResultEquipos(filas.length > 0 ? result : { ok: 0, errores: 0 })
      setProgresoEq(100); setProgresoEqTexto('¡Listo!')
    } catch (err) {
      console.error('Import equipos error:', err)
      alert(`Error al importar equipos: ${err instanceof Error ? err.message : String(err)}`)
      setResultEquipos({ ok: 0, errores: 1 }); setProgresoEq(100)
    } finally { setImportandoEquipos(false); setTimeout(() => { setProgresoEq(0); setProgresoEqTexto('') }, 800) }
  }

  // ── Backup ───────────────────────────────────────────────────
  const [generandoBackup, setGenerandoBackup] = useState(false)
  const [backupOk, setBackupOk] = useState(false)
  const [backupProgreso, setBackupProgreso] = useState('')
  const [backupPct, setBackupPct] = useState(0)

  const generarBackup = async () => {
    if (!user) return
    setGenerandoBackup(true)
    setBackupProgreso('Cargando datos…'); setBackupPct(5)
    try {
      const [XLSX, JSZip] = await Promise.all([import('xlsx'), import('jszip')])
      const zip = new JSZip.default()
      const empresaId = user.empresa_id
      const nombreEmpresa = user.empresa?.nombre?.replace(/\s+/g, '_') ?? 'empresa'
      const fecha = new Date().toISOString().slice(0, 10)

      // Cargar datos en paralelo
      const [resClientes, resEquipos, resInformes, resUsuarios] = await Promise.all([
        supabase.from('clientes').select('*').eq('empresa_id', empresaId),
        supabase.from('equipos').select('*').eq('empresa_id', empresaId),
        supabase.from('informes').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
        supabase.from('usuarios').select('id, nombre, rol, activo, created_at').eq('empresa_id', empresaId),
      ])

      // ── Excel ────────────────────────────────────────────────
      setBackupProgreso('Generando Excel…'); setBackupPct(25)
      const wb = XLSX.utils.book_new()

      const clientes = (resClientes.data ?? []).map(c => ({
        ID: c.id, Empresa: c.company, Contacto: c.contact, Dirección: c.address,
        Email: c.email, Ciudad: c.city, Teléfono: c.phone,
      }))
      const wsC = XLSX.utils.json_to_sheet(clientes.length ? clientes : [{}])
      wsC['!cols'] = [10,24,18,26,26,14,14].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, wsC, 'Clientes')

      const equipos = (resEquipos.data ?? []).map(e => ({
        ID: e.id, Serial: e.serial, Marca: e.brand, Modelo: e.model,
        Capacidad: e.capacity, Ubicación: e.ubicacion, 'QR Code': e.qr_code,
        'ID Cliente': e.client_id,
      }))
      const wsE = XLSX.utils.json_to_sheet(equipos.length ? equipos : [{}])
      wsE['!cols'] = [10,14,14,20,12,22,14,10].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, wsE, 'Equipos')

      const informesData = resInformes.data ?? []
      const informes = informesData.map(i => ({
        'N° Informe': i.numero_informe, Fecha: i.fecha, Cliente: i.cliente,
        Serial: i.serial, Marca: i.marca, Modelo: i.modelo, Capacidad: i.capacidad,
        Ubicación: i.ubicacion, Técnico: i.tecnico, Tipo: i.tipo_reporte,
        Observaciones: i.observaciones, Recomendaciones: i.recomendaciones,
        'URL PDF': i.pdf_url, 'Creado en': i.created_at,
      }))
      const wsI = XLSX.utils.json_to_sheet(informes.length ? informes : [{}])
      wsI['!cols'] = [14,12,22,14,12,18,10,22,18,10,30,30,40,20].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, wsI, 'Informes')

      const usuariosData = (resUsuarios.data ?? []).map(u => ({
        ID: u.id, Nombre: u.nombre, Rol: u.rol,
        Activo: u.activo ? 'Sí' : 'No', 'Creado en': u.created_at,
      }))
      const wsU = XLSX.utils.json_to_sheet(usuariosData.length ? usuariosData : [{}])
      wsU['!cols'] = [10,20,10,8,20].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, wsU, 'Usuarios')

      // Agregar Excel al ZIP
      const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      zip.file(`datos_${nombreEmpresa}_${fecha}.xlsx`, xlsxBuffer)

      // ── PDFs ─────────────────────────────────────────────────
      const pdfsConUrl = informesData.filter(i => i.pdf_url)
      if (pdfsConUrl.length > 0) {
        const carpetaPdf = zip.folder('PDFs')!
        let descargados = 0
        // Descargar en lotes de 5 para no saturar la red
        for (let i = 0; i < pdfsConUrl.length; i += 5) {
          const lote = pdfsConUrl.slice(i, i + 5)
          await Promise.all(lote.map(async (inf) => {
            try {
              const res = await fetch(inf.pdf_url)
              if (!res.ok) return
              const buffer = await res.arrayBuffer()
              const nombre = `${inf.numero_informe ?? `informe_${inf.id}`}.pdf`
              carpetaPdf.file(nombre, buffer)
              descargados++
              setBackupProgreso(`Descargando PDFs… ${descargados}/${pdfsConUrl.length}`)
              setBackupPct(40 + Math.round((descargados / pdfsConUrl.length) * 45))
            } catch { /* ignorar PDFs que fallen */ }
          }))
        }
      }

      // ── Generar y descargar ZIP ───────────────────────────────
      setBackupProgreso('Comprimiendo…'); setBackupPct(88)
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_${nombreEmpresa}_${fecha}.zip`
      a.click()
      URL.revokeObjectURL(url)

      setBackupPct(100)
      setBackupOk(true)
      setBackupProgreso('')
      setTimeout(() => { setBackupOk(false); setBackupPct(0) }, 3000)
    } catch (err) {
      console.error('Backup error:', err)
      alert('Error al generar el backup. Intenta de nuevo.')
      setBackupProgreso(''); setBackupPct(0)
    } finally {
      setGenerandoBackup(false)
    }
  }

  // ── Consecutivo global ─────────────────────────────────────────
  const guardarConsecutivo = async () => {
    const val = parseInt(consecValue ?? '1')
    if (!val || val < 1 || !user) return
    setConsecSaving(true)
    await setConsecutivoInicial(user.empresa_id, 'global', val)
    setConsecSaving(false)
    setConsecSaved(true)
    setTimeout(() => setConsecSaved(false), 2000)
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Panel de Administración</h1>
          <span className="text-sm text-gray-400 ml-1">— {user.empresa?.nombre}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => router.push('/admin/informes')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Informes
            </Button>
            <Button onClick={() => router.push('/admin/configuracion')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configuración
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">


        {/* Consecutivo de informes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Hash className="w-4 h-4" /> Consecutivo de informes
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Número único compartido por todos los tipos de servicio. El tipo diferencia
            el prefijo del código: <code className="bg-gray-100 px-1 rounded">UPS/26-0001</code>,&nbsp;
            <code className="bg-gray-100 px-1 rounded">AIR/26-0002</code>, etc.
          </p>
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Próximo número</Label>
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={consecValue}
                onChange={e => setConsecValue(e.target.value)}
                className="text-sm h-9"
              />
            </div>
            <Button
              onClick={guardarConsecutivo}
              disabled={consecSaving}
              className={`h-9 px-4 text-sm ${consecSaved ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-800'} text-white`}
            >
              {consecSaved ? <CheckCircle className="w-4 h-4" /> : 'Guardar'}
            </Button>
          </div>
        </div>

        {/* Importar desde Excel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Importar desde Excel
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Descarga la plantilla de cada tipo, llénala y súbela.
            Los equipos se vinculan al cliente por el nombre exacto en la columna <code className="bg-gray-100 px-1 rounded">company</code>.
            El QR se asigna automáticamente si la celda viene vacía.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">

            {/* ── Tarjeta Clientes ── */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Clientes</p>
                <button
                  onClick={descargarPlantillaClientes}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Plantilla
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Columnas: <code className="bg-gray-100 px-1 rounded">company, contact, address, email, city, phone</code>
              </p>
              <input ref={fileClientesRef} type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden" onChange={handleImportClientes} id="xl-clientes" />
              <label htmlFor="xl-clientes" className={`relative flex items-center justify-center gap-2 w-full h-9 rounded-md text-sm font-medium text-white overflow-hidden cursor-pointer select-none transition-colors ${importandoClientes ? 'bg-blue-400 pointer-events-none' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {importandoClientes && (
                  <span className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300" style={{ width: `${progresoCl}%` }} />
                )}
                <span className="relative flex items-center gap-2">
                  {importandoClientes
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {progresoCl < 100 ? `${progresoCl}%` : '¡Listo!'}</>
                    : <><Upload className="w-4 h-4" /> Subir clientes</>}
                </span>
              </label>
              {resultClientes && (
                <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${resultClientes.errores === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    <strong>{resultClientes.ok}</strong> importados
                    {resultClientes.errores > 0 && <>, <strong>{resultClientes.errores}</strong> con error</>}
                  </span>
                </div>
              )}
            </div>

            {/* ── Tarjeta Equipos ── */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Equipos</p>
                <button
                  onClick={descargarPlantillaEquipos}
                  className="text-xs text-green-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Plantilla
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Columnas: <code className="bg-gray-100 px-1 rounded">serial, company, brand, model, capacity, ubicacion, qr_code</code>
              </p>
              <input ref={fileEquiposRef} type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden" onChange={handleImportEquipos} id="xl-equipos" />
              <label htmlFor="xl-equipos" className={`relative flex items-center justify-center gap-2 w-full h-9 rounded-md text-sm font-medium text-white overflow-hidden cursor-pointer select-none transition-colors ${importandoEquipos ? 'bg-green-400 pointer-events-none' : 'bg-green-600 hover:bg-green-700'}`}>
                {importandoEquipos && (
                  <span className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300" style={{ width: `${progresoEq}%` }} />
                )}
                <span className="relative flex items-center gap-2">
                  {importandoEquipos
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {progresoEqTexto || `${progresoEq}%`}</>
                    : <><Upload className="w-4 h-4" /> Subir equipos</>}
                </span>
              </label>
              {resultEquipos && (
                <div className={`text-xs rounded-lg ${resultEquipos.errores === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      <strong>{resultEquipos.ok}</strong> importados
                      {resultEquipos.errores > 0 && <>, <strong>{resultEquipos.errores}</strong> con error</>}
                    </span>
                  </div>
                  {resultEquipos.detalle && resultEquipos.detalle.length > 0 && (
                    <ul className="px-3 pb-2 space-y-0.5 border-t border-amber-200">
                      {resultEquipos.detalle.map((msg, i) => (
                        <li key={i} className="text-amber-800">• {msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Backup */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <DatabaseBackup className="w-4 h-4" /> Backup de datos
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Descarga toda la información de tu empresa en un archivo Excel con cuatro hojas:
            <strong> Clientes</strong>, <strong>Equipos</strong>, <strong>Informes</strong> y <strong>Usuarios</strong>.
          </p>
          <Button
            onClick={generarBackup}
            disabled={generandoBackup}
            className={`relative overflow-hidden flex items-center gap-2 ${backupOk ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-900'} text-white`}
          >
            {generandoBackup && (
              <span className="absolute inset-0 bg-white/20 transition-all duration-500 rounded-md" style={{ width: `${backupPct}%` }} />
            )}
            <span className="relative flex items-center gap-2">
              {generandoBackup ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {backupProgreso || 'Generando…'} {backupPct > 0 && `(${backupPct}%)`}</>
              ) : backupOk ? (
                <><CheckCircle className="w-4 h-4" /> ¡Descargado!</>
              ) : (
                <><Download className="w-4 h-4" /> Descargar backup (ZIP + PDFs)</>
              )}
            </span>
          </Button>
        </div>

        {/* Usuarios */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4" /> Usuarios ({usuarios.length})
            </h2>
            <button onClick={cargarUsuarios} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loadingUsers ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {usuarios.map(u => (
                <div key={u.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.nombre}</p>
                    <p className="text-xs text-gray-400 capitalize">{u.rol}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {u.id !== user.id && (
                      <button
                        onClick={() => toggleActivo(u)}
                        className="text-gray-400 hover:text-gray-600"
                        title={u.activo ? 'Desactivar' : 'Activar'}
                      >
                        {u.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crear usuario */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Invitar técnico</h2>
          <p className="text-xs text-gray-400 mb-4">
            Comparte la clave de licencia para que el técnico se registre él mismo, o créale la cuenta aquí.
          </p>
          <form onSubmit={crearUsuario} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="newNombre">Nombre</Label>
              <Input id="newNombre" value={newUserNombre} onChange={e => setNewUserNombre(e.target.value)} placeholder="Nombre completo" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newEmail">Correo</Label>
              <Input id="newEmail" type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="correo@empresa.com" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPass">Contraseña temporal</Label>
              <Input id="newPass" type="password" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} placeholder="Mínimo 6 caracteres" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newRol">Rol</Label>
              <select
                id="newRol"
                value={newUserRol}
                onChange={e => setNewUserRol(e.target.value as 'tecnico' | 'admin' | 'cliente')}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="tecnico">Técnico</option>
                <option value="admin">Administrador</option>
                <option value="cliente">Cliente (portal)</option>
              </select>
            </div>
            {newUserRol === 'cliente' && (
              <div className="col-span-2 space-y-1">
                <Label htmlFor="newClientCompany">Empresa del cliente</Label>
                <Input
                  id="newClientCompany"
                  value={newUserClientCompany}
                  onChange={e => setNewUserClientCompany(e.target.value)}
                  placeholder="Nombre exacto del cliente en los informes (ej: ORTOCLINICA)"
                  required
                />
                <p className="text-xs text-gray-400">Debe coincidir exactamente con el nombre usado en los informes.</p>
              </div>
            )}
            {createError && <p className="col-span-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>}
            {createSuccess && <p className="col-span-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">✓ Usuario creado exitosamente.</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={creating} className="bg-green-600 hover:bg-green-700 text-white">
                {creating ? 'Creando…' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </div>

        {/* Enlace para técnico externo */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Enlace para técnico externo
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Genera un enlace temporal para que un técnico sin cuenta pueda llenar un informe técnico.
          </p>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={tokenDesc}
              onChange={e => setTokenDesc(e.target.value)}
              placeholder="Descripción (ej: Visita empresa ABC)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <Button
              onClick={generarToken}
              disabled={generatingToken}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {generatingToken ? 'Generando…' : 'Generar enlace'}
            </Button>
          </div>

          {tokens.length > 0 && (
            <div className="divide-y divide-gray-50">
              {tokens.map(token => {
                const expired = new Date(token.expires_at) < new Date()
                const isActive = token.activo && !expired
                return (
                  <div key={token.id} className="py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 truncate">{token.descripcion}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {isActive ? 'activo' : 'expirado'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Vence: {new Date(token.expires_at).toLocaleDateString('es-CO')} · Usos: {token.usos}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => copiarEnlaceToken(token.id)}
                        className="text-gray-400 hover:text-green-600 p-1"
                        title="Copiar enlace"
                      >
                        {copiedTokenId === token.id ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                      {isActive && (
                        <button
                          onClick={() => desactivar(token.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                          title="Desactivar"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
