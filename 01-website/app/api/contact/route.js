import { submitEnquiry } from '../../../lib/contact.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) { return submitEnquiry(request); }
