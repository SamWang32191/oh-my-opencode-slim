# Command Sources Design

## Goal

在 `oh-my-opencode-slim` 中新增兩種自動 command discovery 能力：

- 從 `Makefile` 產生 `make:<target>` commands
- 從 `package.json scripts` 產生 `<runner>:<script>` commands

同時保留既有 skill command 掃描與 merge 行為，不引入不必要的 runtime hook 複雜度。

## Current Context

- 現況 command 註冊點在 [src/index.ts](/Users/samwang/Repo/workspace/oh-my-opencode-slim/src/index.ts) 的 `config` hook。
- 現況只會發現 skills，來源是 [src/skills/loader.ts](/Users/samwang/Repo/workspace/oh-my-opencode-slim/src/skills/loader.ts)。
- 既有 merge 行為由 [src/skills/register.ts](/Users/samwang/Repo/workspace/oh-my-opencode-slim/src/skills/register.ts) 負責，既有 commands 優先於後載入 commands。

## Approaches

### 1. 最小改動：直接把兩個 source 硬接到 `src/index.ts`

優點：

- 改動少
- 最快可交付

缺點：

- `index.ts` 會進一步膨脹
- command discovery 邏輯分散，之後若再加第三種 source 會更難維護

### 2. 推薦：抽出通用 command discovery 模組

做法：

- 新增 `src/commands/` 目錄
- 將 skill commands、Makefile commands、package script commands 都視為同一種 `CommandDefinition`
- 在 `config` hook 前先組合完整 command catalog，再一次 merge 進 `opencodeConfig.command`

優點：

- 邊界清楚
- 後續再加 command source 成本低
- 可重用測試模式與衝突處理

缺點：

- 需要小幅整理現有 `skills/register.ts` / `skills/loader.ts` 的責任分界

### 3. 不推薦：引入 `command.execute.before` hook

優點：

- 可直接沿用 `opencode-command-inject` 的部分做法

缺點：

- 與 `oh-my-opencode-slim` 現有直接註冊 `config.command` 的模型不一致
- 增加 runtime 攔截邏輯與除錯成本
- 對這個需求沒有明顯收益

## Recommended Design

採用「通用 command discovery 模組」。

### Architecture

新增 `src/commands/`，負責：

- 定義 shared `CommandDefinition` / `DiscoveredCommand`
- 提供 `MakefileCommandSource`
- 提供 `PackageScriptsCommandSource`
- 提供 command merge helper

既有 `src/skills/loader.ts` 保留 skill discovery 專責；它回傳的 command definitions 會被 command registry 一起整合。

### Merge Strategy

- 既有 `opencodeConfig.command` 優先
- 動態發現的 command 若重名，略過並記錄 log
- source 之間若重名，維持 deterministic 順序：
  - skills
  - Makefile
  - package scripts

這樣可維持與現有 skill merge 語意一致，降低行為驚訝。

### Naming Rules

- Makefile: `make:<target>`
- package scripts: `<runner>:<script>`
- `runner` 來源：
  - 先看 `package.json.packageManager`
  - 再看 lockfile
  - 都沒有則 fallback `npm`

### Template Rules

- Makefile template: `Use shell to execute \`make <target> $ARGUMENTS\``
- package script template: `Use shell to execute \`<runner> run <script> -- $ARGUMENTS\``

### Parsing Scope

Makefile parser 初版只支援：

- 單行 target
- target 名稱只含英數、`_`、`-`
- `## description` 註解格式

這與來源 plugin 的能力對齊，足夠作為第一版範圍。

### Testing

測試分三層：

1. Source unit tests
   - Makefile parsing / loading
   - package manager detection
   - package scripts loading
2. Merge tests
   - 既有 command 優先
   - source collision 處理
3. Integration-ish tests
   - `config` 階段可把 skills + Makefile + package scripts 一起合併進 `opencodeConfig.command`

## Non-Goals

- 不支援複雜 Makefile 語法解析
- 不重做 skill loader
- 不新增 `command.execute.before` / `command.execute.after` hook 行為
- 不改變 agent / MCP / background task 架構
