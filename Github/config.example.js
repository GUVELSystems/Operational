// config.example.js — copia este archivo como config.js (en la raíz de la app) para activar el modo NUBE (Supabase).
// Sin config.js el portal funciona en modo local con datos simulados en el navegador.
// En producción NO se escribe a mano: deploy.yml lo genera con los secretos SUPABASE_URL y SUPABASE_ANON_KEY.
// La llave anon es PÚBLICA (la seguridad la dan las políticas RLS). NUNCA pongas aquí la service_role.
window.GUVEL_CONFIG = {
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...tu-llave-anon...'
};
