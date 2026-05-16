/**
 * ALP Platform — Backend Services
 * email.js | pdf.js | compliance.js | storage.js | notifications.js
 * Built by Stan Paraclete | www.stanparaclete.com
 */

// ═══════════════════════════════════════════════════════════════
// EMAIL SERVICE  —  services/email.js
// ═══════════════════════════════════════════════════════════════
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST    || 'smtp.sendgrid.net',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS,
  },
});

const templates = {
  'password-reset': (data) => ({
    subject: 'Reset your ALP Platform password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B0A1A;color:#F4F3FF;padding:40px;border-radius:12px">
        <div style="text-align:center;margin-bottom:32px">
          <div style="display:inline-block;background:#7C3AED;color:#fff;font-weight:800;font-size:18px;padding:10px 20px;border-radius:8px">ALP</div>
        </div>
        <h2 style="color:#A78BFA;margin-bottom:16px">Reset Your Password</h2>
        <p style="margin-bottom:24px">Hi ${data.firstName}, click the link below to reset your ALP Platform password. This link expires in 1 hour.</p>
        <a href="${data.resetLink}" style="display:inline-block;background:#7C3AED;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-bottom:24px">Reset Password</a>
        <p style="font-size:12px;color:#9B99BE">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:1px solid rgba(124,58,237,0.2);margin:24px 0">
        <p style="font-size:11px;color:#6B6A8A;text-align:center">Built by Stan Paraclete · www.stanparaclete.com · growwithalp.com</p>
      </div>`,
  }),

  'new-message': (data) => ({
    subject: `New message from ${data.senderName} — ALP Platform`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B0A1A;color:#F4F3FF;padding:40px;border-radius:12px">
        <h2 style="color:#A78BFA">New Message</h2>
        <p>Hi ${data.recipientName}, you have a new message from <strong>${data.senderName}</strong>.</p>
        <div style="background:#1A1836;border-left:4px solid #7C3AED;padding:16px;margin:20px 0;border-radius:0 8px 8px 0">
          <p style="font-weight:700;margin-bottom:8px">${data.subject}</p>
          <p style="color:#9B99BE;font-size:13px">${data.preview}…</p>
        </div>
        <a href="${data.portalLink}" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Message</a>
        <hr style="border:1px solid rgba(124,58,237,0.2);margin:24px 0">
        <p style="font-size:11px;color:#6B6A8A;text-align:center">Built by Stan Paraclete · growwithalp.com</p>
      </div>`,
  }),

  'plan-activated': (data) => ({
    subject: `${data.studentName}'s ALP has been activated — ALP Platform`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B0A1A;color:#F4F3FF;padding:40px;border-radius:12px">
        <h2 style="color:#10B981">✅ ALP Activated</h2>
        <p>Hi ${data.parentName}, ${data.studentName}'s Accelerated Learning Plan has been activated and is ready for your review.</p>
        <ul style="color:#9B99BE;margin:16px 0">
          <li>Plan effective date: ${data.effectiveDate}</li>
          <li>Annual review date: ${data.reviewDate}</li>
          <li>Goals: ${data.goalCount} annual goals</li>
        </ul>
        <p>As a parent/guardian, you have the right to review this plan and request a meeting at any time.</p>
        <a href="${data.portalLink}" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View in Family Portal</a>
        <hr style="border:1px solid rgba(124,58,237,0.2);margin:24px 0">
        <p style="font-size:11px;color:#6B6A8A;text-align:center">Built by Stan Paraclete · growwithalp.com</p>
      </div>`,
  }),

  'signature-request': (data) => ({
    subject: `Action required: Please sign ${data.studentName}'s ALP — ALP Platform`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B0A1A;color:#F4F3FF;padding:40px;border-radius:12px">
        <h2 style="color:#F59E0B">✍️ Signature Required</h2>
        <p>Hi ${data.parentName}, your signature is required on ${data.studentName}'s Accelerated Learning Plan. Please review and sign by <strong>${data.deadline}</strong>.</p>
        <a href="${data.signLink}" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">Review & Sign ALP</a>
        <p style="color:#9B99BE;font-size:12px">You may also decline and request a meeting. Contact ${data.coordinatorName} at ${data.coordinatorEmail} with questions.</p>
        <hr style="border:1px solid rgba(124,58,237,0.2);margin:24px 0">
        <p style="font-size:11px;color:#6B6A8A;text-align:center">Built by Stan Paraclete · growwithalp.com</p>
      </div>`,
  }),
};

export async function sendEmail({ to, subject, template, data, html }) {
  try {
    const content = template ? templates[template]?.(data) : { subject, html };
    if (!content) throw new Error(`Unknown email template: ${template}`);

    await transporter.sendMail({
      from:    `"${process.env.FROM_NAME || 'ALP Platform'}" <${process.env.FROM_EMAIL || 'noreply@growwithalp.com'}>`,
      to,
      subject: content.subject,
      html:    content.html,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
    // Don't throw — email failures shouldn't break the main flow
  }
}


// ═══════════════════════════════════════════════════════════════
// PDF SERVICE  —  services/pdf.js
// ═══════════════════════════════════════════════════════════════
import PDFDocument from 'pdfkit';

export async function generateALPPDF(plan) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'LETTER', info: { Title: `ALP — ${plan.student.firstName} ${plan.student.lastName}`, Author: 'ALP Platform', Creator: 'Stan Paraclete · www.stanparaclete.com' } });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PURPLE = '#7C3AED';
    const GRAY   = '#9B99BE';

    // ─── Header ────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 100).fill(PURPLE);
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('ACCELERATED LEARNING PLAN', 50, 28);
    doc.fontSize(12).font('Helvetica').text(`${plan.student.firstName} ${plan.student.lastName} · Grade ${plan.student.grade}`, 50, 58);
    doc.fontSize(10).text(`Effective: ${new Date(plan.effectiveDate).toLocaleDateString()} · Review: ${new Date(plan.reviewDate).toLocaleDateString()}`, 50, 76);

    doc.moveDown(4);

    // ─── Student Info ──────────────────────────────────────────
    doc.fillColor(PURPLE).fontSize(14).font('Helvetica-Bold').text('Student Information');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke(PURPLE);
    doc.moveDown(0.5);

    const info = [
      ['Full Name', `${plan.student.firstName} ${plan.student.lastName}`],
      ['Date of Birth', plan.student.dateOfBirth ? new Date(plan.student.dateOfBirth).toLocaleDateString() : 'N/A'],
      ['Grade', plan.student.grade],
      ['Primary Language', plan.student.primaryLanguage || 'English'],
      ['Disability', plan.student.disabilities?.[0]?.category?.replace(/_/g, ' ') || 'N/A'],
      ['Plan Type', plan.planType],
      ['Framework', plan.framework?.replace(/_/g, ' ')],
    ];

    info.forEach(([k, v]) => {
      doc.fillColor('#111').fontSize(10).font('Helvetica-Bold').text(k + ':', 50, doc.y, { width: 160, continued: false });
      doc.fillColor('#333').font('Helvetica').text(v, 220, doc.y - 12, { width: 340 });
      doc.moveDown(0.3);
    });

    // ─── Goals ────────────────────────────────────────────────
    doc.moveDown(1);
    doc.fillColor(PURPLE).fontSize(14).font('Helvetica-Bold').text('Measurable Annual Goals');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke(PURPLE);
    doc.moveDown(0.5);

    (plan.goals || []).forEach((goal, i) => {
      if (doc.y > 650) doc.addPage();

      doc.fillColor(PURPLE).fontSize(11).font('Helvetica-Bold').text(`Goal ${i + 1}: ${goal.domain.replace(/_/g, ' ')}`);
      doc.fillColor('#222').fontSize(10).font('Helvetica').text(goal.description, { width: 510, indent: 10 });
      doc.fillColor(GRAY).fontSize(9).text(`Baseline: ${goal.baseline}   Target: ${goal.target}   Monitoring: ${goal.monitoring}`);
      doc.moveDown(0.8);
    });

    // ─── Services & Accommodations ─────────────────────────────
    doc.moveDown(0.5);
    doc.fillColor(PURPLE).fontSize(14).font('Helvetica-Bold').text('Services & Accommodations');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke(PURPLE);
    doc.moveDown(0.5);

    const services = Array.isArray(plan.services) ? plan.services : [];
    const accomms  = Array.isArray(plan.accommodations) ? plan.accommodations : [];

    if (services.length) {
      doc.fillColor('#111').fontSize(11).font('Helvetica-Bold').text('Special Education Services:');
      services.forEach(s => doc.fillColor('#333').font('Helvetica').fontSize(10).text(`• ${s.type?.replace(/_/g, ' ')} — ${s.frequency}`, { indent: 10 }));
    }

    if (accomms.length) {
      doc.moveDown(0.5);
      doc.fillColor('#111').fontSize(11).font('Helvetica-Bold').text('Accommodations:');
      accomms.forEach(a => doc.fillColor('#333').font('Helvetica').fontSize(10).text(`• [${a.category}] ${a.description}`, { indent: 10 }));
    }

    // ─── Signatures ───────────────────────────────────────────
    doc.moveDown(2);
    if (doc.y > 600) doc.addPage();
    doc.fillColor(PURPLE).fontSize(14).font('Helvetica-Bold').text('Signatures');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke(PURPLE);
    doc.moveDown(0.5);

    (plan.signatures || []).forEach(sig => {
      const name = sig.user ? `${sig.user.firstName} ${sig.user.lastName}` : 'N/A';
      const status = sig.status === 'SIGNED' ? `Signed ${new Date(sig.signedAt).toLocaleDateString()}` : sig.status;
      doc.fillColor('#111').fontSize(10).font('Helvetica-Bold').text(`${sig.role.charAt(0).toUpperCase() + sig.role.slice(1)}: `, 50, doc.y, { continued: true });
      doc.font('Helvetica').fillColor('#333').text(`${name} — ${status}`);
      doc.moveDown(0.4);
    });

    // ─── Footer ───────────────────────────────────────────────
    const pages = doc.bufferedPageRange().count;
    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i);
      doc.fillColor(GRAY).fontSize(8).font('Helvetica')
        .text(`Generated by ALP Platform v2.4.1 · Built by Stan Paraclete · www.stanparaclete.com · Page ${i + 1} of ${pages}`, 50, doc.page.height - 30, { align: 'center', width: doc.page.width - 100 });
    }

    doc.end();
  });
}


// ═══════════════════════════════════════════════════════════════
// COMPLIANCE SERVICE  —  services/compliance.js
// ═══════════════════════════════════════════════════════════════
export async function checkCompliance(plan) {
  const checks = {
    hasStudentInfo:    Object.keys(plan.studentInfo || {}).length > 0,
    hasPresentLevels:  Object.keys(plan.presentLevels || {}).length > 0,
    hasGoals:          (plan.goals || []).length >= 1,
    hasSmartGoals:     (plan.goals || []).every(g => g.description?.length > 20 && g.baseline && g.target),
    hasServices:       Array.isArray(plan.services) && plan.services.length > 0,
    hasAccommodations: Array.isArray(plan.accommodations) && plan.accommodations.length > 0,
    hasFamilyInput:    Object.keys(plan.familyInput || {}).length > 0,
    hasReviewDate:     !!plan.reviewDate,
    hasParentSig:      (plan.signatures || []).some(s => s.role === 'parent'),
    isComplete:        (plan.completionPct || 0) >= 80,
  };

  const issues = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => ({
      field:    k,
      severity: ['hasGoals', 'hasParentSig'].includes(k) ? 'critical' : 'warning',
      message: {
        hasStudentInfo:   'Student information section is incomplete',
        hasPresentLevels: 'Present levels of performance not documented',
        hasGoals:         'At least one measurable annual goal required',
        hasSmartGoals:    'All goals must include baseline, target, and criterion',
        hasServices:      'Special education services must be documented',
        hasAccommodations:'Accommodations and modifications required',
        hasFamilyInput:   'Family input section must be completed',
        hasReviewDate:    'Annual review date is required',
        hasParentSig:     'Parent/guardian signature required for activation',
        isComplete:       `Plan is only ${plan.completionPct || 0}% complete (minimum 80% required)`,
      }[k] || k,
    }));

  return {
    isCompliant: issues.filter(i => i.severity === 'critical').length === 0,
    score:       Math.round((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100),
    checks,
    issues,
    framework: plan.framework,
  };
}


// ═══════════════════════════════════════════════════════════════
// STORAGE SERVICE  —  services/storage.js
// ═══════════════════════════════════════════════════════════════
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function uploadToS3({ buffer, key, mimeType }) {
  await s3.send(new PutObjectCommand({
    Bucket:      process.env.AWS_S3_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256',
  }));
  return `${process.env.AWS_CLOUDFRONT_URL}/${key}`;
}

export async function getSignedUrl(url, expiresIn = 900) {
  // Extract key from CloudFront URL
  const key = url.replace(`${process.env.AWS_CLOUDFRONT_URL}/`, '');
  return awsGetSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }), { expiresIn });
}


// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS SERVICE  —  services/notifications.js
// ═══════════════════════════════════════════════════════════════
import { prisma as prismaFn } from '../db.js';

export async function notifyFamily(studentId, { title, body, type, data = {} }) {
  try {
    // Find parents/guardians with pending signatures or messages for this student
    const signatures = await prismaFn.signature.findMany({
      where: { alp: { studentId } },
      include: { user: { select: { id: true } } },
    });

    const parentIds = [...new Set(signatures.map(s => s.user.id))];

    if (parentIds.length) {
      await prismaFn.notification.createMany({
        data: parentIds.map(userId => ({ userId, title, body, type, data })),
      });
    }
  } catch (err) {
    console.error('notifyFamily error:', err.message);
  }
}


// ═══════════════════════════════════════════════════════════════
// TOTP SERVICE  —  services/totp.js
// ═══════════════════════════════════════════════════════════════
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export function generateTOTP(email) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, 'ALP Platform', secret);
  return { secret, qrCodeUrl: otpauth };
}

export function verifyTOTP(secret, token) {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
