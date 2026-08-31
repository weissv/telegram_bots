import { Redis } from 'ioredis';
import { getEnv } from '@telegram-commerce/config';

let redisClient: Redis | null = null;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

export function getRedisClient(): Redis | null {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (!redisClient) {
    const env = getEnv();
    try {
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          if (times > 3) return null; // stop retrying and fallback
          return Math.min(times * 100, 2000);
        },
      });

      redisClient.on('error', (err) => {
        // Silently fallback to memory cache if Redis is unavailable
      });
    } catch {
      redisClient = null;
    }
  }

  return redisClient;
}

export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      return await redis.get(key);
    } catch {
      // fallback
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return cached.value;
  }
  return null;
}

export async function cacheSet(key: string, value: string, ttlSeconds = 3600): Promise<void> {
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      await redis.set(key, value, 'EX', ttlSeconds);
      return;
    } catch {
      // fallback
    }
  }

  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      await redis.del(key);
    } catch {
      // fallback
    }
  }
  memoryCache.delete(key);
}
