import { describe, expect, test } from 'bun:test';
import {
  applyAppend,
  applyInsertAfter,
  applyInsertBefore,
  applyPrepend,
  applyReplaceLines,
  applySetLine,
} from './edit-operation-primitives';
import { formatHashLine } from './hash-computation';

describe('edit-operation-primitives', () => {
  // Helper to extract anchor from line using formatHashLine
  const anchor = (lineNum: number, content: string): string => {
    return formatHashLine(lineNum, content).split('|')[0];
  };

  describe('applySetLine', () => {
    test('replaces a single line by anchor', () => {
      const lines = ['const a = 1;', 'const b = 2;', 'const c = 3;'];
      const anchorLine = anchor(2, 'const b = 2;');
      const result = applySetLine(lines, anchorLine, 'const b = 42;', {
        skipValidation: true,
      });
      expect(result).toEqual(['const a = 1;', 'const b = 42;', 'const c = 3;']);
    });

    test('replaces with multiline content', () => {
      const lines = ['line1', 'line2', 'line3'];
      const anchorLine = anchor(2, 'line2');
      const result = applySetLine(lines, anchorLine, 'new2a\nnew2b', {
        skipValidation: true,
      });
      expect(result).toEqual(['line1', 'new2a', 'new2b', 'line3']);
    });
  });

  describe('applyReplaceLines', () => {
    test('replaces a range of lines', () => {
      const lines = ['line1', 'line2', 'line3', 'line4'];
      const startAnchor = anchor(2, 'line2');
      const endAnchor = anchor(3, 'line3');
      const result = applyReplaceLines(
        lines,
        startAnchor,
        endAnchor,
        'replaced',
        { skipValidation: true },
      );
      expect(result).toEqual(['line1', 'replaced', 'line4']);
    });

    test('throws when start > end', () => {
      const lines = ['a', 'b', 'c'];
      const startAnchor = anchor(3, 'c');
      const endAnchor = anchor(1, 'a');
      expect(() =>
        applyReplaceLines(lines, startAnchor, endAnchor, 'x', {
          skipValidation: true,
        }),
      ).toThrow();
    });
  });

  describe('applyInsertAfter', () => {
    test('inserts after anchor line', () => {
      const lines = ['line1', 'line2'];
      const anchorLine = anchor(1, 'line1');
      const result = applyInsertAfter(lines, anchorLine, 'inserted', {
        skipValidation: true,
      });
      expect(result).toEqual(['line1', 'inserted', 'line2']);
    });

    test('inserts multiple lines', () => {
      const lines = ['line1'];
      const anchorLine = anchor(1, 'line1');
      const result = applyInsertAfter(lines, anchorLine, 'a\nb\nc', {
        skipValidation: true,
      });
      expect(result).toEqual(['line1', 'a', 'b', 'c']);
    });

    test('handles empty text with skipValidation', () => {
      const lines = ['line1'];
      const anchorLine = anchor(1, 'line1');
      // With skipValidation, empty lines are allowed
      const result = applyInsertAfter(lines, anchorLine, '', {
        skipValidation: true,
      });
      expect(result).toEqual(['line1', '']);
    });
  });

  describe('applyInsertBefore', () => {
    test('inserts before anchor line', () => {
      const lines = ['line1', 'line2'];
      const anchorLine = anchor(2, 'line2');
      const result = applyInsertBefore(lines, anchorLine, 'inserted', {
        skipValidation: true,
      });
      expect(result).toEqual(['line1', 'inserted', 'line2']);
    });

    test('inserts multiple lines', () => {
      const lines = ['line2'];
      const anchorLine = anchor(1, 'line2');
      const result = applyInsertBefore(lines, anchorLine, 'a\nb', {
        skipValidation: true,
      });
      expect(result).toEqual(['a', 'b', 'line2']);
    });

    test('handles empty text with skipValidation', () => {
      const lines = ['line1'];
      const anchorLine = anchor(1, 'line1');
      const result = applyInsertBefore(lines, anchorLine, '', {
        skipValidation: true,
      });
      expect(result).toEqual(['', 'line1']);
    });
  });

  describe('applyAppend', () => {
    test('appends to non-empty file', () => {
      const lines = ['line1', 'line2'];
      const result = applyAppend(lines, 'line3');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    test('appends to empty file (single empty string)', () => {
      const lines = [''];
      const result = applyAppend(lines, 'first');
      expect(result).toEqual(['first']);
    });

    test('appends multiple lines', () => {
      const lines = ['line1'];
      const result = applyAppend(lines, 'line2\nline3');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    test('handles empty text', () => {
      const lines = ['line1'];
      // Empty text is allowed - just appends nothing
      const result = applyAppend(lines, '');
      expect(result).toEqual(['line1', '']);
    });
  });

  describe('applyPrepend', () => {
    test('prepends to non-empty file', () => {
      const lines = ['line2', 'line3'];
      const result = applyPrepend(lines, 'line1');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    test('prepends to empty file (single empty string)', () => {
      const lines = [''];
      const result = applyPrepend(lines, 'first');
      expect(result).toEqual(['first']);
    });

    test('prepends multiple lines', () => {
      const lines = ['line3'];
      const result = applyPrepend(lines, 'line1\nline2');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    test('handles empty text', () => {
      const lines = ['line1'];
      const result = applyPrepend(lines, '');
      expect(result).toEqual(['', 'line1']);
    });
  });
});
