import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { pages, articles, resourceGroups } from '../../content/pages.mjs';
import SiteImage from '../../components/SiteImage';
import ContactForm from '../../components/ContactForm';
import { DownloadOptions } from '../../components/SiteChrome';
import { appBase } from '../../lib/urls.mjs';

const special = { pricing: 'Pricing', resources: 'Resources', blog: 'The ALP journal', contact: 'Contact ALP', download: 'Download ALP', login: 'Welcome to ALP', privacy: 'Privacy notice', terms: 'Terms of use' };
export function generateStaticParams() { return [...Object.keys(pages), ...Object.keys(special)].map(slug => ({ slug })); }
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const title = pages[slug]?.title || special[slug];
  return { title, description: pages[slug]?.intro, alternates: { canonical: `/${slug}` } };
}
function PageHeading({ title, eyebrow, intro }) { return <header className="page-heading container"><p className="eyebrow">{eyebrow || 'Accelerated Learning Plan'}</p><h1>{title}</h1>{intro && <p>{intro}</p>}</header>; }
function Enquire() { return <div className="container page-enquiry"><Link href="/contact" className="button">Talk to ALP <ArrowRight size={18}/></Link><Link href="/login" className="text-link">Open the platform <ArrowRight size={18}/></Link></div>; }

export default async function ContentPage({ params, searchParams }) {
  const { slug } = await params;
  if (pages[slug]) {
    const page = pages[slug];
    return <><PageHeading {...page}/><div className="container page-image"><SiteImage id={page.image} priority/></div><div className="container prose-sections">{page.sections.map((section, index) => <section key={section.title}><span className="section-number">{String(index+1).padStart(2,'0')}</span><h2>{section.title}</h2><p>{section.text}</p></section>)}</div><Enquire/></>;
  }
  if (!special[slug]) notFound();
  if (slug === 'contact') {
    const query = await searchParams;
    return <><PageHeading title="Let’s talk about your learners." eyebrow="Contact ALP" intro="Tell us about your school, team or programme. We’ll use your enquiry to understand the next step."/><div className="container contact-layout"><aside><h2>A useful first conversation</h2><p>Include your school size, country and the learning-support workflow you want to improve.</p><p>For product support, describe the issue without including private student records.</p><Link href="/resources" className="text-link">Browse resources <ArrowRight size={18}/></Link></aside><ContactForm initialSubject={query.subject}/></div></>;
  }
  if (slug === 'login' || slug === 'download') return <><PageHeading title={special[slug]} intro="Choose how you want to work. Your institution controls access to its learners and records."/><section className="container gateway"><DownloadOptions/><div className="gateway-note"><h2>Using a phone?</h2><p>The live web app works in a mobile browser and can be added to your home screen. School records currently require an internet connection.</p><Link href="/contact?subject=support" className="text-link">Need help? <ArrowRight size={16}/></Link></div></section></>;
  if (slug === 'pricing') return <><PageHeading title="Start with your team’s needs." eyebrow="Pricing" intro="Begin as an individual teacher or discuss a coordinated rollout for your school or programme."/><div className="container pricing-grid">
    {[{name:'Individual teacher',price:'Free',description:'For a teacher beginning with ALP.',items:['Individual planning workflow','Progress records','ALP document export'],href:`${appBase}/signup`,action:'Start free'}, {name:'Schools & learning centres',price:'Talk to us',description:'For shared planning and school-led adoption.',items:['School access requirements','Staff onboarding and review workflow','Implementation and support scope'],href:'/contact?subject=school',action:'Discuss your school'}, {name:'Programmes & networks',price:'By agreement',description:'For multi-school and organisational requirements.',items:['Data-governance requirements','Regional implementation planning','Reporting and integration scope'],href:'/contact?subject=partnership',action:'Discuss your programme'}].map(plan=><section key={plan.name} className="pricing-item"><h2>{plan.name}</h2><p className="price">{plan.price}</p><p>{plan.description}</p><ul>{plan.items.map(item=><li key={item}><Check size={18}/>{item}</li>)}</ul><a className="button" href={plan.href}>{plan.action}<ArrowRight size={16}/></a></section>)}
    </div><p className="container pricing-note">School and programme prices, scope and availability are confirmed in writing before purchase. This page does not start a paid subscription.</p></>;
  if (slug === 'resources') return <><PageHeading title="Resources for learning support." eyebrow="ALP resources" intro="Practical reading for planning, progress and clearer conversations."/><div className="container resource-list">{resourceGroups.map(group=><section key={group.title}><h2>{group.title}</h2><p>{group.description}</p><Link className="text-link" href={`/blog/${group.article.slug}`}>{group.article.title}<ArrowRight size={18}/></Link></section>)}</div><Enquire/></>;
  if (slug === 'blog') return <><PageHeading title="The ALP journal" intro="Notes on purposeful planning and everyday learning support."/><div className="container article-grid journal-grid">{articles.map(article=><article key={article.slug}><Link href={`/blog/${article.slug}`}><SiteImage id={article.image}/><p className="eyebrow">{article.category}</p><h2>{article.title}</h2><p>{article.summary}</p><span className="text-link">Read article<ArrowRight size={16}/></span></Link></article>)}</div></>;
  if (slug === 'privacy') return <><PageHeading title="Privacy notice" intro="Public website enquiries and school records have different purposes and responsibilities."/><div className="container legal-prose">
    <section><h2>Public website enquiries</h2><p>The contact form asks for your name, email, organisation, enquiry type and message. These details are used to respond to your request. Do not submit identifiable student information, health information or private school documents through the public form.</p></section>
    <section><h2>School records</h2><p>Schools determine the purposes for which their learner records are used and who is authorised to access them. Institutional use must be governed by the relevant agreement and data-processing arrangements. Contact your school first for questions about a learner’s record.</p></section>
    <section><h2>Browser storage and hosting</h2><p>This website stores your light or dark theme preference in your browser. It does not install advertising analytics. Hosting infrastructure may process technical request information needed to deliver and secure the website. Opening the application takes you to a separate authenticated service with its own session handling.</p></section>
    <section><h2>Your choices</h2><p>You can clear the stored theme preference in your browser. To ask about access, correction or deletion of an enquiry, contact ALP and identify the enquiry without sending private student records. Identity may need to be verified before information is disclosed.</p><Link href="/contact?subject=privacy" className="text-link">Contact ALP about privacy<ArrowRight size={16}/></Link></section>
    <section><h2>External services</h2><p>External websites and app distribution services operate their own privacy notices. The Stan Paraclete credit is an external link. No student records are included in that link.</p></section>
    </div></>;
  return <><PageHeading title="Terms of use" intro="These terms describe use of the public ALP website. Institutional services require a separate agreement."/><div className="container legal-prose">
    <section><h2>Using this website</h2><p>Use the website lawfully and do not attempt to disrupt it, bypass access controls or submit material you are not authorised to share. Public enquiries must not contain private learner records.</p></section>
    <section><h2>Educational information</h2><p>Website articles are general information, not an individual assessment, diagnosis, legal opinion or guarantee of educational outcomes. Educators and institutions are responsible for appropriate professional review and local requirements.</p></section>
    <section><h2>Product availability</h2><p>The browser application is available separately. Native downloads are offered only when a release is published. Descriptions of future products do not establish a delivery date or an entitlement to a feature. School and programme services are subject to an agreed scope.</p></section>
    <section><h2>Accounts and school access</h2><p>Access to learner information must be authorised by the responsible institution. Do not share credentials or use another person’s account. Each institution is responsible for its authorised users and the information it provides.</p></section>
    <section><h2>Brand and content</h2><p>ALP branding, website text and supplied media are not transferred to visitors. Third-party content remains subject to its respective rights. Links to other websites do not imply endorsement of all their content.</p></section>
    <section><h2>Questions</h2><p>Contact ALP for questions about website use or to discuss an institutional agreement.</p><Link href="/contact" className="text-link">Contact ALP<ArrowRight size={16}/></Link></section>
    </div></>;
}
