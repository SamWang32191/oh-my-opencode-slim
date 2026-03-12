export interface FrontmatterData {
  name?: string;
  description?: string;
  model?: string;
  agent?: string;
  subtask?: string;
  [key: string]: string | undefined;
}

export interface FrontmatterResult<
  T extends FrontmatterData = FrontmatterData,
> {
  data: T;
  body: string;
  hadFrontmatter: boolean;
  parseError: boolean;
}

const FRONTMATTER_OPEN = /^---\r?\n/;
const FRONTMATTER_CLOSE = /\r?\n---(?:\r?\n|$)/;

function stripInlineYamlComment(value: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (character === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (
      character === '#' &&
      !inSingleQuote &&
      !inDoubleQuote &&
      (index === 0 || /\s/.test(value[index - 1]))
    ) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value;
}

export function parseFrontmatter<T extends FrontmatterData = FrontmatterData>(
  content: string,
): FrontmatterResult<T> {
  if (!FRONTMATTER_OPEN.test(content)) {
    return {
      data: {} as T,
      body: content,
      hadFrontmatter: false,
      parseError: false,
    };
  }

  const closeMatch = content.slice(4).match(FRONTMATTER_CLOSE);
  if (!closeMatch || closeMatch.index === undefined) {
    return {
      data: {} as T,
      body: content,
      hadFrontmatter: true,
      parseError: true,
    };
  }

  const yamlStart = 4;
  const yamlEnd = 4 + closeMatch.index;
  const yamlBlock = content.slice(yamlStart, yamlEnd);
  const bodyStart = yamlEnd + closeMatch[0].length;
  const body = content.slice(bodyStart);
  const data: FrontmatterData = {};
  let parseError = false;
  let inBlockScalar = false;

  for (const rawLine of yamlBlock.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      inBlockScalar = false;
      continue;
    }
    if (trimmed.startsWith('#')) continue;

    const isIndented = /^\s/.test(rawLine);
    if (isIndented && inBlockScalar) continue;
    if (isIndented && trimmed.startsWith('- ')) continue;

    const line = isIndented ? trimmed : rawLine;

    if (inBlockScalar) {
      inBlockScalar = false;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) {
      parseError = true;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    const value = stripInlineYamlComment(line.slice(colonIndex + 1).trim())
      .trim()
      .replace(/^['"]|['"]$/g, '');

    data[key] = value;

    if (/^[>|][+-]?$/.test(value)) {
      inBlockScalar = true;
    }
  }

  return {
    data: data as T,
    body,
    hadFrontmatter: true,
    parseError,
  };
}
