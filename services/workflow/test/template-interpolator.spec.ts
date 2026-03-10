import { interpolate } from '../src/common/template-interpolator';

describe('interpolate', () => {
  it('replaces a simple token', () => {
    expect(interpolate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces multiple tokens', () => {
    expect(interpolate('{{a}} and {{b}}', { a: 'foo', b: 'bar' })).toBe('foo and bar');
  });

  it('resolves dot-notation path', () => {
    expect(
      interpolate('Amount: {{payload.amount}}', { payload: { amount: 999 } }),
    ).toBe('Amount: 999');
  });

  it('leaves unknown tokens unchanged', () => {
    expect(interpolate('Hello {{unknown}}!', { name: 'World' })).toBe('Hello {{unknown}}!');
  });

  it('handles deeply nested paths', () => {
    expect(interpolate('{{a.b.c}}', { a: { b: { c: 'deep' } } })).toBe('deep');
  });

  it('converts numbers to string', () => {
    expect(interpolate('{{count}}', { count: 42 })).toBe('42');
  });

  it('converts booleans to string', () => {
    expect(interpolate('{{flag}}', { flag: true })).toBe('true');
  });

  it('returns template unchanged when no tokens', () => {
    expect(interpolate('no tokens here', { a: 'b' })).toBe('no tokens here');
  });
});
