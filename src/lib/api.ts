/**
 * Small helpers shared by route handlers so error responses and body parsing
 * behave the same everywhere.
 */

export function jsonError(status: number, message: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error: message, ...extra }, { status });
}

export type ReadJsonResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parse a JSON request body; returns a ready-made 400 response when the body is invalid. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<ReadJsonResult<T>> {
  try {
    const data = (await request.json()) as T;
    if (data === null || typeof data !== 'object') {
      return { ok: false, response: jsonError(400, 'Request body must be a JSON object.') };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, response: jsonError(400, 'Request body is not valid JSON.') };
  }
}

/** Best-effort client IP from proxy headers. */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Tiny in-memory fixed-window rate limiter. Per-instance only (good enough to
 * stop casual spamming; not a security boundary across instances).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 5000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
      if (buckets.size >= MAX_BUCKETS) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
