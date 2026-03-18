import { dedupeEdits } from './edit-deduplication';
import {
  applyAppend,
  applyInsertAfter,
  applyInsertBefore,
  applyPrepend,
  applyReplaceLines,
  applySetLine,
} from './edit-operation-primitives';
import {
  collectLineRefs,
  detectOverlappingRanges,
  getEditLineNumber,
} from './edit-ordering';
import type { HashlineEdit } from './types';
import { validateLineRefs } from './validation';

export interface HashlineApplyReport {
  content: string;
  noopEdits: number;
  deduplicatedEdits: number;
}

export function applyHashlineEditsWithReport(
  content: string,
  edits: HashlineEdit[],
): HashlineApplyReport {
  if (edits.length === 0) {
    return {
      content,
      noopEdits: 0,
      deduplicatedEdits: 0,
    };
  }

  const dedupeResult = dedupeEdits(edits);
  const EDIT_PRECEDENCE: Record<string, number> = {
    replace: 0,
    append: 1,
    prepend: 2,
  };
  const sortedEdits = dedupeResult.edits
    .map((edit, index) => ({ edit, index }))
    .sort((a, b) => {
      const lineA = getEditLineNumber(a.edit);
      const lineB = getEditLineNumber(b.edit);
      if (lineB !== lineA) return lineB - lineA;

      const precedenceDelta =
        (EDIT_PRECEDENCE[a.edit.op] ?? 3) - (EDIT_PRECEDENCE[b.edit.op] ?? 3);
      if (precedenceDelta !== 0) return precedenceDelta;

      const isAnchoredInsertPair =
        (a.edit.op === 'append' || a.edit.op === 'prepend') &&
        a.edit.op === b.edit.op &&
        a.edit.pos &&
        a.edit.pos === b.edit.pos;
      if (isAnchoredInsertPair) {
        return b.index - a.index;
      }

      return a.index - b.index;
    })
    .map(({ edit }) => edit);

  let noopEdits = 0;

  let lines = content.length === 0 ? [] : content.split('\n');

  const refs = collectLineRefs(sortedEdits);
  validateLineRefs(lines, refs);

  const overlapError = detectOverlappingRanges(sortedEdits);
  if (overlapError) throw new Error(overlapError);

  for (const edit of sortedEdits) {
    switch (edit.op) {
      case 'replace': {
        // Handle null or empty lines as deletion
        const replacementLines = edit.lines ?? [];
        const next = edit.end
          ? applyReplaceLines(lines, edit.pos, edit.end, replacementLines, {
              skipValidation: true,
            })
          : applySetLine(lines, edit.pos, replacementLines, {
              skipValidation: true,
            });
        if (next.join('\n') === lines.join('\n')) {
          noopEdits += 1;
          break;
        }
        lines = next;
        break;
      }
      case 'append': {
        const next = edit.pos
          ? applyInsertAfter(lines, edit.pos, edit.lines, {
              skipValidation: true,
            })
          : applyAppend(lines, edit.lines);
        if (next.join('\n') === lines.join('\n')) {
          noopEdits += 1;
          break;
        }
        lines = next;
        break;
      }
      case 'prepend': {
        const next = edit.pos
          ? applyInsertBefore(lines, edit.pos, edit.lines, {
              skipValidation: true,
            })
          : applyPrepend(lines, edit.lines);
        if (next.join('\n') === lines.join('\n')) {
          noopEdits += 1;
          break;
        }
        lines = next;
        break;
      }
    }
  }

  return {
    content: lines.join('\n'),
    noopEdits,
    deduplicatedEdits: dedupeResult.deduplicatedEdits,
  };
}

export function applyHashlineEdits(
  content: string,
  edits: HashlineEdit[],
): string {
  return applyHashlineEditsWithReport(content, edits).content;
}
