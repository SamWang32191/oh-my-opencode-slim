# Command Sources Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `oh-my-opencode-slim` 中加入 `MakefileCommandSource` 與 `PackageScriptsCommandSource`，讓 plugin 能在 `config` 階段自動註冊 Makefile targets 與 package scripts 為 OpenCode commands。

**Architecture:** 延續 `oh-my-opencode-slim` 目前以 `config.command` 為中心的註冊模式，不引入 `command.execute.before`。新增一層小型 command discovery 模組，讓 skills、Makefile、package scripts 都能產出同型別 command definitions，再由單一 merge helper 合併進 `opencodeConfig.command`。

**Tech Stack:** TypeScript, Bun test runner, OpenCode plugin runtime, Bun/Node filesystem APIs

---

## File Structure

- `src/index.ts` - plugin `config` hook 的 command discovery 入口
- `src/skills/loader.ts` - 保留 skill discovery，必要時只做最小型別抽取
- `src/skills/register.ts` - 可能重命名或保留作為 generic command merge helper
- `src/skills/register.test.ts` - 既有 merge precedence 測試，可擴充為 generic command merge 測試
- `src/commands/types.ts` - shared command definition / source interfaces
- `src/commands/register.ts` - 合併 skills 與動態 commands 進 `opencodeConfig.command`
- `src/commands/index.ts` - command discovery exports
- `src/commands/discover.ts` - 組合多個 command source 的入口
- `src/commands/makefile-parser.ts` - Makefile target parser
- `src/commands/makefile-source.ts` - `MakefileCommandSource`
- `src/commands/package-manager.ts` - `packageManager` / lockfile 偵測
- `src/commands/package-scripts-source.ts` - `PackageScriptsCommandSource`
- `src/commands/template.ts` - shell command template builder
- `src/commands/discover.test.ts` - 多 source 整合與 collision 測試
- `src/commands/makefile-source.test.ts` - Makefile source 單元測試
- `src/commands/package-manager.test.ts` - package manager 偵測測試
- `src/commands/package-scripts-source.test.ts` - package scripts source 單元測試

## Implementation Notes

- 保持現有 precedence：既有 `opencodeConfig.command` 優先於自動發現 commands。
- command source 合併順序建議固定為 `skills -> makefile -> package scripts`。
- shell template 直接沿用來源 plugin 的簡單格式即可，不必加 runtime hook。
- 初版 Makefile parser 僅支援簡單 target 與 `##` 註解；把更完整 GNU Make 支援留在未來。

## Chunk 1: 抽出共用 command 註冊邊界

### Task 1: 建立 shared command types 與 generic merge helper

**Files:**
- Create: `src/commands/types.ts`
- Create: `src/commands/register.ts`
- Modify: `src/skills/register.ts`
- Test: `src/skills/register.test.ts`

- [ ] **Step 1: 先寫 merge precedence 的失敗測試**

在 `src/skills/register.test.ts` 補以下情境：

- 既有 `config.command` 優先於自動發現 commands
- 可以同時合併 skill commands 與非 skill commands
- 動態 commands 若重名，不覆蓋既有 command

範例斷言：

```ts
mergeDiscoveredCommands(config, {
  atlas: { description: 'skill', template: 'skill template' },
  'make:build': { description: 'build', template: 'Use shell to execute `make build $ARGUMENTS`' },
});

expect(config.command.atlas.template).toBe('existing template');
expect(config.command['make:build']).toBeDefined();
```

- [ ] **Step 2: 跑測試確認目前行為不足以表達新需求**

Run: `bun test src/skills/register.test.ts`

Expected: 需要新增 generic helper 或測試無法通過目前 API。

- [ ] **Step 3: 實作 shared types 與 generic merge helper**

在 `src/commands/types.ts` 定義：

```ts
export interface CommandDefinition {
  description?: string;
  template: string;
  model?: string;
  agent?: string;
  subtask?: boolean;
}
```

在 `src/commands/register.ts` 定義：

```ts
export function mergeDiscoveredCommands(
  opencodeConfig: Record<string, unknown>,
  discovered: Record<string, CommandDefinition>,
): void
```

需求：

