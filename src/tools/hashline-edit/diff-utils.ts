import { createTwoFilesPatch, diffLines } from 'diff';

export function generateUnifiedDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  return createTwoFilesPatch(
    filePath,
    filePath,
    oldContent,
    newContent,
    undefined,
    undefined,
    { context: 3 },
  );
}

export function countLineDiffs(
  oldContent: string,
  newContent: string,
): { additions: number; deletions: number } {
  const changes = diffLines(oldContent, newContent);

  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    // Count lines in the change value.
    // If the value ends with a newline, each newline represents a line.
    // If it doesn't end with a newline, there's content after the last newline.
    // Empty values (no-op changes) should return 0.
    let lineCount = 0;
    if (change.value) {
      const newlineCount = (change.value.match(/\n/g) || []).length;
      lineCount = change.value.endsWith('\n') ? newlineCount : newlineCount + 1;
    }

    if (change.added) {
      additions += lineCount;
    } else if (change.removed) {
      deletions += lineCount;
    }
  }

  return { additions, deletions };
}
