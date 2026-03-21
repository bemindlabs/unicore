import { sanitizeCss } from './css-sanitizer';

describe('sanitizeCss', () => {
  it('passes clean CSS through unchanged', () => {
    const css = '.button { color: red; font-size: 14px; }';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(sanitized).toBe(css);
    expect(blocked).toHaveLength(0);
  });

  it('blocks url(javascript:) protocol', () => {
    const css = '.x { background: url(javascript:alert(1)); }';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(blocked).toContain('url(javascript:)');
    expect(sanitized).toContain('/* blocked:url(javascript:) */');
    expect(sanitized).not.toContain('javascript:');
  });

  it('blocks expression() (IE XSS)', () => {
    const css = '.x { width: expression(alert(1)); }';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(blocked).toContain('expression()');
    expect(sanitized).toContain('/* blocked:expression() */');
  });

  it('blocks -moz-binding', () => {
    const css = '.x { -moz-binding: url("evil.xml"); }';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(blocked).toContain('-moz-binding');
    expect(sanitized).not.toContain('-moz-binding:');
  });

  it('blocks behavior: (IE)', () => {
    const css = '.x { behavior: url(evil.htc); }';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(blocked).toContain('behavior:');
  });

  it('blocks </style> tag injection', () => {
    const css = '.x { color: red; } </style><script>alert(1)</script>';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(blocked).toContain('</style>');
    expect(sanitized).not.toContain('</style>');
  });

  it('blocks @import', () => {
    const css = '@import url("https://evil.com/evil.css");';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(blocked).toContain('@import');
    expect(sanitized).not.toContain('@import');
  });

  it('blocks @charset', () => {
    const css = '@charset "UTF-8";';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(blocked).toContain('@charset');
  });

  it('blocks multiple patterns and reports all', () => {
    const css = '@import "x"; @charset "utf-8"; .x { behavior: url(y); }';
    const { sanitized: _, blocked } = sanitizeCss(css);
    expect(blocked).toContain('@import');
    expect(blocked).toContain('@charset');
    expect(blocked).toContain('behavior:');
  });

  it('is case-insensitive for pattern matching', () => {
    const css = '.x { BEHAVIOR: url(evil.htc); }';
    const { blocked } = sanitizeCss(css);
    expect(blocked).toContain('behavior:');
  });

  it('handles empty string', () => {
    const { sanitized, blocked } = sanitizeCss('');
    expect(sanitized).toBe('');
    expect(blocked).toHaveLength(0);
  });

  it('does not block legitimate url() with https', () => {
    const css = '.x { background: url("https://example.com/img.png"); }';
    const { sanitized, blocked } = sanitizeCss(css);
    expect(sanitized).toBe(css);
    expect(blocked).toHaveLength(0);
  });
});
