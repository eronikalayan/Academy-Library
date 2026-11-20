/**
 * Guards against rendering a resource's `sourceUrl` as a live link when it
 * isn't safely openable — the Zod contract only guarantees *well-formed*
 * URL syntax (`z.string().url()`), which still permits schemes like
 * `javascript:` or `data:` that must never end up in an `href`. Call this
 * at render time before linking out to any resource-supplied URL.
 */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
