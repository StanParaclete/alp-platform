/**
 * Cache — uses Redis if available, otherwise no-op in-memory fallback
 * So the app works without Redis in development
 */

// Simple in-memory fallback
const memStore = new Map();

export const cache = {
  get: async (key) => memStore.get(key) || null,
  set: async (key, value, opts) => { memStore.set(key, value); return 'OK'; },
  del: async (key) => { memStore.delete(key); return 1; },
  ping: async () => 'PONG',
};

// Try to connect to real Redis if configured
if (process.env.REDIS_URL) {
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', () => {}); // silent fail
    await client.connect();
    // Override with real Redis
    cache.get  = (k) => client.get(k);
    cache.set  = (k, v, o) => client.set(k, v, o);
    cache.del  = (k) => client.del(k);
    cache.ping = () => client.ping();
    console.log('✅ Redis connected');
  } catch {
    console.log('ℹ️  Redis not available — using memory cache');
  }
}

export const redis = cache;
export default cache;
