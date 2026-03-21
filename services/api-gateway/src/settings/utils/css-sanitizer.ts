/**
 * CSS sanitizer to prevent XSS via customCss field injection.
 * Blocks dangerous CSS constructs before saving or rendering in <style> tags.
 */

interface SanitizeResult {
  sanitized: string;
  blocked: string[];
}

const DANGEROUS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // javascript: protocol inside url()
  { name: 'url(javascript:)', pattern: /url\s*\(\s*['"]?\s*javascript\s*:/gi },
  // CSS expressions (IE)
  { name: 'expression()', pattern: /expression\s*\(/gi },
  // Firefox XBL binding
  { name: '-moz-binding', pattern: /-moz-binding\s*:/gi },
  // IE behavior
  { name: 'behavior:', pattern: /behavior\s*:/gi },
  // Breaking out of <style> tag
  { name: '</style>', pattern: /<\/style\s*>/gi },
  // @import with external URLs (allow @import url("relative") is risky too, block all)
  { name: '@import', pattern: /@import\b/gi },
  // @charset manipulation
  { name: '@charset', pattern: /@charset\b/gi },
];

export function sanitizeCss(input: string): SanitizeResult {
  const blocked: string[] = [];
  let sanitized = input;

  for (const { name, pattern } of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      blocked.push(name);
      // Reset lastIndex after test (global regex)
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, `/* blocked:${name} */`);
    }
    pattern.lastIndex = 0;
  }

  return { sanitized, blocked };
}
