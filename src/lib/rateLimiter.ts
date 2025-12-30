const rateLimit = new Map<string, { count: number; timestamp: number }>();
const DEFAULT_TIME_WINDOW = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 5;
const MAX_ENTRIES = 10000;

type RateLimitOptions = {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
};

const pruneExpired = (now: number, windowMs: number) => {
  if (rateLimit.size < MAX_ENTRIES) {
    return;
  }
  for (const [key, value] of rateLimit.entries()) {
    if (now - value.timestamp > windowMs * 2) {
      rateLimit.delete(key);
    }
  }
};

export const checkRateLimit = (ip: string | undefined, options: RateLimitOptions = {}) => {
  const now = Date.now();
  const windowMs = options.windowMs ?? DEFAULT_TIME_WINDOW;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const keyPrefix = options.keyPrefix ?? "default";
  const key = `${keyPrefix}:${ip || "unknown"}`;
  const user = rateLimit.get(key);

  pruneExpired(now, windowMs);

  if (user && now - user.timestamp < windowMs) {
    if (user.count + 1 > maxRequests) {
      return false;
    }
    rateLimit.set(key, { count: user.count + 1, timestamp: user.timestamp });
  } else {
    rateLimit.set(key, { count: 1, timestamp: now });
  }

  return true;
};
