import type { CommandDefinition } from './loader';

export function mergeSkillCommands(
  opencodeConfig: Record<string, unknown>,
  loadedSkills: Record<string, CommandDefinition>,
): void {
  const existing =
    (opencodeConfig.command as Record<string, CommandDefinition> | undefined) ??
    {};

  opencodeConfig.command = {
    ...loadedSkills,
    ...existing,
  };
}
