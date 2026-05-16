// Email service — logs to console in dev (replace with Resend/SendGrid in production)
export async function sendEmail({ to, subject, template, data }) {
  console.log(`[email] To: ${to} | Subject: ${subject} | Template: ${template}`);
  return { success: true, messageId: `dev-${Date.now()}` };
}
export async function sendWelcomeEmail(user) {
  return sendEmail({ to: user.email, subject: 'Welcome to ALP Platform', template: 'welcome', data: user });
}
export async function sendPasswordResetEmail(email, token) {
  console.log(`[email] Password reset token for ${email}: ${token}`);
  return sendEmail({ to: email, subject: 'Reset your ALP password', template: 'reset', data: { token } });
}
