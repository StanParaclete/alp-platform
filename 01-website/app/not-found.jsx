import Link from 'next/link';
export default function NotFound() { return <section className="container page-heading"><p className="eyebrow">404</p><h1>Page not found</h1><p>This address does not match an ALP page.</p><Link className="button" href="/">Return to ALP</Link></section>; }
