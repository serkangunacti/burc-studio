function codeOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'code' in value ? (value as { code: unknown }).code : undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  const cause = typeof error === 'object' && error !== null && 'cause' in error ? (error as { cause: unknown }).cause : undefined;
  return codeOf(error) === '23505' || codeOf(cause) === '23505';
}
