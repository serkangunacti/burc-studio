import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import robots from './robots';

describe('arama motoru engeli', () => {
  it('robots.txt her şeyi engeller', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('tüm yanıtlara noindex başlığı eklenir', async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toContainEqual({
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    });
  });
});
