import { describe, expect, test } from 'bun:test';
import { countLineDiffs, generateUnifiedDiff } from './diff-utils';

describe('countLineDiffs', () => {
  test('counts simple additions', () => {
    const oldContent = 'line 1\nline 2\n';
    const newContent = 'line 1\nline 2\nline 3\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(1);
    expect(deletions).toBe(0);
  });

  test('counts simple deletions', () => {
    const oldContent = 'line 1\nline 2\nline 3\n';
    const newContent = 'line 1\nline 2\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(0);
    expect(deletions).toBe(1);
  });

  test('counts modifications', () => {
    const oldContent = 'line 1\nline 2\n';
    const newContent = 'line 1\nmodified line\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(1);
    expect(deletions).toBe(1);
  });

  test('correctly counts reordered lines as changes', () => {
    // When lines are reordered, frequency counting shows 0 changes
    // but a true diff would show 2 deletions + 2 additions
    const oldContent = 'a\nb\n';
    const newContent = 'b\na\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    // A proper diff should show at least some changes for reordering
    expect(additions + deletions).toBeGreaterThan(0);
  });

  test('correctly counts duplicate line changes', () => {
    // Adding a duplicate line should count as an addition
    const oldContent = 'line\nline\n';
    const newContent = 'line\nline\nline\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(1);
    expect(deletions).toBe(0);
  });

  test('counts blank line additions', () => {
    // Adding 1 blank line between existing lines
    const oldContent = 'line 1\nline 2\n';
    const newContent = 'line 1\n\nline 2\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(1); // 1 blank line added
    expect(deletions).toBe(0);
  });

  test('counts blank line deletions', () => {
    // Removing 2 blank lines between existing lines
    const oldContent = 'line 1\n\n\nline 2\n';
    const newContent = 'line 1\nline 2\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(0);
    expect(deletions).toBe(2); // Should count 2 blank lines removed
  });

  test('counts consecutive blank lines correctly', () => {
    // Adding 3 consecutive blank lines
    const oldContent = 'start\nend\n';
    const newContent = 'start\n\n\n\nend\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(3);
    expect(deletions).toBe(0);
  });

  test('counts blank lines mixed with content', () => {
    // Adding a line followed by blank line
    const oldContent = 'line 1\nline 2\n';
    const newContent = 'line 1\nnew line\n\nline 2\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    expect(additions).toBe(2); // 1 regular line + 1 blank line
    expect(deletions).toBe(0);
  });

  test('handles complex reorder with duplicates', () => {
    // This case trips up frequency-based counting
    const oldContent = 'a\nb\na\n';
    const newContent = 'a\na\nb\n';
    const { additions, deletions } = countLineDiffs(oldContent, newContent);
    // True diff: one 'a' moved from position 2 to position 1
    // Should show additions + deletions > 0
    expect(additions + deletions).toBeGreaterThan(0);
  });
});

describe('generateUnifiedDiff', () => {
  test('generates diff for simple changes', () => {
    const oldContent = 'line 1\nline 2\n';
    const newContent = 'line 1\nmodified\n';
    const diff = generateUnifiedDiff(oldContent, newContent, 'test.txt');
    expect(diff).toContain('--- test.txt');
    expect(diff).toContain('+++ test.txt');
  });
});
