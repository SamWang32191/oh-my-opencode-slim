import { describe, expect, test } from 'bun:test';
import {
  applyHashlineEdits,
  applyHashlineEditsWithReport,
} from './edit-operations';
import { formatHashLine } from './hash-computation';
import type { HashlineEdit } from './types';

// Helper to extract anchor from line using formatHashLine
const anchor = (lineNum: number, content: string): string => {
  return formatHashLine(lineNum, content).split('|')[0];
};

describe('applyHashlineEdits applies', () => {
  describe('single-line replace by anchor', () => {
    test('replaces a single line using anchor', () => {
      const content = 'const a = 1;\nconst b = 2;\nconst c = 3;';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(2, 'const b = 2;'),
          lines: 'const b = 42;',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('const a = 1;\nconst b = 42;\nconst c = 3;');
    });

    test('replaces with multiline content', () => {
      const content = 'line1\nline2\nline3';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(2, 'line2'),
          lines: 'new line 2a\nnew line 2b',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nnew line 2a\nnew line 2b\nline3');
    });
  });

  describe('range replace by pos and end', () => {
    test('replaces a range of lines', () => {
      const content = 'line1\nline2\nline3\nline4';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(2, 'line2'),
          end: anchor(3, 'line3'),
          lines: 'replaced',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nreplaced\nline4');
    });

    test('replaces entire file when range covers all', () => {
      const content = 'line1\nline2';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(1, 'line1'),
          end: anchor(2, 'line2'),
          lines: 'only',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('only');
    });
  });

  describe('anchored append', () => {
    test('appends after a line', () => {
      const content = 'line1\nline2';
      const edits: HashlineEdit[] = [
        { op: 'append', pos: anchor(1, 'line1'), lines: 'after line1' },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nafter line1\nline2');
    });

    test('appends multiple lines', () => {
      const content = 'first';
      const edits: HashlineEdit[] = [
        { op: 'append', pos: anchor(1, 'first'), lines: 'line2\nline3' },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('first\nline2\nline3');
    });
  });

  describe('anchored prepend', () => {
    test('prepends before a line', () => {
      const content = 'line1\nline2';
      const edits: HashlineEdit[] = [
        { op: 'prepend', pos: anchor(2, 'line2'), lines: 'before line2' },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nbefore line2\nline2');
    });

    test('prepends multiple lines', () => {
      const content = 'last';
      const edits: HashlineEdit[] = [
        { op: 'prepend', pos: anchor(1, 'last'), lines: 'line1\nline2' },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nline2\nlast');
    });
  });

  describe('same-anchor insertion order', () => {
    test('preserves request order for anchored append edits', () => {
      const content = 'A\nB';
      const edits: HashlineEdit[] = [
        { op: 'append', pos: anchor(1, 'A'), lines: 'x' },
        { op: 'append', pos: anchor(1, 'A'), lines: 'y' },
      ];

      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('A\nx\ny\nB');
    });

    test('preserves request order for anchored prepend edits', () => {
      const content = 'A\nB';
      const edits: HashlineEdit[] = [
        { op: 'prepend', pos: anchor(2, 'B'), lines: 'x' },
        { op: 'prepend', pos: anchor(2, 'B'), lines: 'y' },
      ];

      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('A\nx\ny\nB');
    });
  });

  describe('unanchored append on empty and non-empty files', () => {
    test('appends to non-empty file at end', () => {
      const content = 'line1\nline2';
      const edits: HashlineEdit[] = [{ op: 'append', lines: 'line3' }];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nline2\nline3');
    });

    test('appends to empty file', () => {
      const content = '';
      const edits: HashlineEdit[] = [{ op: 'append', lines: 'first line' }];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('first line');
    });

    test('appends to single empty line file', () => {
      const content = '';
      const edits: HashlineEdit[] = [{ op: 'append', lines: 'first' }];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('first');
    });
  });

  describe('unanchored prepend on empty and non-empty files', () => {
    test('prepends to non-empty file at beginning', () => {
      const content = 'line2\nline3';
      const edits: HashlineEdit[] = [{ op: 'prepend', lines: 'line1' }];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nline2\nline3');
    });

    test('prepends to empty file', () => {
      const content = '';
      const edits: HashlineEdit[] = [{ op: 'prepend', lines: 'first line' }];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('first line');
    });

    test('prepends to single empty line file', () => {
      const content = '';
      const edits: HashlineEdit[] = [{ op: 'prepend', lines: 'first' }];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('first');
    });
  });

  describe('lines null deletion through replace', () => {
    test('deletes a single line with null', () => {
      const content = 'line1\nline2\nline3';
      const edits: HashlineEdit[] = [
        { op: 'replace', pos: anchor(2, 'line2'), lines: null as any },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nline3');
    });

    test('deletes a range with null', () => {
      const content = 'line1\nline2\nline3\nline4';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(2, 'line2'),
          end: anchor(3, 'line3'),
          lines: null as any,
        },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nline4');
    });

    test('deletes a range with empty array', () => {
      const content = 'line1\nline2\nline3';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(2, 'line2'),
          end: anchor(2, 'line2'),
          lines: [],
        },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('line1\nline3');
    });
  });

  describe('dedupe and noop counts', () => {
    test('reports noop edits when content unchanged', () => {
      const content = 'line1\nline2';
      const edits: HashlineEdit[] = [
        { op: 'replace', pos: anchor(1, 'line1'), lines: 'line1' }, // same content = noop
      ];
      const result = applyHashlineEditsWithReport(content, edits);
      expect(result.noopEdits).toBe(1);
      expect(result.deduplicatedEdits).toBe(0);
      expect(result.content).toBe(content);
    });

    test('reports deduplicated edits', () => {
      const content = 'line1\nline2';
      const edits: HashlineEdit[] = [
        { op: 'replace', pos: anchor(2, 'line2'), lines: 'changed' },
        { op: 'replace', pos: anchor(2, 'line2'), lines: 'changed' }, // duplicate
      ];
      const result = applyHashlineEditsWithReport(content, edits);
      expect(result.deduplicatedEdits).toBe(1);
      expect(result.content).toBe('line1\nchanged');
    });

    test('empty edits array returns original content', () => {
      const content = 'some content';
      const result = applyHashlineEditsWithReport(content, []);
      expect(result.content).toBe(content);
      expect(result.noopEdits).toBe(0);
      expect(result.deduplicatedEdits).toBe(0);
    });
  });

  describe('stripping echoed boundary lines', () => {
    test('strips anchor echo on append', () => {
      const content = 'const x = 1;';
      const edits: HashlineEdit[] = [
        {
          op: 'append',
          pos: anchor(1, 'const x = 1;'),
          lines: 'const x = 1;\nconst y = 2;',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      // First line matches anchor, should be stripped
      expect(result).toBe('const x = 1;\nconst y = 2;');
    });

    test('strips anchor echo on prepend', () => {
      const content = 'const y = 2;';
      const edits: HashlineEdit[] = [
        {
          op: 'prepend',
          pos: anchor(1, 'const y = 2;'),
          lines: 'const x = 1;\nconst y = 2;',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      // Last line matches anchor, should be stripped
      expect(result).toBe('const x = 1;\nconst y = 2;');
    });
  });

  describe('preserving indentation', () => {
    test('preserves indentation when replacing single line', () => {
      const content = '  indented line';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(1, '  indented line'),
          lines: 'new content',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      // Should preserve the leading whitespace from original
      expect(result).toBe('  new content');
    });

    test('preserves indentation for range replacement', () => {
      const content = '  line1\n  line2';
      const edits: HashlineEdit[] = [
        {
          op: 'replace',
          pos: anchor(1, '  line1'),
          end: anchor(2, '  line2'),
          lines: 'new',
        },
      ];
      const result = applyHashlineEdits(content, edits);
      // First line gets original indent restored
      expect(result).toBe('  new');
    });
  });

  describe('multiple edits applied bottom-up', () => {
    test('applies multiple edits in correct order', () => {
      const content = 'a\nb\nc\nd';
      const edits: HashlineEdit[] = [
        { op: 'replace', pos: anchor(1, 'a'), lines: 'first' },
        { op: 'replace', pos: anchor(3, 'c'), lines: 'third' },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('first\nb\nthird\nd');
    });

    test('handles overlapping line numbers correctly', () => {
      const content = 'a\nb\nc';
      // Append after line 2 should not affect line 3
      const edits: HashlineEdit[] = [
        { op: 'append', pos: anchor(2, 'b'), lines: 'after b' },
        { op: 'replace', pos: anchor(3, 'c'), lines: 'replaced c' },
      ];
      const result = applyHashlineEdits(content, edits);
      expect(result).toBe('a\nb\nafter b\nreplaced c');
    });
  });
});
