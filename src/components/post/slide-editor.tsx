'use client';

import { useId } from 'react';
import { RegenerateSignButton } from '@/components/signs/regenerate-sign-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PostDraft, SignText } from '@/lib/posts/draft';
import { editLimitsFor } from '@/lib/posts/edit-schema';
import type { PostSummary } from '@/lib/posts/summary';
import type { SlideData } from '@/remotion/slide-types';
import { CharField } from './char-field';

type EditorProps = {
  post: PostSummary;
  draft: PostDraft;
  errors: Record<string, string>;
  onChange: (draft: PostDraft) => void;
};

export function SlideEditor({
  slide,
  post,
  draft,
  errors,
  onChange,
  onRegenerated,
}: EditorProps & { slide: SlideData; onRegenerated: (postId: string) => void }) {
  const limits = editLimitsFor(post.kind);
  if (slide.type === 'cover') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kapak</CardTitle>
        </CardHeader>
        <CardContent>
          <CharField
            label="Kapak cümlesi"
            value={draft.hook}
            max={limits.coverHook}
            error={errors.coverHook}
            onChange={(hook) => onChange({ ...draft, hook })}
          />
        </CardContent>
      </Card>
    );
  }
  if (slide.type === 'cta') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kapanış</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Kapanış slaytı Ayarlar&apos;daki Instagram kullanıcı adını kullanır.
        </CardContent>
      </Card>
    );
  }
  const text = draft.signs[slide.sign] ?? { headline: slide.headline, body: slide.body, short: '' };
  const update = (patch: Partial<SignText>) => onChange({ ...draft, signs: { ...draft.signs, [slide.sign]: { ...text, ...patch } } });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{slide.signName}</CardTitle>
        <RegenerateSignButton
          date={post.date}
          audience={post.audience}
          kind={post.kind}
          sign={slide.sign}
          name={slide.signName}
          onRegenerated={onRegenerated}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <CharField
          label="Başlık"
          value={text.headline}
          max={limits.headline}
          error={errors[`${slide.sign}.headline`]}
          onChange={(headline) => update({ headline })}
        />
        <CharField
          label="Yorum"
          rows={post.kind === 'weekly' ? 12 : 7}
          value={text.body}
          max={limits.body}
          error={errors[`${slide.sign}.body`]}
          onChange={(body) => update({ body })}
        />
        <CharField
          label={post.kind === 'weekly' ? 'Kısa metin' : 'Kısa metin (Reels)'}
          rows={2}
          value={text.short}
          max={limits.short}
          error={errors[`${slide.sign}.short`]}
          onChange={(short) => update({ short })}
        />
      </CardContent>
    </Card>
  );
}

export function PostTextEditor({ post, draft, errors, onChange }: EditorProps) {
  const limits = editLimitsFor(post.kind);
  const hashtagsId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Açıklama ve format</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CharField
          label="Caption"
          rows={6}
          value={draft.caption}
          max={limits.caption}
          error={errors.caption}
          onChange={(caption) => onChange({ ...draft, caption })}
        />
        <div className="space-y-1.5">
          <Label htmlFor={hashtagsId}>Hashtagler</Label>
          <Input id={hashtagsId} value={draft.hashtags} onChange={(event) => onChange({ ...draft, hashtags: event.target.value })} />
          <p className="text-xs text-muted-foreground">En fazla 5 hashtag; boşlukla ayır.</p>
          {errors.hashtags && (
            <p role="alert" className="text-sm text-destructive">
              {errors.hashtags}
            </p>
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Format</legend>
          {(
            [
              ['4x5', '4:5 (1080×1350)'],
              ['3x4', '3:4 (1080×1440)'],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                value={value}
                checked={draft.format === value}
                onChange={() => onChange({ ...draft, format: value })}
                className="size-4 accent-primary"
              />
              {text}
            </label>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}
