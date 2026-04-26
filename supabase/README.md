# Supabase migrations

SQL aplicado a la BD de producción de apptech (`deouxnumhspmollumsoz.supabase.co`).
Estos archivos no se ejecutan automáticamente — hay que pegarlos en
**Supabase Studio → SQL Editor** y darle Run.

## Orden de aplicación

Numerados. Aplicar en orden ascendente. Si algún `0001_*.sql` falla por la
mitad, ejecutar inmediatamente el `0001_rollback.sql` correspondiente.

## 0001_enable_rls.sql — Multi-tenant hardening

Activa Row Level Security en las 9 tablas multi-tenant + el bucket `reportes`.
Crea funciones helper (`current_empresa_id`, `current_user_role`,
`current_client_company`) y RPCs públicas (`validar_form_token`,
`validar_asignacion`, `validar_licencia`) para reemplazar las queries directas
que el cliente hacía con la anon key.

### Pre-requisitos antes de aplicar

1. **Backup**: Supabase Dashboard → Database → Backups → Create backup.
2. **Variables de entorno requeridas** en Vercel y `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` (público — antes hardcoded)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (público — antes hardcoded)
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — RLS no aplica)
   - `SUPERADMIN_KEY` (server only — clave maestra de `/admin/licencias`,
     ahora también firma el cookie de sesión del super-admin)
   Si faltan las dos primeras, la app no arranca (el helper `lib/supabase-config`
   lanza error de inicio). Ver `.env.example`.
3. **Desplegar primero el código**: la nueva versión de `lib/supabase.ts`
   llama a las RPCs nuevas. Si aplicás la migración antes que el deploy,
   el registro y los formularios públicos se rompen.

### Pasos

```
1. Deploy de los cambios de código a producción.
2. Pegar 0001_enable_rls.sql en SQL Editor → Run.
3. Smoke test (ver checklist abajo).
4. Si algo falla, pegar 0001_rollback.sql → Run.
```

### Checklist de smoke test (post-aplicación)

Probar cada uno de estos flujos. Si alguno falla, rollback inmediato.

- [ ] **Login** con usuario admin existente — entra al dashboard.
- [ ] **Login** con usuario tecnico — ve solo su empresa.
- [ ] **Login** con usuario cliente (rol cliente) — portal muestra solo
      informes de `client_company` correspondiente.
- [ ] **Registro nuevo** con license_key válida — crea cuenta y asigna rol
      correcto (admin si es el primero, tecnico si ya hay admin).
- [ ] **Registro con licencia inválida** — error claro.
- [ ] **Form público** `/form/[token]` — carga la pantalla con datos de la
      empresa (logo, nombre).
- [ ] **Asignación pública** `/asignacion/[token]` — igual.
- [ ] **Crear informe** desde admin/tecnico — se guarda con `empresa_id`.
- [ ] **Listar informes** desde admin — solo ve los suyos.
- [ ] **Subir PDF a Storage** — sube al folder `{empresa_id}/...`.
- [ ] **Recuperación de password** — el RPC `email_registrado` funciona.
- [ ] **Panel super-admin** `/admin/licencias` — lista, crea, renueva,
      activa/desactiva empresas (vía nuevas API routes).
- [ ] **Aislamiento**: con dos empresas distintas, verificar desde DevTools
      que un usuario de empresa A no puede leer datos de empresa B aunque
      manipule queries.

### Riesgos conocidos

- **Storage bucket `reportes`**: si está marcado como público, la lectura es
  abierta (cualquiera con el URL puede ver el PDF). Las policies aquí solo
  protegen escrituras. Para protección de lectura, hay que volver el bucket
  privado y usar `signed URLs` — fuera del alcance de esta migración.
- **`email_registrado`**: el script lo redefine como SECURITY DEFINER. Si
  ya existía con otro cuerpo, este lo sobrescribe. Verificar que la firma
  `(text) → boolean` coincide con la versión previa.

### Cambios de seguridad que NO requieren SQL

Aplicados en el mismo PR pero independientes de la migración:

- **Super-admin: cookie httpOnly firmado** (HMAC-SHA256, TTL 15 min) en lugar
  de mandar la master password en cada request. La clave nunca se guarda
  en sessionStorage. Endpoints: `/api/superadmin-auth` (login),
  `/api/superadmin-logout` (logout), y los `/api/superadmin/*` que verifican
  el cookie.
- **Anon key + URL movidas a env vars**: `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ya no hay strings de Supabase en el
  código. El helper `lib/supabase-config.ts` valida que existan al
  iniciar.
