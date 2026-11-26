// invite-user — invita (o reenvía, con enlace nuevo) a una persona a una empresa.
// POST { companyId, email, firstName, lastName, role, lang? }  con  Authorization: Bearer <JWT de un owner/admin de esa empresa>
// create_invitation (SQL) decide el permiso: owner/admin de la empresa o admin de plataforma; un admin no puede invitar owners.
// Reenviar = llamar de nuevo con el mismo correo: la invitación anterior queda revocada y se crea una nueva.
import { adminClient, HttpError, inviteLink, json, newToken, rpcError, serve, sha256, userClient, validEmail } from '../_shared/lib.ts';
import { sendInviteMail } from '../_shared/mail.ts';

const ROLES = ['owner', 'admin', 'manager', 'supervisor', 'guest'];

serve(async (req) => {
  const b = await req.json().catch(() => ({}));
  const companyId = String(b.companyId ?? ''), email = String(b.email ?? '').trim().toLowerCase(), role = String(b.role ?? '');
  const first = String(b.firstName ?? '').trim(), last = String(b.lastName ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) throw new HttpError(400, 'Company not found.', 'invalid');
  if (!validEmail(email)) throw new HttpError(400, 'Enter a valid email address.', 'invalid');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Choose a role.', 'invalid');
  if (!first || !last) throw new HttpError(400, 'Enter the first name and last name.', 'invalid');

  const user = userClient(req), token = newToken();
  const { error } = await user.rpc('create_invitation', { p_company: companyId, p_email: email, p_first: first, p_last: last, p_role: role, p_token_hash: await sha256(token) });
  if (error) rpcError(error);

  const admin = adminClient();
  const { data: co } = await admin.from('companies').select('name, slug').eq('id', companyId).single();
  const { data: me } = await user.auth.getUser();
  const link = inviteLink(co!.slug, token);
  const sent = await sendInviteMail({ to: email, firstName: first, companyName: co!.name, role, link, days: 7, lang: b.lang === 'en' ? 'en' : 'es', invitedBy: me.user?.email });
  return json(req, { emailSent: sent, inviteLink: sent ? undefined : link });   // el enlace solo vuelve a quien invita si el correo no pudo enviarse
});
