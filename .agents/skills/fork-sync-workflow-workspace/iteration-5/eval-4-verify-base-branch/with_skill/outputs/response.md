# Eval 4 - With Skill (Iteration 5)

在同步 upstream 之前，你需要確認兩件事：

## 1. 查詢遠端分支名稱

```bash
git remote show origin
```

看 `HEAD branch` 那一行，會顯示預設分支是 `master` 還是 `main`。

## 2. 查詢 GitHub 上的預設分支

```bash
gh repo view --json defaultBranchRef
```

輸出會顯示 `defaultBranchRef` 的 `name`，即為 upstream 的預設分支名稱。

## 3. 確認本地分支

```bash
git branch -a
```

看有哪些本地和遠端分支。

---

查到之後，後續的 fetch/merge 命令要把 `main` 改成實際的分支名稱。
