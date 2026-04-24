import Redis from 'ioredis';

// Connects to Railway's Redis instance automatically if the env var is present
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.error('Redis Client Error', err));