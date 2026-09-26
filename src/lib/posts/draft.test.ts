import { describe, expect, it } from 'vitest';
import { SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from '@/remotion/fixtures';
import { applyDraft, createDraft, draftToEdit, isEmptyEdit, parseHashtagInput, type DraftSource } from './draft';

const source: DraftSource = {
  format: '4x5',
  hook: 'Kanca',
  caption: 'Açıklama',
  hashtags: ['#burç', '#astroloji'],
  signs: [
    { sign: 'koc', headline: 'Koç başlık', body: 'Koç gövde', short: 'Koç kısa' },
    { sign: 'boga', headline: 'Boğa başlık', body: 'Boğa gövde', short: 'Boğa kısa' },
  ],
};

describe('düzenleme taslağı', () => {
  it('dokunulmamış taslak boş düzenleme üretir', () => {
    expect(isEmptyEdit(draftToEdit(source, createDraft(source)))).toBe(true);
  });

  it('yalnızca değişen alanları gönderir', () => {
    const draft = createDraft(source);
    const next = {
      ...draft,
      hook: 'Yeni kanca',
      format: '3x4' as const,
      hashtags: '#burç   İkizler,#yeni',
      signs: { ...draft.signs, boga: { ...draft.signs.boga!, body: 'Yeni gövde' } },
    };
    expect(draftToEdit(source, next)).toEqual({
      format: '3x4',
      coverHook: 'Yeni kanca',
      hashtags: ['#burç', 'İkizler', '#yeni'],
      signs: [{ sign: 'boga', headline: 'Boğa başlık', body: 'Yeni gövde', short: 'Boğa kısa' }],
    });
  });

  it('hashtag girişini boşluk ve virgülden böler', () => {
    expect(parseHashtagInput(' #a, b  #c ')).toEqual(['#a', 'b', '#c']);
    expect(parseHashtagInput('   ')).toEqual([]);
  });

  it('taslağı önizleme slaytlarına uygular', () => {
    const slides = [sampleProps(SAMPLE_COVER), sampleProps(sampleSign('koc')), sampleProps(SAMPLE_CTA)];
    const draft = {
      ...createDraft(source),
      hook: 'Önizleme kancası',
      format: '3x4' as const,
      signs: { koc: { headline: 'Taslak başlık', body: 'Taslak gövde', short: 'x' } },
    };
    const preview = applyDraft(slides, draft);
    expect(preview.map((props) => props.format)).toEqual(['3x4', '3x4', '3x4']);
    expect(preview[0].slide).toMatchObject({ hook: 'Önizleme kancası' });
    expect(preview[1].slide).toMatchObject({ headline: 'Taslak başlık', body: 'Taslak gövde' });
    expect(preview[2].slide).toEqual(SAMPLE_CTA);
  });
});
