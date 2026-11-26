# Primera puesta en marcha real (Supabase) — paso a paso

Objetivo de esta primera vuelta: **probar de punta a punta en tu PC contra un proyecto Supabase real**, sin correo y sin Cloudflare todavía
(el enlace de invitación te lo muestra el portal para copiarlo). Cuando funcione, se agregan correo y subdominios.

## 1. Crear el proyecto (lo haces tú, ~3 min)
1. Entra a https://supabase.com/dashboard → **New project**.
2. Nombre: `guvel-operational` · Región: la más cercana a Saltillo (US East o US West) · **Database password**: genérala fuerte y guárdala en tu gestor de contraseñas (no se vuelve a mostrar).
3. Cuando termine de crearse, copia el **Project ref** (está en la URL: `supabase.com/dashboard/project/<ESTE-TEXTO>` y en Settings → General). El *ref* no es secreto.
4. En **Authentication → Providers → Email**: deja el correo habilitado y **apaga "Allow new users to sign up"** (nadie entra sin invitación). Deja "Confirm email" como esté.

## 2. Crear tu usuario de plataforma
En **Authentication → Users → Add user → Create new user**: tu correo, una contraseña y marca **Auto Confirm User**. Será el administrador de GUVEL Systems.

## 3. Subir el esquema y las funciones
En PowerShell, dentro de la carpeta `Supabase`:
```powershell
Copy-Item .env.example .env        # y rellena ALLOWED_ORIGINS=http://localhost:5178 (por ahora lo demás puede quedar vacío)
.\deploy.ps1 -ProjectRef <TU-REF>
```
Te pedirá iniciar sesión en Supabase (se abre el navegador) y la contraseña de la base de datos. Aplica las migraciones `0001` a `0004`, carga los secretos y despliega las 3 funciones.

## 4. Crear la empresa madre
En **SQL Editor → New query**, pega esto (cambia el correo por el del paso 2) y ejecuta:
```sql
insert into public.companies (name, slug, is_platform, domain_status) values ('GUVEL Systems', 'guvel', true, 'active');
insert into public.memberships (company_id, user_id, role, first_name, last_name, email)
  select c.id, u.id, 'owner', 'Tu nombre', 'Tu apellido', u.email
  from public.companies c, auth.users u where c.is_platform and u.email = 'TU-CORREO@EJEMPLO.COM';
```

## 5. Conectar el portal (en tu PC)
Crea el archivo `prototipo/config.js` (no se sube a GitHub) con la URL y la llave **anon** (Settings → API):
```js
window.GUVEL_CONFIG = { SUPABASE_URL: 'https://<TU-REF>.supabase.co', SUPABASE_ANON_KEY: '<llave anon>' };
```
Nunca pegues la llave `service_role` en el portal ni en el chat.

## 6. Probar
1. Abre `http://localhost:5178/?tenant=guvel` → entra con tu usuario de plataforma → **Companies → New company** (`Metrics Works Saltillo`, dirección `metricsworkssaltillo`, owner de prueba).
2. Copia el enlace de invitación que muestra el portal, ábrelo, crea la contraseña y entra al portal de la empresa.
3. Captura producción, invita a otra persona desde **Users**, suspende la empresa desde la consola y confirma que se bloquea.
