/**
 * ALP Platform — Family Portal Routes
 * Messages, meetings, signatures, parent-facing portal
 * Built by Stan Paraclete | www.stanparaclete.com
 */

import express from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

// ─── Messages ─────────────────────────────────────────────────────────────────

// GET /api/family/messages
router.get('/messages', async (req, res) => {
  try {
    const { studentId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      OR: [
        { senderId:    req.user.id },
        { recipientId: req.user.id },
      ],
    };
    if (studentId) where.studentId = studentId;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: { sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.message.count({ where }),
    ]);

    res.json({ messages, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/family/messages — send message
router.post('/messages', async (req, res) => {
  try {
    const schema = z.object({
      recipientId: z.string(),
      studentId:   z.string().optional(),
      subject:     z.string().min(1).max(200),
      body:        z.string().min(1),
      attachments: z.array(z.any()).optional(),
    });

    const data = schema.parse(req.body);

    const message = await prisma.message.create({
      data: {
        senderId:    req.user.id,
        recipientId: data.recipientId,
        studentId:   data.studentId,
        subject:     data.subject,
        body:        data.body,
        attachments: data.attachments || [],
        status:      'SENT',
      },
      include: { sender: { select: { firstName: true, lastName: true } } },
    });

    // Notify recipient
    await prisma.notification.create({
      data: {
        userId: data.recipientId,
        title:  `New message from ${req.user.firstName} ${req.user.lastName}`,
        body:   data.subject,
        type:   'message',
        data:   { messageId: message.id },
      },
    });

    // Email notification
    const recipient = await prisma.user.findUnique({ where: { id: data.recipientId }, select: { email: true, firstName: true } });
    if (recipient) {
      await sendEmail({
        to:       recipient.email,
        subject:  `New message from ${req.user.firstName} ${req.user.lastName} — ALP Platform`,
        template: 'new-message',
        data: {
          recipientName: recipient.firstName,
          senderName:    `${req.user.firstName} ${req.user.lastName}`,
          subject:       data.subject,
          preview:       data.body.slice(0, 200),
          portalLink:    `${process.env.APP_URL}/family/messages`,
        },
      }).catch(console.error);
    }

    res.status(201).json(message);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/family/messages/:id/read
router.patch('/messages/:id/read', async (req, res) => {
  try {
    const updated = await prisma.message.update({
      where: { id: req.params.id, recipientId: req.user.id },
      data:  { isRead: true, readAt: new Date(), status: 'READ' },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Meetings ─────────────────────────────────────────────────────────────────

// GET /api/family/meetings
router.get('/meetings', async (req, res) => {
  try {
    const { studentId, upcoming } = req.query;

    const where = {
      participants: { some: { userId: req.user.id } },
    };
    if (studentId) where.participants = { some: { studentId } };
    if (upcoming === 'true') where.scheduledAt = { gte: new Date() };

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        participants: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });

    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/family/meetings — schedule meeting
router.post('/meetings', async (req, res) => {
  try {
    const schema = z.object({
      title:        z.string().min(1),
      type:         z.string(),
      studentId:    z.string().optional(),
      scheduledAt:  z.string(),
      duration:     z.number().int().default(60),
      isVirtual:    z.boolean().default(false),
      location:     z.string().optional(),
      meetingLink:  z.string().optional(),
      participantIds: z.array(z.string()),
    });

    const data = schema.parse(req.body);

    const meeting = await prisma.meeting.create({
      data: {
        title:       data.title,
        type:        data.type,
        scheduledAt: new Date(data.scheduledAt),
        duration:    data.duration,
        isVirtual:   data.isVirtual,
        location:    data.location,
        meetingLink: data.meetingLink,
        participants: {
          create: [
            { userId: req.user.id, role: 'organizer' },
            ...data.participantIds.map(id => ({ userId: id })),
            ...(data.studentId ? [{ studentId: data.studentId }] : []),
          ],
        },
      },
      include: { participants: true },
    });

    // Notify all participants
    for (const pid of data.participantIds) {
      await prisma.notification.create({
        data: {
          userId: pid,
          title:  'Meeting Scheduled',
          body:   `${data.title} on ${new Date(data.scheduledAt).toLocaleDateString()}`,
          type:   'meeting',
          data:   { meetingId: meeting.id },
        },
      }).catch(console.error);
    }

    res.status(201).json(meeting);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// ─── Signatures ───────────────────────────────────────────────────────────────

// GET /api/family/signatures/pending
router.get('/signatures/pending', async (req, res) => {
  try {
    const pending = await prisma.signature.findMany({
      where: { userId: req.user.id, status: 'PENDING' },
      include: {
        alp: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, grade: true } },
            createdBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/family/signatures/:id/sign
router.post('/signatures/:id/sign', async (req, res) => {
  try {
    const { signatureData } = req.body;

    const sig = await prisma.signature.findUnique({ where: { id: req.params.id } });
    if (!sig || sig.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (sig.status !== 'PENDING') return res.status(400).json({ error: 'Signature already processed' });

    const updated = await prisma.signature.update({
      where: { id: req.params.id },
      data: {
        status:        'SIGNED',
        signedAt:      new Date(),
        ipAddress:     req.ip,
        userAgent:     req.headers['user-agent'],
        signatureData,
      },
    });

    // Check if all required signatures collected — notify teacher
    const allSigs = await prisma.signature.findMany({ where: { alpId: sig.alpId } });
    const allSigned = allSigs.every(s => s.status === 'SIGNED');

    if (allSigned) {
      const plan = await prisma.aLPPlan.findUnique({ where: { id: sig.alpId }, include: { createdBy: true } });
      if (plan) {
        await prisma.notification.create({
          data: {
            userId: plan.createdById,
            title:  'All Signatures Collected',
            body:   'All required signatures have been received. The ALP is fully executed.',
            type:   'all_signatures',
            data:   { alpId: sig.alpId },
          },
        });
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/family/signatures/:id/decline
router.post('/signatures/:id/decline', async (req, res) => {
  try {
    const { reason } = req.body;
    const updated = await prisma.signature.update({
      where: { id: req.params.id, userId: req.user.id },
      data:  { status: 'DECLINED', declineReason: reason },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/family/dashboard — parent-facing portal data
router.get('/dashboard', async (req, res) => {
  try {
    if (req.user.role !== 'PARENT') return res.status(403).json({ error: 'Parent role required' });

    // Find students linked to this parent via messages or pending signatures
    const [pendingSigs, recentMessages, upcomingMeetings] = await Promise.all([
      prisma.signature.findMany({
        where: { userId: req.user.id, status: 'PENDING' },
        include: { alp: { include: { student: true } } },
      }),
      prisma.message.findMany({
        where: { OR: [{ senderId: req.user.id }, { recipientId: req.user.id }] },
        include: { sender: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { sentAt: 'desc' },
        take: 5,
      }),
      prisma.meeting.findMany({
        where: { participants: { some: { userId: req.user.id } }, scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
    ]);

    res.json({ pendingSignatures: pendingSigs, recentMessages, upcomingMeetings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
