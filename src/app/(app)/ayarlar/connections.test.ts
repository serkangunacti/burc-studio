import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./automation-actions', () => ({ connectTelegramAction: vi.fn(), connectInstagramAction: vi.fn(), connectBufferAction: vi.fn() }));
const { Connections } = await import('./connections');

describe('bağlantı kartları', () => {
  it('bağlı hesaplarda etiket, yer tutucu ve Değiştir düğmesi gösterir', () => {
    const html = renderToStaticMarkup(
      createElement(Connections, {
        status: {
          telegram: { username: 'kozmikarkan_bot', chatLinked: true },
          instagram: { username: 'kozmikarkan', expiresAt: '2026-11-26T18:11:03.527Z' },
          tiktok: { channel: 'kozmikarkan' },
        },
      }),
    );
    expect(html.split('✓ Bağlı').length - 1).toBe(3);
    expect(html.split('Bağlı — değiştirmek için yeni anahtar yapıştır').length - 1).toBe(3);
    expect(html).toContain('>Değiştir<');
    expect(html).not.toContain('>Bağla<');
  });

  it('bağlı olmayan hesaplarda kurulum yönergesini ve Bağla düğmesini, /start bekleyen botu ayrı gösterir', () => {
    const html = renderToStaticMarkup(
      createElement(Connections, { status: { telegram: { username: 'kozmikarkan_bot', chatLinked: false }, instagram: null, tiktok: null } }),
    );
    expect(html).toContain('/start bekleniyor');
    expect(html).not.toContain('✓ Bağlı');
    expect(html.split('>Bağla<').length - 1).toBe(2);
  });
});
