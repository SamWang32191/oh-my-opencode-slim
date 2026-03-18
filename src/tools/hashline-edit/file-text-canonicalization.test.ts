import { describe, expect, test } from 'bun:test';
import {
  canonicalizeFileText,
  type FileTextEnvelope,
  restoreFileText,
} from './file-text-canonicalization';

describe('file-text-canonicalization', () => {
  describe('canonicalizeFileText', () => {
    test('preserves LF line endings', () => {
      const content = 'line1\nline2\nline3';
      const result = canonicalizeFileText(content);
      expect(result.lineEnding).toBe('\n');
      expect(result.hadBom).toBe(false);
      expect(result.content).toBe('line1\nline2\nline3');
    });

    test('converts CRLF to LF', () => {
      const content = 'line1\r\nline2\r\nline3';
      const result = canonicalizeFileText(content);
      expect(result.lineEnding).toBe('\r\n');
      expect(result.content).toBe('line1\nline2\nline3');
    });

    test('detects BOM and strips it', () => {
      const content = '\uFEFFline1\nline2';
      const result = canonicalizeFileText(content);
      expect(result.hadBom).toBe(true);
      expect(result.content).toBe('line1\nline2');
    });

    test('handles mixed CR and CRLF', () => {
      const content = 'line1\r\nline2\rline3\nline4';
      const result = canonicalizeFileText(content);
      expect(result.content).toBe('line1\nline2\nline3\nline4');
    });

    test('handles empty content', () => {
      const result = canonicalizeFileText('');
      expect(result.lineEnding).toBe('\n');
      expect(result.hadBom).toBe(false);
      expect(result.content).toBe('');
    });
  });

  describe('restoreFileText', () => {
    test('restores LF content unchanged', () => {
      const envelope: FileTextEnvelope = {
        content: 'line1\nline2',
        lineEnding: '\n',
        hadBom: false,
      };
      const result = restoreFileText('line1\nline2', envelope);
      expect(result).toBe('line1\nline2');
    });

    test('restores CRLF line endings', () => {
      const envelope: FileTextEnvelope = {
        content: 'line1\nline2',
        lineEnding: '\r\n',
        hadBom: false,
      };
      const result = restoreFileText('line1\nline2', envelope);
      expect(result).toBe('line1\r\nline2');
    });

    test('restores BOM when hadBom is true', () => {
      const envelope: FileTextEnvelope = {
        content: 'line1\nline2',
        lineEnding: '\n',
        hadBom: true,
      };
      const result = restoreFileText('line1\nline2', envelope);
      expect(result).toBe('\uFEFFline1\nline2');
    });

    test('restores BOM with CRLF', () => {
      const envelope: FileTextEnvelope = {
        content: 'line1\nline2',
        lineEnding: '\r\n',
        hadBom: true,
      };
      const result = restoreFileText('line1\nline2', envelope);
      expect(result).toBe('\uFEFFline1\r\nline2');
    });
  });
});
