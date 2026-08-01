/**
 * A link href is user input that ends up in an `href` attribute, so the set of
 * schemes allowed through is deliberately small. Tiptap's built-in check already
 * rejects `javascript:` and `data:`, but it also permits ftp, ftps, tel, callto,
 * sms, cid and xmpp -- none of which a manuscript needs. Note that the Link
 * extension's `protocols` option only *widens* its allowlist, so narrowing the
 * surface means replacing `isAllowedUri` outright.
 */
const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];

/**
 * Resolving against a base lets document-relative hrefs (`#section`, `/page`)
 * inherit an allowed protocol instead of being rejected. The base itself is
 * never stored -- only the resolved protocol is inspected.
 */
const RESOLUTION_BASE = "https://writewise.invalid";

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const EMAIL_PATTERN = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

export function isAllowedLinkHref(href: string | null | undefined): boolean {
  // There is nothing to exploit in an absent href, and Tiptap asks about one
  // while rendering marks that have not been given a value yet.
  if (!href) return true;

  try {
    // The URL parser strips the tabs, newlines and leading control characters
    // that `java&#9;script:` style obfuscation relies on, so this inspects the
    // real scheme rather than the literal text.
    return ALLOWED_PROTOCOLS.includes(new URL(href, RESOLUTION_BASE).protocol);
  } catch {
    return false;
  }
}

/**
 * Turns what the writer typed into a usable href. Bare hosts get `https://` and
 * bare addresses get `mailto:`, the way Word and Google Docs do it -- without a
 * scheme the href would otherwise resolve against the app rather than the site
 * the writer meant.
 */
export function normalizeLinkHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Already explicit, or deliberately relative -- leave it alone.
  if (SCHEME_PATTERN.test(trimmed) || trimmed.startsWith("//")) return trimmed;
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return trimmed;

  if (EMAIL_PATTERN.test(trimmed)) return `mailto:${trimmed}`;

  return `https://${trimmed}`;
}
