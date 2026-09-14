import './globals.css';
import { Header, Footer } from '../components/SiteChrome';
import site from '../content/site.json';
const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3100';
export const metadata = {
  metadataBase: new URL(base), title: { default: 'ALP | Accelerated Learning Plan', template: '%s | ALP' },
  description: site.description, icons: { icon: '/alp-logo.png' },
  robots: process.env.ALLOW_INDEXING === 'true' ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { title: 'ALP | Accelerated Learning Plan', description: site.description, type: 'website', images: ['/alp-logo.png'] }
};
export const viewport = { themeColor: '#8F16B8', width: 'device-width', initialScale: 1 };
const themeScript = `try{const t=localStorage.getItem('alp-theme');document.documentElement.dataset.theme=t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light'}catch{}`;
export default function RootLayout({ children }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head><body><a className="skip-link" href="#main">Skip to content</a><Header/><main id="main">{children}</main><Footer/></body></html>;
}
