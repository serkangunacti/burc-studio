import type { Db } from '@/db/types';
import { MAX_HASHTAGS, normalizeHashtag } from '@/lib/content/hashtags';
import { PostConflictError, createPostVersion, getCurrentPost, saveReadings, type NewReading, type PostRow } from '@/lib/content/repository';
import { graphemeLength } from '@/lib/text/turkish';
import { EDIT_LIMITS, type PostEdit } from './edit-schema';
import { getPostDetail } from './repository';

export type EditErrors = Record<string, string>;
export type EditResult =
  | { status: 'created'; postId: string }
  | { status: 'unchanged'; postId: string }
  | { status: 'not-found' }
  | { status: 'stale'; currentId: string | null }
  | { status: 'invalid'; errors: EditErrors };

function checkText(errors: EditErrors, field: string, value: string, max: number): void {
  const length = graphemeLength(value.trim());
  if (length === 0) errors[field] = 'Boş bırakılamaz.';
  else if (length > max) errors[field] = `En fazla ${max} karakter olmalı (şu an ${length}).`;
}

export function validatePostEdit(edit: PostEdit): { ok: true; value: PostEdit } | { ok: false; errors: EditErrors } {
  const errors: EditErrors = {};
  if (edit.coverHook !== undefined) checkText(errors, 'coverHook', edit.coverHook, EDIT_LIMITS.coverHook);
  if (edit.caption !== undefined) {
    checkText(errors, 'caption', edit.caption, EDIT_LIMITS.caption);
    if (edit.caption.includes('#')) errors.caption = 'Caption hashtag içermemeli; hashtagleri ayrı alana yaz.';
  }
  let hashtags: string[] | undefined;
  if (edit.hashtags !== undefined) {
    const normalized = edit.hashtags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map(normalizeHashtag);
    if (normalized.some((tag) => tag === null)) {
      errors.hashtags = 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.';
    } else {
      hashtags = [...new Set(normalized as string[])];
      if (hashtags.length > MAX_HASHTAGS) errors.hashtags = `En fazla ${MAX_HASHTAGS} hashtag kullanılabilir.`;
    }
  }
  for (const sign of edit.signs ?? []) {
    checkText(errors, `${sign.sign}.headline`, sign.headline, EDIT_LIMITS.headline);
    checkText(errors, `${sign.sign}.body`, sign.body, EDIT_LIMITS.body);
    checkText(errors, `${sign.sign}.short`, sign.short, EDIT_LIMITS.short);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      format: edit.format,
      coverHook: edit.coverHook?.trim(),
      caption: edit.caption?.trim(),
      hashtags,
      signs: edit.signs?.map((sign) => ({ sign: sign.sign, headline: sign.headline.trim(), body: sign.body.trim(), short: sign.short.trim() })),
    },
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export async function editPost(db: Db, postId: string, edit: PostEdit, now: Date = new Date()): Promise<EditResult> {
  const checked = validatePostEdit(edit);
  if (!checked.ok) return { status: 'invalid', errors: checked.errors };
  const detail = await getPostDetail(db, postId);
  if (!detail) return { status: 'not-found' };
  const { post } = detail;
  const key = { date: post.date, kind: post.kind, audience: post.audience };
  const stale = async (): Promise<EditResult> => ({ status: 'stale', currentId: (await getCurrentPost(db, key))?.post.id ?? null });
  if (!post.isCurrent) return stale();

  const value = checked.value;
  const readingBySign = new Map(detail.slides.flatMap((slide) => (slide.reading ? [[slide.reading.sign, slide.reading] as const] : [])));
  const changedSigns = (value.signs ?? []).flatMap((edited) => {
    const reading = readingBySign.get(edited.sign);
    if (!reading) return [];
    const changed = reading.headline !== edited.headline || reading.body !== edited.body || reading.short !== edited.short;
    return changed ? [{ edited, reading }] : [];
  });
  const hook = value.coverHook ?? post.cover.hook;
  const caption = value.caption ?? post.caption;
  const hashtags = value.hashtags ?? post.hashtags;
  const format = value.format ?? post.format;
  const postChanged = hook !== post.cover.hook || caption !== post.caption || !sameList(hashtags, post.hashtags) || format !== post.format;
  if (!postChanged && changedSigns.length === 0) return { status: 'unchanged', postId };

  let created: PostRow;
  try {
    created = await db.transaction(async (tx) => {
      const saved = await saveReadings(
        tx,
        key,
        changedSigns.map(
          ({ edited, reading }): NewReading => ({
            sign: reading.sign,
            headline: edited.headline,
            body: edited.body,
            short: edited.short,
            meta: reading.meta,
            provider: reading.provider,
            model: reading.model,
            promptVersion: reading.promptVersion,
            runId: reading.runId,
            editedAt: now,
          }),
        ),
      );
      const savedBySign = new Map(saved.map((row) => [row.sign, row.id]));
      const signReadingIds = detail.slides
        .filter((slide) => slide.type === 'sign')
        .map((slide) => savedBySign.get(slide.reading!.sign) ?? (slide.readingId as string));
      return createPostVersion(tx, {
        ...key,
        templateVersion: post.templateVersion,
        format,
        cover: { hook },
        caption,
        hashtags,
        signReadingIds,
        basePostId: post.id,
      });
    });
  } catch (error) {
    if (error instanceof PostConflictError) return stale();
    throw error;
  }
  return { status: 'created', postId: created.id };
}
