/**
 * Validates a `?from=` value before ever passing it to `<Navigate>`.
 * `from` is attacker-reachable — anyone can craft a link to
 * `/login?from=https://evil.example.com` or `/login?from=//evil.example.com`
 * hoping a post-login redirect sends the victim off-site — so this is
 * the one gate every such value passes through before use (see
 * `RequireAuth.tsx`, which sets it, and `RedirectIfAuthenticated.tsx`,
 * which consumes it).
 *
 * Only an absolute, same-origin path is accepted: must start with a
 * single `/` (not `//`, which a browser resolves as protocol-relative
 * to a different host), and must not itself resolve to a different
 * origin once parsed. `excludePaths` additionally rejects the
 * authentication pages themselves — without that, an authenticated
 * visitor landing on `/login?from=/login` would bounce straight back to
 * `/login` by `RedirectIfAuthenticated`'s own logic, a redirect loop
 * this value alone can't otherwise prevent.
 */
export function resolveSafeRedirect(
  value: string | null,
  options: { fallback: string; excludePaths?: readonly string[] },
): string {
  const { fallback, excludePaths = [] } = options;

  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  let resolved: URL;
  try {
    resolved = new URL(value, window.location.origin);
  } catch {
    return fallback;
  }
  if (resolved.origin !== window.location.origin) {
    return fallback;
  }

  const path = resolved.pathname + resolved.search + resolved.hash;
  if (excludePaths.includes(resolved.pathname)) {
    return fallback;
  }

  return path;
}
