import Elysia from "elysia";
import Redis from "ioredis";

const redis = new Redis({
  host: Bun.env.REDIS_HOST || "localhost",
  port: Number(Bun.env.REDIS_PORT) || 6379,
  password: Bun.env.REDIS_PASSWORD,
})


// Bungkus jadi helper yang enak dipake
export const cacheHelper = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  },

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  },

  async del(key: string): Promise<void> {
    await redis.del(key)
  },

  // Hapus semua key dengan prefix tertentu
  async flush(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) await redis.del(...keys)
  },
}

// Inject ke context Elysia lewat .decorate()
export const redisPlugin = new Elysia({ name: "redis" })
  .decorate("cache", cacheHelper)