import { describe, expect, test } from 'bun:test';
import { computeLineHash } from './hash-computation';
import {
  HashlineMismatchError,
  normalizeLineRef,
  parseLineRef,
  validateLineRef,
  validateLineRefs,
} from './validation';

describe('validation', () => {
  describe('normalizeLineRef', () => {
    test('passes through valid reference', () => {
      expect(normalizeLineRef('1#ZB')).toBe('1#ZB');
    });

    test('trims whitespace', () => {
      expect(normalizeLineRef('  1#ZB  ')).toBe('1#ZB');
    });

    test('strips >>> prefix', () => {
      expect(normalizeLineRef('>>> 1#ZB')).toBe('1#ZB');
    });

    test('strips + prefix', () => {
      expect(normalizeLineRef('+ 1#ZB')).toBe('1#ZB');
    });

    test('strips - prefix', () => {
      expect(normalizeLineRef('- 1#ZB')).toBe('1#ZB');
    });

    test('normalizes # spacing', () => {
      expect(normalizeLineRef('1 # ZB')).toBe('1#ZB');
    });

    test('strips pipe and content after', () => {
      expect(normalizeLineRef('1#ZB|some content')).toBe('1#ZB');
    });

    test('extracts ref from hashline format', () => {
      expect(normalizeLineRef('1#ZB|actual content here')).toBe('1#ZB');
    });

    test('returns trimmed original for invalid format', () => {
      expect(normalizeLineRef('invalid')).toBe('invalid');
    });

    test('extracts ref from copied anchor with surrounding text', () => {
      // This tests the "copied anchor" case - when user copies a hashline ref
      // that has extra text before/after it, like from a chat message
      expect(normalizeLineRef('foo 1#ZB bar')).toBe('1#ZB');
    });

    test('extracts ref from messy anchor with multiple # chars', () => {
      // Edge case: text with multiple hash-like patterns
      expect(normalizeLineRef('see 1#ZB in the code')).toBe('1#ZB');
    });
  });

  describe('parseLineRef', () => {
    test('parses valid reference', () => {
      const result = parseLineRef('42#ZB');
      expect(result.line).toBe(42);
      expect(result.hash).toBe('ZB');
    });

    test('parses reference with whitespace', () => {
      const result = parseLineRef('  10#ZB  ');
      expect(result.line).toBe(10);
      expect(result.hash).toBe('ZB');
    });

    test('parses reference from hashline format', () => {
      const result = parseLineRef('5#ZB|content here');
      expect(result.line).toBe(5);
      expect(result.hash).toBe('ZB');
    });

    test('throws on invalid format - no hash', () => {
      expect(() => parseLineRef('42')).toThrow();
    });

    test('throws on invalid format - no line number', () => {
      expect(() => parseLineRef('#ZB')).toThrow();
    });

    test('throws on invalid format - non-numeric line', () => {
      expect(() => parseLineRef('abc#ZB')).toThrow(/not a line number/);
    });

    test('throws on invalid format - invalid hash chars', () => {
      expect(() => parseLineRef('1#12')).toThrow();
    });

    test('throws on malformed format - reversed', () => {
      expect(() => parseLineRef('ZB#1')).toThrow();
    });
  });

  describe('validateLineRef', () => {
    test('validates matching reference', () => {
      const lines = ['hello world', 'second line'];
      // Compute the actual hash for line 1
      const actualHash = computeLineHash(1, 'hello world');
      expect(() => validateLineRef(lines, `1#${actualHash}`)).not.toThrow();
    });

    test('throws on out of bounds line', () => {
      const lines = ['line1', 'line2'];
      const hash = computeLineHash(10, '');
      expect(() => validateLineRef(lines, `10#${hash}`)).toThrow(
        /out of bounds/,
      );
    });

    test('throws on hash mismatch', () => {
      const lines = ['hello world'];
      // Use a definitely wrong hash (ZZ is not valid but would fail regex)
      expect(() => validateLineRef(lines, '1#ZB')).toThrow(
        HashlineMismatchError,
      );
    });

    test('validates reference without content', () => {
      const lines = ['test content'];
      // This should work if we use the correct hash
      const hash = computeLineHash(1, 'test content');
      expect(() => validateLineRef(lines, `1#${hash}`)).not.toThrow();
    });
  });

  describe('HashlineMismatchError', () => {
    test('error message includes updated LINE#ID snippets', () => {
      const lines = ['original content', 'more content'];
      const error = new HashlineMismatchError(
        [{ line: 1, expected: 'ZB' }],
        lines,
      );
      expect(error.message).toContain('>>>');
      expect(error.message).toMatch(/\d+#[ZPMQVRWSNKTXJBYH]{2}\|/);
    });

    test('formats singular mismatch correctly', () => {
      const lines = ['original', 'more'];
      const error = new HashlineMismatchError(
        [{ line: 1, expected: 'ZB' }],
        lines,
      );
      // Should say "1 line has changed" not "1 line line has changed"
      expect(error.message).toContain('1 line has changed');
      expect(error.message).not.toContain('line line has');
    });

    test('error includes remaps with updated references', () => {
      const lines = ['original', 'more'];
      const error = new HashlineMismatchError(
        [{ line: 1, expected: 'ZB' }],
        lines,
      );
      expect(error.remaps.size).toBeGreaterThan(0);
    });

    test('error formats with context lines', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
      const error = new HashlineMismatchError(
        [{ line: 5, expected: 'ZB' }],
        lines,
      );
      expect(error.message).toContain('>>>');
      // Should include context lines
      expect(error.message).toMatch(/line 3/);
      expect(error.message).toMatch(/line 7/);
    });

    test('handles multiple mismatches', () => {
      const lines = ['a', 'b', 'c', 'd'];
      const error = new HashlineMismatchError(
        [
          { line: 1, expected: 'ZB' },
          { line: 3, expected: 'ZB' },
        ],
        lines,
      );
      expect(error.message).toContain('2 lines have changed');
    });
  });

  describe('validateLineRefs', () => {
    test('validates multiple matching references', () => {
      const lines = ['line1', 'line2', 'line3'];
      // Use valid hash characters from NIBBLE_STR
      const h1 = computeLineHash(1, 'line1');
      const h2 = computeLineHash(2, 'line2');
      expect(() =>
        validateLineRefs(lines, [`1#${h1}`, `2#${h2}`]),
      ).not.toThrow();
    });

    test('throws on first mismatch', () => {
      const lines = ['hello'];
      // Use an invalid hash (not in NIBBLE_STR) to trigger mismatch
      expect(() => validateLineRefs(lines, ['1#ZB'])).toThrow(
        HashlineMismatchError,
      );
    });

    test('throws on out of bounds in batch', () => {
      const lines = ['a', 'b'];
      const h = computeLineHash(1, 'a');
      expect(() => validateLineRefs(lines, [`1#${h}`, '5#ZB'])).toThrow(
        /out of bounds/,
      );
    });
  });
});
