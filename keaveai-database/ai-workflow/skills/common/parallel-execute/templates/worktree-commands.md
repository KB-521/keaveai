# 并行 worktree 命令模板

逐任务登记，不在共享 clone 直接切换到任务分支：

```sh
keaveai delivery start <task-id> \
  --allow <allowed-file-or-directory> \
  --context <tasks-index> <parent-task-index> <task-doc> <design-or-contract-doc>
```

只传真实存在的文件和最小允许路径；共同的远端和目标分支来自项目 `agent.config`。任务 ID 用小写 ASCII 字母、数字或连字符，多组有重复编号时加需求前缀；记录与原始任务 ID 的对应。仓库有外部 worktree 根目录或分支前缀规范时，添加 `--worktree-root <path>` 或 `--branch-prefix <prefix>`。

以每个 `start` 返回的绝对 worktree 路径和 SHA 为准，全部基线一致且上下文可读才启动编码。后续阶段按 `ai-workflow/skills/common/task-delivery/SKILL.md` 走固定快照审查与提交，不手动绕过。
