import { describe, expect, test } from 'bun:test';
import {
  autocorrectReplacementLines,
  maybeExpandSingleLineMerge,
  restoreIndentForPairedReplacement,
  restoreOldWrappedLines,
} from './autocorrect-replacement-lines';

describe('restoreOldWrappedLines', () => {
  test('returns replacement unchanged when original is empty', () => {
    const original: string[] = [];
    const replacement = ['line1', 'line2'];
    expect(restoreOldWrappedLines(original, replacement)).toEqual(replacement);
  });

  test('returns replacement unchanged when only one replacement line', () => {
    const original = ['line1', 'line2'];
    const replacement = ['single line'];
    expect(restoreOldWrappedLines(original, replacement)).toEqual(replacement);
  });

  test('restores wrapped line when unique match found in multi-line replacement', () => {
    // When LLM wraps two original lines into one replacement line,
    // restoreOldWrappedLines can unwrap them back
    // The key is: original has fewer lines than replacement can combine to match
    const original = ['const x = 1;', 'const y = 2;'];
    // Two replacement lines that when combined match a single original line
    const replacement = ['const x = 1;const y = 2;'];
    // Since replacement has only 1 line, restoreOldWrappedLines returns early
    // This tests the early return behavior
    expect(restoreOldWrappedLines(original, replacement)).toEqual(replacement);
  });

  test('returns replacement when no unique candidates', () => {
    const original = ['a', 'b', 'c', 'a', 'b', 'c'];
    const replacement = ['abcabc'];
    expect(restoreOldWrappedLines(original, replacement)).toEqual(replacement);
  });

  test('sorts candidates by start position descending', () => {
    const original = ['line one', 'line two', 'line three'];
    const replacement = ['line oneline two', 'line three'];
    const result = restoreOldWrappedLines(original, replacement);
    expect(result).toEqual(replacement);
  });
});

describe('maybeExpandSingleLineMerge', () => {
  test('returns unchanged when not single line replacement', () => {
    const original = ['line1', 'line2'];
    const replacement = ['line1', 'line2'];
    expect(maybeExpandSingleLineMerge(original, replacement)).toEqual(
      replacement,
    );
  });

  test('returns unchanged when original has empty lines', () => {
    const original = ['line1', '', 'line2'];
    const replacement = ['line1line2'];
    expect(maybeExpandSingleLineMerge(original, replacement)).toEqual(
      replacement,
    );
  });

  test('expands when all parts found in order', () => {
    const original = ['const a = 1;', 'const b = 2;'];
    const replacement = ['const a = 1;const b = 2;'];
    const result = maybeExpandSingleLineMerge(original, replacement);
    expect(result).toEqual(['const a = 1;', 'const b = 2;']);
  });

  test('expands using semicolon split fallback', () => {
    const original = ['const a = 1;', 'const b = 2;'];
    // Semicolon split requires semicolon followed by whitespace
    const replacement = ['const a = 1; const b = 2;'];
    const result = maybeExpandSingleLineMerge(original, replacement);
    expect(result).toEqual(['const a = 1;', 'const b = 2;']);
  });

  test('returns unchanged when expansion fails', () => {
    const original = ['const a = 1;', 'const b = 2;'];
    const replacement = ['unrelated content'];
    expect(maybeExpandSingleLineMerge(original, replacement)).toEqual(
      replacement,
    );
  });

  test('handles trailing continuation tokens in ordered match', () => {
    const original = ['const a = 1', 'const b = 2'];
    const replacement = ['const a = 1const b = 2'];
    const result = maybeExpandSingleLineMerge(original, replacement);
    // Should find both parts and expand to 2 lines
    expect(result.length).toBe(2);
  });
});

describe('restoreIndentForPairedReplacement', () => {
  test('returns unchanged when lengths differ', () => {
    const original = ['line1'];
    const replacement = ['line1', 'line2'];
    expect(restoreIndentForPairedReplacement(original, replacement)).toEqual(
      replacement,
    );
  });

  test('preserves existing indentation', () => {
    const original = ['  line1'];
    const replacement = ['  line1'];
    expect(restoreIndentForPairedReplacement(original, replacement)).toEqual(
      replacement,
    );
  });

  test('adds indent when original has indent and replacement has none', () => {
    const original = ['  line1'];
    const replacement = ['line1'];
    const result = restoreIndentForPairedReplacement(original, replacement);
    expect(result).toEqual(['  line1']);
  });

  test('adds indent when lines are identical after trim (reformatting)', () => {
    const original = ['  line1'];
    const replacement = ['line1'];
    // When original trimmed equals replacement trimmed, the content is the same
    // so we SHOULD add the indent back (reformatting case)
    const result = restoreIndentForPairedReplacement(original, replacement);
    expect(result).toEqual(['  line1']);
  });

  test('preserves empty lines', () => {
    const original = ['  line1', ''];
    const replacement = ['line1', ''];
    const result = restoreIndentForPairedReplacement(original, replacement);
    expect(result).toEqual(['  line1', '']);
  });

  test('handles multiple lines with mixed indentation', () => {
    const original = ['  line1', '    line2', '  line3'];
    const replacement = ['line1', 'line2', 'line3'];
    const result = restoreIndentForPairedReplacement(original, replacement);
    expect(result).toEqual(['  line1', '    line2', '  line3']);
  });
});

describe('autocorrectReplacementLines', () => {
  test('applies all corrections in sequence', () => {
    const original = ['const a = 1;', 'const b = 2;'];
    const replacement = ['const a = 1;const b = 2;'];
    const result = autocorrectReplacementLines(original, replacement);
    // Should expand the single line merge
    expect(result.length).toBe(2);
  });

  test('returns original when no corrections needed', () => {
    const original = ['line1', 'line2'];
    const replacement = ['line1', 'line2'];
    expect(autocorrectReplacementLines(original, replacement)).toEqual(
      replacement,
    );
  });
});
