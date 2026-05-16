/**
 * ALP Platform — Next.js 14 Marketing Website
 * growwithalp.com
 * Built by Stan Paraclete | www.stanparaclete.com
 *
 * Structure:
 *  app/
 *    layout.tsx      — root layout
 *    page.tsx        — home/landing
 *    pricing/page.tsx
 *    features/page.tsx
 *    about/page.tsx
 *    download/page.tsx
 *  components/
 *    Navbar.tsx
 *    Hero.tsx
 *    Features.tsx
 *    Pricing.tsx
 *    Testimonials.tsx
 *    Footer.tsx
 *    DownloadModal.tsx
 */

// ─── app/layout.tsx ───────────────────────────────────────────
/*
import type { Metadata } from 'next'
import { Sora } from 'next/font/google'
import './globals.css'

const sora = Sora({ subsets: ['latin'], display: 'swap', variable: '--font-sora' })

export const metadata: Metadata = {
  title: 'ALP Platform — Accelerated Learning Plan',
  description: 'One intelligent platform helping schools worldwide support every learner through AI-powered intervention planning, progress monitoring, and family collaboration.',
  keywords: ['special education', 'IEP', 'ALP', 'intervention planning', 'Ghana', 'Nigeria', 'IDEA', 'SEND'],
  authors: [{ name: 'Stan Paraclete', url: 'https://www.stanparaclete.com' }],
  openGraph: {
    title: 'ALP Platform — Accelerated Learning Plan',
    description: 'Supporting every learner\'s growth with AI-powered intervention planning',
    url: 'https://growwithalp.com',
    siteName: 'ALP Platform',
    images: [{ url: 'https://growwithalp.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'ALP Platform', description: 'Supporting every learner\'s growth.' },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body>{children}</body>
    </html>
  )
}
*/

// ─── app/page.tsx (Home) ─────────────────────────────────────
/*
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import Testimonials from '@/components/Testimonials'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      <Footer />
    </main>
  )
}
*/

// ─── app/globals.css ──────────────────────────────────────────
/*
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');

:root {
  --purple: #7C3AED;
  --purple-light: #A78BFA;
  --bg: #0B0A1A;
  --bg-card: #12102B;
  --bg-panel: #1A1836;
  --text: #F4F3FF;
  --text-muted: #9B99BE;
  --border: rgba(124,58,237,0.18);
  --green: #10B981;
  --amber: #F59E0B;
  --red: #EF4444;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Sora', sans-serif; background: var(--bg); color: var(--text); }
*/

// ─── components/Navbar.tsx ────────────────────────────────────
/*
'use client'
import Link from 'next/link'
import { useState } from 'react'

const navLinks = [
  { href: '/features', label: 'Features' },
  { href: '/pricing',  label: 'Pricing'  },
  { href: '/about',    label: 'About'    },
  { href: '/download', label: 'Download' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="logo">
          <div className="logo-mark">ALP</div>
          <span className="logo-text">ALP Platform</span>
        </Link>
        <div className="nav-links desktop">
          {navLinks.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </div>
        <div className="nav-actions">
          <Link href="https://app.growwithalp.com" className="btn-ghost">Sign In</Link>
          <Link href="https://app.growwithalp.com" className="btn-primary">Get Started Free →</Link>
        </div>
      </div>
    </nav>
  )
}
*/

// ─── components/Hero.tsx ─────────────────────────────────────
/*
'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="hero-badge">
            <span className="pulse-dot" />
            Now available · Spring 2026 · 10 global compliance frameworks
          </div>
          <h1 className="hero-headline">
            Supporting Every<br />
            <span className="gradient-text">Learner's Growth.</span>
          </h1>
          <p className="hero-sub">
            One intelligent platform helping schools worldwide support every learner through
            AI-powered intervention planning, progress monitoring, and family collaboration.
          </p>
          <div className="hero-actions">
            <Link href="https://app.growwithalp.com" className="btn-primary-lg">
              🚀 Start for Free — Web App
            </Link>
            <Link href="/download" className="btn-secondary-lg">
              ⬇ Download Desktop App
            </Link>
          </div>
          <div className="hero-stats">
            <div className="stat"><span className="stat-value">10+</span><span>Countries</span></div>
            <div className="stat"><span className="stat-value">100%</span><span>FERPA Compliant</span></div>
            <div className="stat"><span className="stat-value">AI</span><span>Claude-Powered</span></div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
*/

