export function formatCaption(caption: string, hashtags: readonly string[]): string {
  const text = caption.trim();
  return hashtags.length > 0 ? `${text}\n\n${hashtags.join(' ')}` : text;
}
