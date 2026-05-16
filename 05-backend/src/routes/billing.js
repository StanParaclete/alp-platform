/**
 * ALP Platform — Stripe Billing Route
 * Subscription management, webhooks, seat limits, trial handling
 * Built by Stan Paraclete | www.stanparaclete.com
 */

import express from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

const PLANS = {
  starter:      { price: process.env.STRIPE_PRICE_STARTER,      seats: 10,      name: 'Starter'      },
  professional: { price: process.env.STRIPE_PRICE_PROFESSIONAL, seats: 50,      name: 'Professional' },
  enterprise:   { price: process.env.STRIPE_PRICE_ENTERPRISE,   seats: Infinity, name: 'Enterprise'  },
};

// GET /api/billing/subscription  —  current subscription status
router.get('/subscription', async (req, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { districtId: req.user.districtId, status: { in: ['active', 'trialing'] } },
      include: { district: { select: { name: true, _count: { select: { users: true } } } } },
    });

    if (!sub) return res.json({ plan: 'free', seats: 3, usedSeats: 0, isTrialing: false });

    const stripeData = sub.stripeSubId
      ? await stripe.subscriptions.retrieve(sub.stripeSubId).catch(() => null)
      : null;

    res.json({
      id:         sub.id,
      plan:       sub.plan,
      status:     sub.status,
      seats:      sub.seats,
      usedSeats:  sub.usedSeats,
      startsAt:   sub.startsAt,
      expiresAt:  sub.expiresAt,
      isTrialing: stripeData?.status === 'trialing',
      trialEnds:  stripeData?.trial_end ? new Date(stripeData.trial_end * 1000) : null,
      renewsAt:   stripeData?.current_period_end ? new Date(stripeData.current_period_end * 1000) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/checkout  —  create Stripe checkout session
router.post('/checkout', requireRole(['SUPER_ADMIN', 'DISTRICT_MANAGER', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    const { plan = 'professional' } = req.body;
    const planConfig = PLANS[plan];
    if (!planConfig) return res.status(400).json({ error: 'Invalid plan' });

    const district = await prisma.district.findUnique({ where: { id: req.user.districtId } });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.price, quantity: 1 }],
      success_url: `${process.env.APP_URL}/settings?tab=billing&success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.APP_URL}/settings?tab=billing&cancelled=true`,
      customer_email: req.user.email,
      metadata: {
        districtId: req.user.districtId,
        userId:     req.user.id,
        plan,
      },
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          districtId: req.user.districtId,
          plan,
        },
      },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/portal  —  Stripe customer portal
router.post('/portal', requireRole(['SUPER_ADMIN', 'DISTRICT_MANAGER', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { districtId: req.user.districtId },
    });

    if (!sub?.stripeSubId) return res.status(400).json({ error: 'No active subscription' });

    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubId);
    const session = await stripe.billingPortal.sessions.create({
      customer:   stripeSub.customer,
      return_url: `${process.env.APP_URL}/settings?tab=billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/webhook  —  Stripe event handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const { districtId, plan } = session.metadata;
        const planConfig = PLANS[plan];

        await prisma.subscription.upsert({
          where:  { districtId },
          update: {
            plan, status: 'active', seats: planConfig.seats,
            stripeSubId: session.subscription,
            startsAt: new Date(),
            expiresAt: null,
          },
          create: {
            districtId, plan, status: 'active', seats: planConfig.seats,
            stripeSubId: session.subscription,
            startsAt: new Date(),
          },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const districtId = sub.metadata.districtId;
        const plan = sub.metadata.plan;
        if (districtId) {
          await prisma.subscription.updateMany({
            where: { districtId },
            data:  { status: sub.status, plan: plan || undefined },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const districtId = sub.metadata.districtId;
        if (districtId) {
          await prisma.subscription.updateMany({
            where: { districtId },
            data:  { status: 'cancelled' },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const sub = await prisma.subscription.findFirst({ where: { stripeSubId: invoice.subscription } });
        if (sub) {
          const district = await prisma.district.findUnique({
            where: { id: sub.districtId },
            include: { users: { where: { role: { in: ['SUPER_ADMIN','DISTRICT_MANAGER'] } }, take: 1 } },
          });
          if (district?.users[0]) {
            await prisma.notification.create({
              data: {
                userId: district.users[0].id,
                title:  '💳 Payment Failed',
                body:   'Your ALP Platform subscription payment failed. Please update your billing information.',
                type:   'billing',
                data:   { invoiceId: invoice.id },
              },
            });
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK] Processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/usage  —  seat usage stats
router.get('/usage', requireRole(['SUPER_ADMIN', 'DISTRICT_MANAGER', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    const [sub, usedSeats] = await Promise.all([
      prisma.subscription.findFirst({ where: { districtId: req.user.districtId } }),
      prisma.user.count({ where: { districtId: req.user.districtId, isActive: true, role: { not: 'PARENT' } } }),
    ]);

    if (sub) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { usedSeats } });
    }

    res.json({
      usedSeats,
      totalSeats: sub?.seats || 3,
      remaining:  Math.max(0, (sub?.seats || 3) - usedSeats),
      plan:       sub?.plan || 'free',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