// ─── components/Features.tsx ─────────────────────────────────
/*
const features = [
  {
    icon: '📋',
    title: 'ALP Builder',
    desc: '13-section guided workflow with AI goal suggestions, autosave, version history, and legally compliant e-signatures.',
    color: '#7C3AED',
  },
  {
    icon: '🤖',
    title: 'AI Goal Generation',
    desc: 'Claude-powered SMART annual goals tailored to student disability, grade, and baseline data. One click to add.',
    color: '#3B82F6',
  },
  {
    icon: '📈',
    title: 'Progress Monitoring',
    desc: 'Real-time CBM data entry, trend analysis, at-risk alerts, and automatic family notifications.',
    color: '#10B981',
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Family Collaboration',
    desc: 'Secure parent portal for messaging, document signing, meeting scheduling, and plain-language progress updates.',
    color: '#F59E0B',
  },
  {
    icon: '⚖️',
    title: 'Global Compliance',
    desc: 'Supports IDEA (USA), GES (Ghana), NERDC (Nigeria), UK SEND, Australia NCCD, and 6+ more frameworks.',
    color: '#EF4444',
  },
  {
    icon: '📱',
    title: 'All Platforms',
    desc: 'Web app, iOS, Android, Windows, macOS, and Linux — all synced in real time with offline support.',
    color: '#A78BFA',
  },
]

export default function Features() {
  return (
    <section className="features-section">
      <div className="section-label">Platform Features</div>
      <h2 className="section-title">Everything your school needs</h2>
      <p className="section-sub">From identification to compliance — one connected system.</p>
      <div className="features-grid">
        {features.map(f => (
          <div key={f.title} className="feature-card" style={{ borderTop: `3px solid ${f.color}` }}>
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
*/

// ─── components/Pricing.tsx ──────────────────────────────────
/*
const plans = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    desc: 'Perfect for small schools and learning centers',
    seats: 'Up to 10 educators',
    features: ['ALP Builder (all 13 sections)', 'Progress monitoring', 'Family portal', 'PDF export', '1 compliance framework', 'Email support'],
    cta: 'Start Free Trial',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '$149',
    period: '/month',
    desc: 'Built for growing schools and districts',
    seats: 'Up to 50 educators',
    features: ['Everything in Starter', 'AI goal suggestions (Claude)', 'All compliance frameworks', 'Advanced analytics', 'Priority support', 'API access'],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For districts, governments, and NGOs',
    seats: 'Unlimited educators',
    features: ['Everything in Professional', 'Custom compliance frameworks', 'Self-hosted / on-premise option', 'SSO / SAML', 'SLA guarantee', 'Dedicated success manager'],
    cta: 'Contact Sales',
    highlight: false,
  },
]

export default function Pricing() {
  return (
    <section className="pricing-section">
      <div className="section-label">Pricing</div>
      <h2 className="section-title">Simple, school-friendly pricing</h2>
      <p className="section-sub">All plans include a 30-day free trial. No credit card required.</p>
      <div className="pricing-grid">
        {plans.map(p => (
          <div key={p.name} className={`pricing-card ${p.highlight ? 'pricing-card--featured' : ''}`}>
            {p.highlight && <div className="pricing-badge">Most Popular</div>}
            <div className="pricing-name">{p.name}</div>
            <div className="pricing-price">{p.price}<span>{p.period}</span></div>
            <div className="pricing-seats">{p.seats}</div>
            <ul className="pricing-features">
              {p.features.map(f => <li key={f}>✓ {f}</li>)}
            </ul>
            <a href="https://app.growwithalp.com" className={p.highlight ? 'btn-primary-lg' : 'btn-secondary-lg'}>{p.cta}</a>
          </div>
        ))}
      </div>
    </section>
  )
}
*/

// ─── components/Footer.tsx ────────────────────────────────────
/*
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="logo-mark">ALP</div>
          <p className="footer-tagline">Supporting Every Learner's Growth</p>
          <p className="footer-builder">
            Built by <a href="https://www.stanparaclete.com" target="_blank" rel="noopener noreferrer">Stan Paraclete</a><br />
            www.stanparaclete.com
          </p>
        </div>
        <div className="footer-links">
          <div>
            <h4>Product</h4>
            <a href="/features">Features</a>
            <a href="/pricing">Pricing</a>
            <a href="/download">Download</a>
            <a href="https://docs.growwithalp.com">Documentation</a>
          </div>
          <div>
            <h4>Use Cases</h4>
            <a href="/schools">Schools</a>
            <a href="/districts">Districts</a>
            <a href="/governments">Governments</a>
            <a href="/ngos">NGOs</a>
          </div>
          <div>
            <h4>Compliance</h4>
            <a href="/compliance/idea">IDEA (USA)</a>
            <a href="/compliance/ghana">Ghana GES</a>
            <a href="/compliance/nigeria">Nigeria NERDC</a>
            <a href="/compliance/uk-send">UK SEND</a>
          </div>
          <div>
            <h4>Support</h4>
            <a href="https://docs.growwithalp.com">Docs</a>
            <a href="mailto:support@growwithalp.com">Contact</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 ALP Platform · growwithalp.com · Built by Stan Paraclete · www.stanparaclete.com</p>
      </div>
    </footer>
  )
}
*/

// ─── next.config.js ───────────────────────────────────────────
/*
const nextConfig = {
  images: {
    domains: ['cdn.growwithalp.com'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/app', destination: 'https://app.growwithalp.com', permanent: false },
    ]
  },
}

module.exports = nextConfig
*/

// ─── package.json ─────────────────────────────────────────────
/*
{
  "name": "alp-website",
  "version": "2.4.1",
  "description": "ALP Platform Marketing Website — Built by Stan Paraclete",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "typescript": "^5",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
*/

export default {};
