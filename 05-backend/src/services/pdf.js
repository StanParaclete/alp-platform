// PDF generation service — stub (uses pdfkit in production)
export async function generateALPPDF(alpPlan) {
  console.log(`[pdf] generateALPPDF called for plan: ${alpPlan?.id} (stub)`);
  // Return a minimal PDF buffer placeholder
  return Buffer.from(`%PDF-1.4 ALP Plan ${alpPlan?.id || 'demo'}`);
}
export async function generateProgressReport(data) {
  console.log('[pdf] generateProgressReport called (stub)');
  return Buffer.from('%PDF-1.4 Progress Report');
}
