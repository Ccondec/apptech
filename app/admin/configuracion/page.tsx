'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getEmpresaConfig, updateEmpresaConfig } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Building2, Save, Upload, X } from 'lucide-react'

export default function ConfiguracionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nombreComercial, setNombreComercial] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [emailContacto, setEmailContacto] = useState('')
  const [logo, setLogo] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (!loading && user?.rol !== 'admin') { router.push('/'); return }
  }, [loading, user, router])

  useEffect(() => {
    if (!user?.empresa_id) return
    getEmpresaConfig(user.empresa_id).then(config => {
      if (!config) return
      setNombreComercial(config.nombre_comercial ?? '')
      setTelefono(config.telefono ?? '')
      setDireccion(config.direccion ?? '')
      setEmailContacto(config.email_contacto ?? '')
      setLogo(config.logo ?? '')
    })
  }, [user])

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogo(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.empresa_id) return
    setSaving(true); setError(''); setSuccess(false)

    const result = await updateEmpresaConfig(user.empresa_id, {
      nombre_comercial: nombreComercial.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
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
            <div className="flex items-center gap-4">
              {logo ? (
                <div className="relative w-32 h-20 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                  <button
                    type="button"
                    onClick={() => { setLogo(''); if (fileRef.current) fileRef.current.value = '' }}
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-500 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300">
                  <Building2 className="w-8 h-8" />
                </div>
              )}
              <div>
                <Button type="button" onClick={() => fileRef.current?.click()} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
                  <Upload className="w-4 h-4 mr-2" /> Subir logo
                </Button>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG — máx. 2MB</p>
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

          <div className="space-y-1">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              placeholder="Calle 00 # 00-00, Ciudad"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">✓ Cambios guardados correctamente.</p>}

          <Button type="submit" disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </form>
      </main>
    </div>
  )
}
