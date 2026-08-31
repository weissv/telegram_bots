import type { StorageAdapter } from 'grammy';
import type Redis from 'ioredis';

const SESSION_TTL = 604800; // 7 days in seconds

/**
 * Creates a Redis-backed StorageAdapter for grammY sessions.
 * Session keys are composite: `sess:{tenantId}:{userId}`.
 * TTL: 7 days. Data persists across server restarts and worker clusters.
 */
export function createRedisSessionStorage<T>(
  redis: Redis,
  tenantId: string
): StorageAdapter<T> {
  function buildKey(userId: string): string {
    return `sess:${tenantId}:${userId}`;
  }

  return {
    async read(key: string): Promise<T | undefined> {
      const redisKey = buildKey(key);
      const data = await redis.get(redisKey);
      if (data === null) return undefined;
      try {
        return JSON.parse(data) as T;
      } catch {
        return undefined;
      }
    },

    async write(key: string, value: T): Promise<void> {
      const redisKey = buildKey(key);
      await redis.setex(redisKey, SESSION_TTL, JSON.stringify(value));
    },

    async delete(key: string): Promise<void> {
      const redisKey = buildKey(key);
      await redis.del(redisKey);
    },
  };
}
