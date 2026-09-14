import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { articles } from '../../../content/pages.mjs';
import SiteImage from '../../../components/SiteImage';
export function generateStaticParams() { return articles.map(item => ({ article: item.slug })); }
export async function generateMetadata({ params }) { const { article } = await params; const item = articles.find(item => item.slug === article); return { title: item?.title, description: item?.summary }; }
export default async function Article({ params }) {
  const { article } = await params;
  const item = articles.find(item => item.slug === article);
  if (!item) notFound();
  return <article className="container journal-article"><Link className="text-link" href="/blog"><ArrowLeft size={16}/>ALP journal</Link><header><p className="eyebrow">{item.category}</p><h1>{item.title}</h1><p>{item.summary}</p><small>ALP editorial</small></header><SiteImage id={item.image} priority/>{item.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}<Link className="text-link" href="/resources">More resources<ArrowLeft size={16}/></Link></article>;
}
