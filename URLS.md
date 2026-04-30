# URLs del proyecto apptech

Sistema de licencias y asignaciones técnicas (Snel). Stack: Next.js 16 +
Supabase + Resend + Vercel.

## Producción

| Servicio | URL |
|---|---|
| Sitio público | https://tech.snelapp.com |
| Supabase project | https://deouxnumhspmollumsoz.supabase.co |
| Supabase Studio (admin SQL) | https://supabase.com/dashboard/project/deouxnumhspmollumsoz |
| Vercel deploy | (configurado en `.vercel/project.json`) |

---

## Rutas frontend (UI)

### Públicas

| Ruta | Quién entra | Propósito |
|---|---|---|
| `/` | Logueado (técnico/admin) | Home — formulario técnico. Cliente → redirect a `/portal` |
| `/login` | Anónimo | Login con email/password (Supabase Auth) |
| `/registro` | Anónimo (con PIN) | Registro de usuario nuevo, requiere PIN de acceso |
| `/recuperar` | Anónimo | Solicitar reset de password (email vía Resend) |
| `/reset-password` | Anónimo (con token) | Página de cambio de password desde link de email |
| `/cambiar-password` | Logueado con `mustChangePassword=true` | Cambio forzado de password en primer login |
| `/offline` | PWA fallback | Página offline cuando no hay red |

### Cliente final

| Ruta | Quién entra | Propósito |
|---|---|---|
| `/portal` | Logueado rol `cliente` | Lista de informes técnicos del cliente. Filtros por ciudad / ubicación |
| `/informe` | Cliente | Detalle de un informe específico |

### Equipo / técnicos

| Ruta | Quién entra | Propósito |
|---|---|---|
| `/equipo/[id]` | **Anónimo (público vía QR)** | Historial técnico de un equipo. El `id` es el `qr_code` del equipo. Server component que usa `SUPABASE_SERVICE_ROLE_KEY` para saltarse RLS y mostrar todos los informes a quien escanee el QR. Soporta fallback de QR antiguos (busca por sufijo `%-EQ-0001`). NO existe `/equipo` (listado) — solo el detalle por ID |
| `/asignacion/[token]` | Anónimo (token único) | Formulario de asignación pública — el técnico entra con un token, no requiere login |
| `/form/[token]` | Anónimo (token único) | Formulario técnico público — captura de datos en campo sin login |

### Admin

| Ruta | Quién entra | Propósito |
|---|---|---|
| `/admin` | Logueado rol `admin` | Panel principal de administración |
| `/admin/configuracion` | Admin | Configuración del sistema |
| `/admin/informes` | Admin | Gestión de informes técnicos |
| **`/admin/licencias`** | **Super-admin** | **Gestión de licencias / empresas** — crear, suspender, expirar. Auth con `SUPERADMIN_KEY` (cookie httpOnly firmado con HMAC). Inactividad: 30 min → logout |

---

## APIs (REST endpoints internos)

Base URL: `https://tech.snelapp.com/api`

### Públicas (sin auth, validadas por token / RPC Supabase)

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/submit-asignacion` | El técnico envía la asignación desde `/asignacion/[token]` |
| POST | `/api/submit-informe-token` | Envío de informe desde token público |
| POST | `/api/send-email` | Envía email transaccional (Resend) — invitaciones, reset password |
| POST | `/api/siguiente-qr` | Próximo número consecutivo + QR |
| GET | `/api/peek-consecutivo` | Lee el próximo consecutivo sin avanzarlo |

### Auth super-admin

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/superadmin-auth` | Login del super-admin con `SUPERADMIN_KEY` → setea cookie httpOnly firmado |
| POST | `/api/superadmin-logout` | Borra la cookie de sesión super-admin |
| GET | `/api/superadmin/empresas` | Lista todas las empresas/licencias (requiere cookie super-admin) |
| POST | `/api/superadmin/empresas` | Crea una nueva empresa con su `license_key` (formato `IONENERGY-XXXX-XXXX-XXXX`) |
| PATCH | `/api/superadmin/empresas/[id]` | Actualiza empresa: activar/desactivar, cambiar fecha de expiración, regenerar key |

