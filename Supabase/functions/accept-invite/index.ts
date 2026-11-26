// accept-invite — acepta una invitación (SIN sesión previa; verify_jwt = false en config.toml).
// POST { slug, token, password, firstName, lastName }
//   • slug  = empresa del subdominio desde el que se abrió el enlace (el front lo toma del host).
//   • El token debe corresponder a ESA empresa; si no, se rechaza (un enlace de la empresa A no sirve en el subdominio de B).
// Flujo: valida (get_invitation) → crea el usuario en Auth con el correo de la invitación (email_confirm = true: abrir el enlace recibido por
// correo ya demuestra que es suyo) → consume la invitación (membresía + marca de uso, atómico) → el front inicia sesión con signInWithPassword.
// Si ese correo YA tiene cuenta (p. ej. pertenece a otra empresa) no se cambia su contraseña: se responde { existingUser: true } y el front le pide
// iniciar sesión con la suya y volver a llamar con su Authorization (se verifica que el correo coincida).
import { adminClient, HttpError, json, rpcError, serve, sha256, userClient } from '../_shared/lib.ts';

serve(async (req) => {
  const b = await req.json().catch(() => ({}));
  const slug = String(b.slug ?? '').trim().toLowerCase(), token = String(b.token ?? ''), password = String(b.password ?? '');
  const first = String(b.firstName ?? '').trim(), last = String(b.lastName ?? '').trim();
  if (!slug || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'This invitation link is not valid.', 'invalid');
  if (!first || !last) throw new HttpError(400, 'Enter the first name and last name.', 'invalid');

  const admin = adminClient(), hash = await sha256(token);
  const { data: rows, error } = await admin.rpc('get_invitation', { p_slug: slug, p_token_hash: hash });
  if (error) rpcError(error);
  const inv = rows?.[0];
  if (!inv) throw new HttpError(404, 'This invitation link is not valid.', 'invalid');           // no existe o es de otra empresa
  if (inv.state === 'used') throw new HttpError(410, 'This invitation was already used.', 'used');
  if (inv.state === 'revoked') throw new HttpError(410, 'This invitation was cancelled.', 'revoked');
  if (inv.state === 'expired') throw new HttpError(410, 'This invitation has expired.', 'expired');

  // ¿Llega con la sesión de un usuario existente? (con la llave anon como Bearer, getUser() falla y se ignora)
  let userId: string | null = null;
  if (req.headers.get('Authorization')) {
    const { data } = await userClient(req).auth.getUser();
    if (data.user && data.user.email?.toLowerCase() === inv.email) userId = data.user.id;   // el correo debe coincidir con el de la invitación
  }
  if (!userId) {
    if (password.length < 8) throw new HttpError(400, 'Use at least 8 characters for the password.', 'invalid');
    const created = await admin.auth.admin.createUser({ email: inv.email, password, email_confirm: true, user_metadata: { first_name: first, last_name: last } });
    if (created.error) {
      if (/already|registered|exists/i.test(created.error.message)) return json(req, { existingUser: true, email: inv.email }, 200);   // que inicie sesión y reintente
      console.error('createUser', created.error); throw new HttpError(500, 'Something went wrong. Please try again.');
    }
    userId = created.data.user.id;
  }
  const { data: role, error: e2 } = await admin.rpc('consume_invitation', { p_slug: slug, p_token_hash: hash, p_user: userId, p_first: first, p_last: last });
  if (e2) { console.error('consume', e2); throw new HttpError(409, 'This invitation can no longer be used.', 'invalid'); }
  return json(req, { ok: true, email: inv.email, role });          // el front: supabase.auth.signInWithPassword({ email, password })
});
