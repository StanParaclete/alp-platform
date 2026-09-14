import { pages, articles } from '../content/pages.mjs';
export default function sitemap() { const root = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3100'; return ['', ...Object.keys(pages), 'pricing','resources','blog','contact','download','login','privacy','terms', ...articles.map(item=>`blog/${item.slug}`)].map(path=>({ url:`${root}/${path}` })); }
