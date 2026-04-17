'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Copy, CheckCircle, Plus, Building2, Calendar, ToggleLeft, ToggleRight } from 'lucide-react'

// Página exclusiva para Ion Energy — acceso directo por URL
// /admin/licencias

interface Empresa {
  id: string
  nombre: string
  license_key: string
  activa: boolean
  fecha_expiracion: string | null
  created_at: string
}

function generarClave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segmento = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `IONENERGY-${segmento(4)}-${segmento(4)}-${segmento(4)}`
}

export default function LicenciasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [expiracion, setExpiracion] = useState('')
  const [clave, setClave] = useState(generarClave())
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('empresas')
      .select('*')
      .order('created_at', { ascending: false })
    setEmpresas(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const copiar = (key: string, id: string) => {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const crearEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)

    const { error: err } = await supabase.from('empresas').insert({
      nombre: nombre.trim(),
      license_key: clave,
      activa: true,
      fecha_expiracion: expiracion || null,
    })

    setSaving(false)
    if (err) { setError(err.message); return }

    setSuccess(`Empresa "${nombre}" creada con clave ${clave}`)
    setNombre(''); setExpiracion(''); setClave(generarClave())
    cargar()
  }

  const toggleActiva = async (empresa: Empresa) => {
    await supabase.from('empresas').update({ activa: !empresa.activa }).eq('id', empresa.id)
    cargar()
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
            <Key className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestión de Licencias</h1>
            <p className="text-sm text-gray-400">Ion Energy S.A.S — Panel interno</p>
          </div>
        </div>

        {/* Crear empresa */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva empresa
          </h2>
          <form onSubmit={crearEmpresa} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="nombre">Nombre de la empresa</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Empresa cliente S.A.S"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expiracion">Fecha de expiración (opcional)</Label>
                <Input
                  id="expiracion"
                  type="date"
                  value={expiracion}
                  onChange={e => setExpiracion(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Clave generada</Label>
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-mono text-gray-700">
                  {clave}
                </code>
                <Button
                  type="button"
                  onClick={() => setClave(generarClave())}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Nueva
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">✓ {success}</p>}

            <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              {saving ? 'Guardando…' : 'Crear empresa y clave'}
            </Button>
          </form>
        </div>

        {/* Lista de empresas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Empresas registradas ({empresas.length})
          </h2>

          {loading ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {empresas.map(emp => (
                <div key={emp.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800">{emp.nombre}</p>
                    <div className="flex items-center gap-2">
                      {emp.fecha_expiracion && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(emp.fecha_expiracion).toLocaleDateString('es-CO')}
                        </span>
                      )}
                      <button onClick={() => toggleActiva(emp)} title={emp.activa ? 'Desactivar' : 'Activar'}>
                        {emp.activa
                          ? <ToggleRight className="w-5 h-5 text-green-600" />
                          : <ToggleLeft className="w-5 h-5 text-gray-400" />
                        }
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-50 border border-gray-100 rounded-md px-3 py-1.5 font-mono text-gray-600">
                      {emp.license_key}
                    </code>
                    <button
                      onClick={() => copiar(emp.license_key, emp.id)}
                      className="text-gray-400 hover:text-green-600"
                    >
                      {copiedId === emp.id
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <Copy className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.activa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {emp.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
