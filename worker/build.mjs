// worker/build.mjs — arma la carpeta dist/ que sirve el Worker. Lo corre Cloudflare (Workers Builds) en cada push:
//   Build command:  node worker/build.mjs
// Variables de build en Cloudflare (Worker → Settings → Build → Variables): SUPABASE_URL y SUPABASE_ANON_KEY (la anon/publishable key es pública).
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('Faltan SUPABASE_URL y/o SUPABASE_ANON_KEY en las variables de build.'); process.exit(1); }
if (/service_role|sb_secret_/i.test(SUPABASE_ANON_KEY)) { console.error('Esa llave es secreta. Usa solo la anon/publishable key.'); process.exit(1); }

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const p of ['index.html', 'css', 'js', 'assets', '_headers']) if (existsSync(p)) cpSync(p, `dist/${p}`, { recursive: true });
writeFileSync('dist/config.js', `window.GUVEL_CONFIG = ${JSON.stringify({ SUPABASE_URL, SUPABASE_ANON_KEY })};\n`);
console.log('dist listo');
