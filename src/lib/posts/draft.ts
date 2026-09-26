import type { SignSlug } from '@/lib/zodiac/signs';
import type { PostFormat, SlideProps } from '@/remotion/slide-types';
import type { PostEdit } from './edit-schema';

export type SignText = { headline: string; body: string; short: string };
export type DraftSource = { format: PostFormat; hook: string; caption: string; hashtags: string[]; signs: ({ sign: SignSlug } & SignText)[] };
export type PostDraft = { format: PostFormat; hook: string; caption: string; hashtags: string; signs: Partial<Record<SignSlug, SignText>> };

export function createDraft(source: DraftSource): PostDraft {
  return {
    format: source.format,
    hook: source.hook,
    caption: source.caption,
    hashtags: source.hashtags.join(' '),
    signs: Object.fromEntries(source.signs.map(({ sign, ...text }) => [sign, text])),
  };
}

export function parseHashtagInput(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}

export function draftToEdit(source: DraftSource, draft: PostDraft): PostEdit {
  const edit: PostEdit = {};
  if (draft.format !== source.format) edit.format = draft.format;
  if (draft.hook !== source.hook) edit.coverHook = draft.hook;
  if (draft.caption !== source.caption) edit.caption = draft.caption;
  const hashtags = parseHashtagInput(draft.hashtags);
  if (hashtags.join(' ') !== source.hashtags.join(' ')) edit.hashtags = hashtags;
  const signs = source.signs.flatMap(({ sign, ...original }) => {
    const text = draft.signs[sign] ?? original;
    const changed = text.headline !== original.headline || text.body !== original.body || text.short !== original.short;
    return changed ? [{ sign, ...text }] : [];
  });
  if (signs.length > 0) edit.signs = signs;
  return edit;
}

export function isEmptyEdit(edit: PostEdit): boolean {
  return Object.keys(edit).length === 0;
}

export function applyDraft(slides: readonly SlideProps[], draft: PostDraft): SlideProps[] {
  return slides.map((props) => {
    const { slide } = props;
    if (slide.type === 'cover') return { ...props, format: draft.format, slide: { ...slide, hook: draft.hook } };
    if (slide.type === 'sign') {
      const text = draft.signs[slide.sign];
      return { ...props, format: draft.format, slide: { ...slide, headline: text?.headline ?? slide.headline, body: text?.body ?? slide.body } };
    }
    return { ...props, format: draft.format };
  });
}
