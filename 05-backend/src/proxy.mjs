import { isIP } from 'node:net';

export function trustedProxyAddresses(env) {
  const value = env.ALP_TRUSTED_PROXY_CIDRS;
  if (value === undefined || value === '') return false;
  const entries = value.split(',').map(entry => entry.trim());
  if (entries.length > 64 || entries.some(entry => {
    const parts = entry.split('/');
    const family = isIP(parts[0]);
    if (!family || parts.length > 2) return true;
    if (parts.length === 1) return false;
    if (!/^\d+$/.test(parts[1])) return true;
    const bits = Number(parts[1]);
    return bits < 1 || bits > (family === 4 ? 32 : 128);
  })) throw new Error('ALP_TRUSTED_PROXY_CIDRS must contain explicit IP addresses or non-universal CIDRs.');
  return entries;
}
