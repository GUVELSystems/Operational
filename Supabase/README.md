# GUVEL Operational System — multi-empresa (Supabase + GitHub)

Dirección de cada empresa: `operational.<empresa>.guvelsystems.com`  (primera: `operational.metricsworkssaltillo.guvelsystems.com`).
`operational.guvelsystems.com` (sin empresa) muestra "Elige tu empresa".

## Principio de seguridad
El subdominio **solo identifica** la empresa en pantalla. Lo que impide que una empresa vea datos de otra es **RLS en Supabase**
(`migrations/0001` y `0002`): `company_id` en cada tabla, llaves foráneas compuestas `(company_id, id)` y políticas que usan
`auth.uid()` + membresía activa + empresa activa. Cambiar el subdominio, el `company_id` en una petición o el `localStorage` no da acceso a nada.

## Flujo de entrada
1. El navegador abre `operational.<slug>.guvelsystems.com`; el front toma `<slug>` del host (en el prototipo: `js/tenant.js`).
2. `resolve_company(slug)` (función pública, devuelve solo id/nombre/slug/estado) → si no existe: "Empresa no encontrada"; si está
   `suspended`/`terminated`: pantalla de bloqueo (sin login).
3. Login con Supabase Auth. Después, `my_membership(slug)` debe devolver una fila; si no, se cierra la sesión ("no tiene acceso a esta empresa").
   El **rol sale siempre de la membresía**, nunca de lo que mande el navegador.
4. Todas las consultas pasan por RLS; si luego se suspende la empresa, el siguiente request ya no devuelve datos.

## DNS, certificados y hosting (lo que implica tu formato de dominio)
- Un comodín DNS/TLS solo cubre **una** etiqueta a la izquierda: `*.guvelsystems.com` **no** cubre `operational.<empresa>.guvelsystems.com`.
  Por eso, **cada empresa nueva necesita su registro DNS y su certificado** (automatizable desde el módulo Empresa).
- **GitHub Pages no sirve** para esto (un dominio personalizado por sitio). Recomendado: dejar el código en GitHub y publicar con
  un **Cloudflare Worker** con *Custom Domains*: al crear una empresa, `create-company` lo agrega al Worker por API y Cloudflare crea el DNS y emite el certificado solo.
- Supabase Auth → *URL Configuration*: agregar `https://operational.*.guvelsystems.com/**` en Redirect URLs (verificar que el comodín
  acepte una etiqueta en tu versión) y `https://operational.guvelsystems.com/**` como Site URL.
- Cada subdominio es un origen distinto: la sesión y el `localStorage` no se comparten entre empresas (comportamiento deseado).
- Alta de empresa = (1) fila en `companies` con `slug`, (2) hostname en Cloudflare, (3) primer owner en `memberships`. Suspender = `status='suspended'`.

## Empresa madre (GUVEL Systems) y alta de empresas
- La empresa madre es una fila de `companies` con `is_platform = true` (slug reservado `guvel`). Se abre en **`operational.guvelsystems.com`** (sin subdominio de empresa).
  Sus owners/admins son los administradores de plataforma. Ven y administran **empresas y usuarios**, pero **no** los datos de producción de ninguna empresa.
- Primera vez (una sola, en el SQL Editor): crear la empresa madre y tu usuario (comandos al final de `0003`).
- **Alta de una empresa (módulo Companies):** nombre + nombre de dirección (`metricsworkssaltillo`) + correo del primer owner →
  Edge Function `create-company`: (1) `platform_create_company(...)` crea la empresa y la invitación del owner (guarda solo el hash del token),
  (2) crea el hostname en Cloudflare (`domain_status = pending → active` por webhook), (3) envía el correo con el enlace.
- **Suspender / dar de baja:** `platform_set_company_status(...)`; surte efecto al siguiente request porque RLS exige `companies.status = 'active'`.

## Usuarios e invitaciones (token)
1. Owner/admin de la empresa invita desde **Users** (correo + rol). La Edge Function genera un token de 32 bytes, guarda su SHA-256 (`create_invitation`) y envía
   `https://operational.<empresa>.guvelsystems.com/#/invite/<token>`. Caduca a los 7 días y se usa una sola vez; "Resend" revoca el anterior y crea otro.
2. La persona abre el enlace → el front pide `get_invitation(slug, sha256(token))` → muestra "Únete a <empresa>" (o "usada / caducada / cancelada").
3. Crea su contraseña → Edge Function `accept-invite` (service role): valida el hash, crea o confirma el usuario en Supabase Auth con ese correo, llama a
   `private.consume_invitation(...)` (crea la membresía y marca la invitación como usada, atómico) y devuelve la sesión.
4. El rol sale de la membresía. Un admin no puede invitar ni modificar owners; nadie puede cambiarse su propio rol ni deshabilitarse.

