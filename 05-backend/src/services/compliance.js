// Compliance checking service
export async function checkCompliance(plan) {
  const issues = [];
  if (!plan?.goals?.length)      issues.push({ field: 'goals',           severity: 'critical', message: 'At least one goal is required' });
  if (!plan?.reviewDate)         issues.push({ field: 'reviewDate',      severity: 'critical', message: 'Annual review date is required' });
  if (!plan?.effectiveDate)      issues.push({ field: 'effectiveDate',   severity: 'warning',  message: 'Effective date is required' });
  const score = Math.round(((4 - issues.length) / 4) * 100);
  const isCompliant = issues.filter(i => i.severity === 'critical').length === 0;
  return { isCompliant, score: Math.max(0, score), issues };
}
