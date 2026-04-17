'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase, Usuario } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Users, UserCheck, UserX, RefreshCw, Copy, CheckCircle, Settings } from 'lucide-react'

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [copied, setCopied] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserNombre, setNewUserNombre] = useState('')
  const [newUserRol, setNewUserRol] = useState<'tecnico' | 'admin'>('tecnico')
  const [newUserPass, setNewUserPass] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

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

    // Crear en Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin?.createUser({
      email: newUserEmail,
      password: newUserPass,
      email_confirm: true,
    }) as any

    if (authErr || !authData?.user) {
      // Fallback: usar la función de registro normal (invita al usuario)
      const { error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPass,
        options: { data: { nombre: newUserNombre } },
      })
      if (error) { setCreateError(error.message); setCreating(false); return }
    }

    setCreating(false)
    setCreateSuccess(true)
    setNewUserEmail(''); setNewUserNombre(''); setNewUserPass('')
    setTimeout(() => setCreateSuccess(false), 3000)
    cargarUsuarios()
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
          <div className="ml-auto">
            <Button onClick={() => router.push('/admin/configuracion')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configuración
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Licencia */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Clave de licencia</h2>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-mono text-gray-700">
              {user.empresa?.license_key}
            </code>
            <Button
              onClick={copiarLicencia}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Comparte esta clave con los técnicos para que puedan crear su cuenta.
          </p>
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
                onChange={e => setNewUserRol(e.target.value as 'tecnico' | 'admin')}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="tecnico">Técnico</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {createError && <p className="col-span-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>}
            {createSuccess && <p className="col-span-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">✓ Usuario creado exitosamente.</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={creating} className="bg-green-600 hover:bg-green-700 text-white">
                {creating ? 'Creando…' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </div>

      </main>
    </div>
  )
}
