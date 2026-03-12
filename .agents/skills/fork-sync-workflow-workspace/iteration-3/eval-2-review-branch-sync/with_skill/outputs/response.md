# Eval 2 - With Skill (Iteration 3)

# Feature Branch 同步策略

當你的 feature branch 正在 review 中，即將 squash merge 回 master，以下是最穩定的同步方式：

## 同步流程

### 1. 先同步本地 master
```bash
git fetch origin --prune
git fetch upstream --prune
git switch master
git pull --ff-only origin master
git merge upstream/master
git push origin master
```

### 2. 再同步 feature branch
```bash
git switch feat/your-branch
git merge master
git push origin feat/your-branch
```

## 為什麼用 merge 而非 rebase？

| 情境 | rebase | merge |
|------|--------|-------|
| **歷史改寫** | 會改變 commit hash | 保留原 commit 歷史 |
| **Review 狀態** | 可能導致 reviewer 的 comment 對不上 | 所有 comment 位置維持正確 |
| **衝突處理** | 強制一次性解決所有衝突 | 可逐步處理衝突 |
| **協作安全** | 已推送到遠端的 branch 風險高 | 多人協作時更安全 |

**核心原因**：rebase 會改變 commit 歷史，而 branch 已經在 review 中，任何 commit 變動都可能造成 reviewer 的比對困難。Merge 保持原有一切，只多一個 merge commit，風險最低。

## 注意事項

- 確認 feature branch 沒有落後太多再用此方式
- 如果有 conflict，用編輯器仔細解決，別用 `-X theirs` 自動處理
- 推上去後主動告知 reviewer 已更新
