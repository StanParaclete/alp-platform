process.env.PORT ||= '3100';
process.env.HOSTNAME = process.env.HOST || '127.0.0.1';
await import('../.next/standalone/server.js');
