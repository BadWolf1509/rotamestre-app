import { groupBy, escapeHtml } from '../common';

describe('groupBy', () => {
  it('groups by property key', () => {
    const items = [
      { category: 'a', value: 1 },
      { category: 'b', value: 2 },
      { category: 'a', value: 3 },
    ];
    const result = groupBy(items, 'category');
    expect(result).toEqual({
      a: [
        { category: 'a', value: 1 },
        { category: 'a', value: 3 },
      ],
      b: [{ category: 'b', value: 2 }],
    });
  });

  it('groups by extractor function', () => {
    const items = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 20 },
      { name: 'Carol', age: 30 },
    ];
    const result = groupBy(items, (item) => String(item.age));
    expect(result).toEqual({
      '30': [
        { name: 'Alice', age: 30 },
        { name: 'Carol', age: 30 },
      ],
      '20': [{ name: 'Bob', age: 20 }],
    });
  });

  it('returns empty object for empty array', () => {
    expect(groupBy([], 'key' as never)).toEqual({});
  });

  it('handles single-item array', () => {
    const result = groupBy([{ type: 'x' }], 'type');
    expect(result).toEqual({ x: [{ type: 'x' }] });
  });

  it('converts non-string keys to string', () => {
    const items = [
      { status: 1, label: 'active' },
      { status: 0, label: 'inactive' },
      { status: 1, label: 'another' },
    ];
    const result = groupBy(items, 'status');
    expect(Object.keys(result).sort()).toEqual(['0', '1']);
    expect(result['1']).toHaveLength(2);
  });
});

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello" & \'world\'')).toBe(
      '&quot;hello&quot; &amp; &#039;world&#039;'
    );
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns safe strings unchanged', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('escapes all special characters in one string', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
  });
});
