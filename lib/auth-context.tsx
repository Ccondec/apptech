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
    const u = await getUsuarioActual()
    setUser(u as AuthUser | null)
    setLoading(false)
  }

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      loadUser(s)
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
