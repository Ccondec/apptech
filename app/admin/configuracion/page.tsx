'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getEmpresaConfig, updateEmpresaConfig, listarMarcas, guardarMarca, actualizarMarca, eliminarMarca, MarcaRecord } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DraggableLogo from '@/components/ui/DraggableLogo'
import { ArrowLeft, Building2, Save, Upload } from 'lucide-react'

function compressImage(dataUrl: string, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function ConfiguracionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nombreComercial, setNombreComercial] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [emailContacto, setEmailContacto] = useState('')
  const [logo, setLogo] = useState('')
  const [logoPosX, setLogoPosX] = useState(50)
  const [logoPosY, setLogoPosY] = useState(50)
  const [logoZoom, setLogoZoom] = useState(1)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Marcas
  const [marcas, setMarcas] = useState<MarcaRecord[]>([])
  const [marcaNombre, setMarcaNombre] = useState('')
  const [marcaDireccion, setMarcaDireccion] = useState('')
  const [marcaCiudad, setMarcaCiudad] = useState('')
  const [marcaTelefono, setMarcaTelefono] = useState('')
  const [marcaEmail, setMarcaEmail] = useState('')
  const [marcaLogoPreview, setMarcaLogoPreview] = useState<string | null>(null)
  const [marcaLogoBase64, setMarcaLogoBase64] = useState<string | null>(null)
  const [savingMarca, setSavingMarca] = useState(false)
  const [editingMarca, setEditingMarca] = useState<MarcaRecord | null>(null)
  const marcaLogoRef = useRef<HTMLInputElement>(null)

  // Cargar pos/zoom guardados en localStorage
  useEffect(() => {
    try {
      const px = localStorage.getItem('apptech_logo_posX')
      const py = localStorage.getItem('apptech_logo_posY')
      const pz = localStorage.getItem('apptech_logo_zoom')
      if (px) setLogoPosX(parseFloat(px))
      if (py) setLogoPosY(parseFloat(py))
      if (pz) setLogoZoom(parseFloat(pz))
    } catch (_e) {}
  }, [])

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user?.rol !== 'admin') { router.push('/'); return }
  }, [loading, user, router])

  const cargarMarcas = useCallback(async () => {
    if (!user?.empresa_id) return
    const data = await listarMarcas(user.empresa_id)
    setMarcas(data)
  }, [user])

  useEffect(() => { cargarMarcas() }, [cargarMarcas])

  useEffect(() => {
    if (!user?.empresa_id) return
    getEmpresaConfig(user.empresa_id).then(config => {
      if (!config) return
      setNombreComercial(config.nombre_comercial ?? '')
      setTelefono(config.telefono ?? '')
      setDireccion(config.direccion ?? '')
      setCiudad((config as any).ciudad ?? '')
      setEmailContacto(config.email_contacto ?? '')
      setLogo(config.logo ?? '')
    })
  }, [user])

  const handleLogo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const result = ev.target?.result
      if (typeof result === 'string') {
        const compressed = await compressImage(result, 400, 200, 0.7)
        setLogo(compressed)
        // Resetear posición al cargar un nuevo logo
        setLogoPosX(50); setLogoPosY(50); setLogoZoom(1)
        localStorage.setItem('apptech_logo_posX', '50')
        localStorage.setItem('apptech_logo_posY', '50')
        localStorage.setItem('apptech_logo_zoom', '1')
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.empresa_id) return
    setSaving(true); setError(''); setSuccess(false)

    // Guardar pos/zoom en localStorage
    localStorage.setItem('apptech_logo_posX', String(logoPosX))
    localStorage.setItem('apptech_logo_posY', String(logoPosY))
    localStorage.setItem('apptech_logo_zoom', String(logoZoom))

    const result = await updateEmpresaConfig(user.empresa_id, {
      nombre_comercial: nombreComercial.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      ciudad: ciudad.trim(),
      email_contacto: emailContacto.trim(),
      logo,
    })

    setSaving(false)
    if (!result.ok) { setError(result.error ?? 'Error al guardar'); return }
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Building2 className="w-5 h-5 text-green-600" />
          <h1 className="text-lg font-semibold text-gray-800">Configuración de la empresa</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

          {/* Logo */}
          <div className="space-y-3">
            <Label>Logo de la empresa</Label>
            <div className="flex items-start gap-4">
              {logo ? (
                <DraggableLogo
                  src={logo}
                  posX={logoPosX}
                  posY={logoPosY}
                  zoom={logoZoom}
                  onPositionChange={(x, y) => { setLogoPosX(x); setLogoPosY(y) }}
                  onZoomChange={z => setLogoZoom(z)}
                  onRemove={() => {
                    setLogo('')
                    setLogoPosX(50); setLogoPosY(50); setLogoZoom(1)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                  className="w-64 h-32 border border-gray-200"
                />
              ) : (
                <div
                  className="w-64 h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-300 cursor-pointer hover:border-green-400 hover:text-green-400 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Building2 className="w-8 h-8 mb-1" />
                  <span className="text-xs">Click para subir</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={() => fileRef.current?.click()} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
                  <Upload className="w-4 h-4 mr-2" /> {logo ? 'Cambiar logo' : 'Subir logo'}
                </Button>
                <p className="text-xs text-gray-400">PNG, JPG — máx. 2MB</p>
                {logo && (
                  <p className="text-xs text-gray-400">
                    Arrastra el logo para encuadrar.<br />Rueda del mouse o pellizco para zoom.
                  </p>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              </div>
            </div>
          </div>

          {/* Nombre comercial */}
          <div className="space-y-1">
            <Label htmlFor="nombreComercial">Nombre de la empresa (aparece en reportes)</Label>
            <Input
              id="nombreComercial"
              value={nombreComercial}
              onChange={e => setNombreComercial(e.target.value)}
              placeholder="Mi Empresa S.A.S"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="+57 300 000 0000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emailContacto">Correo de contacto</Label>
              <Input
                id="emailContacto"
                type="email"
                value={emailContacto}
                onChange={e => setEmailContacto(e.target.value)}
                placeholder="contacto@miempresa.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Calle 00 # 00-00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                value={ciudad}
                onChange={e => setCiudad(e.target.value)}
                placeholder="Bogotá"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">✓ Cambios guardados correctamente.</p>}

          <Button type="submit" disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </form>
        {/* Marcas / Empresas Representadas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">🏷️ Marcas / Empresas Representadas</h2>
            <p className="text-xs text-gray-400 mt-1">Empresas a cuyo nombre emites informes. Al generar un PDF podrás elegir qué marca aparece en el encabezado.</p>
          </div>

          {/* Lista */}
          {marcas.length > 0 && (
            <div className="divide-y divide-gray-50">
              {marcas.map(m => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  {m.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.logo_url} alt={m.nombre} className="w-12 h-8 object-contain rounded border border-gray-100 bg-gray-50 p-1" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
                    <p className="text-xs text-gray-400">{[m.ciudad, m.telefono, m.email].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditingMarca(m)
                        setMarcaNombre(m.nombre)
                        setMarcaDireccion(m.direccion ?? '')
                        setMarcaCiudad(m.ciudad ?? '')
                        setMarcaTelefono(m.telefono ?? '')
                        setMarcaEmail(m.email ?? '')
                        setMarcaLogoPreview(m.logo_url)
                        setMarcaLogoBase64(m.logo_url)
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >Editar</button>
                    <button
                      onClick={async () => { await eliminarMarca(m.id); cargarMarcas() }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulario */}
          <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-600">{editingMarca ? 'Editar marca' : 'Agregar marca'}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre de la empresa *</Label>
                <Input placeholder="Ej: Bancolombia, EPM, Hospital San José…" value={marcaNombre} onChange={e => setMarcaNombre(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label>Dirección</Label>
                <Input placeholder="Ej: Cra 7 # 71-21" value={marcaDireccion} onChange={e => setMarcaDireccion(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label>Ciudad</Label>
                <Input placeholder="Ej: Bogotá" value={marcaCiudad} onChange={e => setMarcaCiudad(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input placeholder="Ej: +57 601 234 5678" value={marcaTelefono} onChange={e => setMarcaTelefono(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label>Correo de contacto</Label>
                <Input type="email" placeholder="contacto@empresa.com" value={marcaEmail} onChange={e => setMarcaEmail(e.target.value)} className="text-sm" />
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-1">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {marcaLogoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={marcaLogoPreview} alt="logo" className="h-12 object-contain rounded border border-gray-100 bg-gray-50 p-1" />
                )}
                <button
                  type="button"
                  onClick={() => marcaLogoRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4" />
                  {marcaLogoPreview ? 'Cambiar logo' : 'Subir logo'}
                </button>
                <input
                  ref={marcaLogoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = async ev => {
                      const b64 = ev.target?.result as string
                      const compressed = await compressImage(b64, 400, 200, 0.7)
                      setMarcaLogoPreview(compressed)
                      setMarcaLogoBase64(compressed)
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                disabled={savingMarca || !marcaNombre.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={async () => {
                  if (!marcaNombre.trim() || !user) return
                  setSavingMarca(true)
                  const campos = {
                    nombre: marcaNombre.trim(),
                    logo_url: marcaLogoBase64,
                    direccion: marcaDireccion.trim() || undefined,
                    ciudad: marcaCiudad.trim() || undefined,
                    telefono: marcaTelefono.trim() || undefined,
                    email: marcaEmail.trim() || undefined,
                  }
                  if (editingMarca) {
                    await actualizarMarca(editingMarca.id, campos)
                  } else {
                    await guardarMarca(user.empresa_id, campos)
                  }
                  setMarcaNombre(''); setMarcaDireccion(''); setMarcaCiudad('')
                  setMarcaTelefono(''); setMarcaEmail('')
                  setMarcaLogoPreview(null); setMarcaLogoBase64(null)
                  setEditingMarca(null); setSavingMarca(false)
                  cargarMarcas()
                }}
              >
                {savingMarca ? 'Guardando…' : editingMarca ? 'Actualizar' : 'Guardar marca'}
              </Button>
              {editingMarca && (
                <Button
                  type="button" variant="outline"
                  onClick={() => {
                    setEditingMarca(null)
                    setMarcaNombre(''); setMarcaDireccion(''); setMarcaCiudad('')
                    setMarcaTelefono(''); setMarcaEmail('')
                    setMarcaLogoPreview(null); setMarcaLogoBase64(null)
                  }}
                >Cancelar</Button>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
