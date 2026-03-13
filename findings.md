# Findings

## 2026-03-14

### 現有 command/skill 架構

- `src/index.ts` 在 `config` hook 內呼叫 `discoverAllSkills(ctx.directory)`，再把結果交給 `mergeSkillCommands(...)`。
- `src/skills/register.ts` 的 precedence 是「已存在的 `opencodeConfig.command` 覆蓋後載入的 skill commands」。
- `src/skills/loader.ts` 已提供完整的 skill discovery：
  - 掃描 `~/.agents/skills`
  - 掃描 `$XDG_CONFIG_HOME/opencode/skills` 或 `~/.config/opencode/skills`
  - 掃描 `<project>/.agents/skills`
  - 掃描 `<project>/.opencode/skills`
- `src/skills/loader.ts` 保留 `description/template/model/agent/subtask` metadata，且支援 nested `SKILL.md`、symlink、`@path` 解析。

### 與 opencode-command-inject 的差異

- `opencode-command-inject` 已有可重用的兩個 command source：
  - `MakefileCommandSource`
  - `PackageScriptsCommandSource`
- 其額外 `skill` 注入能力與 `oh-my-opencode-slim` 現有能力重疊，而且較弱，不值得整包搬入。
- `opencode-command-inject` 透過 `command.execute.before` 注入 template；`oh-my-opencode-slim` 目前直接把 command definition 寫進 `opencodeConfig.command`，架構較簡單。

### 規劃方向

- 推薦把 Makefile / package scripts discovery 納入 `oh-my-opencode-slim` 現有 `config` 階段 merge 流程。
- 推薦抽出一層較小的通用 command discovery module，避免把邏輯硬塞進 `skills/loader.ts`。
