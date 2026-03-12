import { afterEach, describe, expect, it } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverAllSkills, loadSkillsFromDirectories } from './loader';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('loadSkillsFromDirectories', () => {
  it('loads flat markdown skills', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    await writeFile(
      join(root, 'summarize.md'),
      '---\ndescription: Summarize code\n---\nSummarize:\n$ARGUMENTS\n',
    );

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills.summarize?.description).toBe('Summarize code');
    expect(skills.summarize?.template).toContain('Summarize:');
    expect(skills.summarize?.template.match(/\$ARGUMENTS/g)?.length).toBe(1);
  });

  it('loads nested SKILL.md and prefers frontmatter name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    const skillDir = join(root, 'repo-map');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: atlas\ndescription: Map repo\nagent: explorer\nsubtask: true\n---\nUse @docs/README.md when mapping.\nIgnore @param tokens.\n',
    );
    await mkdir(join(skillDir, 'docs'), { recursive: true });
    await writeFile(join(skillDir, 'docs', 'README.md'), '# repo map\n');

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills.atlas).toBeDefined();
    expect(skills.atlas?.agent).toBe('explorer');
    expect(skills.atlas?.subtask).toBe(true);
    expect(skills.atlas?.template).toContain('<skill-instruction>');
    expect(skills.atlas?.template).toContain('Base directory for this skill:');
    expect(skills.atlas?.template).toContain(`${skillDir}/docs/README.md`);
    expect(skills.atlas?.template).toContain('Ignore @param tokens.');
    expect(skills.atlas?.template).toContain('<user-request>');
    expect(skills.atlas?.template).toContain('$ARGUMENTS');
  });

  it('resolves root-level @path references relative to the skill directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    const skillDir = join(root, 'repo-map');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\ndescription: Map repo\n---\nRead @README.md before editing.\nIgnore @param tokens.\n',
    );
    await writeFile(join(skillDir, 'README.md'), '# repo map\n');

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills['repo-map']?.template).toContain(`${skillDir}/README.md`);
    expect(skills['repo-map']?.template).toContain('Ignore @param tokens.');
  });

  it('discovers skills nested deeper than one directory level', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    const skillDir = join(root, 'bundle', 'repo-map');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\ndescription: Deep skill\n---\nDeep prompt\n',
    );

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills['repo-map']?.description).toBe('Deep skill');
    expect(skills['repo-map']?.template).toContain('Deep prompt');
  });

  it('ignores non-skill markdown files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    await mkdir(join(root, 'notes'), { recursive: true });
    await writeFile(
      join(root, 'SKILL.md'),
      '---\ndescription: wrong\n---\nWrong\n',
    );
    await writeFile(join(root, 'notes', 'README.md'), '# docs\n');

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills.SKILL).toBeUndefined();
    expect(skills.README).toBeUndefined();
  });

  it('loads only root-level flat markdown files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    await mkdir(join(root, 'notes'), { recursive: true });
    await writeFile(
      join(root, 'summarize.md'),
      '---\ndescription: root\n---\nRoot\n',
    );
    await writeFile(
      join(root, 'notes', 'summarize.md'),
      '---\ndescription: nested\n---\nNested\n',
    );

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills.summarize?.description).toBe('root');
    expect(skills.summarize?.template).toContain('Root');
  });

  it('lets later directories override earlier directories', async () => {
    const globalDir = await mkdtemp(join(tmpdir(), 'skill-loader-global-'));
    const projectDir = await mkdtemp(join(tmpdir(), 'skill-loader-project-'));
    tempDirs.push(globalDir, projectDir);

    await writeFile(
      join(globalDir, 'review.md'),
      '---\ndescription: global\n---\nGlobal review\n',
    );
    await writeFile(
      join(projectDir, 'review.md'),
      '---\ndescription: project\n---\nProject review\n',
    );

    const skills = await loadSkillsFromDirectories([
      { path: globalDir, source: 'agents' },
      { path: projectDir, source: 'agents' },
    ]);

    expect(skills.review?.description).toBe('project');
    expect(skills.review?.template).toContain('Project review');
  });

  it('skips unreadable skill directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    await writeFile(
      join(root, 'review.md'),
      '---\ndescription: review\n---\nReview\n',
    );

    await chmod(root, 0o000);

    try {
      const skills = await loadSkillsFromDirectories([
        { path: root, source: 'agents' },
      ]);

      expect(skills).toEqual({});
    } finally {
      await chmod(root, 0o755);
    }
  });

  it('skips unreadable skill files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    const skillPath = join(root, 'review.md');
    await writeFile(skillPath, '---\ndescription: review\n---\nReview\n');

    await chmod(skillPath, 0o000);

    try {
      const skills = await loadSkillsFromDirectories([
        { path: root, source: 'agents' },
      ]);

      expect(skills).toEqual({});
    } finally {
      await chmod(skillPath, 0o644);
    }
  });

  it('drops model from agents skills but keeps it for opencode skills', async () => {
    const agentsDir = await mkdtemp(join(tmpdir(), 'skill-loader-agents-'));
    const opencodeDir = await mkdtemp(join(tmpdir(), 'skill-loader-opencode-'));
    tempDirs.push(agentsDir, opencodeDir);

    await writeFile(
      join(agentsDir, 'review.md'),
      '---\ndescription: agents\nmodel: openai/gpt-5\n---\nAgents review\n',
    );
    await writeFile(
      join(opencodeDir, 'review.md'),
      '---\ndescription: opencode\nmodel: openai/gpt-5\n---\nOpencode review\n',
    );

    const agentsSkills = await loadSkillsFromDirectories([
      { path: agentsDir, source: 'agents' },
    ]);
    const opencodeSkills = await loadSkillsFromDirectories([
      { path: opencodeDir, source: 'opencode' },
    ]);

    expect(agentsSkills.review?.model).toBeUndefined();
    expect(opencodeSkills.review?.model).toBe('openai/gpt-5');
  });

  it('skips skills with malformed frontmatter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    await writeFile(
      join(root, 'broken.md'),
      '---\ndescription [oops\n---\nPrompt\n',
    );

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills).toEqual({});
  });

  it('loads skills with yaml comments and structured metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    await writeFile(
      join(root, 'review.md'),
      '---\n# comment\ndescription: Review code\ntags:\n  - docs\nnotes: |\n  line 1\nagent: explorer\n---\nReview:\n$ARGUMENTS\n',
    );

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills.review?.description).toBe('Review code');
    expect(skills.review?.agent).toBe('explorer');
  });

  it('parses subtask metadata when the scalar has an inline comment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    tempDirs.push(root);
    await writeFile(
      join(root, 'atlas.md'),
      '---\ndescription: Review code\nsubtask: true # keep boolean\n---\nReview\n',
    );

    const skills = await loadSkillsFromDirectories([
      { path: root, source: 'agents' },
    ]);

    expect(skills.atlas?.subtask).toBe(true);
  });
});

