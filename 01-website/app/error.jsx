'use client';
export default function ErrorPage({ reset }) { return <section className="container page-heading"><h1>We couldn’t open this page.</h1><p>Please try again. If the issue continues, return to ALP later.</p><button className="button" onClick={reset}>Try again</button></section>; }