## Edge Functions (`functions/`)
| Función | Quién la llama | Qué hace |
|---|---|---|
| `create-company` | admin de plataforma (JWT) | `platform_create_company` → hostname en Cloudflare → correo al primer owner (nombre y apellido incluidos) |
| `invite-user` | owner/admin de la empresa (JWT) | `create_invitation` (permiso en SQL) → correo con enlace. Reenviar = llamarla otra vez (revoca el enlace anterior) |
| `accept-invite` | cualquiera con el enlace (sin JWT) | valida el token contra el slug del subdominio → crea el usuario → `consume_invitation` |
Compartido en `functions/_shared/`: `lib.ts` (CORS, clientes, tokens SHA-256, errores), `mail.ts` (Resend ES/EN), `cloudflare.ts` (DNS + Custom Hostnames).
El **token en claro** solo existe en el correo y en la URL; la base guarda su SHA-256. El enlace solo se devuelve al navegador de quien invita si el correo no pudo enviarse.

## Puesta en marcha paso a paso
1. **Proyecto**: crea el proyecto en Supabase (región cercana) y guarda `Project ref`, `anon key`, `service_role key` (esta última nunca sale de Supabase).
2. **Esquema**: instala el CLI, copia esta carpeta como `supabase/` del repo y ejecuta `supabase link --project-ref <ref>` y `supabase db push` (aplica 0001 → 0003).
3. **Empresa madre**: en el SQL Editor, crea tu usuario en Authentication → Users, y corre los dos `insert` comentados al final de `0003`.
4. **Secretos de funciones**: copia `.env.example` a `.env`, rellénalo y ejecuta `supabase secrets set --env-file ./supabase/.env`.
5. **Funciones**: `supabase functions deploy create-company`, `invite-user` y `accept-invite` (`config.toml` ya fija `verify_jwt` de cada una).
6. **Correo**: en Resend verifica el dominio `guvelsystems.com` (registros SPF/DKIM en Cloudflare) y pon `RESEND_API_KEY` / `MAIL_FROM`.
7. **Cloudflare**: ver `Github/README.md` (sección Worker): crea un token de API (*Workers Scripts: Edit* + *DNS: Edit*) y completa `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID`, `CF_WORKER_NAME`.
8. **Auth**: `config.toml` desactiva el registro libre; revisa en Authentication → URL Configuration el Site URL y el Redirect URL comodín.
9. **Prueba**: corre `tests/isolation.sql`, crea una empresa de prueba desde la consola Companies, acepta la invitación con otro correo y confirma que ve solo lo suyo.

## Pruebas
- `tests/run-local.mjs` — corre **todas** las migraciones y pruebas en tu PC sin Docker ni cuenta (PGlite = Postgres en WASM). Una vez: `cd tests && npm init -y && npm i @electric-sql/pglite`; luego `node run-local.mjs`.
- `tests/isolation.sql` (aislamiento entre empresas), `tests/production.sql` (sesiones, horas, consolidar, reglas de miembros), `tests/invites.sql` (empresa madre, tokens, suspensión).
- La CI (`Github/.github/workflows/ci.yml`) repite las tres contra un Supabase local real en cada Pull Request.
- Estas pruebas ya encontraron y corrigieron un hueco real: un `NULL` en una condición de permisos (`NOT NULL` no bloquea) dejaba invitar a otra empresa.

## Archivos
- `migrations/0004_production_rpcs.sql` — funciones de producción (SECURITY INVOKER) y de miembros (reglas: admin no toca owners, nadie se cambia a sí mismo, siempre queda un owner).
- `config.toml`, `.env.example` — ajustes del CLI y plantilla de secretos.
- `functions/` — Edge Functions (arriba).
- `migrations/0001_tenancy.sql` — empresas, membresías, funciones RLS, `resolve_company`, `my_membership`.
- `migrations/0002_domain_rls.sql` — tablas del negocio con FK compuestas, políticas por rol y bloqueo de `company_id`.
- `migrations/0003_platform_invites.sql` — empresa madre, invitaciones con token (hash), alta/suspensión de empresas y aceptación.
- `tests/isolation.sql` — prueba de aislamiento (dos empresas, transacción con ROLLBACK). Ejecutar en un proyecto de PRUEBA.

## Antes de producción (pendiente)
- [ ] Ejecutar `tests/isolation.sql` en el proyecto nuevo y agregarlo al CI (debe fallar el despliegue si algo se filtra).
- [ ] Validar la matriz de roles de `0002` (`private.can_write`) contra la del prototipo (`G.PERMS`).
- [ ] Migrar las funciones transaccionales (`saveHour`, `consolidateAndFinish`, `startSession`…) como `SECURITY INVOKER`.
- [ ] Módulo Usuarios: invitaciones y cambios de rol solo vía funciones/backend (no hay políticas de escritura en `memberships`).
- [ ] Nunca poner la llave `service_role` en el front; solo la `anon` (pública).
- [ ] Plantas dentro de una empresa: NO implementado. Si se necesita: tabla `plants (company_id, id)` + `plant_id` con FK compuesta y política por planta.