- 沿用既有 precedence
- 不引入破壞性 API 變更
- 若要保留 `mergeSkillCommands`，可讓它成為 wrapper

- [ ] **Step 4: 重跑測試確認 merge helper 正常**

Run: `bun test src/skills/register.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/types.ts src/commands/register.ts src/skills/register.ts src/skills/register.test.ts
git commit -m "refactor: generalize command merge helpers"
```

## Chunk 2: 加入 Makefile command discovery

### Task 2: 建立 Makefile parser 與 source

**Files:**
- Create: `src/commands/template.ts`
- Create: `src/commands/makefile-parser.ts`
- Create: `src/commands/makefile-source.ts`
- Test: `src/commands/makefile-source.test.ts`

- [ ] **Step 1: 先寫 Makefile source 的失敗測試**

在 `src/commands/makefile-source.test.ts` 覆蓋：

- 有 `Makefile` 且 target 帶 `##` 描述時，產生 `make:<target>`
- `Makefile` 不存在時回傳空陣列
- 非法或不支援行格式被忽略

範例：

```ts
await writeFile(join(dir, 'Makefile'), 'build: ## Build app\ntest: ## Run tests\n');
expect(commands).toEqual([
  {
    name: 'make:build',
    description: 'Build app',
    template: 'Use shell to execute `make build $ARGUMENTS`',
  },
]);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test src/commands/makefile-source.test.ts`

Expected: FAIL，因為檔案與 source 尚不存在。

- [ ] **Step 3: 實作 parser / template / source**

`src/commands/template.ts`：

```ts
export function buildShellTemplate(command: string): string {
  return `Use shell to execute \`${command}\``;
}
```

`src/commands/makefile-parser.ts`：

- 使用簡單 regex 擷取 target 與 `##` 描述
- 忽略空行、註解、dot-prefixed 特殊 target

`src/commands/makefile-source.ts`：

- 讀取 `<root>/Makefile`
- 用 parser 轉成 `make:<target>` commands

- [ ] **Step 4: 重跑測試**

Run: `bun test src/commands/makefile-source.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/template.ts src/commands/makefile-parser.ts src/commands/makefile-source.ts src/commands/makefile-source.test.ts
git commit -m "feat: add Makefile command discovery"
```

## Chunk 3: 加入 package scripts command discovery

### Task 3: 建立 package manager 偵測與 package scripts source

**Files:**
- Create: `src/commands/package-manager.ts`
- Create: `src/commands/package-scripts-source.ts`
- Test: `src/commands/package-manager.test.ts`
- Test: `src/commands/package-scripts-source.test.ts`

- [ ] **Step 1: 先寫 package manager 偵測與 source 的失敗測試**

需要覆蓋：

