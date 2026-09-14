'use client';
import { useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';

export default function ContactForm({ initialSubject = 'school' }) {
  const [state, setState] = useState({ pending: false, error: '', sent: false });
  async function submit(event) {
    event.preventDefault();
    if (state.pending) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.consent = data.consent === 'on';
    setState({ pending: true, error: '', sent: false });
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not deliver your enquiry. Please try again.');
      form.reset();
      setState({ pending: false, error: '', sent: true });
    } catch (error) { setState({ pending: false, error: error.name === 'TimeoutError' ? 'The connection timed out. Please try again.' : error.message, sent: false }); }
  }
  return <form className="contact-form" onSubmit={submit}>
    <div className="form-grid"><label>Your name<input name="name" autoComplete="name" required maxLength={100}/></label><label>Work email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label></div>
    <label>School or organisation<input name="organisation" autoComplete="organization" maxLength={200}/></label>
    <label>Enquiry<select name="subject" defaultValue={['demo','school','partnership','support','privacy'].includes(initialSubject) ? initialSubject : 'school'}><option value="demo">Request a demo</option><option value="school">School rollout</option><option value="partnership">Partnership</option><option value="support">Product support</option><option value="privacy">Privacy enquiry</option></select></label>
    <label>Message<textarea name="message" rows={5} minLength={10} maxLength={3000} required aria-describedby="message-note"/></label>
    <p id="message-note" className="fine-print">Please do not include student names, health information or private school records.</p>
    <label className="trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <label className="check-label"><input name="consent" type="checkbox" required/><span>I agree that ALP may use these details to respond to my enquiry. <a href="/privacy">Privacy notice</a></span></label>
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {state.sent && <p role="status" className="form-success">Your enquiry has been received by ALP.</p>}
    <button className="button" disabled={state.pending}>{state.pending ? <LoaderCircle className="spin" size={18}/> : <ArrowRight size={18}/>} {state.pending ? 'Sending' : 'Send enquiry'}</button>
  </form>;
}
