# GUVEL Operational System — repositorio (GitHub)

Esta carpeta es el **área de preparación del repositorio nuevo de GitHub**. Aquí vive todo lo que irá a GitHub además del código de la aplicación:
flujos de CI/CD, `.gitignore`, cabeceras de seguridad y la guía de publicación. La carpeta hermana `../Supabase/` tiene lo que va a Supabase.

## Estructura final del repositorio

```
guvel-operational/                  ← raíz del repo nuevo
├─ index.html, css/, js/, assets/   ← la aplicación (hoy en ../prototipo; se copia al pasar a Supabase)
├─ config.js                        ← SUPABASE_URL y SUPABASE_ANON_KEY (públicas); se genera en el deploy, NO se versiona
├─ _headers                         ← cabeceras de seguridad (las aplica el Worker)    ← viene de Github/_headers\n├─ worker/                          ← Worker guvel-operational (wrangler.jsonc + src)  ← viene de Github/worker/
├─ supabase/                        ← migraciones, funciones y pruebas                  ← viene de ../Supabase/ (en minúsculas)
├─ .github/workflows/               ← ci.yml y deploy.yml                              ← vienen de Github/.github/workflows/
├─ .gitignore                       ← viene de Github/.gitignore
└─ README.md
```

> El CLI de Supabase exige la carpeta en minúsculas (`supabase/`). Aquí se llama `Supabase` solo como área de trabajo; al armar el repo se copia como `supabase/`.

## Modo local vs. modo nube (la app)
La app decide sola al arrancar: si existe `config.js` (ver `config.example.js`) usa **Supabase**; si no, sigue en **modo local** con datos simulados.
- `js/cloud.js` — cliente de Supabase, inicio de sesión, resolución de la empresa por subdominio y llamadas a las Edge Functions.
- `js/db-cloud.js` — adaptador de `G.db` con la misma interfaz que el simulador: descarga las tablas de la empresa (RLS filtra), escribe primero a la base y
  usa las funciones SQL de `0004` para sesiones y horas. Ninguna página cambió.
- Al copiar la app al repo: incluir `js/cloud.js`, `js/db-cloud.js` y el `<script>` de `supabase-js` de `index.html` (versión fija).

## Cloudflare: Worker `guveloperational` y subdominios por empresa
Hosts: `operational.guvelsystems.com` = empresa madre (GUVEL Systems) · `operational.<empresa>.guvelsystems.com` = cada empresa cliente.
- **Worker** (`worker/`): sirve los archivos de la app en esos hosts; el resto de hosts de la zona pasa al origen como hasta hoy. Aún **no está desplegado**.
- **Route**: la de `operational.guvelsystems.com/*` solo cubre la raíz. Las empresas necesitan además `*.guvelsystems.com/*` (el comodín solo puede ir al inicio); ya está en `worker/wrangler.jsonc`.
- **Por cada empresa nueva** `create-company` agrega `operational.<empresa>.guvelsystems.com` como **Custom Domain del Worker** (API de Workers → Domains). Cloudflare crea solo el registro DNS (tipo Worker) y el certificado, también de dos niveles. Es el mismo patrón que ya usa la app Quality (`quality.metricsworkssaltillo.guvelsystems.com`). No hace falta Cloudflare for SaaS.

Preparación única en Cloudflare (la haces tú):
1. **Token de API** (My Profile → API Tokens) con permisos *Account → Workers Scripts: Edit* y *Zone guvelsystems.com → DNS: Edit*. Con él se llenan `CF_API_TOKEN`, `CF_ACCOUNT_ID` y `CF_ZONE_ID` en `Supabase/.env` (`CF_WORKER_NAME=guveloperational`). El token no se pega en chats ni en el repo.
2. **Empresa madre:** `operational.guvelsystems.com` se agrega una sola vez como Custom Domain del Worker (Workers → guveloperational → Domains → Add), después de probar.

**Orden recomendado:** (1) primer deploy sin dominios (solo `workers.dev`); (2) probar ahí; (3) crear una empresa de prueba desde la consola de GUVEL; (4) solo entonces tomar `operational.guvelsystems.com`. Antes hay que desactivar GitHub Pages y borrar el `CNAME` del repo, porque Pages reclama ese dominio.

**Sophos / filtro web de la empresa:** un nombre nuevo suele caer en "sin categoría". Pide a TI permitir `*.guvelsystems.com` (con el formato de dos niveles hace falta ese comodín completo) o enviar la recategorización a Sophos. Los usuarios finales de cada empresa pueden tener el mismo problema con su propio filtro: conviene avisarles la dirección que deben permitir.

## Cómo se publica (resumen)
| Qué | Dónde | Cómo |
|---|---|---|
| Aplicación (HTML/CSS/JS) | **Cloudflare Worker `guveloperational`** | Integración GitHub de Cloudflare (Workers Builds): `node worker/build.mjs` + `npx wrangler deploy --config worker/wrangler.jsonc` en cada push a `main`. Variables de build: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. El primer deploy va **sin routes** (solo `workers.dev`); las routes se descomentan después |
| Base de datos (migraciones) | Proyecto Supabase | `supabase db push` desde `deploy.yml` |
| Edge Functions | Proyecto Supabase | `supabase functions deploy` desde `deploy.yml` |
| Dominios por empresa | Cloudflare (Custom Domains del Worker) | los crea la función `create-company` al dar de alta |

GitHub Pages **no** se usa: no admite un subdominio distinto por empresa (`operational.<empresa>.guvelsystems.com`). Se usa el Worker de arriba.

## Secretos del repositorio (GitHub → Settings → Secrets and variables → Actions)
| Secreto | Para qué |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | desplegar migraciones y funciones (token personal del CLI) |
| `SUPABASE_PROJECT_REF` | id del proyecto Supabase |
| `SUPABASE_DB_PASSWORD` | `supabase db push` |
| (Cloudflare, no GitHub) `SUPABASE_URL` / `SUPABASE_ANON_KEY` | variables de build del Worker; `build.mjs` las escribe en `config.js` (la anon key es pública) |

Nunca subas: `service_role`, `RESEND_API_KEY`, `CF_API_TOKEN` ni ningún `.env`. Esos viven como *secrets* de Supabase (`supabase secrets set`).

## Flujo de trabajo
1. Trabajas en una rama → abres Pull Request → `ci.yml` valida: sintaxis JS, tipos de las funciones y **la prueba de aislamiento entre empresas** en una base local.
2. Si la prueba de aislamiento falla, el PR no se puede fusionar (activar *branch protection* con el check `isolation` obligatorio).
3. Fusionas a `main` → `deploy.yml` aplica migraciones, despliega funciones y publica la app.

## Pendiente antes del primer deploy
- [ ] Crear el repo en GitHub y activar la protección de la rama `main`.
- [ ] Crear el proyecto Supabase y copiar sus claves a los secretos.
- [ ] Conectar el repo al Worker `guveloperational` en Cloudflare (Settings → Builds) y desactivar GitHub Pages + borrar `CNAME`.
- [x] Capa `G.db` conectable a Supabase (`js/cloud.js`, `js/db-cloud.js`) — probada contra el SQL real en un Postgres local; falta probarla contra un proyecto Supabase real.
- [ ] Probar una vez de punta a punta en un proyecto real: alta de empresa → correo → aceptar invitación → capturar producción.
