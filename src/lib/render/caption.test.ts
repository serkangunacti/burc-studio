import { describe, expect, it } from 'vitest';
import { formatCaption } from './caption';

describe('formatCaption', () => {
  it('caption ile hashtagleri boş satırla ayırır', () => {
    expect(formatCaption('  Günün yorumları hazır!  ', ['#burç', '#astroloji'])).toBe('Günün yorumları hazır!\n\n#burç #astroloji');
  });

  it('hashtag yoksa yalnızca caption döner', () => {
    expect(formatCaption('Sadece metin', [])).toBe('Sadece metin');
  });
});
