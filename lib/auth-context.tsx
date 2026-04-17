'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, getUsuarioActual, Usuario, Empresa } from './supabase'
import type { Session } from '@supabase/supabase-js'

interface AuthUser extends Usuario {
  empresa: Empresa
}

interface AuthContextType {
  session: Session | null
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUser(s: Session | null) {
    if (!s) { setUser(null); setLoading(false); return }
    const { data } = await supabase
      .from('usuarios')
      .select('*, empresa:empresas(*)')
      .eq('id', s.user.id)
      .single()
    setUser(data as AuthUser | null)
    setLoading(false)
  }

  useEffect(() => {
    // 1. Verificar sesión existente al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      loadUser(session)
    })

    // 2. Escuchar cambios de auth (login / logout / refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(s)
        loadUser(s)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
