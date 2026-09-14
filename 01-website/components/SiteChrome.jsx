'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Sun, Moon, ArrowUpRight, Download, Monitor, Smartphone, Globe } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import site from '../content/site.json';
import releases from '../content/releases.json';
import { appBase } from '../lib/urls.mjs';
const platforms = [['windows', 'Windows', Monitor], ['mac', 'macOS', Monitor], ['linux', 'Linux', Monitor], ['ios', 'iOS', Smartphone], ['android', 'Android', Smartphone]];

export function DownloadOptions() {
  return <div className="download-options">
    <a className="browser-option" href={`${appBase}/login`}><Globe size={24}/><span><strong>Continue in browser</strong><small>Use ALP on your computer, tablet or phone</small></span><ArrowUpRight size={20}/></a>
    <div className="platform-list">{platforms.map(([id, name, Icon]) => {
      const release = releases.releases.find(item => item.platform === id && item.published && item.url.startsWith('https://'));
      return <div className="platform" key={id}><Icon size={22}/><span><strong>{name}</strong><small>{release ? `Version ${release.version}` : 'Native release not yet published'}</small></span>
        {release ? <a href={release.url} className="icon-button" title={`Download ALP for ${name}`} aria-label={`Download ALP for ${name}`}><Download size={20}/></a> : <span className="release-status">In development</span>}</div>;
    })}</div>
  </div>;
}

export function DownloadButton({ className = 'button secondary', children = 'Download app' }) {
  const dialog = useRef(null);
  const opener = useRef(null);
  useEffect(() => () => { document.body.style.overflow = ''; }, []);
  function close() { dialog.current.close(); document.body.style.overflow = ''; opener.current?.focus(); }
  return <><button ref={opener} className={className} onClick={() => { dialog.current.showModal(); document.body.style.overflow = 'hidden'; }}><Download size={18}/>{children}</button>
    <dialog ref={dialog} className="download-dialog" aria-labelledby="download-title" onCancel={close} onClick={event => { if (event.target === dialog.current) close(); }}>
      <div className="dialog-heading"><h2 id="download-title">ALP, wherever you work</h2><button autoFocus className="icon-button" onClick={close} aria-label="Close downloads" title="Close"><X/></button></div>
      <DownloadOptions/>
      <p className="fine-print">The browser app is available now. Native installers will appear here after release verification.</p>
    </dialog></>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    try { setDark(document.documentElement.dataset.theme === 'dark'); } catch {}
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('alp-theme', next ? 'dark' : 'light'); } catch {}
  }
  return <header className="site-header"><div className="container header-row">
    <Link href="/" className="brand" aria-label="ALP home"><img src="/alp-logo.png" alt="" width="42" height="42"/><span><strong>ALP</strong><small>Accelerated Learning Plan</small></span></Link>
    <nav className="desktop-nav" aria-label="Main navigation">{site.navigation.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</nav>
    <div className="header-actions"><button className="icon-button" onClick={toggleTheme} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>{dark ? <Sun size={20}/> : <Moon size={20}/>}</button><Link href="/login" className="header-login">Log in <ArrowUpRight size={15}/></Link><button className="icon-button menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X/> : <Menu/>}</button></div>
    {open && <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">{[...site.navigation, { label: 'About', href: '/about' }, { label: 'Pricing', href: '/pricing' }, { label: 'Contact', href: '/contact' }, { label: 'Downloads', href: '/download' }].map(link => <Link key={link.href} href={link.href}>{link.label}<ArrowUpRight size={16}/></Link>)}</nav>}
  </div></header>;
}

export function Footer() {
  return <footer className="site-footer"><div className="container">
    <div className="footer-grid"><div><Link className="brand footer-brand" href="/"><img src="/alp-logo.png" width="48" height="48" alt=""/><strong>ALP</strong></Link><p>Accelerating growth<br/>for every learner.</p></div>
      <div><h3>Platform</h3>{[['Features','features'],['How ALP works','how-alp-works'],['Solutions','solutions'],['Pricing','pricing'],['Download','download']].map(([label, slug]) => <Link key={slug} href={`/${slug}`}>{label}</Link>)}</div>
      <div><h3>Community</h3>{[['About','about'],['Who we serve','who-we-serve'],['Partners','partners'],['Resources','resources'],['Blog','blog']].map(([label, slug]) => <Link key={slug} href={`/${slug}`}>{label}</Link>)}</div>
      <div><h3>Get in touch</h3><Link href="/contact">Contact ALP</Link><Link href="/contact?subject=demo">Request a demo</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
    </div>
    <div className="colophon"><span>© {new Date().getFullYear()} ALP. Accelerated Learning Plan.</span><span>Built by <a href={site.credit.url} target="_blank" rel="noopener noreferrer">{site.credit.name}</a></span></div>
  </div></footer>;
}

export function Reveal({ children, className }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={false} whileInView={reduced ? {} : { opacity: [0.8, 1], y: [12, 0] }} viewport={{ once: true }} transition={{ duration: 0.4 }}>{children}</motion.div>;
}
