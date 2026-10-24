import nodemailer from 'nodemailer';
import { zohoTransport } from './zoho-mail.mjs';

const roleLabels = {
  SCHOOL_ADMIN: 'School administrator',
  TEACHER: 'Teacher',
  SPECIAL_EDUCATION_TEACHER: 'Special education teacher',
  THERAPIST: 'Therapist',
  PSYCHOLOGIST: 'Psychologist',
  PARENT: 'Parent / guardian',
  STUDENT: 'Student',
};

function smtpTransport(env) {
  const ready = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].every(key => env[key]);
  if (!ready) return null;
  const port = Number(env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

export function mailDelivery(env, { smtp = smtpTransport, zoho = zohoTransport } = {}) {
  const provider = env.MAIL_PROVIDER || 'smtp';
  if (!['smtp', 'zoho'].includes(provider)) throw new Error('Unsupported ALP mail provider.');
  const from = provider === 'zoho' ? env.ZOHO_FROM : env.SMTP_FROM;
  const mail = provider === 'zoho' ? zoho(env) : smtp(env);
  return from && mail ? { from, mail } : null;
}

function joinUrl(env) {
  const base = env.ALP_APP_URL || env.APP_URL || 'https://app.growwithalp.com';
  try {
    return new URL('/join', base).toString();
  } catch {
    return 'https://app.growwithalp.com/join';
  }
}

export async function sendInvitationEmail({ env, mailer, invitation }) {
  const delivery = mailer ? { from: env.MAIL_PROVIDER === 'zoho' ? env.ZOHO_FROM : env.SMTP_FROM, mail: mailer } : mailDelivery(env);
  const { from, mail } = delivery || {};
  if (!from || !mail) return { status: 'not_configured' };
  try {
    const role = roleLabels[invitation.role] || invitation.role;
    const result = await mail.sendMail({
      from,
      to: invitation.email,
      subject: `Your ALP invitation to ${invitation.schoolName}`,
      messageId: `<alp-invitation-${invitation.id}@growwithalp.com>`,
      text: `You have been invited to join ${invitation.schoolName} on ALP.\n\nAccount email: ${invitation.email}\nRole: ${role}\nInvitation code: ${invitation.token}\nExpires: ${new Date(invitation.expiresAt).toISOString()}\n\nAccept the invitation here:\n${joinUrl(env)}\n\nExisting account holders must sign in first, then use Join a school. Keep this code private.\n\nBuilt by Stan Paraclete\nhttps://www.stanparaclete.com/`,
    });
    const accepted = (result.accepted || []).some(
      address => String(address).toLowerCase() === invitation.email.toLowerCase(),
    );
    return { status: accepted ? 'sent' : 'failed' };
  } catch (error) {
    console.error('alp_invitation_email_failed', { code: error?.code || error?.name });
    return { status: 'failed' };
  }
}
