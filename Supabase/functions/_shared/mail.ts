// _shared/mail.ts — correo de invitación (Resend). Bilingüe: ES o EN según `lang`.
// Variables: RESEND_API_KEY, MAIL_FROM (p. ej. "GUVEL Systems <no-reply@guvelsystems.com>").
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface InviteMail { to: string; firstName: string; companyName: string; role: string; link: string; days: number; lang?: 'es' | 'en'; invitedBy?: string }

export function inviteHtml(m: InviteMail) {
  const es = (m.lang ?? 'es') === 'es';
  const t = es
    ? { subject: `Te invitaron a ${m.companyName} en GUVEL Operational System`, hi: `Hola ${m.firstName},`, body: `${m.invitedBy ? esc(m.invitedBy) + ' te' : 'Te'} invitó a unirte a <b>${esc(m.companyName)}</b> con el rol <b>${esc(m.role)}</b>.`, cta: 'Aceptar invitación', note: `El enlace caduca en ${m.days} días y solo se puede usar una vez. Si no esperabas este correo, ignóralo.` }
    : { subject: `You have been invited to ${m.companyName} on GUVEL Operational System`, hi: `Hi ${m.firstName},`, body: `${m.invitedBy ? esc(m.invitedBy) + ' has' : 'You have been'} invited you to join <b>${esc(m.companyName)}</b> as <b>${esc(m.role)}</b>.`, cta: 'Accept invitation', note: `The link expires in ${m.days} days and can be used once. If you did not expect this email, ignore it.` };
  const html = `<!doctype html><html><body style="margin:0;background:#EAF2F8;font-family:Segoe UI,Arial,sans-serif;color:#0F1B2D"><table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="height:6px;background:#0CC0DF"></td></tr><tr><td style="padding:28px 32px"><div style="font-size:13px;letter-spacing:.14em;font-weight:700;color:#4A6183">GUVEL OPERATIONAL SYSTEM</div><h1 style="margin:14px 0 6px;font-size:22px">${esc(t.hi)}</h1><p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#4A6183">${t.body}</p><a href="${esc(m.link)}" style="display:inline-block;background:#0F1B2D;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:12px">${t.cta}</a><p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:#7F93AE">${t.note}</p><p style="margin:10px 0 0;font-size:11.5px;color:#7F93AE;word-break:break-all">${esc(m.link)}</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: t.subject, html };
}

/** Devuelve true si el correo salió; false si falló (el llamador decide cómo avisar — nunca se registra el token) */
export async function sendInviteMail(m: InviteMail): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('MAIL_FROM');
  if (!key || !from) { console.warn('Mail not configured (RESEND_API_KEY / MAIL_FROM)'); return false; }
  const { subject, html } = inviteHtml(m);
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [m.to], subject, html }) });
  if (!r.ok) { console.error('Resend error', r.status, await r.text().catch(() => '')); return false; }
  return true;
}
