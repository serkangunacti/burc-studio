export const MAX_HASHTAGS = 5;

export function normalizeHashtag(input: string): string | null {
  const body = input.trim().replace(/^#+/, '').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}_]/gu, '');
  return body ? `#${body}` : null;
}

export function mergeHashtags(base: readonly string[], suggested: readonly string[]): string[] {
  const result: string[] = [];
  for (const tag of [...base, ...suggested]) {
    const normalized = normalizeHashtag(tag);
    if (normalized && !result.includes(normalized)) result.push(normalized);
    if (result.length === MAX_HASHTAGS) break;
  }
  return result;
}
