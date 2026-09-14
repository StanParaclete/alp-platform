import Link from 'next/link';
import { ArrowRight, ClipboardList, ChartNoAxesCombined, UsersRound, ShieldCheck } from 'lucide-react';
import SiteImage from '../components/SiteImage';
import { DownloadButton, Reveal } from '../components/SiteChrome';
import { appBase } from '../lib/urls.mjs';
import { articles } from '../content/pages.mjs';
export default function Home() {
  return <>
    <section className="home-hero"><SiteImage slot="hero" priority className="hero-photo"/><div className="hero-shade"/>
      <div className="container hero-content"><p className="eyebrow">For every learner. For every next step.</p><h1>Accelerated<br/>Learning Plan</h1><p className="hero-tagline">Accelerating growth for every learner</p><p className="hero-description">One connected platform for intervention planning, progress monitoring and educational support.</p><div className="button-row"><Link className="button" href="/contact?subject=demo">Request a demo <ArrowRight size={18}/></Link><a className="button hero-secondary" href={`${appBase}/signup`}>Start free trial <ArrowRight size={18}/></a></div></div>
    </section>
    <section className="intro-band"><div className="container intro-row"><p>Built around learners.<br/><strong>Designed for the people supporting them.</strong></p><Link href="/how-alp-works" className="text-link">How ALP works <ArrowRight size={18}/></Link></div></section>
    <section className="section container"><Reveal><div className="section-heading"><p className="eyebrow">The work that matters</p><h2>Turn a plan into<br/>everyday progress.</h2><p>Bring the learner’s strengths, the team’s priorities and the evidence into the same conversation.</p></div></Reveal>
      <div className="feature-grid">{[[ClipboardList,'Plan with purpose','Connect a clear baseline to a measurable goal and practical support.'],[ChartNoAxesCombined,'See the progress','Build a record of observations and measurements over time.'],[UsersRound,'Keep people connected','Give school teams a shared record and families understandable updates.']].map(([Icon,title,description]) => <Reveal key={title} className="feature-item"><Icon size={30} strokeWidth={1.5}/><h3>{title}</h3><p>{description}</p></Reveal>)}</div>
      <Link href="/features" className="text-link">Explore the platform <ArrowRight size={18}/></Link>
    </section>
    <section className="section muted-band"><div className="container"><div className="section-heading compact"><p className="eyebrow">Different settings. A shared ambition.</p><h2>Learning has no single path.</h2></div><div className="audience-grid">
      {[["reading","Teachers & specialists","who-we-serve"],["community","Schools & learning centres","solutions"],["class","Programmes & partners","partners"]].map(([id,title,href]) => <Link key={id} href={`/${href}`} className="photo-link"><SiteImage id={id}/><span>{title}<ArrowRight size={22}/></span></Link>)}
    </div></div></section>
    <section className="section container"><div className="editorial-row"><div><p className="eyebrow">Trust is part of the work</p><h2>Student records deserve careful handling.</h2><p>Access, school separation and a clear review process belong at the heart of learning support. Discuss your institution’s requirements before rollout.</p><Link className="text-link" href="/privacy">Privacy and responsibilities <ShieldCheck size={18}/></Link></div><SiteImage id="library" className="editorial-photo"/></div></section>
    <section className="section muted-band"><div className="container"><div className="heading-row"><div><p className="eyebrow">From the ALP journal</p><h2>Ideas for thoughtful practice.</h2></div><Link href="/blog" className="text-link">All articles <ArrowRight size={18}/></Link></div><div className="article-grid">{articles.map(article => <article key={article.slug}><Link href={`/blog/${article.slug}`}><SiteImage id={article.image}/><p className="eyebrow">{article.category}</p><h3>{article.title}</h3><p>{article.summary}</p><span className="text-link">Read article <ArrowRight size={16}/></span></Link></article>)}</div></div></section>
    <section className="closing-band"><div className="container"><p className="eyebrow">Your next step</p><h2>Bring ALP into your school.</h2><p>Start a conversation about your learners, your team and the support you want to strengthen.</p><div className="button-row"><Link className="button" href="/contact?subject=demo">Request a demo <ArrowRight size={18}/></Link><DownloadButton className="button hero-secondary"/></div></div></section>
  </>;
}
