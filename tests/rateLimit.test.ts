import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('search rate limits (in-memory fallback, no Supabase)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.SEARCH_LIMIT_GUEST_PER_HOUR = '2';
  });

  it('blocks a guest after the hourly limit, per IP', async () => {
    const { consumeSearchQuota } = await import('@/lib/security/rateLimit');
    const from = (ip: string) => new Headers({ 'x-forwarded-for': ip });

    expect((await consumeSearchQuota(from('1.1.1.1'))).allowed).toBe(true);
    expect((await consumeSearchQuota(from('1.1.1.1'))).allowed).toBe(true);
    const third = await consumeSearchQuota(from('1.1.1.1'));
    expect(third.allowed).toBe(false);
    expect(third.resetInSeconds).toBeGreaterThan(0);

    // a different visitor is not affected
    expect((await consumeSearchQuota(from('2.2.2.2'))).allowed).toBe(true);
  });

  it('treats an invalid token as a guest', async () => {
    const { consumeSearchQuota } = await import('@/lib/security/rateLimit');
    const q = await consumeSearchQuota(new Headers({ authorization: 'Bearer fake', 'x-forwarded-for': '3.3.3.3' }));
    expect(q.signedIn).toBe(false);
    expect(q.limit).toBe(2);
  });
});