describe('discoverAllSkills', () => {
  it('loads installed opencode skills instead of src/skills directly', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'skill-loader-project-'));
    const homeDir = await mkdtemp(join(tmpdir(), 'skill-loader-home-'));
    tempDirs.push(projectDir, homeDir);

    await mkdir(join(homeDir, '.config', 'opencode', 'skills', 'bundle'), {
      recursive: true,
    });
    await writeFile(
      join(homeDir, '.config', 'opencode', 'skills', 'bundle', 'SKILL.md'),
      '---\ndescription: bundled\n---\nBundled skill\n',
    );

    const skills = await discoverAllSkills(projectDir, homeDir);

    expect(skills.bundle?.description).toBe('bundled');
  });

  it('reuses discovered skills for the same project and home directories', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'skill-loader-project-'));
    const homeDir = await mkdtemp(join(tmpdir(), 'skill-loader-home-'));
    tempDirs.push(projectDir, homeDir);

    const skillPath = join(homeDir, '.config', 'opencode', 'skills', 'bundle');
    await mkdir(skillPath, { recursive: true });
    await writeFile(
      join(skillPath, 'SKILL.md'),
      '---\ndescription: bundled\n---\nBundled skill\n',
    );

    const firstSkills = await discoverAllSkills(projectDir, homeDir);

    await writeFile(
      join(skillPath, 'SKILL.md'),
      '---\ndescription: changed\n---\nChanged skill\n',
    );

    const secondSkills = await discoverAllSkills(projectDir, homeDir);

    expect(firstSkills.bundle?.description).toBe('bundled');
    expect(secondSkills.bundle?.description).toBe('bundled');
  });

  it('loads opencode skills from XDG_CONFIG_HOME when set', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'skill-loader-project-'));
    const homeDir = await mkdtemp(join(tmpdir(), 'skill-loader-home-'));
    const xdgConfigHome = await mkdtemp(join(tmpdir(), 'skill-loader-xdg-'));
    tempDirs.push(projectDir, homeDir, xdgConfigHome);

    await mkdir(join(xdgConfigHome, 'opencode', 'skills', 'bundle'), {
      recursive: true,
    });
    await writeFile(
      join(xdgConfigHome, 'opencode', 'skills', 'bundle', 'SKILL.md'),
      '---\ndescription: xdg bundled\n---\nBundled skill\n',
    );

    const previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;

    try {
      const skills = await discoverAllSkills(projectDir, homeDir);
      expect(skills.bundle?.description).toBe('xdg bundled');
    } finally {
      if (previousXdgConfigHome === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
      }
    }
  });
});
