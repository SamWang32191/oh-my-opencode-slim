import { describe, expect, it } from 'bun:test';
import { parseFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('parses yaml frontmatter and preserves body', () => {
    const content =
      '---\nname: repo-map\ndescription: Repository map\nmodel: gpt-5\nagent: explorer\nsubtask: true\n---\nUse the skill exactly as written.\n';

    const result = parseFrontmatter(content);

    expect(result.data).toEqual({
      name: 'repo-map',
      description: 'Repository map',
      model: 'gpt-5',
      agent: 'explorer',
      subtask: 'true',
    });
    expect(result.body).toBe('Use the skill exactly as written.\n');
    expect(result.hadFrontmatter).toBe(true);
    expect(result.parseError).toBe(false);
  });

  it('supports windows line endings', () => {
    const content =
      '---\r\ndescription: Windows body\r\n---\r\nLine 1\r\nLine 2\r\n';

    const result = parseFrontmatter(content);

    expect(result.data.description).toBe('Windows body');
    expect(result.body).toBe('Line 1\r\nLine 2\r\n');
    expect(result.hadFrontmatter).toBe(true);
    expect(result.parseError).toBe(false);
  });

  it('handles values that contain colons', () => {
    const content =
      '---\ndescription: Review src/index.ts:112 before editing\n---\nPrompt\n';

    const result = parseFrontmatter(content);

    expect(result.data.description).toBe(
      'Review src/index.ts:112 before editing',
    );
    expect(result.hadFrontmatter).toBe(true);
    expect(result.parseError).toBe(false);
  });

  it('returns plain text when no frontmatter exists', () => {
    const content = 'Just plain text\n';

    const result = parseFrontmatter(content);

    expect(result.data).toEqual({});
    expect(result.body).toBe('Just plain text\n');
    expect(result.hadFrontmatter).toBe(false);
    expect(result.parseError).toBe(false);
  });

  it('flags malformed scalar frontmatter without losing the body', () => {
    const content = '---\ndescription [oops\n---\nPrompt\n';

    const result = parseFrontmatter(content);

    expect(result.hadFrontmatter).toBe(true);
    expect(result.parseError).toBe(true);
    expect(result.body).toBe('Prompt\n');
  });

  it('ignores valid yaml comments and structured values it does not map', () => {
    const content =
      '---\n# comment\ndescription: Repository map\ntags:\n  - docs\nnotes: |\n  line 1\n  line 2\nagent: explorer\n---\nPrompt\n';

    const result = parseFrontmatter(content);

    expect(result.data.description).toBe('Repository map');
    expect(result.data.agent).toBe('explorer');
    expect(result.hadFrontmatter).toBe(true);
    expect(result.parseError).toBe(false);
    expect(result.body).toBe('Prompt\n');
  });

  it('strips inline comments from scalar values', () => {
    const content =
      '---\nsubtask: true # keep this boolean\nagent: explorer # agent name\n---\nPrompt\n';

    const result = parseFrontmatter(content);

    expect(result.data.subtask).toBe('true');
    expect(result.data.agent).toBe('explorer');
    expect(result.parseError).toBe(false);
  });

  it('parses top-level keys even when they are indented', () => {
    const content =
      '---\n  description: Repository map\n  agent: explorer\n---\nPrompt\n';

    const result = parseFrontmatter(content);

    expect(result.data.description).toBe('Repository map');
    expect(result.data.agent).toBe('explorer');
    expect(result.parseError).toBe(false);
  });

  it('flags an unclosed frontmatter block', () => {
    const content = '---\ndescription: missing close\nPrompt\n';

    const result = parseFrontmatter(content);

    expect(result.data).toEqual({});
    expect(result.body).toBe(content);
    expect(result.hadFrontmatter).toBe(true);
    expect(result.parseError).toBe(true);
  });
});
