'use client'
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { supabase, Usuario, Empresa } from './supabase'
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
  const inflightRef = useRef(false)   // evita queries concurrentes
  const lastUserIdRef = useRef<string | null>(null) // evita recargar el mismo usuario

  async function loadUser(s: Session | null) {
    if (!s) { setUser(null); setLoading(false); lastUserIdRef.current = null; return }

    // Si ya cargamos este usuario, no repetir
    if (lastUserIdRef.current === s.user.id && !inflightRef.current) return

    // Si hay una query en vuelo, ignorar este evento (llegará otro cuando termine)
    if (inflightRef.current) return

    // Si el token ya expiró en INITIAL_SESSION, esperar al TOKEN_REFRESHED
    const tokenExpired = s.expires_at ? s.expires_at * 1000 < Date.now() : false
    if (tokenExpired) return

    inflightRef.current = true
    setLoading(true)

    const { data, error } = await supabase
      .from('usuarios')
      .select('*, empresa:empresas(*)')
      .eq('id', s.user.id)
      .single()

    if (!error && data) {
      lastUserIdRef.current = s.user.id
      setUser(data as AuthUser)
    } else {
      setUser(null)
      lastUserIdRef.current = null
    }

    setLoading(false)
    inflightRef.current = false
  }

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadUser(s)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
        lastUserIdRef.current = null
        inflightRef.current = false
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    lastUserIdRef.current = null
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
