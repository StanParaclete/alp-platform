import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInvitationEmail, mailDelivery } from '../src/mail.mjs';

test('mail delivery selects Zoho without requiring SMTP and does not fall back',()=>{
  const mail={sendMail:async()=>({accepted:[]}),verify:async()=>true};
  const env={MAIL_PROVIDER:'zoho',ZOHO_FROM:'notice@example.test'};
  const factories={zoho:()=>mail,smtp:()=>{throw new Error('SMTP must not be used');}};
  assert.deepEqual(mailDelivery(env,factories),{mail,from:env.ZOHO_FROM});
  assert.equal(mailDelivery(env,{...factories,zoho:()=>null}),null);
  assert.equal(mailDelivery({}, {smtp:()=>mail}),null);
  assert.deepEqual(mailDelivery({SMTP_FROM:'smtp@example.test'},{smtp:()=>mail}),{mail,from:'smtp@example.test'});
  assert.throws(()=>mailDelivery({MAIL_PROVIDER:'unknown'}),/Unsupported/);
});

const invitation = {id:'test-invite',email:'teacher@example.test',schoolName:'Test School',role:'TEACHER',token:'x'.repeat(64),expiresAt:'2026-11-01T00:00:00Z'};
test('unconfigured invitation delivery reports manual sharing',async()=>{
  assert.deepEqual(await sendInvitationEmail({env:{},invitation}),{status:'not_configured'});
});
test('invitation email contains the code and join address and requires recipient acceptance',async()=>{
  let message;
  const env={SMTP_FROM:'ALP <invites@example.test>',ALP_APP_URL:'https://app.example.test'};
  const mailer={sendMail:async value=>{message=value;return {accepted:[invitation.email]};}};
  assert.deepEqual(await sendInvitationEmail({env,mailer,invitation}),{status:'sent'});
  assert.equal(message.to,invitation.email);
  assert.ok(message.text.includes(invitation.token));
  assert.ok(message.text.includes('https://app.example.test/join'));
  assert.deepEqual(await sendInvitationEmail({env,mailer:{sendMail:async()=>({accepted:[]})},invitation}),{status:'failed'});
});
