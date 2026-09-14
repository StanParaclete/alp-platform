export function redisRateLimit(redis) {
  return {
    health:()=>redis.ping(),
    async allow(key,limit,seconds) {
      const count=await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",1,`alp:limit:${key}`,seconds);
      return count<=limit;
    }
  };
}
