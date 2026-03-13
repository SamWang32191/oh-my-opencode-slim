# Task Plan

## Goal

為 `oh-my-opencode-slim` 規劃並落地自動 command discovery，新增：

- `MakefileCommandSource`
- `PackageScriptsCommandSource`

目標是讓 plugin 在保留既有 skill command 行為的前提下，自動把專案內可執行入口註冊成 OpenCode commands。

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| 1. 蒐集現況與限制 | completed | 已確認目前只有 skill command discovery，尚無 Makefile / package scripts command 注入。 |
| 2. 建立 planning files | completed | 已建立 `task_plan.md`、`findings.md`、`progress.md`。 |
| 3. 擬定設計與實作路徑 | completed | 已產出設計摘要與 implementation plan。 |
| 4. 等待後續執行 | in_progress | 計劃已備妥，可進入 review 或實作。 |

## Decisions

- 先以「規劃」為目標，不直接改 code。
- 計劃會優先沿用 `oh-my-opencode-slim` 現有 `config` 階段 command merge 模式，不引入 `command.execute.before` hook。
- 實作建議聚焦於 command discovery / merge，不把 skill loader 重寫成另一套系統。

## Open Questions

- 新增 command 名稱衝突時，是否維持現有「既有 command 優先、動態發現略過」策略。
- `PackageScriptsCommandSource` 是否應完整支援 `packageManager` 欄位與 lockfile 偵測。
- Makefile parser 是否只支援單行 target 與 `##` 描述，或需兼容更多 GNU Make 寫法。

## Errors Encountered

目前無。
