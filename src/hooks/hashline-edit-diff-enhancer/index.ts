import {
  countLineDiffs,
  generateUnifiedDiff,
} from '../../tools/hashline-edit/diff-utils';
import { log } from '../../utils';

interface HashlineEditDiffEnhancerConfig {
  hashline_edit?: { enabled: boolean };
}

type BeforeInput = { tool: string; sessionID: string; callID: string };
type BeforeOutput = { args: Record<string, unknown> };
type AfterInput = { tool: string; sessionID: string; callID: string };
type AfterOutput = {
  title: string;
  output: string;
  filePath?: string;
  path?: string;
  file?: string;
  metadata: Record<string, unknown>;
};

const STALE_TIMEOUT_MS = 5 * 60 * 1000;

const pendingCaptures = new Map<
  string,
  { content: string; filePath: string; storedAt: number }
>();

function makeKey(sessionID: string, callID: string): string {
  return `${sessionID}:${callID}`;
}

function cleanupStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of pendingCaptures) {
    if (now - entry.storedAt > STALE_TIMEOUT_MS) {
      pendingCaptures.delete(key);
    }
  }
}

function isWriteTool(toolName: string): boolean {
  return toolName.toLowerCase() === 'write';
}

function extractFilePath(args: Record<string, unknown>): string | undefined {
  const path = args.path ?? args.filePath ?? args.file_path;
  return typeof path === 'string' ? path : undefined;
}

function isFailedWriteOutput(output: string): boolean {
  const normalized = output.trim().toLowerCase();
  return normalized.startsWith('error') || normalized.includes('failed');
}

async function captureOldContent(filePath: string): Promise<string> {
  try {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return await file.text();
    }
  } catch {
    log('[hashline-edit-diff-enhancer] failed to read old content', {
      filePath,
    });
  }
  return '';
}

export function createHashlineEditDiffEnhancerHook(
  config: HashlineEditDiffEnhancerConfig,
) {
  const enabled = config.hashline_edit?.enabled ?? false;

  return {
    'tool.execute.before': async (
      input: BeforeInput,
      output: BeforeOutput,
    ): Promise<void> => {
      if (!enabled || !isWriteTool(input.tool)) return;

      const filePath = extractFilePath(output.args);
      if (!filePath) return;

      cleanupStaleEntries();
      const oldContent = await captureOldContent(filePath);
      pendingCaptures.set(makeKey(input.sessionID, input.callID), {
        content: oldContent,
        filePath,
        storedAt: Date.now(),
      });
    },

    'tool.execute.after': async (
      input: AfterInput,
      output: AfterOutput,
    ): Promise<void> => {
      if (!enabled || !isWriteTool(input.tool)) return;

      const key = makeKey(input.sessionID, input.callID);
      const captured = pendingCaptures.get(key);
      if (!captured) return;
      pendingCaptures.delete(key);

      const { content: oldContent, filePath } = captured;

      if (isFailedWriteOutput(output.output)) {
        return;
      }

      let newContent: string;
      try {
        newContent = await Bun.file(filePath).text();
      } catch {
        log('[hashline-edit-diff-enhancer] failed to read new content', {
          filePath,
        });
        return;
      }

      const { additions, deletions } = countLineDiffs(oldContent, newContent);
      const unifiedDiff = generateUnifiedDiff(oldContent, newContent, filePath);

      // Safely initialize metadata if missing/undefined/null
      if (!output.metadata || typeof output.metadata !== 'object') {
        output.metadata = {};
      }

      output.metadata.filediff = {
        file: filePath,
        path: filePath,
        filePath: filePath,
        before: oldContent,
        after: newContent,
        additions,
        deletions,
      };

      // TUI reads metadata.diff (unified diff string), not filediff object
      output.metadata.diff = unifiedDiff;

      // Set top-level fields to match executor contract
      output.title = filePath;
      output.filePath = filePath;
      output.path = filePath;
      output.file = filePath;
    },
  };
}
