import { type Dirent, existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { parseFrontmatter } from '../utils';
import { log } from '../utils/logger';

export type SkillSource = 'agents' | 'opencode';

export interface CommandDefinition {
  description?: string;
  template: string;
  model?: string;
  agent?: string;
  subtask?: boolean;
}

interface SkillFile {
  filePath: string;
  commandName: string;
  root: string;
  source: SkillSource;
}

interface LoadedCommand {
  definition: CommandDefinition;
  sourcePath: string;
}

interface ParsedSkillFile {
  skillFile: SkillFile;
  content?: string;
  readError?: string;
}

const discoveredSkillsCache = new Map<
  string,
  Promise<Record<string, CommandDefinition>>
>();

function toSubtask(value?: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function sanitizeModelField(
  model: string | undefined,
  source: SkillSource,
): string | undefined {
  if (source === 'agents') return undefined;
  if (!model?.trim()) return undefined;
  return model.trim();
}

function resolveSkillPathReferences(body: string, dir: string): string {
  const normalizedDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
  return body.replace(
    /(?<![a-zA-Z0-9])@((?=[a-zA-Z0-9_.\-/]*[/.])[a-zA-Z0-9_.\-/]+)/g,
    (_, target: string) => join(normalizedDir, target),
  );
}

function wrapSkillTemplate(body: string, dir: string): string {
  const resolvedBody = resolveSkillPathReferences(body, dir);
  return `<skill-instruction>\nBase directory for this skill: ${dir}/\nFile references (@path) in this skill are relative to this directory.\n\n${resolvedBody}</skill-instruction>\n\n<user-request>\n$ARGUMENTS\n</user-request>`;
}

function createSkillTemplate(
  body: string,
  dir: string,
  isWrapped: boolean,
): string {
  if (!isWrapped) {
    return resolveSkillPathReferences(body, dir);
  }

  return wrapSkillTemplate(body, dir);
}

async function collectSkillFiles(
  root: string,
  source: SkillSource,
  currentDir = root,
): Promise<SkillFile[]> {
  let entries: Dirent[];

  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    log('[skills] failed to read skill directory', {
      root: relative(process.cwd(), currentDir),
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files: SkillFile[] = [];

  for (const entry of entries) {
    const entryPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      const skillFilePath = join(entryPath, 'SKILL.md');
      if (existsSync(skillFilePath)) {
        files.push({
          filePath: skillFilePath,
          commandName: entry.name,
          root,
          source,
        });
      } else {
        files.push(...(await collectSkillFiles(root, source, entryPath)));
      }

      continue;
    }

    if (currentDir !== root) continue;
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name === 'SKILL.md') continue;

    files.push({
      filePath: entryPath,
      commandName: basename(entry.name, '.md'),
      root,
      source,
    });
  }

  return files;
}

export async function loadSkillsFromDirectories(
  directories: Array<{ path: string; source: SkillSource }>,
): Promise<Record<string, CommandDefinition>> {
  const commands: Record<string, LoadedCommand> = {};

  const skillFilesByDirectory = await Promise.all(
    directories.map(async (dir) => {
      if (!existsSync(dir.path)) return [];
      return collectSkillFiles(dir.path, dir.source);
    }),
  );

  for (const skillFiles of skillFilesByDirectory) {
    const parsedSkillFiles: ParsedSkillFile[] = await Promise.all(
      skillFiles.map(async (skillFile) => {
        try {
          const content = await readFile(skillFile.filePath, 'utf8');
          return { skillFile, content };
        } catch (error) {
          return {
            skillFile,
            readError: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    for (const parsedSkillFile of parsedSkillFiles) {
      if (parsedSkillFile.readError) {
        log('[skills] failed to read skill file', {
          filePath: relative(process.cwd(), parsedSkillFile.skillFile.filePath),
          source: parsedSkillFile.skillFile.source,
          error: parsedSkillFile.readError,
        });
        continue;
      }

      const { skillFile, content } = parsedSkillFile;
      if (!content) continue;

      const { data, body, parseError } = parseFrontmatter(content);

      if (parseError) {
        log('[skills] skipped malformed skill frontmatter', {
          filePath: relative(process.cwd(), skillFile.filePath),
          source: skillFile.source,
        });
        continue;
      }

      const commandName = data.name ?? skillFile.commandName;
      const isWrappedSkill = basename(skillFile.filePath) === 'SKILL.md';
      const skillDir = isWrappedSkill
        ? dirname(skillFile.filePath)
        : skillFile.root;

      if (commands[commandName]) {
        log('[skills] overriding command', {
          commandName,
          previousPath: relative(
            process.cwd(),
            commands[commandName].sourcePath,
          ),
          filePath: relative(process.cwd(), skillFile.filePath),
        });
      }

      commands[commandName] = {
        definition: {
          description: data.description,
          template: createSkillTemplate(body, skillDir, isWrappedSkill),
          model: sanitizeModelField(data.model, skillFile.source),
          agent: data.agent,
          subtask: toSubtask(data.subtask),
        },
        sourcePath: skillFile.filePath,
      };
    }
  }

  return Object.fromEntries(
    Object.entries(commands).map(([name, loaded]) => [name, loaded.definition]),
  );
}

export async function discoverAllSkills(
  projectDir: string,
  homeDir = homedir(),
): Promise<Record<string, CommandDefinition>> {
  const opencodeConfigDir =
    process.env.XDG_CONFIG_HOME ?? join(homeDir, '.config');
  const cacheKey = `${projectDir}\u0000${homeDir}\u0000${opencodeConfigDir}`;
  const cached = discoveredSkillsCache.get(cacheKey);
  if (cached) return cached;

  const pending = loadSkillsFromDirectories([
    { path: join(homeDir, '.agents', 'skills'), source: 'agents' },
    {
      path: join(opencodeConfigDir, 'opencode', 'skills'),
      source: 'opencode',
    },
    { path: join(projectDir, '.agents', 'skills'), source: 'agents' },
    { path: join(projectDir, '.opencode', 'skills'), source: 'opencode' },
  ]).catch((error) => {
    discoveredSkillsCache.delete(cacheKey);
    throw error;
  });

  discoveredSkillsCache.set(cacheKey, pending);
  return pending;
}
