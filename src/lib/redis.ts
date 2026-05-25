import Redis from 'ioredis';

// Connects to Railway's Redis instance automatically if the env var is present
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('[Redis] Max retries reached. Stopping reconnection attempts to prevent crashes.');
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 50, 2000);
  }
});

redis.on('error', (err: any) => {
  if (err.code === 'ECONNREFUSED') {
    console.error('[Redis] Connection refused. Is the Redis server running?');
  } else {
    console.error('[Redis] Cache Client Error:', err.message);
  }
});

redis.on('connect', () => console.info('[Redis] Successfully connected.'));