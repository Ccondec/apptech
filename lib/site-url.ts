/**
 * Helper centralizado para obtener la URL base del sitio.
 *
 * Antes había 5+ lugares con hardcodes mezclados:
 *   - 'https://tech.snelapp.com'  (la mayoría)
 *   - 'https://snelapp.com'       (1 caso, supabase.ts línea 94 — bug)
 *   - 'tech.snelapp.com'          (sin protocolo, TechnicalForm.tsx línea 3315 — bug)
 *
 * Cuando se cambió el dominio, los hardcodes quedaron desactualizados y los
 * QRs nuevos seguían apuntando al dominio viejo. Ahora todo pasa por esta
 * función — un solo cambio en `NEXT_PUBLIC_SITE_URL` ajusta toda la app.
 *
 * Estrategia:
 *   1. Si `NEXT_PUBLIC_SITE_URL` está definida → usarla. (Vercel/local)
 *   2. En el cliente sin env var → usar `window.location.origin` (lo que el
 *      navegador tenga ya garantiza el dominio correcto).
 *   3. En el servidor sin env var → fallback al dominio actual.
 *
 * Para cambiar el dominio:
 *   1. Vercel → Settings → Environment Variables → editar NEXT_PUBLIC_SITE_URL
 *   2. Redeploy (o redespliega automáticamente al cambiar la var)
 *   3. Los QRs nuevos ya saldrán con el dominio actualizado.
 *
 * Nota: los QRs ya impresos (físicos) no se pueden actualizar — son stickers
 * en sitio. Para esos casos hay que mantener un redirect 301 desde el dominio
 * viejo al nuevo. La página /equipo/[id] sigue funcionando con el mismo
 * `qr_code` independiente del dominio que escanees.
 */

const FALLBACK_URL = 'https://tech.snelapp.com'

export function getSiteUrl(): string {
  // 1. Env var (preferida — funciona igual server y client porque tiene NEXT_PUBLIC_)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/+$/, '')  // quitar trailing slash si lo trae

  // 2. Cliente — usar el origin del navegador (siempre el actual)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  // 3. Server sin env var — fallback (no debería pasar en producción)
  return FALLBACK_URL
}

/**
 * Construye la URL de un equipo a partir de su qr_code.
 *   getEquipoUrl('IONENERGY-CL3-EQ-0017')
 *   → 'https://tech.snelapp.com/equipo/IONENERGY-CL3-EQ-0017'
 */
export function getEquipoUrl(qrCode: string): string {
  return `${getSiteUrl()}/equipo/${encodeURIComponent(qrCode)}`
}

/**
 * Construye la URL de un formulario público con token.
 *   getFormUrl(tokenId)
 *   → 'https://tech.snelapp.com/form/<tokenId>'
 */
export function getFormUrl(tokenId: string): string {
  return `${getSiteUrl()}/form/${tokenId}`
}

/**
 * Construye la URL de una asignación pública con token.
 *   getAsignacionUrl(tokenId)
 *   → 'https://tech.snelapp.com/asignacion/<tokenId>'
 */
export function getAsignacionUrl(tokenId: string): string {
  return `${getSiteUrl()}/asignacion/${tokenId}`
}