- `package.json.packageManager` 優先
- lockfile fallback：`pnpm-lock.yaml` / `yarn.lock` / `bun.lock` / `package-lock.json`
- 沒有 package manager 線索時 fallback `npm`
- `package.json.scripts` 轉成 `<runner>:<script>` commands
- `package.json` 缺失、無法 parse、沒有 scripts 時回傳空陣列

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test src/commands/package-manager.test.ts src/commands/package-scripts-source.test.ts`

Expected: FAIL

- [ ] **Step 3: 實作 `detectPackageManager(...)` 與 `PackageScriptsCommandSource`**

`src/commands/package-manager.ts`：

- 先讀 `packageManager`
- 再檢查 lockfiles
- 最後回傳 `npm`

`src/commands/package-scripts-source.ts`：

- 讀取 `package.json`
- parse `scripts`
- 為每個 script 產生：

```ts
{
  name: `${runner}:${script}`,
  description: script,
  template: buildShellTemplate(`${runner} run ${script} -- $ARGUMENTS`),
}
```

- [ ] **Step 4: 重跑測試**

Run: `bun test src/commands/package-manager.test.ts src/commands/package-scripts-source.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/package-manager.ts src/commands/package-scripts-source.ts src/commands/package-manager.test.ts src/commands/package-scripts-source.test.ts
git commit -m "feat: add package script command discovery"
```

## Chunk 4: 串接 plugin config 階段並補整合測試

### Task 4: 在 `config` hook 組合 skills + Makefile + package scripts

**Files:**
- Create: `src/commands/discover.ts`
- Create: `src/commands/index.ts`
- Create: `src/commands/discover.test.ts`
- Modify: `src/index.ts`
- Modify: `src/skills/loader.ts`
- Modify: `src/skills/register.ts`
- Test: `src/skills/loader.test.ts`
- Test: `src/skills/register.test.ts`
- Test: `src/commands/discover.test.ts`

- [ ] **Step 1: 先寫整合測試**

在 `src/commands/discover.test.ts` 覆蓋：

- 同時存在 skill、Makefile、package scripts 時，三者都被發現
- 名稱衝突時遵循既定 precedence
- 沒有 Makefile / package scripts 時，skill discovery 行為不退化

- [ ] **Step 2: 跑整合測試確認失敗**

Run: `bun test src/commands/discover.test.ts src/skills/loader.test.ts src/skills/register.test.ts`

Expected: FAIL

- [ ] **Step 3: 實作 discovery 入口並接到 `src/index.ts`**

建議 API：

```ts
export async function discoverCommands(projectDir: string): Promise<Record<string, CommandDefinition>>
```

內部流程：

1. 呼叫既有 `discoverAllSkills(projectDir)`
2. 執行 `MakefileCommandSource`
3. 執行 `PackageScriptsCommandSource`
4. 合併成單一 command map

`src/index.ts` 改成：

```ts
const discoveredCommands = await discoverCommands(ctx.directory);
mergeDiscoveredCommands(opencodeConfig, discoveredCommands);
```

- [ ] **Step 4: 跑完整相關測試**

Run:

```bash
bun test src/commands/discover.test.ts src/commands/makefile-source.test.ts src/commands/package-manager.test.ts src/commands/package-scripts-source.test.ts src/skills/loader.test.ts src/skills/register.test.ts
```

Expected: PASS

- [ ] **Step 5: 跑 repo 基本驗證**

Run:

```bash
bun test
bun run typecheck
bun run check:ci
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/skills/loader.ts src/skills/register.ts src/commands src/skills/loader.test.ts src/skills/register.test.ts
git commit -m "feat: auto-register Makefile and package script commands"
```

## Chunk 5: 文件與行為說明

### Task 5: 補文件，讓使用者知道自動 command discovery 已存在

**Files:**
- Modify: `README.md`
- Modify: `docs/installation.md`
- Modify: `docs/quick-reference.md`

- [ ] **Step 1: 補失敗測試或至少先確認目前文件沒有這項能力**

Run:

```bash
rg -n "Makefile|package scripts|auto.*command|make:" README.md docs
```

Expected: 找不到或內容不足以描述新能力。

- [ ] **Step 2: 更新文件**

加入重點：

- plugin 會自動把 Makefile targets 註冊成 `make:<target>`
- 會自動把 package scripts 註冊成 `npm:` / `pnpm:` / `yarn:` / `bun:` commands
- 若與既有手動 command 名稱衝突，手動 command 優先

- [ ] **Step 3: 做最小驗證**

Run:

```bash
rg -n "make:<target>|package scripts|manual command" README.md docs
```

Expected: 新文件文案可被搜尋到。

- [ ] **Step 4: Commit**

```bash
git add README.md docs/installation.md docs/quick-reference.md
git commit -m "docs: describe auto-discovered Makefile and package commands"
```

## Risks

- `src/skills/register.ts` 若直接改為 generic command merge，需小心不要破壞既有 skill precedence。
- Makefile parser 若 regex 太寬，可能把 pattern rules 或特殊 target 誤判成 command。
- `packageManager` 偵測順序若不穩定，可能造成 command 前綴在不同專案間不一致。

## Verification Summary

- Focused tests:
  - `bun test src/skills/register.test.ts`
  - `bun test src/commands/makefile-source.test.ts`
  - `bun test src/commands/package-manager.test.ts src/commands/package-scripts-source.test.ts`
  - `bun test src/commands/discover.test.ts src/skills/loader.test.ts src/skills/register.test.ts`
- Full verification:
  - `bun test`
  - `bun run typecheck`
  - `bun run check:ci`
