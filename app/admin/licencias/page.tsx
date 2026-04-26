'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Copy, CheckCircle, Plus, Building2, Calendar, ToggleLeft, ToggleRight, RefreshCw, Lock, LogOut } from 'lucide-react'
import { useInactivity } from '@/lib/use-inactivity'

interface Empresa {
  id: string
  nombre: string
  nombre_comercial: string | null
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

// Flag no-sensible: indica que el usuario pasó el auth en esta pestaña.
// La sesión real vive en un cookie httpOnly firmado por el servidor.
const SESSION_FLAG = 'snel_superadmin_authed'

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
    },
  })
}

export default function LicenciasPage() {
  const [authed, setAuthed] = useState(false)
  const [masterInput, setMasterInput] = useState('')
  const [authError, setAuthError] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  // Crear empresa
  const [nombre, setNombre] = useState('')
  const [nombreComercial, setNombreComercial] = useState('')
  const [expiracion, setExpiracion] = useState('')
  const [clave, setClave] = useState(generarClave())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Copiar
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Renovar
  const [renovandoId, setRenovandoId] = useState<string | null>(null)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [savingRenov, setSavingRenov] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_FLAG)) setAuthed(true)
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/superadmin-auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: masterInput }),
    })
    if (res.ok) {
      // El cookie httpOnly lo setea el servidor; acá solo dejamos un flag
      // no-sensible para que la pestaña recuerde que ya pasó el auth.
      sessionStorage.setItem(SESSION_FLAG, '1')
      setMasterInput('')
      setAuthed(true)
    } else {
      setAuthError('Clave incorrecta')
    }
  }

  const cargar = async () => {
    setLoading(true)
    const res = await adminFetch('/api/superadmin/empresas')
    if (res.status === 401) {
      // Cookie expiró → forzar reauth
      sessionStorage.removeItem(SESSION_FLAG)
      setAuthed(false)
      setLoading(false)
      return
    }
    if (!res.ok) {
      setEmpresas([])
      setLoading(false)
      return
    }
    const json = await res.json()
    setEmpresas(json.empresas ?? [])
    setLoading(false)
  }

  const cerrarSesion = useCallback(async () => {
    sessionStorage.removeItem(SESSION_FLAG)
    setAuthed(false)
    setMasterInput('')
    await fetch('/api/superadmin-logout', { method: 'POST', credentials: 'same-origin' })
  }, [])

  useInactivity(cerrarSesion, 15)

  useEffect(() => { if (authed) cargar() }, [authed])

  const copiar = (key: string, id: string) => {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const crearEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    const res = await adminFetch('/api/superadmin/empresas', {
      method: 'POST',
      body: JSON.stringify({
        nombre: nombre.trim(),
        nombre_comercial: nombreComercial.trim() || null,
        license_key: clave,
        fecha_expiracion: expiracion || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Error al crear empresa'); return
    }
    setSuccess(`Empresa "${nombre}" creada con clave ${clave}`)
    setNombre(''); setNombreComercial(''); setExpiracion(''); setClave(generarClave())
    cargar()
  }

  const toggleActiva = async (empresa: Empresa) => {
    setEmpresas(prev => prev.map(e => e.id === empresa.id ? { ...e, activa: !e.activa } : e))
    await adminFetch(`/api/superadmin/empresas/${empresa.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ activa: !empresa.activa }),
    })
    cargar()
  }

  const renovar = async (empresa: Empresa) => {
    if (!nuevaFecha) return
    setSavingRenov(true)
    await adminFetch(`/api/superadmin/empresas/${empresa.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ activa: true, fecha_expiracion: nuevaFecha }),
    })
    setSavingRenov(false)
    setRenovandoId(null)
    setNuevaFecha('')
    cargar()
  }

  // ── Pantalla de autenticación ──────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Panel de Licencias</h1>
              <p className="text-xs text-gray-400">Acceso restringido</p>
            </div>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="masterKey">Clave de acceso</Label>
              <Input
                id="masterKey"
                type="password"
                value={masterInput}
                onChange={e => { setMasterInput(e.target.value); setAuthError('') }}
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // ── Panel principal ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gestión de Licencias</h1>
              <p className="text-sm text-gray-400">Ion Energy S.A.S — Panel interno</p>
            </div>
          </div>
          <button
            onClick={cerrarSesion}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>

        {/* Crear empresa */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva empresa
          </h2>
          <form onSubmit={crearEmpresa} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="nombre">Nombre legal</Label>
                <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Empresa S.A.S" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nombreComercial">Nombre comercial (opcional)</Label>
                <Input id="nombreComercial" value={nombreComercial} onChange={e => setNombreComercial(e.target.value)} placeholder="Marca o nombre visible" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expiracion">Fecha de expiración (opcional)</Label>
                <Input id="expiracion" type="date" value={expiracion} onChange={e => setExpiracion(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Clave generada</Label>
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-mono text-gray-700">
                  {clave}
                </code>
                <Button type="button" onClick={() => setClave(generarClave())} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Empresas registradas ({empresas.length})
            </h2>
            <button onClick={cargar} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {empresas.map(emp => (
                <div key={emp.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{emp.nombre}</p>
                      {emp.nombre_comercial && <p className="text-xs text-gray-400">{emp.nombre_comercial}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.activa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {emp.activa ? 'Activa' : 'Inactiva'}
                      </span>
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
                    <button onClick={() => copiar(emp.license_key, emp.id)} className="text-gray-400 hover:text-green-600">
                      {copiedId === emp.id
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <Copy className="w-4 h-4" />
                      }
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {emp.fecha_expiracion
                      ? <>Vence: <span className={`font-medium ${new Date(emp.fecha_expiracion) < new Date() ? 'text-red-500' : 'text-gray-600'}`}>{new Date(emp.fecha_expiracion).toLocaleDateString('es-CO')}</span></>
                      : 'Sin fecha de expiración'
                    }
                    <button
                      onClick={() => { setRenovandoId(renovandoId === emp.id ? null : emp.id); setNuevaFecha('') }}
                      className="ml-1 text-green-600 hover:underline font-medium"
                    >
                      {renovandoId === emp.id ? 'Cancelar' : 'Renovar'}
                    </button>
                  </div>

                  {renovandoId === emp.id && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        type="date"
                        value={nuevaFecha}
                        onChange={e => setNuevaFecha(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        onClick={() => renovar(emp)}
                        disabled={!nuevaFecha || savingRenov}
                        className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white px-3"
                      >
                        {savingRenov ? '…' : 'Confirmar'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
