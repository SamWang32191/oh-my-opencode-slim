# Eval 4 - With Skill (Iteration 3)

## 查詢 Fork 的預設分支

同步 upstream 之前，建議先查詢以下資訊：

### 1. 查詢本地端的預設分支

```bash
git remote show origin | grep "HEAD branch"
```

或直接看本地端的分支設定：

```bash
git symbolic-ref refs/remotes/origin/HEAD
```

### 2. 查詢 GitHub 上的預設分支

```bash
gh repo view --json defaultBranchRef
```

或如果你已經在 fork 的目錄下：

```bash
gh repo view YOUR_USERNAME/REPO_NAME --json defaultBranchRef
```

### 3. 查詢遠端所有分支

```bash
git branch -r
```

這樣可以看到 origin 有哪些分支。

---

**重要提醒**：確認真正的長期分支名稱後，後續的同步指令都要根據這個分支名稱來調整，例如：

- `git fetch origin` + `git merge origin/main`（如果真的是 main）
- 不要假設一定是 `master`，否則可能會 merge 到錯誤的分支

如果你不確定自己 fork 的名稱，可以先執行 `git remote -v` 查看 origin 對應的 URL。
