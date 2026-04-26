// URL y anon key del proyecto Supabase. Ambas son públicas por diseño
// (la anon key se incrusta en el bundle del navegador), pero las leemos
// de variables de entorno para no acoplarnos a un proyecto específico.
//
// Configuración requerida (.env.local en dev, Vercel project settings en prod):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variable de entorno ${name} no definida. Ver .env.example`)
  }
  return value
}

export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
)

export const SUPABASE_ANON_KEY = required(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
