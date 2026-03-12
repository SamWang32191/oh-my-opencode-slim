import { describe, expect, it } from 'bun:test';
import { mergeSkillCommands } from './register';

describe('mergeSkillCommands', () => {
  it('preserves existing commands and appends loaded skill commands', () => {
    const config = {
      command: {
        existing: {
          description: 'Existing command',
          template: 'Existing template',
        },
      },
    };

    mergeSkillCommands(config, {
      atlas: {
        description: 'Map repo',
        template: 'Map the repository',
        agent: 'explorer',
        subtask: true,
      },
    });

    expect(config.command.existing).toBeDefined();
    expect(config.command.atlas).toEqual({
      description: 'Map repo',
      template: 'Map the repository',
      agent: 'explorer',
      subtask: true,
    });
  });

  it('keeps existing commands when a loaded skill uses the same name', () => {
    const config = {
      command: {
        atlas: {
          description: 'Existing command',
          template: 'Existing template',
        },
      },
    };

    mergeSkillCommands(config, {
      atlas: {
        description: 'Loaded skill',
        template: 'Loaded template',
      },
    });

    expect(config.command.atlas).toEqual({
      description: 'Existing command',
      template: 'Existing template',
    });
  });
});
