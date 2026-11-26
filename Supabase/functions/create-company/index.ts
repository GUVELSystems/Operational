// create-company — alta de una empresa cliente (solo administradores de la empresa madre).
// POST { name, slug, ownerEmail, ownerFirstName, ownerLastName, lang? }  con  Authorization: Bearer <JWT del admin de plataforma>
// 1) platform_create_company (RLS/permisos en SQL: aborta si el llamador no es admin de plataforma; guarda SOLO el hash del token)
// 2) crea el hostname operational.<slug>.<dominio> en Cloudflare (si falla, la empresa queda con domain_status = 'error' y se puede reintentar)
// 3) envía el correo con el enlace al primer owner. Si el correo falla, el enlace se devuelve SOLO a este administrador para que lo comparta.
import { adminClient, hostFor, HttpError, inviteLink, json, newToken, rpcError, serve, sha256, userClient, validEmail, validSlug } from '../_shared/lib.ts';
import { sendInviteMail } from '../_shared/mail.ts';
import { createHostname } from '../_shared/cloudflare.ts';

serve(async (req) => {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim(), slug = String(b.slug ?? '').trim().toLowerCase(), email = String(b.ownerEmail ?? '').trim().toLowerCase();
  const first = String(b.ownerFirstName ?? '').trim(), last = String(b.ownerLastName ?? '').trim();
  if (!name) throw new HttpError(400, 'Enter the company name.', 'invalid');
  if (!validSlug(slug)) throw new HttpError(400, 'Use only lowercase letters, numbers and hyphens for the address (some names are reserved).', 'invalid');
  if (!validEmail(email)) throw new HttpError(400, 'Enter the email of the first owner.', 'invalid');
  if (!first || !last) throw new HttpError(400, 'Enter the first name and last name.', 'invalid');

  const user = userClient(req), token = newToken();
  const { data: companyId, error } = await user.rpc('platform_create_company', { p_name: name, p_slug: slug, p_owner_email: email, p_owner_first: first, p_owner_last: last, p_token_hash: await sha256(token) });
  if (error) rpcError(error);

  const admin = adminClient(); let domain: 'active' | 'pending' | 'error' | 'skipped' = 'pending', domainError: string | undefined;
  try { const h = await createHostname(hostFor(slug)); domain = h.state; }
  catch (e) { domain = 'error'; domainError = String(e).slice(0, 200); console.error('hostname', e); }
  if (domain !== 'skipped') await admin.from('companies').update({ domain_status: domain === 'active' ? 'active' : domain === 'error' ? 'error' : 'pending' }).eq('id', companyId);

  const link = inviteLink(slug, token);
  const sent = await sendInviteMail({ to: email, firstName: first, companyName: name, role: 'owner', link, days: 7, lang: b.lang === 'en' ? 'en' : 'es' });
  return json(req, { companyId, hostname: hostFor(slug), domain, domainError, emailSent: sent, inviteLink: sent ? undefined : link });
});
