// Simplified LSP config - uses OpenCode's lsp config from opencode.json
// Falls back to BUILTIN_SERVERS if no user config exists

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import whichSync from 'which';
import { getAllUserLspConfigs, hasUserLspConfig } from './config-store';
import {
  BUILTIN_SERVERS,
  LANGUAGE_EXTENSIONS,
  LSP_INSTALL_HINTS,
} from './constants';
import type { ResolvedServer, ServerLookupResult } from './types';

/**
 * Merged server config that combines built-in and user config.
 */
interface MergedServerConfig {
  id: string;
  command: string[];
  extensions: string[];
  root?: (file: string) => string | undefined;
  env?: Record<string, string>;
  initialization?: Record<string, unknown>;
}

function getOpenCodeCacheBinDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA ?? homedir(), 'opencode', 'bin');
  }

  const xdgCacheHome =
    process.env.XDG_CACHE_HOME?.trim() || join(homedir(), '.cache');

  return join(xdgCacheHome, 'opencode', 'bin');
}

function getSearchPathSeparator(): string {
  return process.platform === 'win32' ? ';' : ':';
}

function getCacheSearchPaths(cmd: string): string[] {
  const opencodeBin = getOpenCodeCacheBinDir();
  return [opencodeBin, join(opencodeBin, cmd, 'bin')];
}

function buildSearchPath(cmd: string): string {
  const separator = getSearchPathSeparator();
  const pathEntries = [
    ...(process.env.PATH?.split(separator) ?? []),
    ...getCacheSearchPaths(cmd),
  ].filter(Boolean);

  return [...new Set(pathEntries)].join(separator);
}

function getLocalCommandCandidates(cmd: string): string[] {
  const localBin = join(process.cwd(), 'node_modules', '.bin', cmd);

  if (process.platform === 'win32') {
    return [localBin, `${localBin}.exe`, `${localBin}.cmd`, `${localBin}.bat`];
  }

  return [localBin];
}

function toSpawnCommand(resolvedPath: string, args: string[]): string[] {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolvedPath)) {
    return ['cmd.exe', '/c', resolvedPath, ...args];
  }

  return [resolvedPath, ...args];
}

export function resolveServerCommand(command: string[]): string[] | null {
  if (command.length === 0) return null;

  const [cmd, ...args] = command;

  if (cmd.includes('/') || cmd.includes('\\')) {
    return existsSync(cmd) ? toSpawnCommand(cmd, args) : null;
  }

  const resolved = whichSync.sync(cmd, {
    path: buildSearchPath(cmd),
    pathExt: process.platform === 'win32' ? process.env.PATHEXT : undefined,
    nothrow: true,
  });

  if (resolved !== null) {
    return toSpawnCommand(resolved, args);
  }

  for (const candidate of getLocalCommandCandidates(cmd)) {
    if (existsSync(candidate)) {
      return toSpawnCommand(candidate, args);
    }
  }

  return null;
}

/**
 * Build the merged server list by combining built-in servers with user config.
 * This mirrors OpenCode core's pattern: start with built-in, then merge user config.
 */
function buildMergedServers(): Map<string, MergedServerConfig> {
  const servers = new Map<string, MergedServerConfig>();

  // Start with built-in servers
  for (const [id, config] of Object.entries(BUILTIN_SERVERS)) {
    servers.set(id, {
      id,
      command: config.command,
      extensions: config.extensions,
      root: config.root,
      env: config.env,
      initialization: config.initialization,
    });
  }

  // Apply user config (merge with existing or add new)
  if (hasUserLspConfig()) {
    for (const [id, userConfig] of getAllUserLspConfigs()) {
      // Handle disabled: remove built-in from consideration
      if (userConfig.disabled === true) {
        servers.delete(id);
        continue;
      }

      const existing = servers.get(id);

      if (existing) {
        // Merge user config with built-in, preserving root function from built-in
        servers.set(id, {
          ...existing,
          id,
          // User config overrides command if provided
          command: userConfig.command ?? existing.command,
          // User config overrides extensions if provided
          extensions: userConfig.extensions ?? existing.extensions,
          // Preserve root function from built-in (not overrideable)
          root: existing.root,
          // User config overrides env/initialization
          env: userConfig.env ?? existing.env,
          initialization: userConfig.initialization ?? existing.initialization,
        });
      } else {
        // New server defined by user config
        servers.set(id, {
          id,
          command: userConfig.command ?? [],
          extensions: userConfig.extensions ?? [],
          root: undefined,
          env: userConfig.env,
          initialization: userConfig.initialization,
        });
      }
    }
  }

  return servers;
}

export function findServerForExtension(ext: string): ServerLookupResult {
  const servers = buildMergedServers();

  for (const [, config] of servers) {
    if (config.extensions.includes(ext)) {
      const server: ResolvedServer = {
        id: config.id,
        command: config.command,
        extensions: config.extensions,
        root: config.root,
        env: config.env,
        initialization: config.initialization,
      };

      const resolvedCommand = resolveServerCommand(config.command);

      if (resolvedCommand) {
        return {
          status: 'found',
          server: { ...server, command: resolvedCommand },
        };
      }

      return {
        status: 'not_installed',
        server,
        installHint:
          LSP_INSTALL_HINTS[config.id] ||
          `Install '${config.command[0]}' and add to PATH`,
      };
    }
  }

  return { status: 'not_configured', extension: ext };
}

export function getLanguageId(ext: string): string {
  return LANGUAGE_EXTENSIONS[ext] || 'plaintext';
}

export function isServerInstalled(command: string[]): boolean {
  return resolveServerCommand(command) !== null;
}
