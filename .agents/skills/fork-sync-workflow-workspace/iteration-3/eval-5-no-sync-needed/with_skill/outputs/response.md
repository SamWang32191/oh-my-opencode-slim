# Eval 5 - With Skill (Iteration 3)

既然你已經比對過，確認沒有差異，那就可以用指令再精確確認一次：

```bash
git rev-list --left-right --count origin/master...upstream/master
```

如果輸出是 `0 0`，表示雙方完全同步，**不需要做 merge**。

只有當顯示有 commits 差異時（例如 `0 3` 表示 upstream 多了 3 個 commits），才有必要 merge。
