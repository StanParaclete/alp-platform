import { scrypt as scryptCallback, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
const scrypt = promisify(scryptCallback);
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Password must contain 12 to 256 characters.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [algorithm,salt,hash] = encoded.split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{128}$/.test(hash||'')) return false;
  const key = await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return timingSafeEqual(key,Buffer.from(hash,'hex'));
}
export function authTokens(env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 64) throw new Error('JWT_SECRET must contain at least 64 random characters.');
  const key = new TextEncoder().encode(env.JWT_SECRET);
  const issuer = env.JWT_ISSUER || 'alp-api';
  const audience = env.JWT_AUDIENCE || 'alp-clients';
  return {
    issue: (id, sessionId) => new SignJWT(sessionId ? {sid:sessionId} : {}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setSubject(id).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('10m').sign(key),
    verify: token => jwtVerify(token,key,{algorithms:['HS256'],issuer,audience}),
  };
}
export function sameSecret(a,b) { if (!a || !b) return false; const ah=digest(a),bh=digest(b); return timingSafeEqual(Buffer.from(ah),Buffer.from(bh)); }