### Gestión de usuarios (rol admin)

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/listar-usuarios` | Lista usuarios del sistema |
| POST | `/api/crear-usuario` | Crea usuario con email + password temporal (forza cambio en primer login) |
| POST | `/api/eliminar-usuario` | Elimina usuario |
| POST | `/api/clear-must-change-password` | Limpia el flag `must_change_password` después de actualizar |

---

## Variables de entorno

Ver `.env.example` para los placeholders. Resumen:

### Supabase

```
NEXT_PUBLIC_SUPABASE_URL=https://deouxnumhspmollumsoz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...     # público — está en el bundle
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...         # SERVER ONLY — bypassa RLS
```

### Super-admin

```
SUPERADMIN_KEY=<cambiar>     # Clave maestra de /admin/licencias.
                             # Sirve también como secreto HMAC del cookie.
```

### Email transaccional

```
RESEND_API_KEY=re_...        # Resend (envío de invitaciones, reset password)
```

### Site URL

```
NEXT_PUBLIC_SITE_URL=https://tech.snelapp.com    # usado en password-reset redirects
```

---

## Sistema de licencias — flujo completo

1. **Super-admin entra a `/admin/licencias`** y se autentica con `SUPERADMIN_KEY`.
2. **Crea una empresa** (cliente) con un `license_key` autogenerado (`IONENERGY-XXXX-XXXX-XXXX`, charset sin caracteres ambiguos).
3. La empresa puede tener **fecha_expiracion** (vencimiento) y un flag **activa** (suspendida/no).
4. **Validación pública** vía RPC Supabase `validar_licencia(key)` — el cliente la consulta sin necesidad de service role.
5. Toggle de licencia: el super-admin puede activar/desactivar o cambiar la fecha de expiración (`PATCH /api/superadmin/empresas/[id]`).

### Tabla principal

```
empresas {
  id                 uuid
  nombre             text
  nombre_comercial   text | null
  license_key        text UNIQUE   -- formato IONENERGY-XXXX-XXXX-XXXX
  activa             boolean
  fecha_expiracion   date | null   -- null = sin vencimiento
  created_at         timestamp
}
```

### Roles del sistema

| Rol | Acceso |
|---|---|
| `cliente` | Solo `/portal` y `/informe` |
| `tecnico` | Home `/`, `/equipo`, formularios |
| `admin` | Home + `/admin/*` |
| `super-admin` | Cookie httpOnly aparte — solo `/admin/licencias` y APIs `/api/superadmin/*` |

---

## PWA / offline

- Service Worker registrado por `next-pwa` (config en `next.config.ts`).
- Caché de Supabase REST: NetworkFirst con TTL 24h (64 entries).
- Caché de Supabase Storage: StaleWhileRevalidate con TTL 7d (PDFs / logos).
- Fallback offline: `/offline` page.

---

## Migraciones de BD

Las migraciones SQL están en `supabase/migrations/` y se aplican manualmente
desde **Supabase Studio → SQL Editor**. Ver `supabase/README.md` para el
orden y los pre-requisitos (ej. `0001_enable_rls.sql` requiere backup previo
y todas las env vars de Supabase configuradas).

Funciones helper PL/pgSQL relevantes:
- `current_empresa_id()` — empresa del usuario actual (RLS)
- `current_user_role()` — rol del usuario actual
- `current_client_company()` — empresa del cliente logueado
- `validar_form_token(token)` — valida token público de formulario
- `validar_asignacion(token)` — valida token de asignación
- `validar_licencia(key)` — valida `license_key`

---

_Última actualización generada automáticamente al auditar el proyecto._
