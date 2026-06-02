import { Queue } from 'bullmq';
import { getEnv } from './env.js';

export const BRAND_MEMORY_QUEUE = 'brand-memory';
export const RENDER_PREVIEW_QUEUE = 'render-preview';

const env = getEnv();
const redisUrl = new URL(env.REDIS_URL);

export const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: redisUrl.pathname && redisUrl.pathname !== '/' ? Number(redisUrl.pathname.slice(1)) : undefined,
  maxRetriesPerRequest: null,
};

export const brandMemoryQueue = new Queue(BRAND_MEMORY_QUEUE, {
  connection: redisConnection,
});

export const renderPreviewQueue = new Queue(RENDER_PREVIEW_QUEUE, {
  connection: redisConnection,
});
