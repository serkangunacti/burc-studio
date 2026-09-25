import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/auth/logout', () => {
  it('çerezi silip giriş sayfasına 303 ile yönlendirir', async () => {
    const res = POST(new Request('http://localhost/api/auth/logout', { method: 'POST' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost/giris');
    expect(res.headers.get('set-cookie')).toMatch(/^bs_session=; Path=\/; Expires=Thu, 01 Jan 1970/);
  });
});
