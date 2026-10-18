/**
 * URL Security & Sanitization Utility for External Retailer Navigation
 * 
 * Enforces strict security constraints:
 * - Only HTTPS protocols allowed
 * - Blocks executable schemes (javascript:, data:, file:, vbscript:)
 * - Rejects malformed or relative URLs
 * - Provides safe rel & referrer attributes to avoid Cloudflare/bot trigger referrals
 */

export interface UrlValidationResult {
  isValid: boolean;
  sanitizedUrl: string | null;
  isHttps: boolean;
  error?: string;
}

const FORBIDDEN_SCHEMES = ['javascript:', 'data:', 'file:', 'vbscript:', 'blob:'];

/**
 * Validates and sanitizes external URLs before rendering them as clickable anchors
 */
export function validateExternalUrl(rawUrl?: string | null): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return {
      isValid: false,
      sanitizedUrl: null,
      isHttps: false,
      error: 'URL is empty or missing'
    };
  }

  const trimmed = rawUrl.trim();

  // Check for forbidden executable schemes
  const lower = trimmed.toLowerCase();
  for (const scheme of FORBIDDEN_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return {
        isValid: false,
        sanitizedUrl: null,
        isHttps: false,
        error: `Unsafe URL scheme detected: ${scheme}`
      };
    }
  }

  try {
    const parsed = new URL(trimmed);

    // Enforce strictly HTTPS for external merchant links
    if (parsed.protocol !== 'https:') {
      return {
        isValid: false,
        sanitizedUrl: null,
        isHttps: false,
        error: `Insecure protocol: ${parsed.protocol}. Only https: is permitted.`
      };
    }

    // Must have a valid hostname with at least one dot
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return {
        isValid: false,
        sanitizedUrl: null,
        isHttps: true,
        error: 'Invalid hostname'
      };
    }

    return {
      isValid: true,
      sanitizedUrl: parsed.href,
      isHttps: true
    };
  } catch {
    return {
      isValid: false,
      sanitizedUrl: null,
      isHttps: false,
      error: 'Malformed URL structure'
    };
  }
}

/**
 * Standard secure anchor props for direct external browser navigation
 */
export const SAFE_EXTERNAL_LINK_PROPS = {
  target: '_blank',
  rel: 'noopener noreferrer',
  referrerPolicy: 'no-referrer' as const
};
