# Installation Guide

Complete installation instructions for oh-my-opencode-medium.

## Table of Contents

- [For Humans](#for-humans)
- [For LLM Agents](#for-llm-agents)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## For Humans

### Quick Install

Run the interactive installer:

```bash
bunx oh-my-opencode-medium@medium install
```

Or use non-interactive mode:

```bash
bunx oh-my-opencode-medium@medium install --no-tui --kimi=yes --openai=yes --antigravity=yes --chutes=yes --opencode-free=yes --opencode-free-model=auto --tmux=no --skills=yes
```

### Configuration Options

The installer supports the following options:

| Option | Description |
|--------|-------------|
| `--tmux=yes|no` | Enable tmux integration (yes/no) |
| `--skills=yes|no` | Install recommended skills (yes/no) |
| `--no-tui` | Non-interactive mode |
| `--dry-run` | Simulate install without writing files |
| `--reset` | Force overwrite of existing configuration |

### Non-Destructive Behavior

By default, the installer is non-destructive. If an `oh-my-opencode-medium.json` configuration file already exists, the installer will **not** overwrite it. Instead, it will display a message:

```
ℹ Configuration already exists at ~/.config/opencode/oh-my-opencode-medium.json. Use --reset to overwrite.
```

To force overwrite of your existing configuration, use the `--reset` flag:

```bash
bunx oh-my-opencode-medium@medium install --reset
```

It then filters to free `opencode/*` models only, picks a coding-first primary model, and picks a support model for search/implementation agents.

Enable during installation:
```bash
bunx oh-my-opencode-medium install --kimi=yes --openai=yes --antigravity=yes --chutes=yes --opencode-free=yes --opencode-free-model=auto
```

**Note:** When using `--reset`, the installer creates a `.bak` backup file before overwriting, so your previous configuration is preserved.

### After Installation

The installer generates an OpenAI configuration by default (using `gpt-5.4` and `gpt-5-codex` models). To use alternative providers like Kimi, GitHub Copilot, or ZAI Coding Plan, see **[Provider Configurations](provider-configurations.md)** for step-by-step instructions.

Authenticate with your provider:

```bash
opencode auth login
# Select your provider → Complete OAuth flow
```

Once authenticated, run OpenCode and `ping all agents` to verify all agents respond.

> **💡 Tip: Models are fully customizable.** The installer sets sensible defaults, but you can assign *any* model to *any* agent. Edit `~/.config/opencode/oh-my-opencode-medium.json` (or `.jsonc` for comments support) to override models, adjust reasoning effort, or disable agents entirely. See [Configuration](quick-reference.md#configuration) for details.

### Alternative: Ask Any Coding Agent

Paste this into Claude Code, AmpCode, Cursor, or any coding agent:

```
Install and configure by following the instructions here:
https://raw.githubusercontent.com/SamWang32191/oh-my-opencode-medium/main/README.md
```

---

## For LLM Agents

If you're an LLM Agent helping set up oh-my-opencode-medium, follow these steps.

### Step 1: Check OpenCode Installation

```bash
opencode --version
```

If not installed, direct the user to https://opencode.ai/docs first.

### Step 2: Run the Installer

The installer generates an OpenAI configuration by default:

```bash
bunx oh-my-opencode-medium@medium install --no-tui --kimi=<yes|no> --openai=<yes|no> --antigravity=<yes|no> --chutes=<yes|no> --opencode-free=<yes|no> --opencode-free-model=<id|auto> --tmux=<yes|no> --skills=<yes|no>
```

**Examples:**
```bash
# Kimi + OpenAI + Antigravity
bunx oh-my-opencode-medium@medium install --no-tui --kimi=yes --openai=yes --antigravity=yes --chutes=yes --opencode-free=yes --opencode-free-model=auto --tmux=no --skills=yes

# OpenAI only
bunx oh-my-opencode-medium@medium install --no-tui --kimi=no --openai=yes --antigravity=no --chutes=no --opencode-free=no --tmux=no --skills=yes

# OpenCode free models only (auto-select)
bunx oh-my-opencode-medium@medium install --no-tui --kimi=no --openai=no --antigravity=no --chutes=no --opencode-free=yes --opencode-free-model=auto --tmux=no --skills=yes

# OpenCode free models + OpenAI (manual primary model)
bunx oh-my-opencode-medium@medium install --no-tui --kimi=no --openai=yes --antigravity=no --chutes=no --opencode-free=yes --opencode-free-model=opencode/gpt-5-nano --tmux=no --skills=yes
```

The installer automatically:
- Adds the plugin to `~/.config/opencode/opencode.json`
- Generates agent model mappings in `~/.config/opencode/oh-my-opencode-medium.json` (or `.jsonc`)
- Disables default OpenCode agents
- Generates agent model mappings in `~/.config/opencode/oh-my-opencode-medium.json` (or `.jsonc`)

**Crucial Advice for the User:**
- They can easily assign **different models to different agents** by editing `~/.config/opencode/oh-my-opencode-medium.json` (or `.jsonc`).
- If they add a new provider later, they just need to update this file.
- Read generated `~/.config/opencode/oh-my-opencode-medium.json` (or `.jsonc`) file and report the model configuration.

### Step 3: Authenticate with Providers

Ask user to run the following command. Don't run it yourself, it requires user interaction.

```bash
opencode auth login
# Select your provider and complete OAuth flow
```

### Step 4: Verify Installation

Ask the user to:

1. Start OpenCode: `opencode`
2. Run: `ping all agents`

Verify all agents respond successfully.

**Crucial Advice for the User:**
- They can easily assign **different models to different agents** by editing `~/.config/opencode/oh-my-opencode-slim.json` (or `.jsonc`).
- If they want to add a different provider later (Kimi, GitHub Copilot, ZAI), they can update this file manually. See **[Provider Configurations](provider-configurations.md)** for examples.
- Read the generated `~/.config/opencode/oh-my-opencode-slim.json` (or `.jsonc`) file to understand the current configuration.

---

## Troubleshooting

### Installer Fails

Check the expected config format:
```bash
bunx oh-my-opencode-medium@medium install --help
```

Then manually create the config files at:
- `~/.config/opencode/oh-my-opencode-medium.json` (or `.jsonc`)

### Configuration Already Exists

If the installer reports that the configuration already exists, you have two options:

1. **Keep existing config**: The installer will skip the configuration step and continue with other operations (like adding the plugin or installing skills).

2. **Reset configuration**: Use `--reset` to overwrite:
   ```bash
   bunx oh-my-opencode-slim@latest install --reset
   ```
   A `.bak` backup file will be created automatically.

### Agents Not Responding

1. Check your authentication:
   ```bash
   opencode auth status
   ```

2. Verify your config file exists and is valid:
   ```bash
   cat ~/.config/opencode/oh-my-opencode-medium.json
   ```

3. Check that your provider is configured in `~/.config/opencode/opencode.json`

### Authentication Issues

If providers are not working:

1. Check your authentication status:
   ```bash
   opencode auth status
   ```

2. Re-authenticate if needed:
   ```bash
   opencode auth login
   ```

3. Verify your config file has the correct provider configuration:
   ```bash
   cat ~/.config/opencode/oh-my-opencode-medium.json
   ```

### Editor Validation

Add a `$schema` reference to your config for autocomplete and inline validation:

```jsonc
{
  "$schema": "https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-medium.schema.json",
  // your config...
}
```

Works in VS Code, Neovim (with `jsonls`), and any editor that supports JSON Schema. Catches typos and wrong nesting immediately.

### Tmux Integration Not Working

Make sure you're running OpenCode with the `--port` flag and the port matches your `OPENCODE_PORT` environment variable:

```bash
tmux
export OPENCODE_PORT=4096
opencode --port 4096
```

See the [Tmux Integration Guide](tmux-integration.md) for more details.

---

## Uninstallation

1. **Remove the plugin from your OpenCode config**:

   Edit `~/.config/opencode/opencode.json` and remove `"oh-my-opencode-medium"` from the `plugin` array.

2. **Remove configuration files (optional)**:
   ```bash
    rm -f ~/.config/opencode/oh-my-opencode-medium.json
    rm -f .opencode/oh-my-opencode-medium.json
    rm -f ~/.config/opencode/oh-my-opencode-medium.json.bak
    rm -f .opencode/oh-my-opencode-medium.json
    ```

3. **Remove skills (optional)**:
   ```bash
   npx skills remove simplify
   npx skills remove agent-browser
   ```
