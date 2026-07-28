/**
 * 최소한의 인메모리 레이트 리미터.
 *
 * 목적(저작권법 제93조): 데이터베이스제작자의 데이터베이스(제출 데이터)에 대한
 * "반복적이거나 특정한 목적을 위하여 체계적으로" 이루어지는 상당 부분 추출을
 * 억제하기 위한 기술적 조치. 짧은 시간에 동일 사용자가 대량 조회/추출 API를
 * 반복 호출하는 패턴을 차단한다.
 *
 * NOTE: 프로세스 메모리에만 상태를 두므로 단일 인스턴스 한정으로만 유효하다.
 * docker-compose 구성처럼 WAS를 다중 레플리카로 수평 확장하는 운영 환경에서는
 * Redis 등 공유 저장소 기반 리미터로 교체해야 한다 (README 참고).
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - bucket.windowStart) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}
